import { Ban, CheckCircle2, ShieldAlert } from "lucide-react";
import { RiskBadge } from "./RiskBadge";

export const ApprovalPanel = ({ task, approval, onApprove, onReject, busy }) => {
  if (!task) {
    return (
      <section className="ls-card-pad">
        <div className="ls-empty-state">
          Select a task to inspect its approval gate.
        </div>
      </section>
    );
  }

  if (!approval) {
    return (
      <section className="ls-card-pad">
        <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-5">
          <ShieldAlert className="mt-0.5 h-5 w-5 text-slate-500" />
          <div>
            <p className="text-sm font-semibold text-slate-950">No approval request on file</p>
            <p className="mt-2 text-sm text-slate-600">
              Read-only audits do not require approval. If this task should write to the database, create or refresh the task plan first.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="ls-card-pad">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="ls-micro-label">Approval Gate</p>
          <h3 className="mt-2 ls-card-title">Controlled write execution</h3>
        </div>
        <RiskBadge level={approval.risk_level || approval.status} labelPrefix={approval.status} />
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="ls-micro-label">Proposed Action</p>
          <p className="mt-2 text-sm text-slate-600">{approval.proposed_action}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="ls-micro-label">Affected Records</p>
            <p className="mt-2 text-sm font-semibold text-slate-950">{approval.affected_records ?? "Pending audit estimate"}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="ls-micro-label">Rollback Plan</p>
            <p className="mt-2 text-sm text-slate-600">{approval.rollback_plan || "Restore the latest execution snapshot and re-run validation."}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="ls-micro-label">Generated SQL Preview</p>
          <pre className="mt-3 overflow-x-auto rounded-2xl bg-gray-950 p-4 font-mono text-xs text-slate-100">
            {approval.sql_preview || "-- Read-only diagnostic path. No write SQL preview required."}
          </pre>
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <button
            onClick={onReject}
            disabled={busy || approval.status !== "pending"}
            className="inline-flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
          >
            <Ban className="h-4 w-4" />
            Reject
          </button>
          <button
            onClick={onApprove}
            disabled={busy || approval.status !== "pending"}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            Approve
          </button>
        </div>
      </div>
    </section>
  );
};
