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
  Sparkles,
  Loader2,
  PlusCircle,
  Play,
  RefreshCw
} from 'lucide-react';
import { generateCurriculum, checkAIProvider } from '../services/geminiService';
import { getClassroomLoadPlan, mapSubjectsToModules, mergeModulesWithAiSuggestions, shouldRequestAiCurriculumSuggestions } from '../services/classroomLoader';
import { getGradeCandidates, getSubjectCandidates, normalizeCurriculumValue } from '../services/curriculumMatching';
import { getSubjectsForGrade } from '../services/curriculumService';
import { supabase } from '../db/supabase';
import { useSearch } from '../context/SearchContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const getIconForCategory = (category: string) => {
  const cat = category.toLowerCase();
  if (cat.includes('math') || cat.includes('science') || cat.includes('physics') || cat.includes('chem')) return <FlaskConical className="w-5 h-5" />;
  if (cat.includes('hist') || cat.includes('geog') || cat.includes('social') || cat.includes('world')) return <Globe className="w-5 h-5" />;
  if (cat.includes('lit') || cat.includes('lang') || cat.includes('art')) return <BookOpen className="w-5 h-5" />;
  if (cat.includes('psych') || cat.includes('phil') || cat.includes('socio')) return <Brain className="w-5 h-5" />;
  return <Library className="w-5 h-5" />;
};

const getLessonIllustration = (title: string | null | undefined, category?: string | null | undefined) => {
  const t = String(title || '').toLowerCase();
  const c = String(category || '').toLowerCase();

  if (
    t.includes('math') ||
    t.includes('geom') ||
    t.includes('arith') ||
    t.includes('calcul') ||
    t.includes('algebra') ||
    t.includes('suite') ||
    t.includes('serie') ||
    t.includes('série') ||
    t.includes('analyse') ||
    c.includes('math')
  ) {
    return '/illustrations/math_geometry.png';
  }

  if (
    t.includes('physic') ||
    t.includes('physiq') ||
    t.includes('chem') ||
    t.includes('chim') ||
    t.includes('electr') ||
    t.includes('circuit') ||
    t.includes('combust') ||
    c.includes('phys') ||
    c.includes('chim')
  ) {
    return '/illustrations/physics_chemistry.png';
  }

  if (
    t.includes('svt') ||
    t.includes('earth') ||
    t.includes('life') ||
    t.includes('tecton') ||
    t.includes('plaqu') ||
    t.includes('seisme') ||
    t.includes('séisme') ||
    t.includes('volcan') ||
    t.includes('roche') ||
    t.includes('geolog') ||
    t.includes('géolog') ||
    t.includes('biolog') ||
    c.includes('svt') ||
    c.includes('vie')
  ) {
    return '/illustrations/earth_sciences.png';
  }

  if (
    t.includes('lang') ||
    t.includes('arab') ||
    t.includes('french') ||
    t.includes('franc') ||
    t.includes('franç') ||
    t.includes('read') ||
    t.includes('book') ||
    t.includes('litter') ||
    t.includes('littér') ||
    t.includes('philoso') ||
    t.includes('lexiq') ||
    t.includes('gramm') ||
    t.includes('ortho') ||
    t.includes('conju') ||
    c.includes('lang') ||
    c.includes('fr') ||
    c.includes('ar') ||
    c.includes('phil')
  ) {
    return '/illustrations/humanities_languages.png';
  }

  return '/illustrations/default_edu.png';
};

const MODULES_SCOPE_VERSION = 'v2';

const filterBySelectedSubject = <T extends { id: string }>(items: T[], selectedSubjectId: string) =>
  selectedSubjectId ? items.filter((item) => item.id === selectedSubjectId) : items;

