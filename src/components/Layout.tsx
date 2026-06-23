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
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div className={`${fullWidth ? 'min-h-screen md:h-screen md:overflow-hidden' : 'min-h-screen'} bg-background flex font-sans text-ink`}>
      {!hideSidebar && <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />}
      
      <main 
        data-sidebar-collapsed={isCollapsed ? 'true' : 'false'}
        className={`flex-grow ${fullWidth ? 'min-h-screen md:h-screen md:overflow-hidden' : 'min-h-screen'} flex flex-col w-full pb-20 md:pb-0 transition-all duration-300 ${
          hideSidebar ? '' : `pt-16 ${isCollapsed ? 'md:ps-[85px]' : 'md:ps-[254px]'}`
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
