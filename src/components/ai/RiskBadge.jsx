const LEVEL_STYLES = {
  critical: "bg-red-50 text-red-700",
  high: "bg-orange-50 text-orange-700",
  medium: "bg-yellow-50 text-yellow-800",
  low: "bg-blue-50 text-blue-700",
  pending: "bg-slate-100 text-slate-600",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-rose-50 text-rose-700",
};

export const RiskBadge = ({ level = "medium", labelPrefix = "" }) => {
  const key = String(level || "medium").toLowerCase();
  const classes = LEVEL_STYLES[key] || LEVEL_STYLES.medium;

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${classes}`}>
      {labelPrefix ? `${labelPrefix} ` : ""}
      {key.replace(/_/g, " ")}
    </span>
  );
};
