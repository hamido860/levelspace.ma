import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  BookOpen, 
  Calendar, 
  Archive,
  GitFork,
  BarChart3,
  User,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sparkles
} from 'lucide-react';

import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useAppSettings } from '../context/AppSettingsContext';

interface SidebarProps {
  isCollapsed?: boolean;
  setIsCollapsed?: (collapsed: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed = false, setIsCollapsed }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, t } = useLanguage();
  const { signOut, isAdmin } = useAuth();
  const { settings } = useAppSettings();

  const mainNavItems = [
    { label: t('dashboard'), icon: <LayoutDashboard size={20} />, path: '/dashboard' },
    { label: 'Profile', icon: <User size={20} />, path: '/profile' },
    { label: t('classrooms'), icon: <BookOpen size={20} />, path: '/modules' },
    { label: t('library'), icon: <Archive size={20} />, path: '/library' },
    { label: t('blueprints'), icon: <GitFork size={20} />, path: '/blueprints' },
    { label: t('schedule'), icon: <Calendar size={20} />, path: '/schedule' },
    { label: t('progress'), icon: <BarChart3 size={20} />, path: '/progress' },
  ];

  const toolNavItems = isAdmin ? [
    { label: 'Admin', icon: <Sparkles size={20} />, path: '/admin' },
  ] : [];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside 
        style={{ width: isCollapsed ? '64.9984px' : '176px' }}
        className={`hidden md:flex h-screen fixed start-0 top-0 bg-surface-low flex-col p-4 gap-2 z-40 border-e border-ink/5 transition-all duration-300`}
      >
        <div className={`mb-6 px-2 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isCollapsed && <h1 style={{ fontSize: '10.75px', fontFamily: 'Arial' }} className="text-lg font-black tracking-tighter text-accent uppercase mb-0">{t('my_space')}</h1>}
          {setIsCollapsed && (
            <button 
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 rounded-lg hover:bg-ink/5 text-muted hover:text-ink transition-all"
            >
              {isCollapsed 
                ? (language === 'ar' ? <ChevronLeft size={20} /> : <ChevronRight size={20} />) 
                : (language === 'ar' ? <ChevronRight size={20} /> : <ChevronLeft size={20} />)
              }
            </button>
          )}
        </div>
        
        <nav className="flex flex-col gap-1">
          {!isCollapsed && <p className="text-[10px] font-bold text-muted uppercase tracking-widest px-3 mb-2 opacity-50">{t('content')}</p>}
          {mainNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                title={isCollapsed ? item.label : undefined}
                className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-3'} py-2.5 rounded-lg font-medium text-sm transition-all duration-200 ease-in-out ${
                  isActive 
                    ? 'bg-accent text-white shadow-lg shadow-accent/20' 
                    : 'text-muted hover:bg-ink/5'
                }`}
              >
                <span className={isActive ? 'text-white' : 'text-muted'}>
                  {item.icon}
                </span>
                {!isCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-1 pt-4 border-t border-ink/5">
          {!isCollapsed && <p className="text-[10px] font-bold text-muted uppercase tracking-widest px-3 mb-2 opacity-50">{t('tools')}</p>}
          {toolNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                title={isCollapsed ? item.label : undefined}
                className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-3'} py-2.5 rounded-lg font-medium text-sm transition-all duration-200 ease-in-out ${
                  isActive 
                    ? 'bg-accent text-white shadow-lg shadow-accent/20' 
                    : 'text-muted hover:bg-ink/5'
                }`}
              >
                <span className={isActive ? 'text-white' : 'text-muted'}>
                  {item.icon}
                </span>
                {!isCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
          
          <button
            onClick={() => signOut()}
            title={isCollapsed ? t('logout') : undefined}
            className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-3'} py-2.5 rounded-lg font-medium text-sm text-muted hover:bg-error/5 hover:text-error transition-all duration-200 ease-in-out mt-1`}
          >
            <LogOut size={20} />
            {!isCollapsed && <span>{t('logout')}</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface-low border-t border-ink/5 z-50 px-4 flex items-center gap-2 overflow-x-auto no-scrollbar shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        {[...mainNavItems, ...toolNavItems].map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={`mobile-${item.path}`}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center gap-1 h-full px-3 min-w-[72px] shrink-0 transition-all duration-300 ${
                isActive 
                  ? 'text-accent' 
                  : 'text-muted'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all duration-300 ${isActive ? 'bg-accent/10 scale-110' : ''}`}>
                {React.cloneElement(item.icon as React.ReactElement<any>, { size: 20 })}
              </div>
              <span className={`text-[9px] font-bold uppercase tracking-tighter whitespace-nowrap transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-60'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
