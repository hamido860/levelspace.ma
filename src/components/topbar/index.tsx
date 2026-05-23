import React from 'react';
import { UserProfile } from './UserProfile';
import { SearchBar } from './SearchBar';
import { ActionIcons } from './ActionIcons';

interface TopbarProps {
  isCollapsed?: boolean;
  gradeOverride?: string;
}

export const Topbar: React.FC<TopbarProps> = ({ isCollapsed = false, gradeOverride }) => {
  const currentGrade = gradeOverride || localStorage.getItem('selected_grade') || 'Grade 12';

  return (
    <header
      className={`h-16 border-b border-ink/5 bg-surface-low/80  fixed top-0 z-30 px-4 md:px-6 flex items-center justify-between gap-4 transition-all duration-300 ${
        isCollapsed
          ? 'left-0 w-full md:left-[64.9984px] md:w-[calc(100%-64.9984px)]'
          : 'left-0 w-full md:left-[176px] md:w-[calc(100%-176px)]'
      }`}
    >
      <UserProfile currentGrade={currentGrade} />
      <SearchBar />
      <ActionIcons />
    </header>
  );
};
