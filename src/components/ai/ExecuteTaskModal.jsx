import { useEffect, useState } from "react";
import { AlertTriangle, ShieldCheck, Sparkles } from "lucide-react";
import { Modal } from "../Modal";
import {
  AI_COMMAND_CENTER_AGENTS,
  EXECUTION_MODE_OPTIONS,
  PRIORITY_OPTIONS,
  SAFETY_LEVEL_OPTIONS,
  TARGET_AREA_OPTIONS,
} from "../../services/aiCommandCenterService";
import { AgentBadge } from "./AgentBadge";
import { RiskBadge } from "./RiskBadge";

const areaFromIssue = (issue) => {
  const area = issue?.affected_area || "lessons";
  if (["lessons", "topics", "rag_chunks", "profiles", "onboarding", "supabase_schema"].includes(area)) {
    return area;
  }
  if (area === "RAG") return "rag_chunks";
  if (area === "Supabase") return "supabase_schema";
  return "lessons";
};

const defaultTaskType = (issue) => {
  if (!issue) return "fix";
  return issue.issue_type || "fix";
};

const buildDefaults = (issue) => {
  const priority = issue?.severity || "high";
  const executionMode = priority === "critical" ? "execute_with_approval" : "execute_with_approval";
  const targetArea = areaFromIssue(issue);
  const readOnlyAudit = issue?.issue_type === "audit";
  return {
    task_name: issue ? `Resolve: ${issue.title}` : "Resolve AI issue",
    task_type: defaultTaskType(issue),
    priority,
    assigned_agent: "Planner Agent",
    execution_mode: executionMode,
    safety_level: readOnlyAudit ? "read_only" : "destructive_blocked",
    target_area: targetArea,
    instructions: issue?.suggested_action || "",
    requires_approval: !readOnlyAudit,
  };
};

