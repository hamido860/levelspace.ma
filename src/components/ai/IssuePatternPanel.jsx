import { BrainCircuit, ShieldAlert, Wrench } from "lucide-react";
import { RiskBadge } from "./RiskBadge";

export const IssuePatternPanel = ({ patterns }) => {
  return (
    <section className="rounded-[28px] border border-surface-mid bg-paper p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-muted">Issue Patterns</p>
          <h3 className="mt-2 text-lg font-bold text-ink">Recurring signatures</h3>
        </div>
        <BrainCircuit className="h-5 w-5 text-ink-muted" />
      </div>

      {patterns.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-surface-mid p-5 text-sm text-ink-muted">
          No recurring issue patterns recorded yet.
        </div>
      ) : (
        <div className="space-y-3">
          {patterns.map((pattern) => (
            <article key={pattern.id} className="rounded-[24px] border border-surface-mid bg-surface-low/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">{pattern.affected_area}</p>
                  <p className="mt-1 text-xs text-ink-muted">{pattern.error_signature}</p>
                </div>
                <RiskBadge level={pattern.risk_level} />
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-ink-secondary">
                <ShieldAlert className="h-4 w-4" />
                Seen {pattern.frequency} time{pattern.frequency === 1 ? "" : "s"}
              </div>
              <div className="mt-2 flex items-start gap-2 text-xs text-ink-secondary">
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
