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
    <div className={`${fullWidth ? 'h-screen overflow-hidden' : 'min-h-screen'} bg-background flex font-sans text-ink`}>
      {!hideSidebar && <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />}
      
      <main 
        className={`flex-grow ${fullWidth ? 'h-screen overflow-hidden' : 'min-h-screen'} flex flex-col w-full pb-20 md:pb-0 transition-all duration-300 ${
          hideSidebar ? '' : `pt-16 ${isCollapsed ? 'md:ps-[81px]' : 'md:ps-[192px]'}`
        }`}
      >
        {!hideSidebar && <Topbar isCollapsed={isCollapsed} gradeOverride={topbarGradeOverride} />}
        <div className={`${fullWidth ? 'h-full w-full flex flex-col min-h-0 overflow-hidden' : 'p-2 md:p-4 mx-auto space-y-6 overflow-x-hidden max-w-[1000px] w-full'}`}>
          {children}
        </div>
      </main>
    </div>
  );
};
