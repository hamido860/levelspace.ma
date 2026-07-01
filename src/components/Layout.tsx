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
  topbarGradeOverride
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const layoutVars = hideSidebar
    ? undefined
    : ({
        ['--ls-page-gap' as string]: '4px',
        // Tailwind's h-16/pt-16 resolve to 56px in this app because the root
        // font size is 87.5%. Keep the fixed rail on the same measured grid.
        ['--ls-topbar-height' as string]: '64px',
        ['--ls-sidebar-width' as string]: isCollapsed ? '60px' : '220px',
      } as React.CSSProperties);

  return (
    <div
      style={layoutVars}
      className={`${fullWidth ? 'min-h-screen md:h-screen md:overflow-hidden' : 'min-h-screen'} bg-background flex font-sans text-ink`}
    >
      {!hideSidebar && <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />}
      
      <main 
        data-sidebar-collapsed={isCollapsed ? 'true' : 'false'}
        className={`flex-grow ${fullWidth ? 'min-h-screen md:h-screen md:overflow-hidden' : 'min-h-screen'} flex flex-col w-full pb-20 md:pb-0 transition-all duration-300 ${
          hideSidebar ? '' : 'layout-main-with-sidebar pt-[72px]'
        }`}
      >
        {!hideSidebar && <Topbar isCollapsed={isCollapsed} gradeOverride={topbarGradeOverride} />}
        <div className={`${fullWidth ? 'min-h-[calc(100vh-4rem)] w-full flex flex-col overflow-y-auto md:h-[calc(100vh-4rem)] md:min-h-0 md:overflow-hidden' : 'p-2 md:p-4 mx-auto space-y-6 overflow-x-hidden max-w-[1000px] w-full'}`}>
          {children}
        </div>
      </main>
    </div>
  );
};
