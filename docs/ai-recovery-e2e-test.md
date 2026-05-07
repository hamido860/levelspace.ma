# AI Recovery E2E Test

Date: 2026-04-29

## Summary

This verification pass did **not** complete a true live end-to-end AI Recovery workflow against a real failed `lesson_gen_queue` job from the running app UI.

The main environment blockers were:

- The in-app browser runtime was not exposed in this session, so `/admin/ai-recovery` could not be exercised visually.
- The checked-in local dev entrypoint [server.ts](C:/Users/pc/Documents/Levelspace.ma/levelspace.ma/server.ts:1) is empty, so `npm run dev` is not a usable local runtime for the app/API.
- No server-side Supabase credentials were present in the shell environment:
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_URL`
  - `SUPABASE_DB_URL`
  - `DATABASE_URL`
  - `POSTGRES_URL`
- Live read-only Supabase probing with the anon key failed with `TypeError: fetch failed`, so a real failed queue job could not be discovered from this environment.

Because of those blockers, the results below separate:

- `Verified`: confirmed in this environment
- `Blocked`: could not be truthfully executed here
- `Not verified`: dependent on blocked steps

## Verified Checks

### Build

- `npm run build` passed on 2026-04-29.

### Admin route protection

- Direct invocation of [api/admin/ai-recovery/logs.ts](C:/Users/pc/Documents/Levelspace.ma/levelspace.ma/api/admin/ai-recovery/logs.ts:1) without authentication returned:
  - HTTP `401`
  - body: `Authentication required.`

This verifies the admin logs route is not public.

### Student visibility guard

Direct runtime checks of [isStudentVisibleLesson](C:/Users/pc/Documents/Levelspace.ma/levelspace.ma/src/services/lessonRecovery.ts:48) returned:

- legacy lesson with `teaching_contract = null` -> visible: `true`
- legacy lesson with empty `{}` contract -> visible: `true`
- recovered lesson with `status = needs_review` and `student_publish_allowed = false` -> visible: `false`
- recovered lesson with `status = approved` and `student_publish_allowed = true` -> visible: `true`
- recovered lesson with `status = rejected` and `student_publish_allowed = false` -> visible: `false`
- non-empty contract without `student_publish_allowed` -> visible: `false`

This confirms the intended safe behavior:

- normal legacy lessons stay visible
- unapproved recovered lessons stay hidden
- approved recovered lessons can become visible

### Route presence in client app

The following admin routes are present in [src/App.tsx](C:/Users/pc/Documents/Levelspace.ma/levelspace.ma/src/App.tsx:1):

- `/admin/ai-recovery`
- `/admin/ai-recovery/failed-jobs`
- `/admin/ai-recovery/ai-tasks`
- `/admin/ai-recovery/ai-tasks/:taskId`
- `/admin/ai-recovery/recovered-lessons`
- `/admin/ai-recovery/recovered-lessons/:lessonId`
- `/admin/ai-recovery/logs`

## Step-by-Step Test Results

1. Open `/admin/ai-recovery`
   - Blocked
   - In-app browser runtime unavailable in this session.

2. Confirm dashboard counts load
   - Blocked
   - Could not open the page, and live Supabase probing failed.

3. Open Failed Jobs
   - Blocked

4. Select one failed job
   - Blocked
   - No live failed job could be fetched from this environment.

5. View diagnostics
   - Blocked

6. Create AI task
   - Blocked
   - Admin APIs require service-role-backed Supabase access server-side; that configuration was missing.

7. Open AI task
   - Blocked

8. Generate Repair SQL
   - Blocked

9. Run safety check
   - Blocked

10. Execute approved SQL
    - Blocked
    - No DB execution URL was configured in the shell environment.

11. Confirm queue job becomes done
    - Not verified

12. Confirm ai_task becomes completed
    - Not verified

13. Confirm recovered lesson appears in Recovered Lessons
    - Not verified

14. Confirm lesson has `teaching_contract.status = needs_review`
    - Not verified live
    - Verified by implementation review in the recovery SQL and recovered lesson review flow.

15. Confirm `student_publish_allowed = false`
    - Not verified live
    - Verified by implementation review and runtime visibility helper checks.

16. Confirm student-facing lesson pages do not show it
    - Partially verified
    - Verified by runtime helper checks and code-path review in:
      - [src/services/lessonRecovery.ts](C:/Users/pc/Documents/Levelspace.ma/levelspace.ma/src/services/lessonRecovery.ts:1)
      - [src/pages/ClassroomView.tsx](C:/Users/pc/Documents/Levelspace.ma/levelspace.ma/src/pages/ClassroomView.tsx:105)
      - [src/pages/LessonView.tsx](C:/Users/pc/Documents/Levelspace.ma/levelspace.ma/src/pages/LessonView.tsx:337)
      - [src/pages/Dashboard.tsx](C:/Users/pc/Documents/Levelspace.ma/levelspace.ma/src/pages/Dashboard.tsx:94)
    - Not verified against a live recovered lesson row.

17. Approve recovered lesson
    - Blocked

18. Confirm `student_publish_allowed = true`
    - Not verified live
    - Verified by implementation review in the recovered lesson approval path.

19. Confirm student-facing pages can show it
    - Partially verified
    - Verified by runtime helper checks for approved recovered lessons.
    - Not verified against a live approved recovered lesson row.

20. Check logs
    - Partially verified
    - Logs route exists and is admin-protected.
    - Live recovery event stream could not be fetched without a valid admin session and server-side Supabase credentials.

## Acceptance Criteria Status

### Full flow works

- Blocked
- A truthful live E2E confirmation was not possible in this environment.

### No duplicate lesson created

- Not verified
- Requires a real executed recovery flow.

### No unapproved lesson is visible to students

- Partially verified
- Confirmed in runtime visibility logic and student-facing code paths.
- Not verified against a live recovered lesson record.

### Logs exist

- Partially verified
- Logging implementation and admin logs route are present.
- Unauthenticated access is blocked with `401`.
- Live event retrieval was not verified.

### Admin-only protection works

- Partially verified
- Confirmed on the logs route with unauthenticated `401`.
- Non-admin authenticated user flow was not verified because no non-admin session/token was available.

## Recommended Next Step

To complete a real end-to-end AI Recovery workflow test, rerun this checklist in an environment that has:

- a working browser runtime for local UI testing
- a non-empty local/dev server entrypoint
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`
- one of `SUPABASE_DB_URL`, `DATABASE_URL`, or `POSTGRES_URL`
- a real admin user session
- at least one real `lesson_gen_queue` row with `status = 'failed'`