const buildTrustedSubjectSet = (subjectNames: string[]) =>
  new Set(subjectNames.map((name) => normalizeCurriculumValue(name)));

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

  const dbSettings = useLiveQuery(() => db.settings.toArray()) || [];
  const settingsMap = useMemo(() => Object.fromEntries(dbSettings.map(s => [s.key, s.value])), [dbSettings]);

  const country = settingsMap['selected_country'] || localStorage.getItem('selected_country') || '';
  const selectedGradeId = settingsMap['selected_grade_id'] || localStorage.getItem('selected_grade_id') || '';
  const grade = settingsMap['selected_grade'] || localStorage.getItem('selected_grade') || 'Grade 12';
  const selectedSubjectId = settingsMap['selected_subject_id'] || localStorage.getItem('selected_subject_id') || '';
  const selectedSubjectName = settingsMap['selected_subject'] || localStorage.getItem('selected_subject') || '';
  const selectedBacTrackId = settingsMap['selected_bac_track'] || localStorage.getItem('selected_bac_track') || '';
  const selectedBacIntOptionId = settingsMap['selected_bac_int_option'] || localStorage.getItem('selected_bac_int_option') || '';
  const classroomScopeKey = [
    'modules',
    MODULES_SCOPE_VERSION,
    selectedGradeId,
    selectedSubjectId,
    normalizeCurriculumValue(country),
    normalizeCurriculumValue(grade),
    normalizeCurriculumValue(String(selectedBacTrackId || '')),
    normalizeCurriculumValue(String(selectedBacIntOptionId || '')),
  ].join(':');
  const storedClassroomScopeKey = settingsMap['modules_scope_key'] || localStorage.getItem('modules_scope_key') || '';

  const [bacTrackName, setBacTrackName] = useState<string>('');
  const [bacIntOptionName, setBacIntOptionName] = useState<string>('');
  const trustedSubjectNames = selectedSubjectName ? [selectedSubjectName] : [];
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
  }, [classroomScopeKey, country, dbModules, grade, isPro, modules.length, selectedGradeId, selectedSubjectId, storedClassroomScopeKey]);

  const fetchCurriculum = async (includeAiSuggestions = false, bypassAiCache = false) => {
    setIsLoading(true);
    try {
      if (!selectedGradeId) {
        console.warn('[Modules] Cannot load classroom curriculum without selected_grade_id.');
        return;
      }

      const scopedSubjectRows = await getSubjectsForGrade(selectedGradeId);
      const subjectRows = filterBySelectedSubject(scopedSubjectRows, selectedSubjectId);

      if (subjectRows.length === 0) {
        console.warn('[Modules] No Supabase subjects matched the selected onboarding grade/subject.', {
          selectedGradeId,
          selectedSubjectId,
          grade,
          selectedSubjectName,
        });
      }

      const supabaseModules = mapSubjectsToModules((subjectRows || []) as any[]);
      let modulesToStore = supabaseModules;

      if (trustedSubjectSet.size > 0) {
        modulesToStore = supabaseModules.filter((module) => moduleMatchesTrustedSubjects(module, trustedSubjectSet));
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

        const nextIds = new Set(mergedModules.map((module) => module.id));
        const staleModuleIds = (dbModules || [])
          .filter((module) => !nextIds.has(module.id))
          .map((module) => module.id);

        if (staleModuleIds.length > 0) {
          await db.modules.bulkDelete(staleModuleIds);
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
      <div className="space-y-4">
        {/* Filter Bar */}
        <div className="relative z-10 w-full border-y border-slate-200 bg-white px-4 py-2 dark:border-white/8 dark:bg-paper md:px-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-ink-muted">{filteredModules.length} subjects available</p>
            <div className="flex items-center gap-2">
              <button className="ls-button-ghost h-9 w-9 px-0" title="Filter" aria-label="Filter">
                <Filter className="w-4 h-4" />
              </button>
              <button className="ls-button-ghost h-9 w-9 px-0" title="Sort" aria-label="Sort">
                <ArrowUpDown className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  const plan = getClassroomLoadPlan({ action: 'refresh_suggestions', isPro });
                  fetchCurriculum(plan.includeAiSuggestions, true);
                }}
                disabled={isLoading || !aiAvailable || !isPro}
                title={!aiAvailable ? aiUnavailableMsg : 'Refresh'}
                aria-label="Refresh"
                className="ls-button-ghost h-9 w-9 px-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Modules Grid - Visible Grid Aesthetic */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                  className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col group hover:border-accent/30 hover:shadow-md transition-all dark:bg-paper dark:border-white/8 shadow-sm"
                >
                  <div className="bg-[#007A87] px-4 py-3 flex items-center justify-between gap-3 text-white dark:bg-accent shrink-0">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-5 h-5 shrink-0 text-white" />
                      <h3 className="text-sm font-bold leading-tight truncate text-white" title={module.name}>{module.name}</h3>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {module.category && module.category !== module.name && (
                        <span className="bg-white/15 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm truncate max-w-[76px]" title={module.category}>{module.category}</span>
                      )}
                      {module.code && module.code !== module.name && (
                        <span className="bg-white/15 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm truncate max-w-[52px]" title={module.code}>{module.code}</span>
                      )}
                    </div>
                  </div>

                  <div className="h-20 w-full overflow-hidden relative border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-surface-low shrink-0">
                    <img
                      src={getLessonIllustration(module.name, module.category)}
                      alt={module.name}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>

                  <div className="p-4 flex-1 flex flex-col gap-3">
                    <div className="grid grid-cols-[auto_1fr] gap-3 text-sm items-center">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-slate-400 dark:text-ink-muted" />
                        <span className="font-bold text-slate-800 dark:text-ink">{lessonCountByModuleId[module.id] ?? 0}</span>
                        <span className="text-xs text-slate-500 dark:text-ink-muted">lessons</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-bold">
                          <span className="text-slate-400 dark:text-ink-muted">Progress</span>
                          <span className="text-slate-800 dark:text-ink">{module.progress}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden dark:bg-surface-mid">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${module.progress}%` }} />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-white/6">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/classroom/${module.id}`); }}
                          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-2 text-xs font-bold text-white transition-colors shadow-sm"
                        >
                          <Play className="w-3 h-3 fill-current text-white" />
                          Start
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleModule(module.id); }}
                          className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 transition-colors dark:border-white/10 dark:bg-paper dark:text-ink-secondary dark:hover:bg-surface-low"
                        >
                          Plan
                        </button>
                      </div>

                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${
                        module.selected ? 'text-accent' : 'text-emerald-700 dark:text-emerald-400'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${module.selected ? 'bg-accent' : 'bg-emerald-500 animate-pulse'}`} />
                        {module.selected ? 'Active' : 'Available'}
                      </span>
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
                <h3 className="text-2xl font-serif">No classrooms yet</h3>
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
                  Create classroom
                </button>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* Selection Summary Bar */}
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-slate-950 text-white py-3 px-5 rounded-2xl shadow-md flex flex-col md:flex-row items-center justify-between gap-3 relative overflow-hidden"
        >
          <div className="flex items-center gap-5">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold">{selectedCount}</span>
              <span className="text-xs font-medium text-white/60">ready</span>
            </div>
            <div className="h-6 w-px bg-white/10 hidden md:block"></div>
            <button 
              onClick={resetSelection}
              className="text-xs font-semibold text-white/45 hover:text-white transition-colors"
            >
              Reset
            </button>
          </div>

          <div className="flex items-center">
            <motion.button 
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/dashboard')}
              className="bg-white text-slate-950 px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-accent hover:text-white transition-all duration-300 shadow-sm shadow-ink/20 dark:bg-paper dark:text-ink dark:hover:bg-accent dark:hover:text-white"
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
