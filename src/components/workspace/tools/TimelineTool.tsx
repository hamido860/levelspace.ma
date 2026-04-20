
import React, { useState, useEffect } from 'react';
import { Calendar, ChevronRight, ChevronLeft, History, ZoomIn, ZoomOut, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TimelineEvent {
  id: string;
  year: string;
  title: string;
  description: string;
  type: 'event' | 'cause' | 'effect';
}

interface TimelineToolProps {
  state: any;
  onChange: (state: any) => void;
  lessonContext: any;
}

export const TimelineTool: React.FC<TimelineToolProps> = ({ state, onChange, lessonContext }) => {
  const [events, setEvents] = useState<TimelineEvent[]>(state.events || []);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(state.selectedEventId || null);
  const [zoomLevel, setZoomLevel] = useState(state.zoomLevel || 1);

  useEffect(() => {
    if (events.length === 0) {
      // Mock events based on lesson context
      const mockEvents: TimelineEvent[] = [
        { id: '1', year: '1789', title: 'Start of Revolution', description: 'The Storming of the Bastille marks the beginning of the French Revolution.', type: 'cause' },
        { id: '2', year: '1791', title: 'New Constitution', description: 'The National Assembly adopts a new constitution for France.', type: 'event' },
        { id: '3', year: '1793', title: 'Reign of Terror', description: 'A period of state-sanctioned violence and mass executions.', type: 'effect' },
        { id: '4', year: '1799', title: 'Napoleon Takes Power', description: 'Napoleon Bonaparte seizes power in a coup d\'état.', type: 'event' },
        { id: '5', year: '1804', title: 'Napoleonic Empire', description: 'Napoleon crowns himself Emperor of the French.', type: 'effect' }
      ];
      setEvents(mockEvents);
      onChange({ ...state, events: mockEvents });
    }
  }, []);

  const selectedEvent = events.find(e => e.id === selectedEventId);

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-accent">
          <Calendar className="w-4 h-4" />
          <h3 className="text-sm font-bold uppercase tracking-widest">Historical Timeline</h3>
        </div>
        <div className="flex items-center gap-2 bg-paper border border-ink/5 rounded-lg p-1">
          <button 
            onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.1))}
            className="p-1.5 hover:bg-surface-low rounded text-muted hover:text-ink transition-colors"
          >
            <ZoomOut size={14} />
          </button>
          <span className="text-[9px] font-bold text-muted w-8 text-center">{Math.round(zoomLevel * 100)}%</span>
          <button 
            onClick={() => setZoomLevel(prev => Math.min(2, prev + 0.1))}
            className="p-1.5 hover:bg-surface-low rounded text-muted hover:text-ink transition-colors"
          >
            <ZoomIn size={14} />
          </button>
        </div>
      </div>

      <div className="flex-grow flex flex-col gap-6 overflow-hidden">
        {/* Timeline Track */}
        <div className="relative h-32 bg-paper border border-ink/10 rounded-2xl shadow-inner overflow-x-auto no-scrollbar py-8 px-12">
          <div className="absolute top-1/2 left-0 right-0 h-1 bg-accent/20 -translate-y-1/2" />
          
          <div className="flex items-center justify-between min-w-[600px] h-full relative">
            {events.map((event, i) => (
              <motion.button
                key={event.id}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setSelectedEventId(event.id);
                  onChange({ ...state, selectedEventId: event.id });
                }}
                className={`relative z-10 flex flex-col items-center gap-2 transition-all ${
                  selectedEventId === event.id ? 'scale-110' : 'opacity-60 hover:opacity-100'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border-4 border-paper shadow-md transition-all ${
                  selectedEventId === event.id ? 'bg-accent scale-125' : 'bg-muted'
                }`} />
                <div className="absolute -top-8 text-[10px] font-bold text-accent whitespace-nowrap">{event.year}</div>
                <div className="absolute -bottom-8 text-[9px] font-bold text-ink whitespace-nowrap uppercase tracking-widest">{event.title}</div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Event Details */}
        <div className="flex-grow bg-paper border border-ink/10 rounded-2xl p-6 shadow-inner overflow-y-auto no-scrollbar relative">
          <AnimatePresence mode="wait">
            {selectedEvent ? (
              <motion.div
                key={selectedEvent.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h2 className="text-2xl font-bold text-ink">{selectedEvent.title}</h2>
                    <p className="text-sm font-bold text-accent uppercase tracking-widest">{selectedEvent.year}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest ${
                    selectedEvent.type === 'cause' ? 'bg-emerald-500/10 text-emerald-600' :
                    selectedEvent.type === 'effect' ? 'bg-error/10 text-error' :
                    'bg-accent/10 text-accent'
                  }`}>
                    {selectedEvent.type}
                  </span>
                </div>
                <p className="text-sm text-ink leading-relaxed">
                  {selectedEvent.description}
                </p>
                
                <div className="p-4 bg-surface-low rounded-xl border border-ink/5 flex items-start gap-3">
                  <div className="w-8 h-8 bg-paper rounded-lg flex items-center justify-center text-muted shrink-0">
                    <Info className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-ink">Historical Context</p>
                    <p className="text-[10px] text-muted leading-relaxed">
                      This event was a major turning point in {lessonContext.title}. It led to significant changes in social and political structures.
                    </p>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-40">
                <History className="w-12 h-12 text-muted" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-ink">Explore the Timeline</p>
                  <p className="text-[10px] text-muted uppercase tracking-widest">Select an event above to see details</p>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>

        <div className="p-4 bg-accent/5 border border-accent/10 rounded-xl flex items-start gap-3">
          <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center text-accent shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold text-ink">Chronological Learning</p>
            <p className="text-[10px] text-muted leading-relaxed">
              Visualizing events in a timeline helps in understanding the cause-and-effect relationships of historical periods.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
