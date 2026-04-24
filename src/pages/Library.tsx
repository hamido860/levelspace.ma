import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  File, 
  Book, 
  X,
  Plus, 
  Trash2, 
  Search, 
  Filter,
  Download,
  ExternalLink,
  Clock,
  CheckCircle2,
  BookOpen
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { SEO } from '../components/SEO';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

type FileFormat = 'pdf' | 'epub' | 'txt' | 'manual' | 'link';

interface LibraryItem {
  id: string;
  title: string;
  author: string;
  format: FileFormat;
  size: string;
  addedDate: string;
  status: 'to-read' | 'reading' | 'completed';
  progress: number;
  category: string;
  content?: string;
  url?: string;
}

const initialLibrary: LibraryItem[] = [
  {
    id: '1',
    title: 'Advanced Cognitive Psychology',
    author: 'Dr. Sarah Chen',
    format: 'pdf',
    size: '4.2 MB',
    addedDate: '2024-03-15',
    status: 'reading',
    progress: 45,
    category: 'Science',
    content: '# Advanced Cognitive Psychology\n\n## Chapter 1: Introduction to Cognitive Science\n\nCognitive psychology is the scientific study of mental processes such as "attention, language use, memory, perception, problem solving, creativity, and thinking".\n\n### The Information Processing Approach\n\nOne of the central tenets of cognitive psychology is the idea that the mind can be understood as a complex system that processes information. This approach often uses the computer as a metaphor for the human mind, with sensory input being the "input," mental processes being the "software," and behavior being the "output."\n\n### Key Research Methods\n\n1. **Experimental Psychology**: Using controlled experiments to test hypotheses about mental processes.\n2. **Cognitive Neuropsychology**: Studying individuals with brain damage to understand how specific brain regions contribute to cognitive functions.\n3. **Cognitive Neuroscience**: Using brain imaging techniques (like fMRI or EEG) to observe the brain in action during cognitive tasks.\n4. **Computational Modeling**: Creating computer programs that simulate human cognitive processes.'
  },
  {
    id: '2',
    title: 'The Art of Deep Work',
    author: 'Cal Newport',
    format: 'epub',
    size: '1.8 MB',
    addedDate: '2024-03-10',
    status: 'to-read',
    progress: 0,
    category: 'Productivity',
    content: '# Deep Work\n\n## Rules for Focused Success in a Distracted World\n\nDeep work is the ability to focus without distraction on a cognitively demanding task. It’s a skill that allows you to quickly master complicated information and produce better results in less time.\n\n### The Deep Work Hypothesis\n\nThe ability to perform deep work is becoming increasingly rare at exactly the same time it is becoming increasingly valuable in our economy. As a consequence, the few who cultivate this skill, and then make it the core of their working life, will thrive.\n\n### The Rules\n\n1. **Work Deeply**: Schedule blocks of time for deep work and stick to them.\n2. **Embrace Boredom**: Train your brain to tolerate a lack of stimulation.\n3. **Quit Social Media**: Be intentional about the tools you use.\n4. **Drain the Shallows**: Minimize shallow work (emails, meetings, etc.).'
  },
  {
    id: '3',
    title: 'Quantum Mechanics Notes',
    author: 'MIT OpenCourseWare',
    format: 'txt',
    size: '156 KB',
    addedDate: '2024-03-20',
    status: 'completed',
    progress: 100,
    category: 'Physics',
    content: '# Quantum Mechanics Fundamentals\n\n## Wave-Particle Duality\n\nOne of the most profound discoveries of the 20th century is that all particles exhibit both wave-like and particle-like properties. This is most famously demonstrated in the double-slit experiment.\n\n### The Schrödinger Equation\n\nThe fundamental equation of quantum mechanics is the Schrödinger equation, which describes how the quantum state of a physical system changes over time.\n\n### Heisenberg Uncertainty Principle\n\nIt is impossible to simultaneously know both the exact position and exact momentum of a particle. The more precisely one is known, the less precisely the other can be determined.'
  },
  {
    id: '4',
    title: 'Lab Manual: Organic Chemistry',
    author: 'University Press',
    format: 'manual',
    size: '12.5 MB',
    addedDate: '2024-03-18',
    status: 'reading',
    progress: 12,
    category: 'Chemistry',
    content: '# Organic Chemistry Lab Manual\n\n## Experiment 1: Recrystallization\n\nRecrystallization is a technique used to purify solid compounds. It relies on the fact that most solids are more soluble in a hot solvent than in a cold one.\n\n### Procedure\n\n1. Dissolve the impure solid in a minimum amount of hot solvent.\n2. Filter the hot solution to remove insoluble impurities.\n3. Allow the solution to cool slowly to room temperature, then in an ice bath.\n4. Filter the crystals using a Buchner funnel.\n5. Wash the crystals with a small amount of cold solvent.'
  },
  {
    id: '5',
    title: 'History of Modern Architecture',
    author: 'Kenneth Frampton',
    format: 'pdf',
    size: '8.9 MB',
    addedDate: '2024-03-22',
    status: 'to-read',
    progress: 0,
    category: 'Architecture',
    content: '# History of Modern Architecture\n\n## The Rise of Modernism\n\nModern architecture emerged in the late 19th and early 20th centuries as a response to the Industrial Revolution and the need for new types of buildings.\n\n### Key Movements\n\n1. **Bauhaus**: A German art school that combined crafts and the fine arts, and was famous for the approach to design that it publicized and taught.\n2. **International Style**: Characterized by rectilinear forms, light, taut plane surfaces that have been completely stripped of applied ornamentation and decoration, open interior spaces, and a visually weightless quality engendered by the use of cantilever construction.\n3. **Brutalism**: Characterized by simple, block-like structures that often feature bare building materials.'
  },
  {
    id: '6',
    title: 'Introduction to Algorithms',
    author: 'CLRS',
    format: 'pdf',
    size: '15.2 MB',
    addedDate: '2024-03-23',
    status: 'reading',
    progress: 5,
    category: 'Computer Science',
    content: '# Introduction to Algorithms\n\n## Sorting and Order Statistics\n\nSorting is the process of arranging items in a specific order, typically numerical or lexicographical.\n\n### Common Sorting Algorithms\n\n1. **Insertion Sort**: A simple sorting algorithm that builds the final sorted array one item at a time.\n2. **Merge Sort**: An efficient, stable, comparison-based, divide and conquer sorting algorithm.\n3. **Quick Sort**: An efficient sorting algorithm, serving as a systematic method for placing the elements of an array in order.\n4. **Heap Sort**: A comparison-based sorting algorithm that uses a binary heap data structure.'
  },
  {
    id: '7',
    title: 'Philosophy of Mind',
    author: 'David Chalmers',
    format: 'epub',
    size: '1.2 MB',
    addedDate: '2024-03-24',
    status: 'to-read',
    progress: 0,
    category: 'Philosophy',
    content: '# Philosophy of Mind\n\n## The Hard Problem of Consciousness\n\nThe hard problem of consciousness is the problem of explaining why and how we have qualia or phenomenal experiences—how sensations acquire characteristics, such as colors and tastes.\n\n### Dualism vs. Physicalism\n\n1. **Dualism**: The view that the mind and body are distinct and separable.\n2. **Physicalism**: The view that everything is physical, including the mind.'
  }
];

