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
      className="h-16 border-b border-ink/5 bg-surface-low/80 fixed top-0 left-0 right-0 z-30 px-4 md:px-6 flex items-center justify-between gap-4 transition-all duration-300"
    >
      <UserProfile currentGrade={currentGrade} />
      <SearchBar />
      <ActionIcons />
    </header>
  );
};
