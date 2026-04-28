import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Clock, 
  FlaskConical, 
  BookOpen, 
  History, 
  Brain, 
  ChevronRight, 
  Plus, 
  X,
  ArrowRight,
  Lightbulb,
  FileText,
  Activity,
  Loader2,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { generateFlashcards, generateCauseEffect } from '../services/geminiService';

interface ToolProps {
  category: string;
  lessonId: string;
}

const CharacterMap: React.FC = () => {
  const [characters, setCharacters] = useState<{ name: string; role: string }[]>([]);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');

  const addCharacter = () => {
    if (newName && newRole) {
      setCharacters([...characters, { name: newName, role: newRole }]);
      setNewName('');
      setNewRole('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <input 
          type="text" 
          placeholder="Name" 
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="p-3 bg-background border border-ink/5 rounded-xl text-xs focus:outline-none focus:border-accent/30"
        />
        <input 
          type="text" 
          placeholder="Role" 
          value={newRole}
          onChange={(e) => setNewRole(e.target.value)}
          className="p-3 bg-background border border-ink/5 rounded-xl text-xs focus:outline-none focus:border-accent/30"
        />
      </div>
      <button 
        onClick={addCharacter}
        className="w-full py-3 bg-ink text-paper rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-accent transition-all"
      >
        Add Character
      </button>
      <div className="space-y-2">
        {characters.map((c, i) => (
          <motion.div 
            key={i} 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="p-3 bg-background rounded-xl border border-ink/5 flex justify-between items-center"
          >
            <span className="text-xs font-bold text-ink">{c.name}</span>
            <span className="text-[10px] text-muted uppercase tracking-widest">{c.role}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const LitDevices: React.FC = () => {
  const [devices, setDevices] = useState<{ type: string; example: string }[]>([]);
  const [newType, setNewType] = useState('');
  const [newExample, setNewExample] = useState('');

  const addDevice = () => {
    if (newType && newExample) {
      setDevices([...devices, { type: newType, example: newExample }]);
      setNewType('');
      setNewExample('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3">
        <select 
          value={newType}
          onChange={(e) => setNewType(e.target.value)}
          className="w-full p-3 bg-background border border-ink/5 rounded-xl text-xs focus:outline-none focus:border-accent/30"
        >
          <option value="">Select Device Type</option>
          <option value="Metaphor">Metaphor</option>
          <option value="Simile">Simile</option>
          <option value="Symbolism">Symbolism</option>
          <option value="Irony">Irony</option>
          <option value="Alliteration">Alliteration</option>
          <option value="Other">Other</option>
        </select>
        <textarea 
          placeholder="Example from text..." 
          value={newExample}
          onChange={(e) => setNewExample(e.target.value)}
          className="w-full p-3 bg-background border border-ink/5 rounded-xl text-xs focus:outline-none focus:border-accent/30 resize-none"
          rows={2}
        />
        <button 
          onClick={addDevice}
          className="w-full py-3 bg-ink text-paper rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-accent transition-all"
        >
          Add Device
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {devices.map((d, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="p-4 bg-background rounded-2xl border border-ink/5 border-l-4 border-l-accent"
          >
            <span className="text-[10px] font-bold text-accent uppercase tracking-widest block mb-1">{d.type}</span>
            <p className="text-xs text-ink leading-relaxed">{d.example}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const ThemeTracker: React.FC = () => {
  const [themes, setThemes] = useState<{ theme: string; evidence: string }[]>([]);
  const [newTheme, setNewTheme] = useState('');
  const [newEvidence, setNewEvidence] = useState('');

  const addTheme = () => {
    if (newTheme && newEvidence) {
      setThemes([...themes, { theme: newTheme, evidence: newEvidence }]);
      setNewTheme('');
      setNewEvidence('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <input 
          type="text" 
          placeholder="Theme (e.g. Isolation)" 
          value={newTheme}
          onChange={(e) => setNewTheme(e.target.value)}
          className="w-full p-3 bg-background border border-ink/5 rounded-xl text-xs focus:outline-none focus:border-accent/30"
        />
        <textarea 
          placeholder="Textual Evidence..." 
          value={newEvidence}
          onChange={(e) => setNewEvidence(e.target.value)}
          className="w-full p-3 bg-background border border-ink/5 rounded-xl text-xs focus:outline-none focus:border-accent/30 resize-none"
          rows={3}
        />
        <button 
          onClick={addTheme}
          className="w-full py-3 bg-ink text-paper rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-accent transition-all"
        >
          Track Theme
        </button>
      </div>
      <div className="space-y-3">
        {themes.map((t, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 bg-background rounded-2xl border border-ink/5 space-y-2"
          >
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-accent" />
              <span className="text-xs font-bold text-ink">{t.theme}</span>
            </div>
            <p className="text-[11px] text-muted italic leading-relaxed">"{t.evidence}"</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const TimelineTool: React.FC = () => {
  const [events, setEvents] = useState<{ date: string; event: string }[]>([]);
  const [newDate, setNewDate] = useState('');
  const [newEvent, setNewEvent] = useState('');

  const addEvent = () => {
    if (newDate && newEvent) {
      setEvents([...events, { date: newDate, event: newEvent }]);
      setNewDate('');
      setNewEvent('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <input 
          type="text" 
          placeholder="Date/Period" 
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
          className="p-3 bg-background border border-ink/5 rounded-xl text-xs focus:outline-none focus:border-accent/30"
        />
        <input 
          type="text" 
          placeholder="Event" 
          value={newEvent}
          onChange={(e) => setNewEvent(e.target.value)}
          className="p-3 bg-background border border-ink/5 rounded-xl text-xs focus:outline-none focus:border-accent/30"
        />
      </div>
      <button 
        onClick={addEvent}
        className="w-full py-3 bg-ink text-paper rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-accent transition-all"
      >
        Add Event
      </button>
      <div className="relative pl-4 space-y-4 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-ink/10">
        {events.map((e, i) => (
          <motion.div 
            key={i} 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative"
          >
            <div className="absolute -left-[18px] top-1.5 w-2 h-2 rounded-full bg-accent border-2 border-white" />
            <div className="p-3 bg-background rounded-xl border border-ink/5">
              <span className="text-[10px] font-bold text-accent block mb-1">{e.date}</span>
              <p className="text-xs text-ink">{e.event}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const LabReport: React.FC = () => {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Hypothesis</label>
        <textarea className="w-full p-3 bg-background border border-ink/5 rounded-xl text-xs focus:outline-none focus:border-accent/30 resize-none" rows={2} placeholder="What do you expect to happen?" />
      </div>
      <div className="space-y-2">
        <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Method</label>
        <textarea className="w-full p-3 bg-background border border-ink/5 rounded-xl text-xs focus:outline-none focus:border-accent/30 resize-none" rows={3} placeholder="Steps taken during the experiment..." />
      </div>
      <div className="space-y-2">
        <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Results</label>
        <textarea className="w-full p-3 bg-background border border-ink/5 rounded-xl text-xs focus:outline-none focus:border-accent/30 resize-none" rows={2} placeholder="What were the outcomes?" />
      </div>
      <button className="w-full py-3 bg-ink text-paper rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-accent transition-all">
        Save Lab Report
      </button>
    </div>
  );
};

const CauseEffect: React.FC<{ lessonId: string }> = ({ lessonId }) => {
  const { isAdmin } = useAuth();
  const { settings } = useAppSettings();
  const askAiAccess = settings.ask_ai_access || 'admin';
  const hasAiAccess = askAiAccess === 'all' || (askAiAccess === 'admin' && isAdmin);

  const [pairs, setPairs] = useState<{ cause: string; effect: string }[]>([]);
  const [newCause, setNewCause] = useState('');
  const [newEffect, setNewEffect] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const lesson = useLiveQuery(() => db.lessons.get(lessonId), [lessonId]);

  const addPair = () => {
    if (newCause && newEffect) {
      setPairs([...pairs, { cause: newCause, effect: newEffect }]);
      setNewCause('');
      setNewEffect('');
    }
  };

  const removePair = (index: number) => {
    setPairs(pairs.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    if (!lesson || !hasAiAccess) return;
    setIsGenerating(true);
    try {
      const content = lesson.blocks?.map(b => b.content || '').join('\n') || lesson.content || '';
      const newPairs = await generateCauseEffect(content);
      if (newPairs && newPairs.length > 0) {
        setPairs(newPairs);
      }
    } catch (error) {
      console.error("Failed to generate cause-effect pairs", error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center px-2">
        <h3 className="font-bold text-ink text-sm">Cause & Effect</h3>
        {hasAiAccess && (
          <button 
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-2 px-3 py-1.5 bg-accent/10 text-accent rounded-lg text-xs font-bold hover:bg-accent hover:text-white transition-colors disabled:opacity-50"
          >
            {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {isGenerating ? 'Checking...' : 'Quality check'}
          </button>
        )}
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-2">
          <textarea 
            placeholder="Cause (The trigger...)" 
            value={newCause}
            onChange={(e) => setNewCause(e.target.value)}
            className="p-3 bg-background border border-ink/5 rounded-xl text-xs focus:outline-none focus:border-accent/30 resize-none"
            rows={2}
          />
          <textarea 
            placeholder="Effect (The result...)" 
            value={newEffect}
            onChange={(e) => setNewEffect(e.target.value)}
            className="p-3 bg-background border border-ink/5 rounded-xl text-xs focus:outline-none focus:border-accent/30 resize-none"
            rows={2}
          />
        </div>
        <button 
          onClick={addPair}
          className="w-full py-3 bg-ink text-paper rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-accent transition-all"
        >
          Add Relationship
        </button>
      </div>

      <div className="space-y-4 relative before:absolute before:left-[15px] before:top-4 before:bottom-4 before:w-px before:bg-ink/5">
        {pairs.map((p, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative pl-10"
          >
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background border border-ink/5 flex items-center justify-center z-10">
              <ArrowRight className="w-4 h-4 text-accent" />
            </div>
            <div className="grid grid-cols-1 gap-2 p-4 bg-background rounded-2xl border border-ink/5 shadow-sm group/item relative">
              <button 
                onClick={() => removePair(i)}
                className="absolute top-2 right-2 p-1 text-muted/40 hover:text-destructive opacity-0 group-hover/item:opacity-100 transition-all"
              >
                <X size={12} />
              </button>
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-muted uppercase tracking-widest">Cause</span>
                <p className="text-xs text-ink font-medium">{p.cause}</p>
              </div>
              <div className="h-px bg-ink/5" />
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-accent uppercase tracking-widest">Effect</span>
                <p className="text-xs text-ink">{p.effect}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const Flashcards: React.FC<{ lessonId: string }> = ({ lessonId }) => {
  const { isAdmin } = useAuth();
  const { settings } = useAppSettings();
  const askAiAccess = settings.ask_ai_access || 'admin';
  const hasAiAccess = askAiAccess === 'all' || (askAiAccess === 'admin' && isAdmin);

  const [flipped, setFlipped] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [cards, setCards] = useState<{front: string, back: string}[]>([
    { front: "Metaphor", back: "A figure of speech that describes an object or action in a way that isn’t literally true, but helps explain an idea or make a comparison." },
    { front: "Simile", back: "A figure of speech involving the comparison of one thing with another thing of a different kind, used to make a description more emphatic or vivid (e.g., as brave as a lion)." },
    { front: "Personification", back: "The attribution of a personal nature or human characteristics to something non-human, or the representation of an abstract quality in human form." }
  ]);

  const lesson = useLiveQuery(() => db.lessons.get(lessonId), [lessonId]);

  const handleGenerate = async () => {
    if (!lesson || !hasAiAccess) return;
    setIsGenerating(true);
    try {
      const content = lesson.blocks?.map(b => b.content || '').join('\n') || lesson.content || '';
      const newCards = await generateFlashcards(content);
      if (newCards && newCards.length > 0) {
        setCards(newCards);
        setCurrentIndex(0);
        setFlipped(false);
      }
    } catch (error) {
      console.error("Failed to generate flashcards", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const nextCard = () => {
    setFlipped(false);
    setTimeout(() => {
      setCurrentIndex((currentIndex + 1) % cards.length);
    }, 200);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center px-2">
        <h3 className="font-bold text-ink text-sm">Study Cards</h3>
        {hasAiAccess && (
          <button 
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-2 px-3 py-1.5 bg-accent/10 text-accent rounded-lg text-xs font-bold hover:bg-accent hover:text-white transition-colors disabled:opacity-50"
          >
            {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {isGenerating ? 'Preparing...' : 'Create'}
          </button>
        )}
      </div>
      <div 
        className="relative h-48 cursor-pointer perspective-1000"
        onClick={() => setFlipped(!flipped)}
      >
        <motion.div 
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
          className="w-full h-full relative preserve-3d"
        >
          <div className="absolute inset-0 backface-hidden bg-background border border-ink/5 rounded-3xl flex items-center justify-center p-8 text-center">
            <h3 className="text-xl font-bold text-ink">{cards[currentIndex]?.front || ''}</h3>
          </div>
          <div className="absolute inset-0 backface-hidden bg-accent text-white rounded-3xl flex items-center justify-center p-8 text-center rotate-y-180">
            <p className="text-sm leading-relaxed">{cards[currentIndex]?.back || ''}</p>
          </div>
        </motion.div>
      </div>
      <div className="flex justify-between items-center px-2">
        <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Card {currentIndex + 1} of {cards.length}</span>
        <button 
          onClick={(e) => { e.stopPropagation(); nextCard(); }}
          className="flex items-center gap-2 text-xs font-bold text-accent hover:text-ink transition-colors"
        >
          Next Card <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
};

export const PedagogicalTools: React.FC<ToolProps> = ({ category, lessonId }) => {
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [infoToolId, setInfoToolId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const tools = {
    literature: [
      { id: 'char-map', name: 'Character Map', icon: <Users className="w-4 h-4" />, description: 'Visualize character relationships and dynamics.' },
      { id: 'theme-tracker', name: 'Theme Tracker', icon: <Lightbulb className="w-4 h-4" />, description: 'Track recurring motifs and themes in the text.' },
      { id: 'lit-devices', name: 'Literary Devices', icon: <BookOpen className="w-4 h-4" />, description: 'Identify metaphors, similes, and symbolism.' }
    ],
    history: [
      { id: 'timeline', name: 'Interactive Timeline', icon: <Clock className="w-4 h-4" />, description: 'Map out events in chronological order.' },
      { id: 'cause-effect', name: 'Cause & Effect', icon: <ArrowRight className="w-4 h-4" />, description: 'Analyze the triggers and consequences of events.' },
      { id: 'source-analysis', name: 'Source Analyzer', icon: <FileText className="w-4 h-4" />, description: 'Evaluate primary and secondary historical sources.' }
    ],
    science: [
      { id: 'lab-report', name: 'Lab Experiment', icon: <FlaskConical className="w-4 h-4" />, description: 'Document hypotheses, methods, and results.' },
      { id: 'formula-sheet', name: 'Formula Reference', icon: <Brain className="w-4 h-4" />, description: 'Quick access to relevant scientific formulas.' },
      { id: 'data-plot', name: 'Data Visualizer', icon: <Activity className="w-4 h-4" />, description: 'Plot experimental data into visual charts.' }
    ],
    general: [
      { id: 'mind-map', name: 'Mind Map', icon: <Brain className="w-4 h-4" />, description: 'Connect ideas and concepts visually.' },
      { id: 'flashcards', name: 'Flashcards', icon: <Plus className="w-4 h-4" />, description: 'Create quick study cards for key terms.' }
    ]
  };

  const getCategoryKey = (cat: string) => {
    const c = cat.toLowerCase();
    if (c.includes('lit') || c.includes('lang') || c.includes('art')) return 'literature';
    if (c.includes('hist') || c.includes('social') || c.includes('world')) return 'history';
    if (c.includes('science') || c.includes('physics') || c.includes('chem') || c.includes('bio')) return 'science';
    return 'general';
  };

  const currentCategoryKey = getCategoryKey(category);
  const activeTools = tools[currentCategoryKey as keyof typeof tools];

  const renderToolContent = () => {
    switch (activeTool) {
      case 'char-map': return <CharacterMap />;
      case 'theme-tracker': return <ThemeTracker />;
      case 'lit-devices': return <LitDevices />;
      case 'timeline': return <TimelineTool />;
      case 'cause-effect': return <CauseEffect lessonId={lessonId} />;
      case 'lab-report': return <LabReport />;
      case 'flashcards': return <Flashcards lessonId={lessonId} />;
      default:
        return (
          <div className="p-12 bg-background/50 border border-dashed border-ink/10 rounded-2xl flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-paper flex items-center justify-center shadow-sm text-accent/40">
              {activeTools.find(t => t.id === activeTool)?.icon}
            </div>
            <div>
              <h3 className="font-bold text-ink">Interactive Workspace</h3>
              <p className="text-sm text-muted max-w-xs mx-auto">
                This tool is being tailored for your {currentCategoryKey} lesson. Soon you will be able to interact with it directly.
              </p>
            </div>
            <button 
              onClick={() => setActiveTool(null)}
              className="px-6 py-2 bg-ink text-paper rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-accent transition-all"
            >
              Got it
            </button>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col items-center space-y-6 w-full py-4">
      <div className="flex flex-col items-center gap-1 mb-4">
        <div className="w-1 h-8 bg-accent/20 rounded-full mb-2" />
        <span className="text-[8px] font-black text-muted uppercase tracking-[0.3em] vertical-text rotate-180">Tools</span>
      </div>

      <div className="flex flex-col gap-4">
        {activeTools.map((tool) => (
          <div key={tool.id} className="relative">
            <motion.button
              whileHover={{ scale: 1.1, backgroundColor: 'var(--color-accent)', color: 'white' }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setInfoToolId(infoToolId === tool.id ? null : tool.id)}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-sm border ${
                infoToolId === tool.id 
                  ? 'bg-accent text-white border-accent shadow-accent/20' 
                  : 'bg-paper text-muted border-ink/5 hover:border-accent/30'
              }`}
            >
              {tool.icon}
            </motion.button>

            <AnimatePresence>
              {infoToolId === tool.id && (
                <motion.div
                  initial={{ opacity: 0, x: 20, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 20, scale: 0.95 }}
                  className="absolute top-0 right-full mr-4 w-64 p-6 bg-ink/95 backdrop-blur-xl text-paper rounded-[32px] shadow-2xl z-50 border border-white/10"
                >
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-accent">
                      <div className="p-2 bg-accent/10 rounded-xl">
                        {tool.icon}
                      </div>
                      <h4 className="text-[11px] font-bold uppercase tracking-[0.2em]">{tool.name}</h4>
                    </div>
                    <p className="text-[11px] text-paper/60 leading-relaxed font-medium">
                      {tool.description}
                    </p>
                    <button 
                      onClick={() => {
                        setActiveTool(tool.id);
                        setInfoToolId(null);
                      }}
                      className="w-full py-3 bg-accent text-white rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-paper hover:text-ink transition-all flex items-center justify-center gap-2 group/btn"
                    >
                      Launch Workspace
                      <ArrowRight size={12} className="group-hover/btn:translate-x-1 transition-transform" />
                    </button>
                  </div>
                  {/* Arrow */}
                  <div className="absolute top-6 -right-1.5 w-3 h-3 bg-ink rotate-45 border-r border-t border-white/10" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {/* Minimized Tip */}
      <div className="pt-6 border-t border-ink/5 w-full flex flex-col items-center gap-4">
        <div className="relative group">
          <button 
            onClick={() => setInfoToolId(infoToolId === 'tip' ? null : 'tip')}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              infoToolId === 'tip' ? 'bg-accent text-white' : 'bg-surface-low text-muted hover:text-[#f1681c] hover:bg-accent/10'
            }`}
          >
            <Lightbulb size={18} className={infoToolId === 'tip' ? '' : 'text-[#f1681c]'} />
          </button>
          
          <AnimatePresence>
            {infoToolId === 'tip' && (
              <motion.div
                initial={{ opacity: 0, x: 20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.95 }}
                className="absolute bottom-0 right-full mr-4 w-64 p-6 bg-accent text-white rounded-[32px] shadow-2xl z-50 overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_100%_0%,rgba(255,255,255,0.2),transparent)]" />
                <div className="relative space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Pedagogical Insight</span>
                  </div>
                  <p className="text-[11px] leading-relaxed font-medium italic opacity-95">
                    "Using these specialized tools helps bridge the gap between abstract concepts and concrete understanding in {currentCategoryKey}."
                  </p>
                </div>
                <div className="absolute bottom-4 -right-1.5 w-3 h-3 bg-accent rotate-45" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Tool Modal */}
      {mounted && createPortal(
        <AnimatePresence>
          {activeTool && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-8">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setActiveTool(null)}
                className="absolute inset-0 bg-ink/60 backdrop-blur-md"
              />
              
              {/* Atmospheric Background Glow */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-accent/20 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-[100px] delay-700 animate-pulse" />
              </div>

              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 40 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 40 }}
                className="relative w-full max-w-2xl bg-paper rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
              >
                {/* Modal Header */}
                <div className="p-8 pb-4 flex justify-between items-start border-b border-ink/5">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-accent/10 rounded-xl text-accent">
                        {activeTools.find(t => t.id === activeTool)?.icon}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-mono font-bold text-accent uppercase tracking-[0.2em]">
                          {currentCategoryKey} Workspace
                        </span>
                        <h2 className="text-3xl font-bold tracking-tight text-ink">
                          {activeTools.find(t => t.id === activeTool)?.name}
                        </h2>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setActiveTool(null)}
                    className="p-3 hover:bg-background rounded-2xl transition-all hover:rotate-90 text-muted"
                  >
                    <X size={24} />
                  </button>
                </div>

                {/* Modal Content */}
                <div className="flex-grow overflow-y-auto p-8 custom-scrollbar">
                  <div className="mb-8 p-4 bg-background rounded-2xl border border-ink/5">
                    <p className="text-sm text-muted leading-relaxed italic">
                      {activeTools.find(t => t.id === activeTool)?.description}
                    </p>
                  </div>
                  {renderToolContent()}
                </div>

                {/* Modal Footer */}
                <div className="p-8 pt-4 bg-surface-low border-t border-ink/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-success" />
                    <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Auto-saving active</span>
                  </div>
                  <button 
                    onClick={() => setActiveTool(null)}
                    className="px-8 py-3 bg-ink text-paper rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-accent transition-all shadow-xl shadow-ink/10"
                  >
                    Close Workspace
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};
