
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calculator, 
  CheckCircle, 
  Brain, 
  Ruler, 
  FileText, 
  Image as ImageIcon, 
  Sparkles, 
  Map, 
  Book, 
  Calendar, 
  Zap, 
  PenTool, 
  MessageSquare,
  X,
  ChevronRight,
  Loader2,
  Search,
  Maximize2,
  History,
  LayoutGrid
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { WORKSPACE_CONFIG, ToolConfig, SubjectConfig } from './config';
import { Modal } from '../Modal';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useAppSettings } from '../../context/AppSettingsContext';

// Lazy load tools later if needed, for now let's build the structure
import { MathEditor } from './tools/MathEditor';
import { TextInput } from './tools/TextInput';
import { ImageFetcher } from './tools/ImageFetcher';
import { AITool } from './tools/AITool';
import { DictionaryTool } from './tools/DictionaryTool';
import { TimelineTool } from './tools/TimelineTool';

interface EduWorkspaceProps {
  isOpen: boolean;
  onClose: () => void;
  subjectId: string;
  lessonContext: {
    title: string;
    content: string;
    grade: string;
    country: string;
  };
}

const ICON_MAP: Record<string, any> = {
  Calculator,
  CheckCircle,
  Brain,
  Ruler,
  FileText,
  Image: ImageIcon,
  Sparkles,
  Map,
  Book,
  Calendar,
  Zap,
  PenTool,
  MessageSquare
};

export const EduWorkspace: React.FC<EduWorkspaceProps> = ({ 
  isOpen, 
  onClose, 
  subjectId, 
  lessonContext 
}) => {
  const { t } = useLanguage();
  const { isAdmin } = useAuth();
  const { settings } = useAppSettings();
  const askAiAccess = settings.ask_ai_access || 'admin';
  const hasAiAccess = askAiAccess === 'all' || (askAiAccess === 'admin' && isAdmin);

  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  const [toolStates, setToolStates] = useState<Record<string, any>>({});

  // Normalize subject ID (e.g., 'Mathematics' -> 'math')
  const normalizedSubjectId = useMemo(() => {
    const sid = subjectId.toLowerCase();
    if (sid.includes('math')) return 'math';
    if (sid.includes('physic')) return 'physics';
    if (sid.includes('biolog')) return 'biology';
    if (sid.includes('geolog')) return 'geology';
    if (sid.includes('histor')) return 'history';
    if (sid.includes('languag')) return 'language';
    if (sid.includes('philosoph')) return 'philosophy';
    return 'math'; // Default
  }, [subjectId]);

  const config = useMemo(() => {
    const baseConfig = WORKSPACE_CONFIG[normalizedSubjectId] || WORKSPACE_CONFIG.math;
    return {
      ...baseConfig,
      tools: baseConfig.tools.filter(tool => hasAiAccess || tool.type !== 'ai')
    };
  }, [normalizedSubjectId, hasAiAccess]);

  useEffect(() => {
    if (isOpen && !activeToolId && config.tools.length > 0) {
      setActiveToolId(config.tools[0].id);
    }
  }, [isOpen, config, activeToolId]);

  const handleToolStateChange = (toolId: string, state: any) => {
    setToolStates(prev => ({
      ...prev,
      [toolId]: state
    }));
  };

  const renderTool = () => {
    if (!activeToolId) return null;
    const tool = config.tools.find(t => t.id === activeToolId);
    if (!tool) return null;

    const commonProps = {
      state: toolStates[activeToolId] || {},
      onChange: (state: any) => handleToolStateChange(activeToolId, state),
      lessonContext,
      subjectId: normalizedSubjectId
    };

    switch (tool.id) {
      case 'math-editor':
        return <MathEditor {...commonProps} />;
      case 'text-input':
        return <TextInput {...commonProps} />;
      case 'image-fetcher':
        return <ImageFetcher {...commonProps} />;
      case 'ai-assistant':
      case 'ai-explainer':
      case 'notes-generator':
      case 'writing-assistant':
      case 'argument-builder':
        return <AITool tool={tool} {...commonProps} />;
      case 'dictionary':
        return <DictionaryTool {...commonProps} />;
      case 'timeline':
        return <TimelineTool {...commonProps} />;
      default:
        return (
          <div className="flex flex-col items-center justify-center h-64 text-muted">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
            <p className="text-sm font-medium">Loading {tool.label}...</p>
          </div>
        );
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose}
      maxWidth="6xl"
      title={
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center text-accent shadow-sm">
            <Sparkles size={24} />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-muted uppercase tracking-[0.2em] leading-none mb-1.5">Edu Workspace</span>
            <span className="text-xl font-black text-ink leading-none tracking-tight">{config.label}</span>
          </div>
        </div>
      }
    >
      <div className="flex flex-col md:flex-row gap-8 h-full min-h-[600px]">
        {/* Tool Icon */}
        <div className="flex items-center justify-center">
          <button className="p-4 bg-surface-low rounded-2xl text-accent hover:bg-surface-mid transition-all">
            <LayoutGrid size={24} />
          </button>
        </div>

        {/* Tool Content Area */}
        <div className="flex-grow bg-paper rounded-[2.5rem] p-8 border border-ink/5 shadow-inner overflow-y-auto min-h-[500px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeToolId}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="h-full"
            >
              {renderTool()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </Modal>
  );
};
