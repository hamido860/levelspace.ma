import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Timer, 
  BookOpen, 
  BarChart3, 
  Calendar 
} from 'lucide-react';

export const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: <Timer size={24} strokeWidth={1.2}/>, label: 'Focus', path: '/dashboard' },
    { icon: <BookOpen size={24} strokeWidth={1.2}/>, label: 'Learn', path: '/modules' },
    { icon: <BarChart3 size={24} strokeWidth={1.2}/>, label: 'Stats', path: '/progress' },
    { icon: <Calendar size={24} strokeWidth={1.2}/>, label: 'Plan', path: '/schedule' }
  ];

  const getActiveItem = () => {
    if (location.pathname === '/dashboard') return 'Focus';
    if (location.pathname === '/modules') return 'Learn';
    if (location.pathname === '/progress') return 'Stats';
    if (location.pathname === '/schedule') return 'Plan';
    return '';
  };

  const activeLabel = getActiveItem();

  return (
    <nav className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-paper/60 backdrop-blur-2xl border border-ink/5 px-12 py-6 rounded-full flex gap-16 items-center z-50 shadow-[0_30px_60px_rgba(0,0,0,0.1)]">
      {navItems.map((item, i) => {
        const isActive = item.label === activeLabel;
        return (
          <button 
            key={i}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center gap-2 transition-all duration-500 group ${
              isActive ? 'text-accent scale-110' : 'text-muted hover:text-ink'
            }`}
          >
            <span className="transition-transform duration-500 group-hover:-translate-y-1">{item.icon}</span>
            <span className="text-[9px] font-mono uppercase tracking-[0.2em] font-bold">{item.label}</span>
            {isActive && (
              <motion.div 
                layoutId="nav-pill"
                className="absolute -bottom-1 w-1 h-1 bg-accent rounded-full"
              />
            )}
          </button>
        );
      })}
    </nav>
  );
};
