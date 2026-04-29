# Admin Supabase Dashboard Audit

## 1. Routes found

- `/admin` -> `src/pages/Admin.tsx`, protected in `src/App.tsx` by `ProtectedRoute requireAdmin`.
- `/admin/ai-command-center` -> `src/pages/AiCommandCenter.jsx`, protected in `src/App.tsx` by `ProtectedRoute requireAdmin`.
- Admin navigation links are exposed from `src/components/Sidebar.tsx`.
- A direct demo-admin entry point exists in `src/pages/Login.tsx` (`Sign In As Demo Admin`).
- No separate admin route was found for recovered lessons needing review.
- No separate admin route was found for student-publish review state.

## 2. Components found

### Admin routes/pages

- `src/pages/Admin.tsx`
- `src/pages/AiCommandCenter.jsx`
- `src/components/ProtectedRoute.tsx`
- `src/components/Sidebar.tsx`

### `/admin` page sections/components

- Overview KPIs
- Table Health table
- Grade Coverage table
- Generation Queue KPIs
- Generation Queue by Grade table
- Recent Failed Jobs table
- RAG / Embeddings KPIs
- RAG Chunks by Grade table
- RAG chunk browser/actions
- Table Browser
- AI Analyst panel
- Queue in Command Center modal

### `/admin/ai-command-center` components

- `src/components/ai/IssueCard.jsx`
- `src/components/ai/ExecuteTaskModal.jsx`
- `src/components/ai/TaskStatusBoard.jsx`
- `src/components/ai/TaskLogViewer.jsx`
- `src/components/ai/ApprovalPanel.jsx`
- `src/components/ai/MonitoringRunPanel.jsx`
- `src/components/ai/IssuePatternPanel.jsx`
- `src/components/ai/RagHealthReportPanel.jsx`
- `src/components/ai/AgentBadge.jsx`
- `src/components/ai/RiskBadge.jsx`

## 3. Data source map

