import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { UserProfile } from './UserProfile';
import { SearchBar } from './SearchBar';
import { ActionIcons } from './ActionIcons';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../db/db';

// ⚡ Bolt: Stable fallback array to prevent cascading re-renders when useLiveQuery loads
const EMPTY_ARRAY: any[] = [];

interface TopbarProps {
  isCollapsed?: boolean;
  gradeOverride?: string;
}

export const Topbar: React.FC<TopbarProps> = ({ isCollapsed = false, gradeOverride }) => {
  const { profile, loading } = useAuth();
  const dbSettings = useLiveQuery(() => db.settings.toArray(), EMPTY_ARRAY);
  const settingsMap = React.useMemo(
    () => Object.fromEntries((dbSettings || EMPTY_ARRAY).map((setting) => [setting.key, setting.value])),
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
      className="h-16 border-b border-ink/5 bg-surface-low/80 fixed top-0 left-0 right-0 z-30 px-4 md:px-6 flex items-center justify-between gap-4 transition-all duration-300"
    >
      <UserProfile currentGrade={currentGrade} />
      <SearchBar />
      <ActionIcons />
    </header>
  );
};
