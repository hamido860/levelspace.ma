import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Modal } from './Modal';
import { 
  GitFork, 
  Star, 
  Search, 
  Filter, 
  GraduationCap, 
  User, 
  Blocks, 
  ArrowRight,
  CheckCircle2,
  BookOpen
} from 'lucide-react';
import { useSearch } from '../context/SearchContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface Blueprint {
  id: string;
  title: string;
  author: string;
  role: 'instructor' | 'student';
  forks: number;
  rating: number;
  blocks: string[];
  tags: string[];
  parentId?: string;
}

const mockBlueprints: Blueprint[] = [
  {
    id: '1',
    title: 'Équations du 1er degré',
    author: 'Prof. Dubois',
    role: 'instructor',
    forks: 1240,
    rating: 4.9,
    blocks: ['Definition', 'Rules', 'Examples', 'Common Errors'],
    tags: ['Math', 'Algebra']
  },
  {
    id: '2',
    title: 'Équations du 1er degré (Exam Prep)',
    author: 'Alex M.',
    role: 'student',
    forks: 342,
    rating: 4.7,
    blocks: ['Definition', 'Rules', 'Examples', 'Common Errors', 'Exam Questions', 'Time Management'],
    tags: ['Math', 'Algebra', 'Exam'],
    parentId: '1'
  },
  {
    id: '3',
    title: 'Cognitive Neuroscience: Foundations',
    author: 'Dr. Sarah Chen',
    role: 'instructor',
    forks: 890,
    rating: 4.8,
    blocks: ['Core Concepts', 'Neural Pathways', 'Case Studies', 'Interactive Quiz'],
    tags: ['Psychology', 'Neuroscience']
  },
  {
    id: '4',
    title: 'Organic Chem: Reaction Mechanisms',
    author: 'ChemWhiz99',
    role: 'student',
    forks: 512,
    rating: 4.6,
    blocks: ['Nomenclature', 'Reaction Types', 'Mechanism Visuals', 'Practice Problems'],
    tags: ['Chemistry', 'Organic']
  }
];

interface BlueprintSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BlueprintSelectionModal: React.FC<BlueprintSelectionModalProps> = ({ isOpen, onClose }) => {
  const { searchQuery } = useSearch();
  const { isPro } = useAuth();
  const navigate = useNavigate();
  const [forkedId, setForkedId] = useState<string | null>(null);

  const handleFork = (id: string) => {
    setForkedId(id);
    setTimeout(() => {
        setForkedId(null);
        onClose();
        // Here we could navigate to the newly created classroom or show a success message
        navigate('/modules'); 
    }, 1500);
  };

  const filteredBlueprints = mockBlueprints.filter(bp => 
    bp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    bp.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Curriculum Blueprints" maxWidth="5xl">
      {!isPro ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center text-center space-y-6">
          <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center text-accent">
            <GitFork className="w-8 h-8" />
          </div>
          <div className="space-y-2 max-w-md">
            <h2 className="text-2xl font-bold text-ink">Pro Feature</h2>
            <p className="text-muted">
              Curriculum Blueprints are available exclusively on the Pro plan. Upgrade to discover, fork, and evolve pedagogical structures.
            </p>
          </div>
          <button 
            onClick={() => {
                onClose();
                navigate('/pricing');
            }}
            className="px-6 py-3 bg-ink text-paper rounded-xl font-bold hover:bg-accent transition-colors"
          >
            Upgrade to Pro
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <section className="space-y-4">
            <p className="text-sm md:text-base text-muted leading-relaxed font-light">
              Discover, fork, and evolve pedagogical structures. When you fork a blueprint, 
              you inherit its pedagogical judgment—what to learn and in what order—while the AI 
              fills in the content.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-normal text-muted">Net Grounding Resources:</span>
              <a 
                href="https://www.yool.education/library" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 text-accent rounded-lg text-xs font-medium hover:bg-accent/20 transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Yool Education Library
              </a>
            </div>
          </section>

          {/* Blueprints Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mt-4">
            <AnimatePresence>
              {filteredBlueprints.length > 0 ? (
                filteredBlueprints.map((bp, i) => (
                  <motion.div 
                    key={bp.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-paper border border-ink/5 rounded-3xl p-6 md:p-8 hover:shadow-md hover:shadow-ink/5 transition-all duration-500 flex flex-col relative overflow-hidden group"
                  >
                    {/* Inheritance Indicator */}
                    {bp.parentId && (
                      <div className="absolute top-0 right-8 px-4 py-1.5 bg-ink/5 rounded-b-lg flex items-center gap-2 text-[10px] font-mono uppercase tracking-normal text-muted">
                        <GitFork className="w-3 h-3" />
                        Forked
                      </div>
                    )}

                    <div className="flex justify-between items-start mb-6">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          {bp.role === 'instructor' ? (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-accent/10 text-accent rounded-md text-[10px] font-bold uppercase tracking-normal">
                              <GraduationCap className="w-3 h-3" />
                              Instructor
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-ink/5 text-muted rounded-md text-[10px] font-bold uppercase tracking-normal">
                              <User className="w-3 h-3" />
                              Student
                            </div>
                          )}
                          <span className="text-sm font-medium text-muted">{bp.author}</span>
                        </div>
                        <h3 className="text-xl md:text-2xl font-bold text-ink tracking-tight group-hover:text-accent transition-colors">
                          {bp.title}
                        </h3>
                      </div>
                    </div>

                    {/* Blocks Visualization */}
                    <div className="my-6 md:my-8 space-y-3 flex-grow">
                      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-normal text-muted mb-4">
                        <Blocks className="w-4 h-4" />
                        Config Structure
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {bp.blocks.map((block, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="px-2 md:px-3 py-1.5 bg-background border border-ink/5 rounded-lg text-xs font-medium text-ink">
                              {block}
                            </span>
                            {idx < bp.blocks.length - 1 && (
                              <ArrowRight className="w-3 h-3 text-muted/40" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Footer Stats & Actions */}
                    <div className="flex items-center justify-between pt-6 border-t border-ink/5 mt-auto">
                      <div className="flex items-center gap-4 md:gap-6">
                        <div className="flex items-center gap-2 text-muted">
                          <GitFork className="w-4 h-4" />
                          <span className="text-sm font-bold">{bp.forks.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted">
                          <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                          <span className="text-sm font-bold">{bp.rating}</span>
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => handleFork(bp.id)}
                        disabled={forkedId === bp.id}
                        className={`flex items-center gap-2 px-4 md:px-6 py-2.5 md:py-3 rounded-xl text-[10px] md:text-xs font-bold uppercase tracking-normal transition-all duration-300 ${
                          forkedId === bp.id 
                            ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/20' 
                            : 'bg-ink text-paper hover:bg-accent shadow-sm shadow-ink/10'
                        }`}
                      >
                        {forkedId === bp.id ? (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            Forked!
                          </>
                        ) : (
                          <>
                            <GitFork className="w-4 h-4" />
                            Fork
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                ))
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="lg:col-span-2 py-10 md:py-20 text-center space-y-4"
                >
                  <div className="w-16 h-16 bg-ink/5 rounded-full flex items-center justify-center mx-auto">
                    <Search className="w-6 h-6 text-muted/40" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-ink">No blueprints found</h3>
                    <p className="text-sm text-muted">Try adjusting your search query.</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </Modal>
  );
};