| Component | Displayed data | Current data source | Correct Supabase source | Status | Problem | Required fix |
| --- | --- | --- | --- | --- | --- | --- |
| Admin Overview / `Total Topics` | Topic count | `topics` count in `loadOverview()` (`src/pages/Admin.tsx`) | `public.topics` | accurate | This card is backed by Supabase and matches the current schema. | Keep. |
| Admin Overview / `Lessons Generated` | Distinct topic coverage from lessons | Distinct `lessons.topic_id` (`src/pages/Admin.tsx`) | If this means completed generation jobs, use `public.lesson_gen_queue where status = 'done'`. If it means recovered lessons pending review, use `public.lessons` with `teaching_contract`. | inaccurate | The card title suggests generation completion, but the query is actually lesson-row coverage. It does not reflect queue truth, recovery review state, or publish state. | Split this into separate metrics: coverage from `lessons`, completed jobs from `lesson_gen_queue`, and recovery review from `lessons.teaching_contract`. |
| Admin Overview / `Queue Pending` | Pending jobs | `lesson_gen_queue where status = 'pending'` | `public.lesson_gen_queue where status = 'pending'` | accurate | This matches the stated queue truth. | Keep. |
| Admin Overview / `Queue Failed` | Failed jobs | `lesson_gen_queue where status = 'failed'` | `public.lesson_gen_queue where status = 'failed'` | inaccurate | The read path matches the truth, but other code writes `retryable_failed` and `permanent_failed`, which makes this card drift after AI actions. | Stop inventing failed-like statuses or store retry classification outside `status`. |
| Admin Overview / `RAG Chunks` | Total chunks and embedded percent | `rag_chunks` count and `embedding_status = 'done'` | `public.rag_chunks` | accurate | This is Supabase-backed and matches the current schema. | Keep. |
| Admin Overview / `Users` | Profile count | `profiles` count | `public.profiles` | accurate | This card is straightforward and DB-backed. | Keep. |
| Admin Overview / `Table Health` | Row counts and table status | Hardcoded table-name array, per-table `count`, heuristic status thresholds (`>100 populated`, `>0 partial`) | Real schema tables from `information_schema` or a curated list of confirmed existing tables | inaccurate | The table list contains tables not found in current schema files (`rag_questions`, `audits`, `lesson_gen_log`, `topic_outlines`, `student_progress`, `student_answers`, `ghost_interventions`, `skills`, `user_skills`, `embeddings_archive`). It also conflates missing tables and RLS-denied tables as `unknown/no access`. | Replace hardcoded table names with schema introspection or a verified allowlist, and show `missing table` separately from `RLS denied`. |
| Grade Coverage table | Topics, lessons, queue counts by grade | `grades`, `topics`, `lessons`, `lesson_gen_queue` in `loadGrades()` | For queue truth: `public.lesson_gen_queue`. For recovery review: `public.lessons where teaching_contract->>'status' = 'needs_review'`. | inaccurate | It measures lesson coverage with `lessons.topic_id`, not completed jobs. Queue rows without `topic_id` are dropped from all grades. It does not represent recovered lessons needing review. | Separate grade coverage, queue completion, and recovery review metrics. Include a visible bucket for jobs missing `topic_id`. |
| Grade Coverage / `Bulk Queue` action | Bulk lesson generation per grade | `POST /api/admin/bulk-generate` | No route found in this repo | inaccurate | The UI calls an endpoint that does not exist in `api/`. | Remove until implemented, or add a protected server route. |
| Queue KPIs (`Done`, `Pending`, `Failed`, `Processing`) | Queue status totals | `lesson_gen_queue.status` folded into `{ done, pending, failed, processing }` | `public.lesson_gen_queue` | inaccurate | The UI silently ignores any queue status outside those four values. The same codebase also writes `retryable_failed` and `permanent_failed`, so totals can become wrong. | Restrict queue statuses to truth-backed values or make the UI enumerate all actual statuses. |
| `Generation Queue — by Grade` | Queue progress by grade | `gradeData` derived from grade topics and queue rows | `public.lesson_gen_queue` joined to `topics/grades`, plus a separate unresolved/missing-topic bucket | inaccurate | Jobs missing `topic_id` disappear completely. Progress is only for rows that can already be mapped to a grade. | Add a visible unresolved bucket and do not hide unmapped queue jobs. |
| `Recent Failed Jobs` table | Recent failed queue items | Top 10 `lesson_gen_queue` rows where `status = 'failed'` | `public.lesson_gen_queue where status = 'failed'` | inaccurate | It is partial by design (`limit 10`) and becomes misleading if unsupported statuses like `permanent_failed` are written elsewhere. | Label it clearly as `recent`, add filters/pagination, and keep queue status canonical. |
| Failed-job row actions (`Retry`, `Generate`, `Delete`) | Per-job admin mutations | `POST /api/admin/retry-job`, `/delete-job`, `/generate-lesson` | No routes found in this repo | inaccurate | These actions are not backed by existing server code. | Remove or implement protected endpoints before relying on them. |
| RAG KPIs / `RAG Questions` | QA pair count | `rag_questions` count in `loadRag()` | Only if `public.rag_questions` really exists | inaccurate | No `rag_questions` table definition was found in current schema/migrations. | Remove the card or add the table and migration explicitly. |
| `RAG Chunks — by Grade` | Chunk totals, embedded totals, pending totals | `rag_chunks` grouped client-side by `grade_id` | `public.rag_chunks` | inaccurate | The UI assumes anything not `done` is `pending`, which collapses any other embedding status into pending. | Group by actual status values instead of `total - done`. |
| RAG chunk browser | First 100 chunks for a grade | `rag_chunks where grade_id = ? limit 100` | `public.rag_chunks` | inaccurate | The browser is sampled, not complete, and only exposes `id, content, embedding_status, source_url`, which is not enough for safe lesson-recovery decisions. | Add pagination and include lesson/topic linkage fields when reviewing recovery readiness. |
| RAG chunk actions (`Repair`, `Re-embed`, `Delete`) | Chunk mutations | `POST /api/admin/repair-chunk`, `/re-embed-chunk`, `/delete-chunk` | No routes found in this repo | inaccurate | These buttons are not backed by any server routes in `api/`. | Remove or implement protected endpoints. |
| `Table Browser` | Arbitrary table rows | Raw client `select('*').limit(browseLimit)` over selected table | Real admin-safe inspection endpoints or server-side browsing with schema validation | inaccurate | It depends on the same hardcoded table list, can target non-existent tables, and is limited by client RLS/permissions rather than a clear admin contract. | Replace with a protected server browser tied to a verified table allowlist. |
| Table Browser `Save` / `Delete` | Arbitrary row mutation | `POST /api/admin/update-row` and `/api/admin/delete-row` | No routes found in this repo | inaccurate | The endpoints do not exist. The helper also sends no bearer token. | Remove until protected server routes exist and require admin auth. |
| Admin `AI Analyst` input snapshot | Metrics sent to `/api/ai-analyst` | Live state from `/admin`, plus hardcoded heuristics and top-15 `tableHealth` slice | Failed jobs from `public.lesson_gen_queue`, recovered review state from `public.lessons.teaching_contract`, AI recovery tasks from `public.ai_tasks where target_area = 'lesson_generation'`, review status from `ai_tasks.result->>'review_status'` | inaccurate | The snapshot has no recovered-lesson review metrics, no publishability metrics, no AI recovery review metrics, and includes heuristic table-health strings. | Redefine the analyst payload around the recovery workflow truth before using it for automation. |
| Admin `AI Analyst / Retry Failed` | Reset all failed jobs | `/api/ai-analyst` `retry_failed` branch updates all `lesson_gen_queue` failed rows | `public.lesson_gen_queue where status = 'failed'` only, behind admin auth | inaccurate | The mutation endpoint is unauthenticated, global, and not scoped to a selected issue or workflow. | Remove the mutation from this endpoint or protect it with `requireAiAdmin` and a dedicated admin route. |
| Admin `AI Analyst / Send to Command Center` | Create issue/task from LLM suggestion | `createCommandCenterTaskFromAnalystTask()` in client service | `public.ai_tasks where target_area = 'lesson_generation'`, with review state stored in `result->>'review_status'` | inaccurate | Target areas are inferred as `lessons`, `topics`, `rag_chunks`, etc. There is no `lesson_generation` target area and no `result` review-state model. | Add canonical `lesson_generation` task scope and persist review state in the required JSON field. |
| AI Command Center / `Open issues` | Open issue count | `issues.filter(issue.status === 'open')` | Unresolved issue states, or a dedicated queue/recovery truth query | inaccurate | It excludes active non-open states like `planning`, `auditing`, `waiting_approval`, `running`, and `blocked`, so the card undercounts live issues. | Count unresolved states, not only `open`. |
| AI Command Center / `Waiting approval` | Tasks waiting approval | `tasks.filter(status === 'waiting_approval')` | `public.ai_tasks where status = 'waiting_approval'` | accurate | This card matches its label. | Keep. |
| AI Command Center / `AI crew tasks` | Total task count | `ai_tasks` list length | `public.ai_tasks` | accurate | This is a simple table-backed total. | Keep. |
| AI Command Center / `Completed tasks` | Completed task count | `tasks.filter(status === 'completed')` | `public.ai_tasks where status = 'completed'` | accurate | This card matches its label. | Keep. |
| `Issue Dashboard` | AI issues ready for execution | `ai_issues`, plus latest related task | For AI ops: `public.ai_issues`; for lesson recovery truth: queue + lessons + ai_tasks recovery scope | inaccurate | It is not a direct view of failed jobs or recovered lessons; it is a second-order issue registry created by sampled monitoring logic. | Keep as AI ops metadata, but do not treat it as recovery ground truth. |
| `Task Status Board` | Task lanes and progress | `ai_tasks`, but `latestLogMessage` is only real for the currently selected task | `public.ai_tasks` + latest row from `public.ai_task_logs` for every task | inaccurate | Unselected tasks show `instructions`, not the real latest log. The UI lanes also omit `permanent_failed`, even though the enum includes it. | Join latest log per task and add every real enum status lane or remove unused enum values. |
| `Monitoring Runs` panel | Recent monitoring runs | `ai_monitoring_runs` | `public.ai_monitoring_runs` | inaccurate | The panel is backed by Supabase, but the monitoring data itself is sampled (`lesson_gen_queue limit 500`, `lessons limit 500`) rather than complete. | Either make the sweep complete or clearly label it as sampled. |
| `Issue Patterns` panel | Recurrent issue signatures | `ai_issue_patterns` | `public.ai_issue_patterns` | accurate | This panel matches its backing table. | Keep. |
| `RAG Health` panel | Latest RAG reports | `ai_rag_health_reports` | `public.ai_rag_health_reports` | inaccurate | Reports are persisted correctly, but the underlying diagnostic only samples up to 500 chunks and uses heuristic relevance scoring. | Use complete diagnostics or label the report as sampled/heuristic. |
| `TaskLogViewer` / `ApprovalPanel` | Task logs and approval state | `ai_task_logs` and `ai_task_approvals` | `public.ai_task_logs`, `public.ai_task_approvals`, plus recovery review state from `ai_tasks.result->>'review_status'` | inaccurate | These panels show execution/approval metadata, but there is no required recovery-review field in `ai_tasks.result`. | Add the required `result.review_status` model and surface it explicitly. |
| Missing recovered-lessons review surface | Lessons needing review and student-publish readiness | No component or route found | `public.lessons where teaching_contract->>'status' = 'needs_review'`; student-visible subset must also require `teaching_contract->>'student_publish_allowed' = 'true'` | inaccurate | The admin dashboard has no dedicated Supabase-backed surface for the core recovery review workflow. | Add a dedicated recovered-lessons review dashboard before building automation. |

