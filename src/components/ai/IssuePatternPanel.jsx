import { BrainCircuit, ShieldAlert, Wrench } from "lucide-react";
import { RiskBadge } from "./RiskBadge";

export const IssuePatternPanel = ({ patterns }) => {
  return (
    <section className="ls-card-pad">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="ls-micro-label">Issue Patterns</p>
          <h3 className="mt-2 ls-card-title">Recurring signatures</h3>
        </div>
        <BrainCircuit className="h-5 w-5 text-slate-500" />
      </div>

      {patterns.length === 0 ? (
        <div className="ls-empty-state p-5">
          No recurring issue patterns recorded yet.
        </div>
      ) : (
        <div className="space-y-3">
          {patterns.map((pattern) => (
            <article key={pattern.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">{pattern.affected_area}</p>
                  <p className="mt-1 text-xs text-slate-500">{pattern.error_signature}</p>
                </div>
                <RiskBadge level={pattern.risk_level} />
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
                <ShieldAlert className="h-4 w-4" />
                Seen {pattern.frequency} time{pattern.frequency === 1 ? "" : "s"}
              </div>
              <div className="mt-2 flex items-start gap-2 text-xs text-slate-600">
                <Wrench className="mt-0.5 h-4 w-4" />
                <span>{pattern.known_fix || "No remediation note yet."}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};
