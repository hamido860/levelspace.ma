import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { UserProfile } from './UserProfile';
import { SearchBar } from './SearchBar';
import { ActionIcons } from './ActionIcons';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../db/db';

interface TopbarProps {
  isCollapsed?: boolean;
  gradeOverride?: string;
}

export const Topbar: React.FC<TopbarProps> = ({ isCollapsed = false, gradeOverride }) => {
  const { profile, loading } = useAuth();
  const dbSettings = useLiveQuery(() => db.settings.toArray(), []);
  const settingsMap = React.useMemo(
    () => Object.fromEntries((dbSettings || []).map((setting) => [setting.key, setting.value])),
    [dbSettings],
  );
  const browserGrade = localStorage.getItem('selected_grade') || '';
  const hasPersistedAcademicGrade = Boolean(profile?.selected_grade || settingsMap.selected_grade);
  const currentGrade =
    gradeOverride ||
    profile?.selected_grade ||
    settingsMap.selected_grade ||
    (browserGrade === 'Grade 12' && !hasPersistedAcademicGrade ? '' : browserGrade) ||
    (loading || dbSettings === undefined ? 'Loading...' : 'Set grade');

  return (
    <header
      className={`h-16 border border-slate-200 dark:border-white/8 bg-white dark:bg-paper fixed z-30 px-3 flex items-center justify-between gap-4 transition-all duration-300 shadow-md ${
        isCollapsed 
          ? 'md:left-[72px]' 
          : 'md:left-[242px]'
      } left-1 right-1 top-1 rounded-xl`}
    >
      <UserProfile currentGrade={currentGrade} />
      <SearchBar />
      <ActionIcons />
    </header>
  );
};