export const ExecuteTaskModal = ({
  issue,
  open,
  busy,
  onClose,
  onCreateTask,
  onRunAudit,
}) => {
  const [form, setForm] = useState(buildDefaults(issue));

  useEffect(() => {
    setForm(buildDefaults(issue));
  }, [issue]);

  const forceApproval = form.safety_level !== "read_only" && form.target_area !== "topics" ? form.requires_approval || form.execution_mode !== "dry_run" : form.requires_approval;
  const destructiveBlocked = form.safety_level === "destructive_blocked";

  const updateField = (field, value) => {
    setForm((current) => {
      const next = { ...current, [field]: value };

      if (field === "execution_mode" && value === "execute") {
        next.requires_approval = next.safety_level !== "read_only";
      }

      if (field === "safety_level" && value === "read_only") {
        next.requires_approval = false;
        next.execution_mode = "dry_run";
      }

      if (field === "safety_level" && value !== "read_only" && next.execution_mode === "dry_run") {
        next.execution_mode = "execute_with_approval";
        next.requires_approval = true;
      }

      if (field === "target_area" && ["profiles", "onboarding", "supabase_schema", "lessons", "rag_chunks"].includes(value)) {
        next.requires_approval = true;
      }

      return next;
    });
  };

  const submit = async (mode) => {
    const payload = {
      issue_id: issue.id,
      ...form,
      requires_approval: forceApproval,
    };

    if (mode === "audit") {
      await onRunAudit(payload);
      return;
    }

    await onCreateTask(payload);
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Execute AI Task" maxWidth="4xl">
      <div className="space-y-6">
        <div className="rounded-[28px] bg-gradient-to-br from-gray-950 via-gray-900 to-slate-800 p-5 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <RiskBadge level={issue?.severity} />
                <span className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/80">
                  {issue?.issue_type}
                </span>
              </div>
              <div>
                <p className="text-xs font-medium text-white/70">Issue</p>
                <h3 className="mt-2 text-2xl font-bold">{issue?.title}</h3>
                <p className="mt-2 max-w-2xl text-sm text-white/70">{issue?.impact}</p>
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-medium text-white/70">Assigned Agent</p>
              <div className="mt-3">
                <AgentBadge agent={form.assigned_agent} />
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="ls-micro-label">Task Name</span>
                <input
                  value={form.task_name}
                  onChange={(event) => updateField("task_name", event.target.value)}
                  className="ls-field"
                />
              </label>

              <label className="space-y-2">
                <span className="ls-micro-label">Task Type</span>
                <input
                  value={form.task_type}
                  onChange={(event) => updateField("task_type", event.target.value)}
                  className="ls-field"
                />
              </label>

              <label className="space-y-2">
                <span className="ls-micro-label">Priority</span>
                <select
                  value={form.priority}
                  onChange={(event) => updateField("priority", event.target.value)}
                  className="ls-field"
                >
                  {PRIORITY_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="ls-micro-label">Assigned Agent</span>
                <select
                  value={form.assigned_agent}
                  onChange={(event) => updateField("assigned_agent", event.target.value)}
                  className="ls-field"
                >
                  {AI_COMMAND_CENTER_AGENTS.map((agent) => (
                    <option key={agent} value={agent}>{agent}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-2">
                <span className="ls-micro-label">Execution Mode</span>
                <select
                  value={form.execution_mode}
                  onChange={(event) => updateField("execution_mode", event.target.value)}
                  className="ls-field"
                >
                  {EXECUTION_MODE_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="ls-micro-label">Safety Level</span>
                <select
                  value={form.safety_level}
                  onChange={(event) => updateField("safety_level", event.target.value)}
                  className="ls-field"
                >
                  {SAFETY_LEVEL_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="ls-micro-label">Target Area</span>
                <select
                  value={form.target_area}
                  onChange={(event) => updateField("target_area", event.target.value)}
                  className="ls-field"
                >
                  {TARGET_AREA_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="space-y-2">
              <span className="ls-micro-label">Instructions</span>
              <textarea
                rows={6}
                value={form.instructions}
                onChange={(event) => updateField("instructions", event.target.value)}
                className="ls-field min-h-36"
                placeholder="Describe the root cause checks, rollback requirements, and validation criteria."
              />
            </label>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-5 w-5 text-accent" />
                <div>
                  <p className="text-sm font-semibold text-ink">Guardrail Summary</p>
                  <ul className="mt-3 space-y-2 text-sm text-ink-secondary">
                    <li>Critical issues default to `execute_with_approval`.</li>
                    <li>Database writes always require approval.</li>
                    <li>Destructive actions remain blocked unless explicitly enabled by an admin path.</li>
                    <li>No RAG, no generation. No topic_id, no lesson.</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-start gap-3">
                {destructiveBlocked ? (
                  <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600" />
                ) : (
                  <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-600" />
                )}
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-ink">
                    {destructiveBlocked ? "Destructive actions are blocked" : "Approval and audit gates enabled"}
                  </p>
                  <label className="flex items-center gap-3 text-sm text-ink-secondary">
                    <input
                      type="checkbox"
                      checked={forceApproval}
                      onChange={(event) => updateField("requires_approval", event.target.checked)}
                      disabled={form.safety_level === "read_only" ? false : true}
                      className="h-4 w-4 rounded border-slate-300 text-slate-950"
                    />
                    Require approval before writes
                  </label>
                  <p className="text-xs text-ink-muted">
                    Read-only audits skip approval. Bulk updates and any SQL preview with destructive keywords stay blocked by default.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-5">
          <button
            onClick={onClose}
            disabled={busy}
            className="ls-button-secondary disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => submit("audit")}
            disabled={busy}
            className="ls-button-secondary disabled:opacity-50"
          >
            Run Audit
          </button>
          <button
            onClick={() => submit("create")}
            disabled={busy}
            className="ls-button-primary disabled:opacity-50"
          >
            Create Task
          </button>
        </div>
      </div>
    </Modal>
  );
};