## 4. Hardcoded or dummy logic

- `src/context/AuthContext.tsx` creates a `dummyAdminUser` and `dummyAdminProfile`, and trusts `localStorage['demo_admin_logged_in']`.
- `src/pages/Login.tsx` exposes `Sign In As Demo Admin`, which navigates straight to `/admin`.
- `src/pages/Admin.tsx` hardcodes `Table Health` status thresholds: `>100 => populated`, `>0 => partial`, else `empty`.
- `src/pages/Admin.tsx` slices `tableHealth` to the first 15 tables before sending it to the AI Analyst.
- `src/pages/Admin.tsx` limits failed jobs to 10 rows.
- `src/pages/Admin.tsx` limits RAG chunk browsing to 100 rows.
- `api/_lib/aiCommandCenter.ts` limits RAG diagnostics to 500 chunks.
- `api/_lib/aiCommandCenter.ts` limits audit sampling to 300 queue rows, 300 lessons, and 300 topics.
- `api/_lib/aiCommandCenter.ts` limits monitoring sampling to 500 queue rows and 500 lessons, and only stores top-10 sample ids/groups in evidence.
- `src/pages/AiCommandCenter.jsx` refreshes every 8 seconds and uses `task.instructions` as a fallback for latest task activity, which is not the same as the latest task log.
- `src/db/supabase.ts` builds a dummy Supabase client that tries `/api/supabase/proxy` and `/api/health`, but those routes were not found in this repo.
- `src/components/ConnectionStatusModal.tsx` tells the user to run `supabase-schema.sql`, even though the current admin/AI schema now also depends on later migrations under `supabase/migrations/`.
- `api/ai-analyst.ts` contains a hardcoded fallback NVIDIA API key.