export const Library: React.FC = () => {
  const { t } = useLanguage();
  const { isPro } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<LibraryItem[]>(initialLibrary);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | FileFormat>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<LibraryItem | null>(null);
  const [newItem, setNewItem] = useState({
    title: '',
    url: ''
  });

  const filteredItems = items.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         item.author.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === 'all' || item.format === filter;
    return matchesSearch && matchesFilter;
  });

  const addItem = (e: React.FormEvent) => {
    e.preventDefault();
    const item: LibraryItem = {
      id: Math.random().toString(36).substr(2, 9),
      title: newItem.title || newItem.url,
      author: 'Web Resource',
      format: 'link',
      size: 'URL',
      addedDate: new Date().toISOString().split('T')[0],
      status: 'to-read',
      progress: 0,
      category: 'Web',
      url: newItem.url
    };
    setItems([item, ...items]);
    setShowAddModal(false);
    setNewItem({ title: '', url: '' });
  };

  const deleteItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const getFormatIcon = (format: FileFormat) => {
    switch (format) {
      case 'pdf': return <FileText className="text-red-500" />;
      case 'epub': return <Book className="text-blue-500" />;
      case 'txt': return <File className="text-gray-500" />;
      case 'manual': return <BookOpen className="text-emerald-500" />;
      case 'link': return <ExternalLink className="text-blue-500" />;
    }
  };

  if (!isPro) {
    return (
      <Layout>
        <SEO title="Library" />
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-6">
          <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center text-accent">
            <Book className="w-8 h-8" />
          </div>
          <div className="space-y-2 max-w-md">
            <h2 className="text-2xl font-bold text-ink">Pro Feature</h2>
            <p className="text-muted">
              The Library is available exclusively on the Pro plan. Upgrade to store, read, and organize your academic materials.
            </p>
          </div>
          <button 
            onClick={() => navigate('/pricing')}
            className="px-6 py-3 bg-ink text-paper rounded-xl font-bold hover:bg-accent transition-colors"
          >
            Upgrade to Pro
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <SEO title="Library" />
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-ink">{t('library')}</h1>
            <p className="text-muted text-sm mt-1">Manage your academic resources and reading list.</p>
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-xl font-bold text-sm shadow-lg shadow-accent/20 hover:bg-accent/90 transition-all"
          >
            <Plus size={18} />
            Add Resource
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            {/* Search and Filter */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted/50" />
                <input 
                  type="text" 
                  placeholder="Search by title or author..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-11 pl-10 pr-4 bg-paper border border-ink/5 rounded-xl text-sm focus:ring-2 focus:ring-accent/10 outline-none transition-all"
                />
              </div>
              <div className="flex gap-2">
                {(['all', 'pdf', 'epub', 'txt', 'manual'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                      filter === f ? 'bg-ink text-paper' : 'bg-paper text-muted hover:bg-ink/5'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Library Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AnimatePresence mode="popLayout">
                {filteredItems.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-paper p-5 rounded-2xl border border-ink/5 shadow-sm group hover:shadow-md transition-all"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2 bg-background rounded-lg">
                        {getFormatIcon(item.format)}
                      </div>
                      <button 
                        onClick={() => deleteItem(item.id)}
                        className="p-2 text-muted/30 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    
                    <div className="space-y-1 mb-4">
                      <h3 className="font-bold text-ink line-clamp-1">{item.title}</h3>
                      <p className="text-xs text-muted font-medium">{item.author}</p>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted/60 mb-4">
                      <span>{item.category}</span>
                      <span>{item.size}</span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                        <span className="text-muted/60">Progress</span>
                        <span className="text-accent">{item.progress}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-background rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${item.progress}%` }}
                          className="h-full bg-accent"
                        />
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-ink/5 flex justify-between items-center">
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted/60">
                        {item.status === 'completed' ? (
                          <CheckCircle2 size={12} className="text-emerald-500" />
                        ) : (
                          <Clock size={12} className="text-amber-500" />
                        )}
                        {item.status}
                      </div>
                      <button 
                        onClick={() => setSelectedItem(item)}
                        className="p-2 text-muted hover:text-accent transition-colors"
                      >
                        <ExternalLink size={16} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Right Column: Reading List & Stats */}
          <div className="space-y-6">
            <div className="bg-ink text-paper p-6 rounded-3xl shadow-xl space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-accent">
                  <BookOpen size={20} />
                </div>
                <div>
                  <h2 className="font-bold tracking-tight">Reading List</h2>
                  <p className="text-[10px] text-paper/60 uppercase tracking-widest">Active Sessions</p>
                </div>
              </div>

              <div className="space-y-4">
                {items.filter(i => i.status === 'reading').map(item => (
                  <div key={item.id} className="p-4 bg-white/5 rounded-2xl space-y-3">
                    <div className="flex justify-between items-start">
                      <h4 className="text-sm font-bold line-clamp-1">{item.title}</h4>
                      <span className="text-[10px] font-mono text-accent">{item.progress}%</span>
                    </div>
                    <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-accent" style={{ width: `${item.progress}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              <button 
                onClick={() => {
                  const reading = items.find(i => i.status === 'reading');
                  if (reading) setSelectedItem(reading);
                }}
                className="w-full py-4 bg-paper text-ink rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-accent hover:text-white transition-all"
              >
                Continue Reading
              </button>
            </div>

            <div className="bg-paper p-6 rounded-3xl border border-ink/5 shadow-sm space-y-6">
              <h2 className="font-bold text-ink tracking-tight">Library Stats</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-background rounded-2xl">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Total Files</p>
                  <span className="text-2xl font-bold text-ink">{items.length}</span>
                </div>
                <div className="p-4 bg-background rounded-2xl">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Completed</p>
                  <span className="text-2xl font-bold text-ink">{items.filter(i => i.status === 'completed').length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Add Resource Modal */}
        <AnimatePresence>
          {selectedItem && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedItem(null)}
                className="absolute inset-0 bg-ink/60 backdrop-blur-md"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-4xl h-[85vh] bg-paper rounded-[2rem] shadow-2xl flex flex-col overflow-hidden"
              >
                {/* Reader Header */}
                <div className="p-6 border-b border-ink/5 flex items-center justify-between bg-paper/50 backdrop-blur-sm sticky top-0 z-10">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-background rounded-xl">
                      {getFormatIcon(selectedItem.format)}
                    </div>
                    <div>
                      <h2 className="font-bold text-ink leading-tight">{selectedItem.title}</h2>
                      <p className="text-xs text-muted">{selectedItem.author} · {selectedItem.category}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedItem(null)}
                    className="p-2 hover:bg-background rounded-full transition-colors"
                  >
                    <X size={20} className="text-muted" />
                  </button>
                </div>

                {/* Reader Content */}
                <div className="flex-grow overflow-y-auto p-8 md:p-12 lg:p-16">
                  <div className="max-w-2xl mx-auto">
                    <div className="prose prose-custom prose-sm md:prose-base lg:prose-lg max-w-none">
                      <div className="markdown-body">
                        <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { strict: false }]]}>{selectedItem.content || '# No Content Available\n\nThis resource does not have preview content yet.'}</Markdown>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reader Footer */}
                <div className="p-6 border-t border-ink/5 bg-background/50 flex items-center justify-between rounded-[13px]">
                  <div className="flex items-center gap-4">
                    <div className="h-1.5 w-32 bg-ink/5 rounded-full overflow-hidden">
                      <div className="h-full bg-accent" style={{ width: `${selectedItem.progress}%` }} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted">{selectedItem.progress}% read</span>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-4 py-2 bg-paper border border-ink/5 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-ink/5 transition-all">
                      Add Bookmark
                    </button>
                    <button className="px-4 py-2 bg-ink text-paper rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-accent transition-all">
                      Mark as Completed
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {showAddModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowAddModal(false)}
                className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-md bg-paper rounded-3xl shadow-2xl p-8 overflow-hidden"
              >
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-accent">
                      <Plus className="w-4 h-4" />
                      <span className="text-[10px] font-mono uppercase tracking-[0.2em]">Add Resource</span>
                    </div>
                    <h2 className="text-2xl font-bold font-sans tracking-tight text-ink">New Library Item</h2>
                  </div>

                  <form onSubmit={addItem} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted">URL / Link</label>
                      <input 
                        type="url" 
                        required
                        placeholder="https://example.com/resource"
                        value={newItem.url}
                        onChange={(e) => setNewItem({...newItem, url: e.target.value})}
                        className="w-full h-11 px-4 bg-background border border-ink/5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-accent/10"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Title (Optional)</label>
                      <input 
                        type="text" 
                        placeholder="My Resource"
                        value={newItem.title}
                        onChange={(e) => setNewItem({...newItem, title: e.target.value})}
                        className="w-full h-11 px-4 bg-background border border-ink/5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-accent/10"
                      />
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button 
                        type="button"
                        onClick={() => setShowAddModal(false)}
                        className="flex-1 py-3 bg-background text-muted rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-ink/5 transition-all"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit"
                        className="flex-1 py-3 bg-accent text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-accent/90 transition-all shadow-lg shadow-accent/20"
                      >
                        Add to Library
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
};
