import React from 'react';

type WorkspaceColumnsProps = {
  children: React.ReactNode;
  rowAt?: 'md' | 'lg';
};

export const WorkspaceColumns: React.FC<WorkspaceColumnsProps> = ({
  children,
  rowAt = 'md',
}) => (
  <div
    data-workspace-columns="true"
    className={`flex-1 min-h-0 w-full flex flex-col gap-[var(--ls-page-gap)] overflow-visible ${
      rowAt === 'lg' ? 'lg:flex-row lg:overflow-hidden' : 'md:flex-row md:overflow-hidden'
    }`}
  >
    {children}
  </div>
);
