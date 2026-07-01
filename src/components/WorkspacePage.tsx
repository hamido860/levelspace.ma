import React from 'react';

type WorkspacePageProps = {
  children: React.ReactNode;
  desktopAt?: 'md' | 'lg';
};

export const WorkspacePage: React.FC<WorkspacePageProps> = ({
  children,
  desktopAt = 'md',
}) => (
  <div
    data-workspace-page="true"
    className={`min-h-full w-full bg-background flex flex-col overflow-visible pt-0 px-[var(--ls-page-gap)] pb-[var(--ls-page-gap)] ${
      desktopAt === 'lg' ? 'lg:h-full lg:overflow-hidden' : 'md:h-full md:overflow-hidden'
    }`}
  >
    {children}
  </div>
);
