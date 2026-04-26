import { Ban, CheckCircle2, ShieldAlert } from "lucide-react";
import { RiskBadge } from "./RiskBadge";

export const ApprovalPanel = ({ task, approval, onApprove, onReject, busy }) => {
  if (!task) {
    return (
      <section className="rounded-[28px] border border-surface-mid bg-paper p-5">
        <div className="rounded-3xl border border-dashed border-surface-mid p-6 text-sm text-ink-muted">
          Select a task to inspect its approval gate.
        </div>
      </section>
    );
  }

  if (!approval) {
    return (
      <section className="rounded-[28px] border border-surface-mid bg-paper p-5">
        <div className="flex items-start gap-3 rounded-3xl bg-surface-low/70 p-5">
          <ShieldAlert className="mt-0.5 h-5 w-5 text-ink-muted" />
          <div>
            <p className="text-sm font-semibold text-ink">No approval request on file</p>
            <p className="mt-2 text-sm text-ink-secondary">
              Read-only audits do not require approval. If this task should write to the database, create or refresh the task plan first.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[28px] border border-surface-mid bg-paper p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-muted">Approval Gate</p>
          <h3 className="mt-2 text-lg font-bold text-ink">Controlled write execution</h3>
        </div>
        <RiskBadge level={approval.risk_level || approval.status} labelPrefix={approval.status} />
      </div>

      <div className="space-y-4">
        <div className="rounded-3xl bg-surface-low/75 p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-muted">Proposed Action</p>
          <p className="mt-2 text-sm text-ink-secondary">{approval.proposed_action}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-surface-mid p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-muted">Affected Records</p>
            <p className="mt-2 text-sm font-semibold text-ink">{approval.affected_records ?? "Pending audit estimate"}</p>
          </div>
          <div className="rounded-3xl border border-surface-mid p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-muted">Rollback Plan</p>
            <p className="mt-2 text-sm text-ink-secondary">{approval.rollback_plan || "Restore the latest execution snapshot and re-run validation."}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-surface-mid p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-muted">Generated SQL Preview</p>
          <pre className="mt-3 overflow-x-auto rounded-2xl bg-gray-950 p-4 font-mono text-xs text-slate-100">
            {approval.sql_preview || "-- Read-only diagnostic path. No write SQL preview required."}
          </pre>
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <button
            onClick={onReject}
            disabled={busy || approval.status !== "pending"}
            className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
          >
            <Ban className="h-4 w-4" />
            Reject
          </button>
          <button
            onClick={onApprove}
            disabled={busy || approval.status !== "pending"}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            Approve
          </button>
        </div>
      </div>
    </section>
  );
};
