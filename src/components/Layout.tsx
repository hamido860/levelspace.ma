import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

interface LayoutProps {
  children: React.ReactNode;
  hideSidebar?: boolean;
  fullWidth?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  hideSidebar = false,
  fullWidth = false
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div className="min-h-screen bg-background flex font-sans text-ink">
      {!hideSidebar && <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />}
      
      <main 
        className={`flex-grow min-h-screen flex flex-col w-full pb-20 md:pb-0 transition-all duration-300 ${
          hideSidebar ? '' : `pt-16 ${isCollapsed ? 'md:ps-[64.9984px]' : 'md:ps-[176px]'}`
        }`}
      >
        {!hideSidebar && <Topbar isCollapsed={isCollapsed} />}
        <div className={`${fullWidth ? '' : 'p-2 md:p-4 mx-auto'} w-full space-y-6 overflow-x-hidden ${fullWidth ? 'w-full max-w-none' : 'max-w-[1000px]'}`}>
          {children}
        </div>
      </main>
    </div>
  );
};
