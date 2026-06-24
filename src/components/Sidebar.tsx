import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  BookOpen, 
  Calendar, 
  Layers3,
  BarChart3,
  User,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ShieldCheck,
  Brain,
  GraduationCap,
  BookMarked,
  Database,
  Wrench,
  PackageSearch,
  KeyRound,
  Activity
} from 'lucide-react';

import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  isCollapsed?: boolean;
  setIsCollapsed?: (collapsed: boolean) => void;
}

interface NavItem {
  label: string;
  icon: React.ReactElement;
  path: string;
  matchPrefix?: boolean;
}


const isItemActive = (pathname: string, item: NavItem) => {
  return item.matchPrefix
    ? pathname === item.path || pathname.startsWith(`${item.path}/`)
    : pathname === item.path;
};

const SidebarNavItem: React.FC<{
  item: NavItem;
  isActive: boolean;
  isCollapsed: boolean;
  onClick: () => void;
}> = ({ item, isActive, isCollapsed, onClick }) => (
  <button
    aria-label={item.label}
    onClick={onClick}
    title={isCollapsed ? item.label : undefined}
    className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-3'} py-2.5 rounded-lg font-medium text-sm transition-all duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 ${
      isActive
        ? 'bg-accent text-white shadow-sm shadow-accent/20'
        : 'text-muted hover:bg-ink/5'
    }`}
  >
    <span className={isActive ? 'text-white' : 'text-muted'}>
      {item.icon}
    </span>
    {!isCollapsed && <span>{item.label}</span>}
  </button>
);

const MobileNavItem: React.FC<{
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
}> = ({ item, isActive, onClick }) => (
  <button
    aria-label={item.label}
    onClick={onClick}
    className={`flex flex-col items-center justify-center gap-1 h-full px-3 min-w-[72px] shrink-0 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 ${
      isActive ? 'text-accent' : 'text-muted'
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

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed = false, setIsCollapsed }) => {

  const navigate = useNavigate();
  const location = useLocation();
  const { language, t } = useLanguage();
  const { signOut, isAdmin } = useAuth();

  const mainNavItems: NavItem[] = [
    { label: t('dashboard'), icon: <LayoutDashboard size={20} />, path: '/dashboard' },
    { label: t('classrooms'), icon: <GraduationCap size={20} />, path: '/modules' },
    { label: t('library'), icon: <BookMarked size={20} />, path: '/levelup' },
  ];


  const adminNavItems: NavItem[] = [
    ...(isAdmin ? [
      { label: 'Admin Dashboard', icon: <ShieldCheck size={20} />, path: '/admin', matchPrefix: false }
    ] : [])
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside 
        style={{ width: isCollapsed ? '64px' : '234px' }}
        className="hidden md:flex h-[calc(100vh-8px)] fixed start-1 top-1 bg-white dark:bg-paper flex-col p-4 gap-2 z-40 border border-slate-200 dark:border-white/8 rounded-xl shadow-lg transition-all duration-300 overflow-y-auto no-scrollbar"
      >
        <div className={`mb-6 px-2 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isCollapsed && <h1 style={{ fontSize: '10.75px', fontFamily: 'Arial' }} className="text-lg font-black tracking-tighter text-accent uppercase mb-0">{t('my_space')}</h1>}
          {setIsCollapsed && (
            <button 
              onClick={() => setIsCollapsed(!isCollapsed)}
              aria-expanded={!isCollapsed}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="p-1.5 rounded-lg hover:bg-ink/5 text-muted hover:text-ink transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
            >
              {isCollapsed 
                ? (language === 'ar' ? <ChevronLeft size={20} /> : <ChevronRight size={20} />) 
                : (language === 'ar' ? <ChevronRight size={20} /> : <ChevronLeft size={20} />)
              }
            </button>
          )}
        </div>
        
        <nav className="flex flex-col gap-1">
          {!isCollapsed && <p className="text-[10px] font-bold text-muted uppercase tracking-normal px-3 mb-2 opacity-50">{t('content')}</p>}
          {mainNavItems.map((item) => (
            <SidebarNavItem
              key={item.path}
              item={item}
              isActive={isItemActive(location.pathname, item)}
              isCollapsed={isCollapsed}
              onClick={() => navigate(item.path)}
            />
          ))}
        </nav>

        {/* Dynamic CTA Banner (Only shown when expanded) */}
        {!isCollapsed && (
          <div className="bg-gradient-to-br from-emerald-500/15 via-teal-500/15 to-accent/15 border border-emerald-500/30 dark:from-emerald-500/8 dark:via-teal-500/8 dark:to-accent/8 dark:border-emerald-500/15 p-5 rounded-[1.75rem] relative overflow-hidden shadow-md space-y-4 mt-auto mx-1 select-none">
            <div className="absolute top-0 right-0 w-24 h-24 bg-accent/8 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl pointer-events-none" />
            <div className="flex items-center gap-2.5">
              <Brain size={18} className="text-emerald-500 shrink-0 animate-pulse" />
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-ink">LevelUp Pro</h4>
            </div>
            <p className="text-[11px] font-semibold text-slate-600 dark:text-ink-muted leading-relaxed">
              Gain unlimited generated lessons, smart roadmaps & elite AI crew features.
            </p>
            <button
              onClick={() => navigate('/pricing')}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white dark:bg-emerald-600 dark:hover:bg-emerald-700 text-xs font-black uppercase tracking-widest rounded-xl shadow-md hover:shadow-lg transition-all duration-300 text-center cursor-pointer active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
            >
              Upgrade
            </button>
          </div>
        )}

        <div className={`flex flex-col gap-1 pt-4 border-t border-ink/5 ${isCollapsed ? 'mt-auto' : ''}`}>
          <button
            onClick={() => signOut()}
            aria-label={t("logout")}
            title={isCollapsed ? t('logout') : undefined}
            className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-3'} py-2.5 rounded-lg font-medium text-sm text-muted hover:bg-error/5 hover:text-error transition-all duration-200 ease-in-out mt-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1`}
          >
            <LogOut size={20} />
            {!isCollapsed && <span>{t('logout')}</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface-low border-t border-ink/5 z-50 px-4 flex items-center gap-2 overflow-x-auto no-scrollbar shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        {[...mainNavItems, ...adminNavItems].map((item) => (
          <MobileNavItem
            key={`mobile-${item.path}`}
            item={item}
            isActive={isItemActive(location.pathname, item)}
            onClick={() => navigate(item.path)}
          />
        ))}
      </nav>
    </>
  );
};