## 5. Incorrect schema assumptions

- AI recovery tasks are required to live in `public.ai_tasks` with `target_area = 'lesson_generation'`, but the current UI/service only uses `lessons`, `topics`, `rag_chunks`, `profiles`, `onboarding`, and `supabase_schema`.
- The required review state is `ai_tasks.result->>'review_status'`, but the current schema/service does not use a `result` JSON field. The migration adds `input_data`, `output_data`, and `error_data` instead.
- No route or component was found that queries recovered lessons from `public.lessons where teaching_contract->>'status' = 'needs_review'`.
- No route or component was found that enforces `teaching_contract->>'student_publish_allowed' = 'true'` for student-visible recovered lessons.
- Monitoring and execution code treats `retryable_failed` and `permanent_failed` as lesson queue statuses, but your source-of-truth contract only defines failed jobs as `public.lesson_gen_queue where status = 'failed'`.
- `api/ai-execute-task.ts` mutates `lesson_gen_queue.status` to `permanent_failed`, which is outside the stated truth model.
- `src/pages/Admin.tsx` queries `rag_questions`, but no table definition for `public.rag_questions` was found in the current schema/migrations.
- `src/pages/Admin.tsx` assumes many tables exist for `Table Health`, but no current definitions were found for `audits`, `lesson_gen_log`, `topic_outlines`, `student_progress`, `student_answers`, `ghost_interventions`, `skills`, `user_skills`, `embeddings_archive`, and `rag_questions`.
- `api/_lib/aiCommandCenter.ts` creates monitoring issues with `affected_area: 'lessons'` for failed lesson generation jobs, which does not match the required `lesson_generation` task scope.
- `api/_lib/aiCommandCenter.ts` validation reads `issue.evidence.failedJobs` (camelCase), but monitoring writes `failed_jobs` (snake_case). That breaks the before/after comparison.
- `src/components/ai/TaskStatusBoard.jsx` and `src/services/aiCommandCenterService.js` omit `permanent_failed` from displayed task statuses even though `public.ai_task_status` includes it.
- Search found no references to `public.lesson_generation_jobs`. This specific wrong table name does not appear in the current codebase.
- Search found no use of `ai_tasks.status = 'needs_review'`. This specific wrong status check does not appear in the current codebase.

