
export type ToolType = 'input' | 'logic' | 'api' | 'ai' | 'visual';

export interface ToolConfig {
  id: string;
  type: ToolType;
  label: string;
  icon: string;
  library?: string;
  providers?: string[];
  reuse?: string;
  requirements?: string[];
}

export interface SubjectConfig {
  id: string;
  label: string;
  tools: ToolConfig[];
}

export const WORKSPACE_CONFIG: Record<string, SubjectConfig> = {
  math: {
    id: 'math',
    label: 'Mathematics',
    tools: [
      { id: 'math-editor', type: 'input', label: 'Math Editor', icon: 'Calculator', library: 'MathLive' },
      { id: 'math-validator', type: 'logic', label: 'Validator', icon: 'CheckCircle', library: 'Math.js' },
      { id: 'ai-assistant', type: 'ai', label: 'AI Tutor', icon: 'Brain' }
    ]
  },
  physics: {
    id: 'physics',
    label: 'Physics',
    tools: [
      { id: 'math-editor', type: 'input', label: 'Formula Editor', icon: 'Calculator', library: 'MathLive' },
      { id: 'unit-validator', type: 'logic', label: 'Unit Checker', icon: 'Ruler', library: 'Math.js' },
      { id: 'ai-assistant', type: 'ai', label: 'AI Tutor', icon: 'Brain' }
    ]
  },
  biology: {
    id: 'biology',
    label: 'Biology',
    tools: [
      { id: 'text-input', type: 'input', label: 'Notes', icon: 'FileText' },
      { id: 'image-fetcher', type: 'api', label: 'Diagrams', icon: 'Image', providers: ['Unsplash'] },
      { id: 'ai-explainer', type: 'ai', label: 'AI Explainer', icon: 'Sparkles' }
    ]
  },
  geology: {
    id: 'geology',
    label: 'Geology',
    tools: [
      { id: 'text-input', type: 'input', label: 'Notes', icon: 'FileText' },
      { id: 'image-fetcher', type: 'api', label: 'Maps & Rocks', icon: 'Map', providers: ['Unsplash'] }
    ]
  },
  history: {
    id: 'history',
    label: 'History',
    tools: [
      { id: 'dictionary', type: 'api', label: 'Dictionary', icon: 'Book' },
      { id: 'timeline', type: 'visual', label: 'Timeline', icon: 'Calendar' },
      { id: 'notes-generator', type: 'ai', label: 'AI Summary', icon: 'Zap' }
    ]
  },
  language: {
    id: 'language',
    label: 'Language',
    tools: [
      { id: 'dictionary', type: 'api', label: 'Dictionary', icon: 'Book' },
      { id: 'writing-assistant', type: 'ai', label: 'AI Writing', icon: 'PenTool' }
    ]
  },
  philosophy: {
    id: 'philosophy',
    label: 'Philosophy',
    tools: [
      { id: 'dictionary', type: 'api', label: 'Dictionary', icon: 'Book' },
      { id: 'argument-builder', type: 'ai', label: 'AI Argument', icon: 'MessageSquare' },
      { id: 'writing-assistant', type: 'ai', label: 'AI Writing', icon: 'PenTool' }
    ]
  }
};

export const GLOBAL_TOOLS: ToolConfig[] = [
  { id: 'ai-assistant', type: 'ai', label: 'AI Assistant', icon: 'Brain' }
];
