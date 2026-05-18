import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Layout } from '../components/Layout';
import { SEO } from '../components/SEO';
import {
  Filter,
  ArrowUpDown,
  BookOpen,
  Globe,
  FlaskConical,
  Library,
  Brain,
  ArrowRight,
  Info,
  Sparkles,
  Loader2,
  PlusCircle
} from 'lucide-react';
import { generateCurriculum, checkAIProvider } from '../services/geminiService';
import { getClassroomLoadPlan, mapSubjectsToModules, mergeModulesWithAiSuggestions, shouldRequestAiCurriculumSuggestions } from '../services/classroomLoader';
import { getGradeCandidates, getSubjectCandidates, normalizeCurriculumValue } from '../services/curriculumMatching';
import { supabase } from '../db/supabase';
import { useSearch } from '../context/SearchContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const relativeTime = (ts: number) => {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const getIconForCategory = (category: string) => {
  const cat = category.toLowerCase();
  if (cat.includes('math') || cat.includes('science') || cat.includes('physics') || cat.includes('chem')) return <FlaskConical className="w-5 h-5" />;
  if (cat.includes('hist') || cat.includes('geog') || cat.includes('social') || cat.includes('world')) return <Globe className="w-5 h-5" />;
  if (cat.includes('lit') || cat.includes('lang') || cat.includes('art')) return <BookOpen className="w-5 h-5" />;
  if (cat.includes('psych') || cat.includes('phil') || cat.includes('socio')) return <Brain className="w-5 h-5" />;
  return <Library className="w-5 h-5" />;
};

const MODULES_SCOPE_VERSION = 'v2';

const MOROCCAN_SCOPE_SUBJECTS: Record<string, string[]> = {
  'tronc commun::tronc commun scientifique': [
    'Mathématiques',
    'Physique-Chimie',
    'Sciences de la Vie et de la Terre (SVT)',
    'Français',
    'Informatique',
    'Arabe',
    'Education Islamique',
    'Histoire-Géographie',
  ],
  'tronc commun::tronc commun litteraire': [
    'Arabe',
    'Français',
    'Histoire-Géographie',
    'Education Islamique',
    'Mathématiques',
    'Informatique',
  ],
  'tronc commun::tronc commun technologique': [
    'Mathématiques',
    'Physique-Chimie',
    "Sciences de l'Ingénieur",
    'Français',
    'Informatique',
  ],
};

const buildTrustedSubjectNames = (country: string, grade: string, track: string) => {
  if (normalizeCurriculumValue(country) !== 'morocco') return [];
  return MOROCCAN_SCOPE_SUBJECTS[`${normalizeCurriculumValue(grade)}::${normalizeCurriculumValue(track)}`] || [];
};

const buildTrustedSubjectSet = (subjectNames: string[]) =>
  new Set(
    subjectNames
      .flatMap((name) => getSubjectCandidates(name))
      .map((name) => normalizeCurriculumValue(name)),
  );

const moduleMatchesTrustedSubjects = (
  module: { name: string; category: string; code: string },
  trustedSubjects: Set<string>,
) => {
  if (trustedSubjects.size === 0) return true;

  const candidates = new Set(
    [
      ...getSubjectCandidates(module.name, module.category),
      module.code,
    ].map((value) => normalizeCurriculumValue(String(value || ''))),
  );

  return Array.from(candidates).some((candidate) => trustedSubjects.has(candidate));
};

const buildFallbackTrustedModules = (subjectNames: string[]) =>
  subjectNames.map((name) => ({
    id: `trusted-${normalizeCurriculumValue(name).replace(/\s+/g, '-')}`,
    name,
    code: name,
    description: 'Trusted Moroccan curriculum subject',
    category: name,
    progress: 0,
    selected: false,
    createdAt: Date.now(),
  }));

const getNestedSingle = <T,>(value: T | T[] | null | undefined): T | null => {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
};

const inferGradeOrder = (grade: string) => {
  const normalized = normalizeCurriculumValue(grade);
  const numeric = normalized.match(/\d+/)?.[0];
  if (!numeric) return null;

  const value = Number(numeric);
  if (!Number.isFinite(value)) return null;
  return value;
};

