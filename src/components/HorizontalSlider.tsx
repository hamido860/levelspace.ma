import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface HorizontalSliderProps {
  children: React.ReactNode;
}

export const HorizontalSlider: React.FC<HorizontalSliderProps> = ({ children }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(true);

  const checkScroll = () => {
    if (containerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = containerRef.current;
      setShowLeft(scrollLeft > 10);
      setShowRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      checkScroll();
      // Check after images/contents load
      const timeoutId = setTimeout(checkScroll, 500);
      el.addEventListener('scroll', checkScroll, { passive: true });
      window.addEventListener('resize', checkScroll);

      return () => {
        clearTimeout(timeoutId);
        el.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }
  }, [children]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (containerRef.current) {
      const scrollAmount = 360; // Approximate card width + gap
      containerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
      // Double check after scroll completes
      setTimeout(checkScroll, 350);
    }
  };

  return (
    <div className="relative group/slider w-full select-none">
      {/* Left Slider Arrow */}
      {showLeft && (
        <button
          type="button"
          onClick={() => handleScroll('left')}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-700 dark:text-ink shadow-md backdrop-blur-md hover:bg-[#007A87] hover:text-white dark:hover:bg-accent dark:hover:text-white transition-all scale-90 group-hover/slider:scale-100 duration-200 cursor-pointer active:scale-95"
          title="Slide Left"
        >
          <ChevronLeft size={20} className="stroke-[2.5]" />
        </button>
      )}

      {/* Right Slider Arrow */}
      {showRight && (
        <button
          type="button"
          onClick={() => handleScroll('right')}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-700 dark:text-ink shadow-md backdrop-blur-md hover:bg-[#007A87] hover:text-white dark:hover:bg-accent dark:hover:text-white transition-all scale-90 group-hover/slider:scale-100 duration-200 cursor-pointer active:scale-95"
          title="Slide Right"
        >
          <ChevronRight size={20} className="stroke-[2.5]" />
        </button>
      )}

      {/* Scrollable container */}
      <div
        ref={containerRef}
        onScroll={checkScroll}
        className="flex flex-row overflow-x-auto no-scrollbar gap-4 pb-4 scroll-smooth w-full px-2"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {React.Children.map(children, (child) => (
          <div style={{ scrollSnapAlign: 'start' }} className="shrink-0">
            {child}
          </div>
        ))}
      </div>
    </div>
  );
};
