import { Bot, Eye, FileSearch, ShieldCheck, Sparkles, TerminalSquare, Wrench } from "lucide-react";

const AGENT_STYLES = {
  "Auditor Agent": {
    icon: Eye,
    className: "bg-blue-50 text-blue-700 border border-blue-100",
  },
  "Planner Agent": {
    icon: Sparkles,
    className: "bg-violet-50 text-violet-700 border border-violet-100",
  },
  "RAG Agent": {
    icon: FileSearch,
    className: "bg-cyan-50 text-cyan-700 border border-cyan-100",
  },
  "SQL Agent": {
    icon: TerminalSquare,
    className: "bg-amber-50 text-amber-700 border border-amber-100",
  },
  "Worker Agent": {
    icon: Wrench,
    className: "bg-emerald-50 text-emerald-700 border border-emerald-100",
  },
  "Validator Agent": {
    icon: ShieldCheck,
    className: "bg-green-50 text-green-700 border border-green-100",
  },
  "Reporter Agent": {
    icon: Bot,
    className: "bg-slate-100 text-slate-700 border border-slate-200",
  },
};

export const AgentBadge = ({ agent = "Planner Agent", compact = false }) => {
  const config = AGENT_STYLES[agent] || AGENT_STYLES["Planner Agent"];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${config.className}`}
    >
      <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
      {agent}
    </span>
  );
};
