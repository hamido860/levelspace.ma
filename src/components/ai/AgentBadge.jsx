import { Bot, Eye, FileSearch, ShieldCheck, Sparkles, TerminalSquare, Wrench } from "lucide-react";

const AGENT_STYLES = {
  "Auditor Agent": {
    icon: Eye,
    className: "bg-blue-50 text-blue-700",
  },
  "Planner Agent": {
    icon: Sparkles,
    className: "bg-violet-50 text-violet-700",
  },
  "RAG Agent": {
    icon: FileSearch,
    className: "bg-cyan-50 text-cyan-700",
  },
  "SQL Agent": {
    icon: TerminalSquare,
    className: "bg-amber-50 text-amber-700",
  },
  "Worker Agent": {
    icon: Wrench,
    className: "bg-emerald-50 text-emerald-700",
  },
  "Validator Agent": {
    icon: ShieldCheck,
    className: "bg-green-50 text-green-700",
  },
  "Reporter Agent": {
    icon: Bot,
    className: "bg-surface-mid text-ink-secondary",
  },
};

export const AgentBadge = ({ agent = "Planner Agent", compact = false }) => {
  const config = AGENT_STYLES[agent] || AGENT_STYLES["Planner Agent"];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${config.className}`}
    >
      <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
      {agent}
    </span>
  );
};
