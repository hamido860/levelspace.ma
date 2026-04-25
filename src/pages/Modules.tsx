import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Layout } from '../components/Layout';
import { SEO } from '../components/SEO';
import { 
  Search, 
  Filter, 
  ArrowUpDown, 
  Check, 
  Plus, 
  BookOpen, 
  Globe, 
  FlaskConical, 
  Library, 
  Brain,
  ArrowRight,
  X,
  Info,
  Sparkles,
  Loader2,
  PlusCircle
} from 'lucide-react';
import { generateCurriculum } from '../services/geminiService';
import { useSearch } from '../context/SearchContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../db/supabase';

import { TagsManager } from '../components/TagsManager';
import { Modal } from '../components/Modal';
import { useLanguage } from '../context/LanguageContext';

const getIconForCategory = (category: string) => {
  const cat = category.toLowerCase();
  if (cat.includes('math') || cat.includes('science') || cat.includes('physics') || cat.includes('chem')) return <FlaskConical className="w-5 h-5" />;
  if (cat.includes('hist') || cat.includes('geog') || cat.includes('social') || cat.includes('world')) return <Globe className="w-5 h-5" />;
  if (cat.includes('lit') || cat.includes('lang') || cat.includes('art')) return <BookOpen className="w-5 h-5" />;
  if (cat.includes('psych') || cat.includes('phil') || cat.includes('socio')) return <Brain className="w-5 h-5" />;
  return <Library className="w-5 h-5" />;
};