## 6. Security issues

- `api/ai-analyst.ts` has no admin/auth check, but its `retry_failed` branch updates `lesson_gen_queue`. This is the most serious issue in the current admin stack.
- `api/ai-analyst.ts` contains a hardcoded fallback NVIDIA API key, and the file comment says a key is also committed in `.env`.
- `src/context/AuthContext.tsx` and `src/pages/Login.tsx` allow fake admin access through `localStorage` and the demo-admin button. That makes admin pages client-accessible without real server identity.
- `src/components/ProtectedRoute.tsx` trusts the client-side `isAdmin` flag, which can be satisfied by the fake demo-admin profile.
- `src/pages/Admin.tsx` mutation actions call `/api/admin/*` without attaching an auth bearer token. Those routes do not exist now, but if added in the same pattern they would be unsafe by default.
- `src/services/aiCommandCenterService.js` performs direct browser-side inserts/updates into `ai_issues`, `ai_tasks`, `ai_task_logs`, and `ai_execution_snapshots`. RLS may protect these tables, but privileged admin writes are still originating from the browser.
- `api/_lib/aiCommandCenter.ts` and `api/ai-analyst.ts` fall back from service-role credentials to anon/VITE credentials, which can silently change privilege behavior and make server logic harder to reason about safely.
- No direct exposure of `SUPABASE_SERVICE_ROLE_KEY` was found in `src/` client bundle code.

## 7. Required fixes before automation

### Critical