const inferCycleKey = (grade: string) => {
  const normalized = normalizeCurriculumValue(grade);

  if (normalized.includes('primaire') || normalized.includes('primary')) return 'primary';
  if (normalized.includes('college') || normalized.includes('middle')) return 'college';
  if (
    normalized.includes('tronc commun') ||
    normalized.includes('bac') ||
    normalized.includes('lycee') ||
    normalized.includes('seconde') ||
    normalized.includes('premiere') ||
    normalized.includes('terminale')
  ) {
    return 'lycee';
  }

  return null;
};

const cycleMatchesKey = (cycleName: string, cycleKey: string | null) => {
  if (!cycleKey) return true;

  const normalized = normalizeCurriculumValue(cycleName);
  if (cycleKey === 'primary') return normalized.includes('primaire') || normalized.includes('primary') || cycleName.includes('الإبتدائي');
  if (cycleKey === 'college') return normalized.includes('college') || normalized.includes('middle') || cycleName.includes('الإعدادي');
  if (cycleKey === 'lycee') return normalized.includes('lycee') || normalized.includes('high') || cycleName.includes('التأهيلي');
  return true;
};

type SupabaseGradeRow = {
  id: string;
  name?: string | null;
  grade_order?: number | null;
  cycles?: {
    name?: string | null;
    curricula?: { country?: string | null } | Array<{ country?: string | null }> | null;
  } | Array<{
    name?: string | null;
    curricula?: { country?: string | null } | Array<{ country?: string | null }> | null;
  }> | null;
};

const findScopedGrade = (grades: SupabaseGradeRow[], country: string, grade: string) => {
  const gradeCandidates = getGradeCandidates(grade);
  const normalizedGradeCandidates = new Set(gradeCandidates.map(normalizeCurriculumValue));
  const normalizedCountry = normalizeCurriculumValue(country);
  const inferredGradeOrder = inferGradeOrder(grade);
  const inferredCycleKey = inferCycleKey(grade);

  const countryGrades = grades.filter((row) => {
    const cycle = getNestedSingle(row.cycles);
    const curriculum = getNestedSingle(cycle?.curricula);
    const rowCountry = normalizeCurriculumValue(String(curriculum?.country || ''));
    return !normalizedCountry || rowCountry === normalizedCountry;
  });

  const exact = countryGrades.find((row) => normalizedGradeCandidates.has(normalizeCurriculumValue(String(row.name || ''))));
  if (exact) return exact;

  if (inferredGradeOrder === null) return null;

  return countryGrades.find((row) => {
    const cycle = getNestedSingle(row.cycles);
    return row.grade_order === inferredGradeOrder && cycleMatchesKey(String(cycle?.name || ''), inferredCycleKey);
  }) || null;
};

const fetchSubjectsForCurrentGrade = async (country: string, grade: string) => {
  const { data: grades, error: gradeError } = await supabase
    .from('grades')
    .select('id, name, grade_order, cycles(name, curricula(country))');

  if (gradeError) throw gradeError;

  const matchedGrade = findScopedGrade((grades || []) as SupabaseGradeRow[], country, grade);
  if (!matchedGrade) return null;

  const { data: gradeSubjects, error: gradeSubjectError } = await supabase
    .from('grade_subjects')
    .select('subjects(*)')
    .eq('grade_id', matchedGrade.id);

  if (gradeSubjectError) throw gradeSubjectError;

  return (gradeSubjects || [])
    .map((row: any) => getNestedSingle(row.subjects))
    .filter(Boolean);
};

