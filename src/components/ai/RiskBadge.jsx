const LEVEL_STYLES = {
  critical: "bg-red-100 text-red-700 border border-red-200",
  high: "bg-orange-100 text-orange-700 border border-orange-200",
  medium: "bg-yellow-100 text-yellow-800 border border-yellow-200",
  low: "bg-blue-100 text-blue-700 border border-blue-200",
  pending: "bg-slate-100 text-slate-700 border border-slate-200",
  approved: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  rejected: "bg-rose-100 text-rose-700 border border-rose-200",
};

export const RiskBadge = ({ level = "medium", labelPrefix = "" }) => {
  const key = String(level || "medium").toLowerCase();
  const classes = LEVEL_STYLES[key] || LEVEL_STYLES.medium;

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${classes}`}>
      {labelPrefix ? `${labelPrefix} ` : ""}
      {key.replace(/_/g, " ")}
    </span>
  );
};