- Remove or hard-disable demo-admin mode outside explicit local development. Do not trust `localStorage` as admin proof.
- Protect `/api/ai-analyst` with the same admin auth guard used by the AI Command Center, or split mutations into a dedicated protected endpoint.
- Define one canonical recovery truth model and wire the dashboard to it:
  - Failed jobs: `public.lesson_gen_queue where status = 'failed'`
  - Completed jobs: `public.lesson_gen_queue where status = 'done'`
  - Recovered lessons needing review: `public.lessons where teaching_contract->>'status' = 'needs_review'`
  - Student-visible recovered lessons: also require `teaching_contract->>'student_publish_allowed' = 'true'`
  - AI recovery tasks: `public.ai_tasks where target_area = 'lesson_generation'`
  - Review status: `ai_tasks.result->>'review_status'`
- Stop writing unsupported queue statuses like `retryable_failed` and `permanent_failed` unless the source-of-truth contract is intentionally changed first.
- Add a real recovered-lessons review dashboard before building automation. It does not exist today.

### High

- Replace the hardcoded `Table Health` list with confirmed schema introspection or a curated allowlist of real tables.
- Remove or implement the broken `/api/admin/*`, `/api/supabase/proxy`, and `/api/health` dependencies.
- Fix AI task scope so recovery work uses `target_area = 'lesson_generation'`.
- Add a `result` JSON field or equivalent canonical structure and store review status there as required.
- Fix validation baseline drift (`failedJobs` vs `failed_jobs`).
- Update the Task Status Board to use real latest logs for every task and to cover every real enum status.

### Medium

- Decide whether `Lessons Generated` means:
  - lesson-row coverage in `lessons`
  - completed queue work in `lesson_gen_queue`
  - recovered lessons awaiting review
  Then name and query each metric explicitly.
- Make queue/monitoring/audit views complete instead of sampled, or label them as sampled.
- Add explicit UI for lessons missing `topic_id` so they do not disappear from grade/queue views.
- Remove or fix the `rag_questions` KPI until that table truly exists.
- Distinguish `missing table`, `RLS denied`, and `0 rows` in admin diagnostics.

### Low

- Align `supabase-schema.sql` and connection-help text with the newer migration-based schema.
- Remove heuristic status labels like `>100 => populated` unless they are clearly marked as UI-only heuristics.
- Audit old admin copy so it does not imply "live system truth" where the code is only showing sampled or derived state.

## 8. Fix Notes (2026-04-28)

- Fixed admin overview KPIs to use canonical Supabase sources for completed jobs, failed jobs, pending jobs, recovered lessons needing review, and student-publish-ready recovered lessons.
- Fixed recovered lesson review logic to use `public.lessons where teaching_contract->>'status' = 'needs_review'`.
- Fixed student publish readiness logic to use `teaching_contract->>'student_publish_allowed' = 'true'`.
- Added reusable admin dashboard query helpers so the page no longer hand-builds queue, grade, and RAG metrics inline.
- Removed the misleading `Lessons Generated` overview card and replaced it with `Completed Jobs` backed by `public.lesson_gen_queue where status = 'done'`.
- Removed the unsupported `rag_questions` KPI from the admin dashboard and replaced it with real `rag_chunks` status totals.
- Updated queue KPIs to surface non-canonical statuses and missing `topic_id` rows instead of silently dropping them.
- Relabeled the failed-job table as a recent sample from `public.lesson_gen_queue` and kept it read-only.
- Removed broken admin mutation controls from the main dashboard UI for queue, RAG chunk, and analyst workflow actions so the page stays focused on read-only accuracy.
- Updated table health to use a curated set of confirmed admin tables and to distinguish `missing table` from `restricted`.
- Added explicit dashboard error handling for missing / invalid Supabase configuration so the admin page does not rely on dummy fallback behavior for its metrics.
- Kept the admin dashboard read-only by isolating dormant write/modification flows and surfacing Supabase-backed inspection only.
- Updated student-facing lesson reads to keep recovered lessons blocked unless `student_publish_allowed` is true.
- Normalized lesson block type presentation in the UI to the allowed set: `text`, `example`, `formula`, `summary`.