export const Modules: React.FC = () => {
  const { t } = useLanguage();
  const { isPro } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const { searchQuery } = useSearch();
  const navigate = useNavigate();
  const aiAvailable = checkAIProvider();
  const aiUnavailableMsg = 'AI curriculum suggestions require an API key.';

  const dbModules = useLiveQuery(() => db.modules.toArray());
  const allLessons = useLiveQuery(() => db.lessons.toArray()) || [];

  const lessonCountByModuleId = useMemo(
    () => allLessons.reduce<Record<string, number>>((acc, l) => {
      acc[l.moduleId] = (acc[l.moduleId] || 0) + 1;
      return acc;
    }, {}),
    [allLessons],
  );

  const lastActivityByModuleId = useMemo(
    () => allLessons.reduce<Record<string, number>>((acc, l) => {
      if (!acc[l.moduleId] || l.createdAt > acc[l.moduleId]) acc[l.moduleId] = l.createdAt;
      return acc;
    }, {}),
    [allLessons],
  );

  const dbSettings = useLiveQuery(() => db.settings.toArray()) || [];
  const settingsMap = useMemo(() => Object.fromEntries(dbSettings.map(s => [s.key, s.value])), [dbSettings]);

  const country = settingsMap['selected_country'] || localStorage.getItem('selected_country') || '';
  const grade = settingsMap['selected_grade'] || localStorage.getItem('selected_grade') || 'Grade 12';
  const selectedBacTrackId = settingsMap['selected_bac_track'] || localStorage.getItem('selected_bac_track') || '';
  const selectedBacIntOptionId = settingsMap['selected_bac_int_option'] || localStorage.getItem('selected_bac_int_option') || '';
  const classroomScopeKey = [
    'modules',
    MODULES_SCOPE_VERSION,
    normalizeCurriculumValue(country),
    normalizeCurriculumValue(grade),
    normalizeCurriculumValue(String(selectedBacTrackId || '')),
    normalizeCurriculumValue(String(selectedBacIntOptionId || '')),
  ].join(':');
  const storedClassroomScopeKey = settingsMap['modules_scope_key'] || localStorage.getItem('modules_scope_key') || '';

  const [bacTrackName, setBacTrackName] = useState<string>('');
  const [bacIntOptionName, setBacIntOptionName] = useState<string>('');
  const trustedSubjectNames = buildTrustedSubjectNames(country, grade, bacTrackName || selectedBacTrackId);
  const trustedSubjectSet = buildTrustedSubjectSet(trustedSubjectNames);
  const modules = (dbModules || [])
    .filter((module) => moduleMatchesTrustedSubjects(module, trustedSubjectSet))
    .map(m => ({
      ...m,
      icon: getIconForCategory(m.category)
    }));
  const selectedCount = modules.filter(m => m.selected).length;

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
      } else {
        setBacTrackName("");
      }

      if (selectedBacIntOptionId) {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedBacIntOptionId);
        if (isUUID) {
          const { data } = await supabase.from('bac_international_options').select('name').eq('id', selectedBacIntOptionId).single();
          if (data) setBacIntOptionName(data.name);
        } else {
          setBacIntOptionName(selectedBacIntOptionId);
        }
      } else {
        setBacIntOptionName("");
      }
    };
    fetchBacDetails();
  }, [selectedBacTrackId, selectedBacIntOptionId, grade]);

  useEffect(() => {
    if (dbModules === undefined) return;
    if (!country) return;
    if (storedClassroomScopeKey === classroomScopeKey && modules.length > 0) return;

    const plan = getClassroomLoadPlan({ action: 'create_classroom', isPro });
    fetchCurriculum(plan.includeAiSuggestions);
  }, [classroomScopeKey, country, dbModules, grade, isPro, modules.length, storedClassroomScopeKey]);

  const fetchCurriculum = async (includeAiSuggestions = false, bypassAiCache = false) => {
    setIsLoading(true);
    try {
      const scopedSubjectRows = await fetchSubjectsForCurrentGrade(country, grade);
      let subjectRows = scopedSubjectRows;

      if (subjectRows === null) {
        const { data, error } = await supabase.from('subjects').select('*').limit(500);
        if (error) throw error;
        subjectRows = data || [];
      }

      const supabaseModules = mapSubjectsToModules((subjectRows || []) as any[]);
      let modulesToStore = supabaseModules;

      if (trustedSubjectSet.size > 0) {
        const scopedSupabaseModules = supabaseModules.filter((module) => moduleMatchesTrustedSubjects(module, trustedSubjectSet));
        modulesToStore = scopedSupabaseModules.length > 0
          ? scopedSupabaseModules
          : buildFallbackTrustedModules(trustedSubjectNames);
      }

      if (shouldRequestAiCurriculumSuggestions({ includeAiSuggestions, aiAvailable })) {
        let fullGrade = grade;
        if (bacTrackName) {
          fullGrade += ` - ${bacTrackName}`;
        }
        if (bacIntOptionName) {
          fullGrade += ` (${bacIntOptionName})`;
        }

        try {
          const aiModules = await generateCurriculum(country, fullGrade, false, 2, bypassAiCache);
          if (aiModules && aiModules.length > 0) {
            const formattedAiModules = aiModules.map(m => ({
              id: m.id,
              name: m.name,
              code: m.code,
              description: m.description,
              category: m.category,
              progress: 0,
              selected: false,
              createdAt: Date.now()
            }));
            if (trustedSubjectSet.size > 0) {
              modulesToStore = mergeModulesWithAiSuggestions(modulesToStore, formattedAiModules);
            } else {
              modulesToStore = mergeModulesWithAiSuggestions(supabaseModules, formattedAiModules);
            }
          }
        } catch (aiError) {
          console.warn('AI curriculum suggestions failed; keeping Supabase curriculum:', aiError);
        }
      }

      if (trustedSubjectSet.size > 0) {
        modulesToStore = modulesToStore.filter((module) => moduleMatchesTrustedSubjects(module, trustedSubjectSet));
      }

      if (modulesToStore.length > 0) {
        const existingById = new Map((dbModules || []).map((module) => [module.id, module]));
        const mergedModules = modulesToStore.map((module) => {
          const existing = existingById.get(module.id);
          if (!existing) return module;

          return {
            ...module,
            progress: existing.progress ?? module.progress,
            selected: existing.selected ?? module.selected,
            tags: existing.tags ?? module.tags,
            strictRAG: existing.strictRAG ?? module.strictRAG,
            createdAt: existing.createdAt ?? module.createdAt,
          };
        });

        if (scopedSubjectRows !== null) {
          const nextIds = new Set(mergedModules.map((module) => module.id));
          const staleModuleIds = (dbModules || [])
            .filter((module) => !nextIds.has(module.id))
            .map((module) => module.id);

          if (staleModuleIds.length > 0) {
            await db.modules.bulkDelete(staleModuleIds);
          }
        }

        await db.modules.bulkPut(mergedModules);
        localStorage.setItem('modules_scope_key', classroomScopeKey);
        await db.settings.put({ key: 'modules_scope_key', value: classroomScopeKey });
      }
    } catch (error) {
      console.error('Failed to fetch classroom curriculum:', error);
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
          <div className="space-y-3 flex-1">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 dark:border-accent-soft dark:bg-accent-soft dark:text-accent">
              <Sparkles className="h-4 w-4 shrink-0" />
              Draft AI-assisted content · Pending curriculum validation
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-950 font-sans dark:text-ink">{t('actions_create_classroom')}</h2>
          </div>
          
          <div className="flex items-center gap-4 shrink-0">
            <button
              onClick={() => {
                const plan = getClassroomLoadPlan({ action: 'refresh_suggestions', isPro });
                fetchCurriculum(plan.includeAiSuggestions, true);
              }}
              disabled={isLoading || !aiAvailable || !isPro}
              title={!aiAvailable ? aiUnavailableMsg : undefined}
              className="ls-button-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              Regenerate
            </button>
            <div className="group relative inline-block">
              <button className="ls-button-secondary h-10 w-10 px-0">
                <Info className="w-5 h-5" />
              </button>
              <div className="absolute right-0 top-full mt-2 w-72 p-4 ls-card shadow-sm opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <p className="ls-body-text leading-relaxed">
                  These classrooms are loaded from your Supabase curriculum first. AI can optionally suggest extras for inspiration.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="sticky top-20 z-30 -mx-12 border-b border-slate-200 bg-white px-12 py-3 dark:border-white/8 dark:bg-paper">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-ink-muted">Choose a subject to manage curriculum content.</p>
            <div className="flex items-center gap-2">
              <button className="ls-button-ghost">
                <Filter className="w-4 h-4" />
                Filter
              </button>
              <button className="ls-button-ghost">
                <ArrowUpDown className="w-4 h-4" />
                Sort
              </button>
            </div>
          </div>
        </div>

        {/* Modules Grid - Visible Grid Aesthetic */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {isLoading ? (
              <div className="col-span-full py-32 flex flex-col items-center justify-center space-y-4 bg-white dark:bg-paper">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
                <p className="text-[10px] font-mono text-slate-500 dark:text-ink-muted">Curating from trusted resources...</p>
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
                  className="ls-interactive-card cursor-pointer p-5"
                >
                  {/* Header: icon + name + badges */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${
                        module.selected ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950' : 'bg-slate-100 text-slate-700 dark:bg-surface-mid dark:text-ink-secondary'
                      }`}>
                        {module.icon}
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-slate-950 leading-tight dark:text-ink">{module.name}</h3>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-ink-muted">Supabase curriculum subject</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {module.code && module.code !== module.name && (
                        <span className="ls-badge">{module.code}</span>
                      )}
                      {module.category && module.category !== module.name && (
                        <span className="ls-badge">{module.category}</span>
                      )}
                    </div>
                  </div>

                  {/* Metrics grid */}
                  <div className="mt-4 grid grid-cols-2 gap-2.5">
                    <div className="rounded-xl bg-slate-50 p-3 dark:bg-surface-low">
                      <p className="text-xs font-medium text-slate-500 dark:text-ink-muted">Lessons</p>
                      <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-ink">
                        {lessonCountByModuleId[module.id] ?? 0}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3 dark:bg-surface-low">
                      <p className="text-xs font-medium text-slate-500 dark:text-ink-muted">Progress</p>
                      <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-ink">{module.progress}%</p>
                    </div>
                    <div className="col-span-2 rounded-xl bg-slate-50 p-3 dark:bg-surface-low">
                      <p className="text-xs font-medium text-slate-500 dark:text-ink-muted">Last activity</p>
                      {lastActivityByModuleId[module.id] ? (
                        <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-ink">
                          {relativeTime(lastActivityByModuleId[module.id])}
                        </p>
                      ) : (
                        <p className="mt-1 text-sm font-semibold text-slate-400 dark:text-ink-muted">No activity yet</p>
                      )}
                    </div>
                  </div>

                  {/* Footer: status + actions */}
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-white/6">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                      module.selected ? 'text-accent' : 'text-emerald-700 dark:text-emerald-400'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${module.selected ? 'bg-accent' : 'bg-emerald-500'}`} />
                      {module.selected ? 'Active' : 'Available'}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleModule(module.id); }}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors dark:border-white/10 dark:bg-paper dark:text-ink-secondary dark:hover:bg-surface-low"
                      >
                        {module.selected ? 'Deactivate' : 'Select'}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/classroom/${module.id}`); }}
                        className="rounded-xl bg-slate-950 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 transition-colors dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
                      >
                        Open
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="col-span-full py-32 bg-white dark:bg-paper flex flex-col items-center justify-center text-center space-y-6"
              >
                <div className="w-20 h-20 bg-accent/5 rounded-full flex items-center justify-center mx-auto">
                  <Sparkles className="w-8 h-8 text-accent" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-serif">Your classroom is ready to be built.</h3>
                  <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500/40 dark:text-ink-muted/40 max-w-md mx-auto leading-relaxed">
                    Click 'Create' to load your curriculum from Supabase based on your {grade}{bacTrackName ? ` - ${bacTrackName}` : ''}{bacIntOptionName ? ` (${bacIntOptionName})` : ''} settings in {country}.
                  </p>
                </div>
                {!aiAvailable && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 max-w-sm dark:bg-amber-950/30 dark:border-amber-800/40">
                    <p className="text-xs text-amber-800 font-medium dark:text-amber-400">{aiUnavailableMsg}</p>
                  </div>
                )}
                <button
                  onClick={() => {
                    const plan = getClassroomLoadPlan({ action: 'create_classroom', isPro });
                    fetchCurriculum(plan.includeAiSuggestions);
                  }}
                  className="px-10 py-4 bg-accent text-white rounded-full text-xs font-medium hover:bg-accent-hover transition-all  flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PlusCircle className="w-4 h-4" />
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
          className="bg-slate-950 text-white py-8 px-12 rounded-3xl shadow-md flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden"
        >
          <div className="flex items-center gap-12">
            <div className="flex flex-col">
              <span className="text-[9px] font-mono  text-white/40 mb-1">Current Selection</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-serif italic">{selectedCount}</span>
                <span className="text-[10px] font-mono  text-white/60">Modules Ready</span>
              </div>
            </div>
            <div className="h-12 w-px bg-white/10 hidden md:block"></div>
            <button 
              onClick={resetSelection}
              className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40 hover:text-white transition-colors"
            >
              Reset Selection
            </button>
          </div>

          <div className="flex items-center gap-10">
            <button className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40 hover:text-white transition-colors">
              Skip for now
            </button>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/dashboard')}
              className="bg-white text-slate-950 px-12 py-5 rounded-full text-xs font-mono uppercase tracking-[0.2em] font-bold flex items-center gap-4 hover:bg-accent hover:text-white transition-all duration-500 shadow-sm shadow-ink/20 dark:bg-paper dark:text-ink dark:hover:bg-accent dark:hover:text-white"
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
