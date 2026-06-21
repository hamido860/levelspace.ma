import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  dir?: 'ltr' | 'rtl' | 'auto';
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl';
  variant?: 'light' | 'dark';
  placement?: 'center' | 'right' | 'left';
  closePosition?: 'start' | 'end';
  panelClassName?: string;
  bodyClassName?: string;
  headerClassName?: string;
  closeButtonClassName?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  dir,
  maxWidth = '2xl',
  variant = 'light',
  placement = 'center',
  closePosition = 'end',
  panelClassName = '',
  bodyClassName = '',
  headerClassName = '',
  closeButtonClassName = '',
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const maxWidthClass = {
    'sm': 'max-w-sm',
    'md': 'max-w-md',
    'lg': 'max-w-lg',
    'xl': 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    '7xl': 'max-w-7xl',
  }[maxWidth];

  const isDark = variant === 'dark';
  const isRight = placement === 'right';
  const isLeft = placement === 'left';
  const isSide = isRight || isLeft;

  const titleNode = typeof title === 'string'
    ? <h3 className={`text-xl font-bold font-display ${isDark ? 'text-white' : 'text-ink'}`}>{title}</h3>
    : title;

  const subtitleNode = typeof subtitle === 'string'
    ? <p className={`mt-0.5 text-xs font-semibold ${isDark ? 'text-white/45' : 'text-muted'}`}>{subtitle}</p>
    : subtitle;

  const frameClass = isSide
    ? `items-stretch ${isLeft ? 'justify-start' : 'justify-end'} p-0`
    : 'items-center justify-center p-4 md:p-6';

  const surfaceClass = isDark
    ? 'border-white/10 bg-[#171c23] text-slate-100'
    : 'border-ink/5 bg-paper text-ink';

  const headerSurfaceClass = isDark
    ? 'border-white/10 bg-[#000417] text-white'
    : 'border-ink/5 bg-white/50 dark:bg-paper text-ink';

  const closeSurfaceClass = isDark
    ? 'bg-white/5 text-white/55 hover:bg-white/10 hover:text-white'
    : 'bg-surface-low text-muted hover:text-ink hover:bg-ink/5';

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className={`fixed inset-0 z-[9999] flex ${frameClass}`}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className={`absolute inset-0 ${isDark ? 'bg-ink/55 backdrop-blur-sm' : 'bg-ink/40'}`}
          />
          <motion.div
            initial={isSide ? { opacity: 0, x: isLeft ? '-100%' : '100%' } : { opacity: 0, scale: 0.95, y: 20 }}
            animate={isSide ? { opacity: 1, x: 0 } : { opacity: 1, scale: 1, y: 0 }}
            exit={isSide ? { opacity: 0, x: isLeft ? '-100%' : '100%' } : { opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            data-selection-actions-ignore="true"
            role="dialog"
            aria-modal="true"
            className={`relative flex w-full ${maxWidthClass} ${surfaceClass} ${isSide ? `h-full max-h-none rounded-none ${isLeft ? 'border-r' : 'border-l'} shadow-2xl` : 'max-h-[90vh] rounded-xl border shadow-2xl'} overflow-hidden flex-col ${panelClassName}`}
            dir={dir}
          >
            <div className={`flex shrink-0 items-center justify-between gap-4 border-b px-6 py-4 ${headerSurfaceClass} ${headerClassName}`}>
              {closePosition === 'start' && (
                <button
                  type="button"
                  onClick={onClose}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${closeSurfaceClass} ${closeButtonClassName}`}
                  aria-label="Close modal"
                >
                  <X size={20} />
                </button>
              )}
              {title || subtitle || icon ? (
                <div className={`flex min-w-0 flex-1 items-center gap-3 ${closePosition === 'start' ? 'justify-end text-right' : ''}`}>
                  {icon && (
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isDark ? 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20' : 'bg-accent/10 text-accent'} ${closePosition === 'start' ? 'order-2' : ''}`}>
                      {icon}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    {titleNode}
                    {subtitleNode}
                  </div>
                </div>
              ) : <span />}
              {closePosition === 'end' && (
                <button 
                  type="button"
                  onClick={onClose}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${closeSurfaceClass} ${closeButtonClassName}`}
                  aria-label="Close modal"
                >
                  <X size={20} />
                </button>
              )}
            </div>
            <div className={`flex-grow overflow-y-auto p-6 no-scrollbar ${bodyClassName}`}>
              {children}
            </div>
            {footer && (
              <div className={`shrink-0 border-t ${isDark ? 'border-white/10 bg-[#111820]' : 'border-ink/5 bg-paper'}`}>
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
