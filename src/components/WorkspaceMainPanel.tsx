import React from 'react';

type WorkspaceMainPanelProps = {
  children: React.ReactNode;
  desktopAt?: 'md' | 'lg';
};

export const WorkspaceMainPanel: React.FC<WorkspaceMainPanelProps> = ({
  children,
  desktopAt = 'lg',
}) => {
  const desktopPanel = desktopAt === 'lg' ? 'lg:overflow-hidden' : 'md:overflow-hidden';
  const desktopScroll = desktopAt === 'lg' ? 'lg:overflow-y-auto' : 'md:overflow-y-auto';
  const desktopFlex = desktopAt === 'lg'
    ? 'lg:flex-1 lg:shrink lg:min-h-0'
    : 'md:flex-1 md:shrink md:min-h-0';

  return (
    <div
      data-workspace-main-panel="true"
      className={`flex flex-col shrink-0 min-h-fit w-full overflow-visible bg-white dark:bg-paper rounded-xl shadow-lg border border-slate-200 dark:border-white/8 p-4 sm:p-6 ${desktopFlex} ${desktopPanel}`}
    >
      <div className={`flex flex-col gap-6 overflow-visible no-scrollbar ${desktopFlex} ${desktopScroll}`}>
        {children}
      </div>
    </div>
  );
};
