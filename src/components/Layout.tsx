import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './topbar';

interface LayoutProps {
  children: React.ReactNode;
  hideSidebar?: boolean;
  fullWidth?: boolean;
  topbarGradeOverride?: string;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  hideSidebar = false,
  fullWidth = false,
  topbarGradeOverride,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className={`bg-background font-sans text-ink flex ${fullWidth ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
      {!hideSidebar && (
        <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
      )}

      <main
        className={`flex flex-col flex-1 min-w-0 transition-all duration-300 ${
          fullWidth ? 'h-screen overflow-hidden' : 'min-h-screen'
        } ${
          hideSidebar
            ? ''
            : `pt-[68px] ${isCollapsed ? 'md:ps-[72px]' : 'md:ps-[242px]'}`
        }`}
      >
        {!hideSidebar && (
          <Topbar isCollapsed={isCollapsed} gradeOverride={topbarGradeOverride} />
        )}

        {fullWidth ? (
          /* fullWidth: fixed-height area, pages control their own scroll */
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {children}
          </div>
        ) : (
          /* standard: scrollable document flow */
          <div className="flex-1 overflow-y-auto pb-20 md:pb-6">
            <div className="mx-auto w-full max-w-[1000px] p-2 md:p-4">
              {children}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