export const Modules: React.FC = () => {
  const { t } = useLanguage();
  const { isPro } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const { searchQuery } = useSearch();
  const navigate = useNavigate();

  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customModule, setCustomModule] = useState({
    name: '',
    code: '',
    description: '',
    category: 'General'
  });

  const dbModules = useLiveQuery(() => db.modules.toArray());
  const modules = useMemo(() => (dbModules || []).map(m => ({
    ...m,
    icon: getIconForCategory(m.category)
  })), [dbModules]);
  const selectedCount = modules.filter(m => m.selected).length;

  const dbSettings = useLiveQuery(() => db.settings.toArray()) || [];
  const settingsMap = useMemo(() => Object.fromEntries(dbSettings.map(s => [s.key, s.value])), [dbSettings]);

  const country = settingsMap['selected_country'] || localStorage.getItem('selected_country') || '';
  const grade = settingsMap['selected_grade'] || localStorage.getItem('selected_grade') || 'Grade 12';
  const selectedBacTrackId = settingsMap['selected_bac_track'] || localStorage.getItem('selected_bac_track') || '';
  const selectedBacIntOptionId = settingsMap['selected_bac_int_option'] || localStorage.getItem('selected_bac_int_option') || '';

  const [bacTrackName, setBacTrackName] = useState<string>('');
  const [bacIntOptionName, setBacIntOptionName] = useState<string>('');

  useEffect(() => {
    const fetchBacDetails = async () => {
      if (selectedBacTrackId) {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedBacTrackId);
        if (isUUID) {
          const { data } = await supabase.from('bac_tracks').select('name').eq('id', selectedBacTrackId).single();
          if (data) setBacTrackName(data.name);
        } else {
          setBacTrackName(selectedBacTrackId);
        }
      }
      if (selectedBacIntOptionId) {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedBacIntOptionId);
        if (isUUID) {
          const { data } = await supabase.from('bac_international_options').select('name').eq('id', selectedBacIntOptionId).single();
          if (data) setBacIntOptionName(data.name);
        } else {
          setBacIntOptionName(selectedBacIntOptionId);
        }
      }
    };
    fetchBacDetails();
  }, [selectedBacTrackId, selectedBacIntOptionId]);

  const fetchCurriculum = async () => {
    setIsLoading(true);
    try {
      let fullGrade = grade;
      if (bacTrackName) {
        fullGrade += ` - ${bacTrackName}`;
      }
      if (bacIntOptionName) {
        fullGrade += ` (${bacIntOptionName})`;
      }
      const aiModules = await generateCurriculum(country, fullGrade);
      if (aiModules && aiModules.length > 0) {
        const formattedModules = aiModules.map(m => ({
          id: m.id,
          name: m.name,
          code: m.code,
          description: m.description,
          category: m.category,
          progress: 0,
          selected: false,
          createdAt: Date.now()
        }));
        await db.modules.clear();
        await db.modules.bulkPut(formattedModules);
      }
    } catch (error) {
      console.error("Failed to fetch curriculum:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleModule = async (id: string) => {
    const module = await db.modules.get(id);
    if (module) {
      if (!module.selected && !isPro && selectedCount >= 3) {
        alert('Free plan is limited to 3 active modules. Please upgrade to Pro for unlimited modules!');
        navigate('/pricing');
        return;
      }
      await db.modules.update(id, { selected: !module.selected });
    }
  };

  const resetSelection = async () => {
    if (!dbModules) return;
    const updates = dbModules.map(m => ({ ...m, selected: false }));
    await db.modules.bulkPut(updates);
  };

  const filteredModules = modules.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    m.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Layout>
      <SEO title="Modules" />
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1 flex-1">
            <div className="flex items-start md:items-center gap-2 text-accent">
              <Sparkles className="w-4 h-4 shrink-0 mt-0.5 md:mt-0" />
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] leading-relaxed">AI-Curated for {grade}{bacTrackName ? ` - ${bacTrackName}` : ''}{bacIntOptionName ? ` (${bacIntOptionName})` : ''} in {country}</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-ink font-sans">{t('actions_create_classroom')}</h2>
          </div>
          
          <div className="flex items-center gap-4 shrink-0">
            <button 
              onClick={fetchCurriculum}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-accent/5 text-accent rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-accent/10 transition-all disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              Regenerate
            </button>
            <div className="group relative inline-block">
              <button className="w-10 h-10 rounded-full bg-surface-low flex items-center justify-center text-muted hover:text-accent hover:bg-accent/10 transition-colors">
                <Info className="w-5 h-5" />
              </button>
              <div className="absolute right-0 top-full mt-2 w-72 p-4 bg-paper border border-ink/5 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <p className="text-sm text-muted leading-relaxed">
                  These classrooms are dynamically generated by AI based on your region and academic level, 
                  sourced from trusted global educational standards.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Bar - Sticky Editorial */}
        <div className="sticky top-20 z-30 bg-background/60 backdrop-blur-2xl border-b border-ink/5 -mx-12 px-12">
          <div className="h-12 flex items-center justify-end gap-10">
            <div className="flex items-center gap-12">
              <button className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-[0.2em] text-muted hover:text-ink transition-colors group">
                <Filter className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                Filter
              </button>
              <button className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-[0.2em] text-muted hover:text-ink transition-colors group">
                <ArrowUpDown className="w-4 h-4 group-hover:scale-110 transition-transform duration-500" />
                Sort
              </button>
            </div>
          </div>
        </div>

        {/* Modules Grid - Visible Grid Aesthetic */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-ink/5 border border-ink/5">
          <AnimatePresence mode="popLayout">
            {isLoading ? (
              <div className="col-span-full py-32 flex flex-col items-center justify-center space-y-4 bg-background">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
                <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-muted">Curating from trusted resources...</p>
              </div>
            ) : filteredModules.length > 0 ? (
              filteredModules.map((module, i) => (
                <motion.div 
                  key={module.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.05, duration: 0.6 }}
                  onClick={() => navigate(`/classroom/${module.id}`)}
                  className={`group relative p-8 bg-background cursor-pointer transition-all duration-700 overflow-hidden border-r border-b border-ink/5 ${
                    module.selected ? 'bg-paper/30' : 'hover:bg-paper/10'
                  }`}
                >
                  <div className="flex items-start justify-between mb-8 relative z-10">
                    <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center transition-all duration-700 ${
                      module.selected 
                        ? 'bg-ink text-paper border-ink shadow-xl shadow-ink/20' 
                        : 'bg-background border-ink/10 group-hover:border-accent/30 group-hover:text-accent'
                    }`}>
                      {module.icon}
                    </div>
                    <div className="text-right">
                      <span className="text-[8px] font-mono tracking-[0.3em] text-muted/30 uppercase block mb-1">{module.category}</span>
                      <span className="text-[10px] font-mono text-muted group-hover:text-ink transition-colors">{module.code}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-3 relative z-10">
                    <h3 className="text-2xl font-serif leading-tight group-hover:italic transition-all duration-500">{module.name}</h3>
                    <p className="text-sm text-muted/60 leading-relaxed font-light line-clamp-3 group-hover:text-muted transition-colors">
                      {module.description}
                    </p>
                    <div className="pt-2" onClick={(e) => e.stopPropagation()}>
                      <TagsManager 
                        tags={module.tags || []} 
                        onAddTag={async (tag) => {
                          const currentTags = module.tags || [];
                          if (!currentTags.includes(tag)) {
                            await db.modules.update(module.id, { tags: [...currentTags, tag] });
                          }
                        }}
                        onRemoveTag={async (tag) => {
                          const currentTags = module.tags || [];
                          await db.modules.update(module.id, { tags: currentTags.filter(t => t !== tag) });
                        }}
                        maxDisplay={7}
                      />
                    </div>
                  </div>

                  <div className="mt-10 flex items-center justify-between relative z-10">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleModule(module.id);
                      }}
                      className="flex items-center gap-2 hover:opacity-80 transition-opacity p-2 -ml-2 rounded-lg"
                    >
                      <div className={`w-1.5 h-1.5 rounded-full transition-all duration-700 ${
                        module.selected ? 'bg-accent shadow-[0_0_8px_rgba(var(--color-accent-rgb),0.6)] scale-125' : 'bg-ink/10'
                      }`} />
                      <span className={`text-[8px] font-mono uppercase tracking-[0.2em] transition-colors duration-700 ${
                        module.selected ? 'text-ink font-bold' : 'text-muted/40'
                      }`}>
                        {module.selected ? 'Active' : 'Available'}
                      </span>
                    </button>
                    
                    <AnimatePresence>
                      {module.selected && (
                        <motion.div 
                          initial={{ scale: 0, opacity: 0, rotate: -45 }}
                          animate={{ scale: 1, opacity: 1, rotate: 0 }}
                          exit={{ scale: 0, opacity: 0, rotate: 45 }}
                          className="text-accent"
                        >
                          <Check className="w-5 h-5" strokeWidth={3} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Selection Background Effect */}
                  {module.selected && (
                    <motion.div 
                      layoutId={`bg-highlight-${module.id}`}
                      className="absolute inset-0 bg-accent/[0.02] pointer-events-none z-0"
                    />
                  )}
                </motion.div>
              ))
            ) : (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="col-span-full py-32 bg-background flex flex-col items-center justify-center text-center space-y-6"
              >
                <div className="w-20 h-20 bg-accent/5 rounded-full flex items-center justify-center mx-auto">
                  <Sparkles className="w-8 h-8 text-accent" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-serif">Your classroom is ready to be built.</h3>
                  <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted/40 max-w-md mx-auto leading-relaxed">
                    Click 'Create' to generate a personalized curriculum based on your {grade}{bacTrackName ? ` - ${bacTrackName}` : ''}{bacIntOptionName ? ` (${bacIntOptionName})` : ''} settings in {country}.
                  </p>
                </div>
                <button 
                  onClick={fetchCurriculum}
                  className="px-10 py-4 bg-accent text-paper rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-accent-hover transition-all shadow-xl shadow-accent/20 flex items-center gap-3"
                >
                  <Sparkles className="w-4 h-4" />
                  Create My Classroom
                </button>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* Selection Summary Bar */}
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-ink text-paper py-8 px-12 rounded-3xl shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden"
        >
          <div className="flex items-center gap-12">
            <div className="flex flex-col">
              <span className="text-[9px] font-mono uppercase tracking-[0.3em] text-paper/40 mb-1">Current Selection</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-serif italic">{selectedCount}</span>
                <span className="text-[10px] font-mono uppercase tracking-widest text-paper/60">Modules Ready</span>
              </div>
            </div>
            <div className="h-12 w-px bg-paper/10 hidden md:block"></div>
            <button 
              onClick={resetSelection}
              className="text-[10px] font-mono uppercase tracking-[0.2em] text-paper/40 hover:text-paper transition-colors"
            >
              Reset Selection
            </button>
          </div>

          <div className="flex items-center gap-10">
            <button className="text-[10px] font-mono uppercase tracking-[0.2em] text-paper/40 hover:text-paper transition-colors">
              Skip for now
            </button>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/dashboard')}
              className="bg-paper text-ink px-12 py-5 rounded-full text-xs font-mono uppercase tracking-[0.2em] font-bold flex items-center gap-4 hover:bg-accent hover:text-paper transition-all duration-500 shadow-xl shadow-ink/20"
            >
              {t('dashboard_continue')}
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
};

