import React from "react";

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ElementType;
}

interface TabbedHeaderProps {
  title: string;
  tabs: TabItem[];
  activeTab: string;
  onChangeTab: (id: string) => void;
}

export const TabbedHeader: React.FC<TabbedHeaderProps> = ({ title, tabs, activeTab, onChangeTab }) => {
  return (
    <div className="flex flex-col gap-1.5 shrink-0 w-full mb-2">
      {/* Title Row */}
      <div>
        <h1 className="text-lg font-black tracking-tight text-slate-950 dark:text-ink leading-none">
          {title}
        </h1>
      </div>

      {/* Flat Horizontal Tab Navigation Row */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-white/8 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              type="button"
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 -mb-px transition-all cursor-pointer ${
                isActive
                  ? "border-accent text-accent"
                  : "border-transparent text-slate-500 dark:text-ink-muted hover:text-slate-950 dark:hover:text-ink"
              }`}
            >
              {Icon && <Icon className="w-3.5 h-3.5" />}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
