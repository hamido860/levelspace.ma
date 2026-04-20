import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Layout } from '../components/Layout';
import { SEO } from '../components/SEO';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Globe, 
  GraduationCap, 
  Save, 
  ShieldCheck, 
  Sparkles,
  CheckCircle2,
  Search,
  ChevronDown,
  X,
  FlaskConical,
  BookOpen,
  Library,
  Brain,
  Check,
  ArrowRight,
  Languages,
  Target,
  Database as DatabaseIcon,
  Cloud,
  CloudOff,
  AlertCircle,
  Clock,
  Key,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Grade } from '../types';
import { db } from '../db/db';
import { supabase, checkSupabaseConnection } from '../db/supabase';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { getCustomApiKey, setCustomApiKey } from '../services/geminiService';



export const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { t, language, setLanguage } = useLanguage();
  const { dbConnected, refreshDbConnection, syncData } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  
  const dbSettings = useLiveQuery(() => db.settings.toArray()) || [];
  const settingsMap = useMemo(() => {
    if (!Array.isArray(dbSettings)) return {};
    return Object.fromEntries(dbSettings.map(s => [s.key, s.value]));
  }, [dbSettings]);

  const [activeTab, setActiveTab] = useState<'profile' | 'preferences'>('profile');

  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<string>('Grade 12');
  
  // Baccalaureate Options State
  const [bacSection, setBacSection] = useState("");
  const [bacTrack, setBacTrack] = useState("");
  const [bacIntOption, setBacIntOption] = useState("");

  const [dbBacSections, setDbBacSections] = useState<any[]>([]);
  const [dbBacTracks, setDbBacTracks] = useState<any[]>([]);
  const [dbBacIntOptions, setDbBacIntOptions] = useState<any[]>([]);
  const [dbBacTrackIntOptions, setDbBacTrackIntOptions] = useState<any[]>([]);

  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<string>('General Learning');
  const [currentSession, setCurrentSession] = useState<string>('Fall 2024');
  const [defaultDuration, setDefaultDuration] = useState<number>(60);
  
  const [isSaved, setIsSaved] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // API Key State
  const [apiKey, setApiKey] = useState('');
  const [isApiKeySaved, setIsApiKeySaved] = useState(false);

  const languages = [
    { id: 'en', name: 'English', flag: '🇺🇸' },
    { id: 'fr', name: 'Français', flag: '🇫🇷' },
    { id: 'ar', name: 'العربية', flag: '🇲🇦' },
    { id: 'es', name: 'Español', flag: '🇪🇸' },
    { id: 'de', name: 'Deutsch', flag: '🇩🇪' },
  ];

  // Load settings from DB when they change
  useEffect(() => {
    if (dbSettings.length > 0) {
      if (settingsMap['selected_country']) setSelectedCountry(settingsMap['selected_country']);
      if (settingsMap['selected_grade']) setSelectedGrade(settingsMap['selected_grade']);
      if (settingsMap['selected_interests']) setSelectedInterests(settingsMap['selected_interests']);
      if (settingsMap['selected_goal']) setSelectedGoal(settingsMap['selected_goal']);
      if (settingsMap['current_session']) setCurrentSession(settingsMap['current_session']);
      if (settingsMap['default_session_duration']) setDefaultDuration(Number(settingsMap['default_session_duration']));
      if (settingsMap['selected_bac_section']) setBacSection(settingsMap['selected_bac_section']);
      if (settingsMap['selected_bac_track']) setBacTrack(settingsMap['selected_bac_track']);
      if (settingsMap['selected_bac_int_option']) setBacIntOption(settingsMap['selected_bac_int_option']);
    } else {
      // Fallback to localStorage if DB is empty
      const lsCountry = localStorage.getItem('selected_country');
      const lsGrade = localStorage.getItem('selected_grade');
      const lsInterests = localStorage.getItem('selected_interests');
      const lsGoal = localStorage.getItem('selected_goal');
      const lsSession = localStorage.getItem('current_session');
      const lsDuration = localStorage.getItem('default_session_duration');
      const lsBacSection = localStorage.getItem('selected_bac_section');
      const lsBacTrack = localStorage.getItem('selected_bac_track');
      const lsBacIntOption = localStorage.getItem('selected_bac_int_option');

      if (lsCountry) setSelectedCountry(lsCountry);
      if (lsGrade) setSelectedGrade(lsGrade);
      if (lsInterests) setSelectedInterests(JSON.parse(lsInterests));
      if (lsGoal) setSelectedGoal(lsGoal);
      if (lsSession) setCurrentSession(lsSession);
      if (lsDuration) setDefaultDuration(Number(lsDuration));
      if (lsBacSection) setBacSection(lsBacSection);
      if (lsBacTrack) setBacTrack(lsBacTrack);
      if (lsBacIntOption) setBacIntOption(lsBacIntOption);
    }
  }, [dbSettings.length]);

  useEffect(() => {
    setApiKey(getCustomApiKey());
  }, []);

  const interests = [
    { id: 'interest_stem', label: t('stem'), icon: <FlaskConical className="w-4 h-4" /> },
    { id: 'interest_humanities', label: t('humanities'), icon: <Globe className="w-4 h-4" /> },
    { id: 'interest_arts', label: t('arts'), icon: <BookOpen className="w-4 h-4" /> },
    { id: 'interest_languages', label: t('languages'), icon: <Library className="w-4 h-4" /> },
    { id: 'interest_tech', label: t('tech'), icon: <Brain className="w-4 h-4" /> },
  ];

  const goals = [
    { id: 'goal_exam_prep', label: t('exam_prep') },
    { id: 'goal_skill_dev', label: t('skill_dev') },
    { id: 'goal_general_learning', label: t('general_learning') },
    { id: 'goal_career_transition', label: t('career_transition') },
  ];

  const [dbCountries, setDbCountries] = useState<{code: string, name: string}[]>([]);
  const [dbGrades, setDbGrades] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const { data: curriculaData, error: curriculaError } = await supabase.from('curricula').select('id, country');
        if (curriculaError || !curriculaData) return;
        
        const countries = curriculaData.map(i => {
          return {
            code: i.country,
            name: i.country
          };
        });
        
        const gradesMap: Record<string, string[]> = {};
        const { data: cyclesData } = await supabase.from('cycles').select('id, curriculum_id');
        const { data: gradesData } = await supabase.from('grades').select('id, cycle_id, name');
          
        if (cyclesData && gradesData) {
          curriculaData.forEach(curriculum => {
            const countryCycles = cyclesData.filter(c => c.curriculum_id === curriculum.id);
            const countryGrades = gradesData.filter(g => countryCycles.some(c => c.id === g.cycle_id));
            gradesMap[curriculum.country] = countryGrades.map(g => g.name);
          });
        }

        if (countries.length > 0) {
          setDbCountries(countries);
          setSelectedCountry(prev => prev || countries[0].code);
        }
        if (Object.keys(gradesMap).length > 0) setDbGrades(gradesMap);

        // Fetch Baccalaureate data
        const { data: sectionsData } = await supabase.from('bac_sections').select('*');
        if (sectionsData) setDbBacSections(sectionsData);
        
        const { data: tracksData } = await supabase.from('bac_tracks').select('*');
        if (tracksData) setDbBacTracks(tracksData);
        
        const { data: intOptionsData } = await supabase.from('bac_international_options').select('*');
        if (intOptionsData) setDbBacIntOptions(intOptionsData);
        
        const { data: trackIntOptionsData } = await supabase.from('bac_track_international_options').select('*');
        if (trackIntOptionsData) setDbBacTrackIntOptions(trackIntOptionsData);
      } catch (err) {
        console.error("Failed to fetch metadata", err);
      }
    };
    fetchMetadata();
  }, []);

  const availableCountries = dbCountries;
  const currentGrades = dbGrades[selectedCountry] || [];

  // Sync grade when country changes if current grade is not in the new system
  useEffect(() => {
    if (currentGrades && currentGrades.length > 0 && !currentGrades.includes(selectedGrade)) {
      setSelectedGrade(currentGrades[0]);
    }
  }, [selectedCountry, currentGrades, selectedGrade]);

  // Auto-save settings to localStorage and DB so they are not lost on refresh
  useEffect(() => {
    localStorage.setItem('selected_country', selectedCountry);
    localStorage.setItem('selected_grade', selectedGrade);
    localStorage.setItem('selected_interests', JSON.stringify(selectedInterests));
    localStorage.setItem('selected_goal', selectedGoal);
    localStorage.setItem('current_session', currentSession);
    localStorage.setItem('default_session_duration', defaultDuration.toString());
    localStorage.setItem('selected_bac_section', bacSection);
    localStorage.setItem('selected_bac_track', bacTrack);
    localStorage.setItem('selected_bac_int_option', bacIntOption);
    
    db.settings.bulkPut([
      { key: 'selected_country', value: selectedCountry },
      { key: 'selected_grade', value: selectedGrade },
      { key: 'selected_interests', value: selectedInterests },
      { key: 'selected_goal', value: selectedGoal },
      { key: 'current_session', value: currentSession },
      { key: 'default_session_duration', value: defaultDuration },
      { key: 'selected_bac_section', value: bacSection },
      { key: 'selected_bac_track', value: bacTrack },
      { key: 'selected_bac_int_option', value: bacIntOption }
    ]);

    window.dispatchEvent(new Event('storage'));
  }, [selectedCountry, selectedGrade, selectedInterests, selectedGoal, currentSession, defaultDuration, bacSection, bacTrack, bacIntOption]);

  const filteredCountries = availableCountries.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentCountryName = availableCountries.find(c => c.code === selectedCountry)?.name || selectedCountry;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSave = async () => {
    localStorage.setItem('selected_country', selectedCountry);
    localStorage.setItem('selected_grade', selectedGrade);
    localStorage.setItem('selected_interests', JSON.stringify(selectedInterests));
    localStorage.setItem('selected_goal', selectedGoal);
    localStorage.setItem('current_session', currentSession);
    localStorage.setItem('default_session_duration', defaultDuration.toString());
    
    // Save to DB
    await db.settings.bulkPut([
      { key: 'selected_country', value: selectedCountry },
      { key: 'selected_grade', value: selectedGrade },
      { key: 'selected_interests', value: selectedInterests },
      { key: 'selected_goal', value: selectedGoal },
      { key: 'current_session', value: currentSession },
      { key: 'default_session_duration', value: defaultDuration }
    ]);

    localStorage.removeItem('curated_modules'); // Force refresh
    
    // Clear database to force regeneration
    await db.modules.clear();
    await db.tasks.clear();
    await db.schedule.clear();

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const toggleInterest = (id: string) => {
    setSelectedInterests(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const setupProgress = [
    { label: t('region'), completed: !!selectedCountry },
    { label: t('grade'), completed: !!selectedGrade },
    { label: t('learning_interests'), completed: selectedInterests.length > 0 },
    { label: t('academic_goal'), completed: !!selectedGoal },
  ].filter(s => s.completed).length;

  const progressPercentage = (setupProgress / 4) * 100;

  const handleSaveApiKey = () => {
    if (apiKey.trim()) {
      setCustomApiKey(apiKey.trim());
      setIsApiKeySaved(true);
      setTimeout(() => setIsApiKeySaved(false), 3000);
    } else {
      setCustomApiKey('');
      setApiKey('');
      setIsApiKeySaved(true);
      setTimeout(() => setIsApiKeySaved(false), 3000);
    }
  };

  return (
    <Layout>
      <SEO title="Settings" />
      <div className="max-w-4xl mx-auto space-y-12 py-8 px-4 pb-32">
        {/* Onboarding Header */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 text-accent"
              >
                <Sparkles className="w-5 h-5" />
                <span className="text-[10px] font-bold uppercase tracking-[0.3em]">{t('profile_setup')}</span>
              </motion.div>
              <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-4xl font-serif font-medium tracking-tight text-ink"
              >
                {t('personalize_space')}
              </motion.h1>
            </div>
            <div className="text-right hidden md:block">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted/40">{t('setup_progress')}</span>
              <div className="flex items-center gap-3 mt-1">
                <div className="w-32 h-1.5 bg-ink/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercentage}%` }}
                    className="h-full bg-accent"
                  />
                </div>
                <span className="text-xs font-bold text-ink">{Math.round(progressPercentage)}%</span>
              </div>
            </div>
          </div>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-muted text-lg max-w-2xl leading-relaxed"
          >
            {t('configure_context')}
          </motion.p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-ink/10">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-6 py-3 text-sm font-bold uppercase tracking-widest transition-colors border-b-2 ${
              activeTab === 'profile' ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            Academic Profile
          </button>
          <button
            onClick={() => setActiveTab('preferences')}
            className={`px-6 py-3 text-sm font-bold uppercase tracking-widest transition-colors border-b-2 ${
              activeTab === 'preferences' ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            Preferences
          </button>
        </div>

        {activeTab === 'profile' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {/* Region Selection */}
            <section className="p-5 bg-paper border border-ink/5 rounded-3xl space-y-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-accent/5 rounded-lg flex items-center justify-center text-accent">
                  <Globe className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <h2 className="text-base font-medium text-ink leading-tight">{t('academic_region')}</h2>
                  <p className="text-[10px] text-muted/60 leading-tight">{t('ai_adapts')}</p>
                </div>
              </div>

              <div className="relative" ref={dropdownRef}>
                <button 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full p-4 bg-background border border-ink/10 rounded-2xl flex items-center justify-between cursor-pointer hover:border-accent/30 transition-all text-left"
                >
                  <span className="text-sm font-medium text-ink">{currentCountryName}</span>
                  <ChevronDown className={`w-4 h-4 text-muted transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {isDropdownOpen && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute z-50 left-0 right-0 mt-2 bg-paper border border-ink/10 rounded-2xl shadow-2xl overflow-hidden"
                    >
                      <div className="p-3 border-b border-ink/5">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted/50" />
                          <input 
                            type="text" 
                            placeholder={t('search_countries')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-background border border-ink/5 rounded-xl text-sm outline-none focus:ring-1 focus:ring-accent/20"
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        {filteredCountries.length > 0 ? (
                          filteredCountries.map((country) => (
                            <button
                              key={country.code}
                              onClick={() => {
                                setSelectedCountry(country.code);
                                setIsDropdownOpen(false);
                                setSearchQuery('');
                              }}
                              className={`w-full text-left px-4 py-3 text-sm transition-colors hover:bg-accent/5 flex items-center justify-between ${
                                selectedCountry === country.code ? 'text-accent font-bold bg-accent/5' : 'text-ink'
                              }`}
                            >
                              {country.name}
                              {selectedCountry === country.code && <CheckCircle2 className="w-4 h-4" />}
                            </button>
                          ))
                        ) : (
                          <div className="p-4 text-center text-xs text-muted">{t('no_countries_found')}</div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </section>

            {/* Grade Selection */}
            <section className="p-5 bg-paper border border-ink/5 rounded-3xl space-y-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-accent/5 rounded-lg flex items-center justify-center text-accent">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <h2 className="text-base font-medium text-ink leading-tight">{t('academic_level')}</h2>
                  <p className="text-[10px] text-muted/60 leading-tight">{t('grade')}</p>
                </div>
              </div>
              
              <div key={selectedCountry} className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                {currentGrades.map((grade, index) => (
                  <button
                    key={`${grade}-${index}`}
                    onClick={() => setSelectedGrade(grade)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      selectedGrade === grade 
                        ? 'bg-accent border-accent text-paper shadow-lg shadow-accent/20' 
                        : 'bg-background border-ink/5 text-ink hover:border-accent/30'
                    }`}
                  >
                    <span className="text-xs font-medium">{grade}</span>
                    {selectedGrade === grade && <CheckCircle2 className="w-3.5 h-3.5 text-accent" />}
                  </button>
                ))}
              </div>
            </section>

            {/* Baccalaureate Options (Only for Morocco Bac grades) */}
            {selectedCountry === 'Morocco' && (selectedGrade.includes('Bac') || selectedGrade.includes('Tronc Commun')) && (
              <section className="p-5 bg-paper border border-ink/5 rounded-3xl space-y-5 shadow-sm col-span-1 md:col-span-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-accent/5 rounded-lg flex items-center justify-center text-accent">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5">
                    <h2 className="text-base font-medium text-ink leading-tight">
                      {selectedGrade.includes('Tronc Commun') ? 'Common Core Section' : 'Baccalaureate Track'}
                    </h2>
                    <p className="text-[10px] text-muted/60 leading-tight">
                      {selectedGrade.includes('Tronc Commun') 
                        ? 'Select your foundation year section.' 
                        : 'Select your specific track to get the correct curriculum.'}
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-col md:flex-row gap-4">
                  {/* Section */}
                  <div className="space-y-2 flex-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Section</label>
                    <div className="grid grid-cols-1 gap-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                      {dbBacSections.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => {
                            setBacSection(s.id);
                            setBacTrack("");
                            setBacIntOption("");
                          }}
                          className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                            bacSection === s.id 
                              ? 'bg-accent border-accent text-paper shadow-lg shadow-accent/20' 
                              : 'bg-background border-ink/5 text-ink hover:border-accent/30'
                          }`}
                        >
                          <span className="text-xs font-medium text-left pr-2">{s.name}</span>
                          {bacSection === s.id && <CheckCircle2 className="w-3.5 h-3.5 text-paper shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Track - Only show if NOT Tronc Commun */}
                  {bacSection && !selectedGrade.includes('Tronc Commun') && (
                    <div className="space-y-2 flex-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Track</label>
                      <div className="grid grid-cols-1 gap-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                        {dbBacTracks.filter(t => t.section_id === bacSection).map((t) => (
                          <button
                            key={t.id}
                            onClick={() => {
                              setBacTrack(t.id);
                              setBacIntOption("");
                            }}
                            className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                              bacTrack === t.id 
                                ? 'bg-accent border-accent text-paper shadow-lg shadow-accent/20' 
                                : 'bg-background border-ink/5 text-ink hover:border-accent/30'
                            }`}
                          >
                            <span className="text-xs font-medium text-left pr-2">{t.name}</span>
                            {bacTrack === t.id && <CheckCircle2 className="w-3.5 h-3.5 text-paper shrink-0" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* International Option */}
                  {bacTrack && !selectedGrade.includes('Tronc Commun') && dbBacTrackIntOptions.some(tio => tio.track_id === bacTrack) && (
                    <div className="space-y-2 flex-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted">International Option</label>
                      <div className="grid grid-cols-1 gap-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                        <button
                          onClick={() => setBacIntOption("")}
                          className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                            bacIntOption === "" 
                              ? 'bg-accent border-accent text-paper shadow-lg shadow-accent/20' 
                              : 'bg-background border-ink/5 text-ink hover:border-accent/30'
                          }`}
                        >
                          <span className="text-xs font-medium text-left pr-2">None (Standard)</span>
                          {bacIntOption === "" && <CheckCircle2 className="w-3.5 h-3.5 text-paper shrink-0" />}
                        </button>
                        {dbBacTrackIntOptions
                          .filter(tio => tio.track_id === bacTrack)
                          .map(tio => {
                            const option = dbBacIntOptions.find(o => o.id === tio.international_option_id);
                            if (!option) return null;
                            return (
                              <button
                                key={option.id}
                                onClick={() => setBacIntOption(option.id)}
                                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                                  bacIntOption === option.id 
                                    ? 'bg-accent border-accent text-paper shadow-lg shadow-accent/20' 
                                    : 'bg-background border-ink/5 text-ink hover:border-accent/30'
                                }`}
                              >
                                <span className="text-xs font-medium text-left pr-2">{option.name}</span>
                                {bacIntOption === option.id && <CheckCircle2 className="w-3.5 h-3.5 text-paper shrink-0" />}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Cloud & Data Sync */}
            <section className="p-5 bg-paper border border-ink/5 rounded-3xl space-y-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-accent/5 rounded-lg flex items-center justify-center text-accent">
                  <Cloud className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <h2 className="text-base font-medium text-ink leading-tight">Cloud & Data</h2>
                  <p className="text-[10px] text-muted/60 leading-tight">Manage your cloud synchronization and local data.</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="p-4 bg-surface-low rounded-2xl border border-ink/5 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-ink uppercase tracking-widest">Supabase Connection</p>
                    <p className="text-[10px] text-muted">Status: <span className={dbConnected ? 'text-success font-bold' : 'text-error font-bold'}>{dbConnected ? 'Connected' : 'Disconnected'}</span></p>
                  </div>
                  <button 
                    onClick={refreshDbConnection}
                    className="p-2 hover:bg-ink/5 rounded-full transition-all"
                    title="Refresh Connection"
                  >
                    <RefreshCw className={`w-4 h-4 text-muted ${dbConnected === null ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <button
                  onClick={async () => {
                    setIsSyncing(true);
                    try {
                      const results = await syncData();
                      if (results.errors.length > 0) {
                        alert(`Sync completed with errors:\n${results.errors.join('\n')}`);
                      } else {
                        alert(`Sync successful!\nModules: ${results.modules}\nLessons: ${results.lessons}\nTasks: ${results.tasks}`);
                      }
                    } catch (err) {
                      alert('Sync failed. Please check your connection.');
                    } finally {
                      setIsSyncing(false);
                    }
                  }}
                  disabled={isSyncing || !dbConnected}
                  className="w-full flex items-center justify-center gap-3 p-4 bg-accent text-paper rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-accent-hover transition-all shadow-lg shadow-accent/20 disabled:opacity-50"
                >
                  {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
                  {isSyncing ? 'Synchronizing...' : 'Sync All Data to Cloud'}
                </button>
              </div>
            </section>

            {/* Interests Selection */}
            <section className="p-5 bg-paper border border-ink/5 rounded-3xl space-y-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-accent/5 rounded-lg flex items-center justify-center text-accent">
                  <Brain className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <h2 className="text-base font-medium text-ink leading-tight">{t('learning_interests')}</h2>
                  <p className="text-[10px] text-muted/60 leading-tight">{t('personalize_space')}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                {interests.map((interest) => (
                  <button
                    key={interest.id}
                    onClick={() => toggleInterest(interest.id)}
                    className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${
                      selectedInterests.includes(interest.id)
                        ? 'bg-ink border-ink text-paper shadow-lg shadow-ink/20'
                        : 'bg-background border-ink/5 text-ink hover:border-accent/30'
                    }`}
                  >
                    <span className={selectedInterests.includes(interest.id) ? 'text-accent' : 'text-muted'}>
                      {interest.icon}
                    </span>
                    <span className="text-xs font-medium">{interest.label}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Goals Selection */}
            <section className="p-5 bg-paper border border-ink/5 rounded-3xl space-y-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-accent/5 rounded-lg flex items-center justify-center text-accent">
                  <Target className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <h2 className="text-base font-medium text-ink leading-tight">{t('academic_goal')}</h2>
                  <p className="text-[10px] text-muted/60 leading-tight">{t('status')}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                {goals.map((goal) => (
                  <button
                    key={goal.id}
                    onClick={() => setSelectedGoal(goal.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                      selectedGoal === goal.id
                        ? 'bg-ink border-ink text-paper shadow-lg shadow-ink/20'
                        : 'bg-background border-ink/5 text-ink hover:border-accent/30'
                    }`}
                  >
                    <span className="text-xs font-medium">{goal.label}</span>
                    <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                      selectedGoal === goal.id ? 'border-accent bg-accent' : 'border-ink/10'
                    }`}>
                      {selectedGoal === goal.id && <Check className="w-2.5 h-2.5 text-paper" />}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </motion.div>
        )}

        {activeTab === 'preferences' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {/* Session Settings */}
            <section className="p-5 bg-paper border border-ink/5 rounded-3xl space-y-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-accent/5 rounded-lg flex items-center justify-center text-accent">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <h2 className="text-base font-medium text-ink leading-tight">{t('session_settings')}</h2>
                  <p className="text-[10px] text-muted/60 leading-tight">Configure study session defaults</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted">{t('current_session')}</label>
                  <input 
                    type="text" 
                    value={currentSession}
                    onChange={(e) => setCurrentSession(e.target.value)}
                    placeholder={t('e_g_fall_2024')}
                    className="w-full p-3 bg-background border border-ink/5 rounded-xl text-sm outline-none focus:ring-1 focus:ring-accent/20"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted">{t('default_session_duration')}</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="range" 
                      min="15" 
                      max="180" 
                      step="15"
                      value={defaultDuration}
                      onChange={(e) => setDefaultDuration(Number(e.target.value))}
                      className="flex-grow accent-accent"
                    />
                    <span className="text-xs font-bold text-ink w-20 text-right">{defaultDuration} {t('minutes')}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* API Key Settings */}
            <section className="p-5 bg-paper border border-ink/5 rounded-3xl space-y-5 shadow-sm flex flex-col">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-accent/5 rounded-lg flex items-center justify-center text-accent">
                  <Key className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <h2 className="text-base font-medium text-ink leading-tight">Google AI Studio API Key</h2>
                  <p className="text-[10px] text-muted/60 leading-tight">Use your own Gemini API key</p>
                </div>
              </div>
              
              <div className="space-y-4 flex-grow">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted">API Key</label>
                  <input 
                    type="password" 
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full p-3 bg-background border border-ink/5 rounded-xl text-sm outline-none focus:ring-1 focus:ring-accent/20 font-mono"
                  />
                </div>
                <div className="text-xs text-muted leading-relaxed">
                  Your key is stored locally in your browser and is never sent to our servers.
                </div>
              </div>
              
              <div className="pt-4 border-t border-ink/5 flex justify-end">
                <button 
                  onClick={handleSaveApiKey}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${
                    isApiKeySaved ? 'bg-emerald-500 text-paper' : 'bg-ink text-paper hover:bg-accent'
                  }`}
                >
                  {isApiKeySaved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  {isApiKeySaved ? 'Saved' : 'Save Key'}
                </button>
              </div>
            </section>

            {/* Supabase Connection Status */}
            <section className="p-5 bg-paper border border-ink/5 rounded-3xl space-y-5 shadow-sm flex flex-col md:col-span-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-accent/5 rounded-lg flex items-center justify-center text-accent">
                    <DatabaseIcon className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5">
                    <h2 className="text-base font-medium text-ink leading-tight">Supabase Cloud Sync</h2>
                    <p className="text-[10px] text-muted/60 leading-tight">Connect to your own database for cross-device sync</p>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 ${
                  dbConnected ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${dbConnected ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                  {dbConnected ? 'Connected' : 'Local-Only Mode'}
                </div>
              </div>

              {!dbConnected ? (
                <div className="p-6 bg-amber-500/5 border border-amber-500/10 rounded-2xl space-y-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <h3 className="text-sm font-bold text-ink">Supabase is not configured</h3>
                      <p className="text-xs text-muted leading-relaxed">
                        To enable cloud sync and real-time features, you need to provide your Supabase credentials in the <strong>Secrets</strong> panel of AI Studio.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="p-3 bg-paper rounded-xl border border-ink/5 space-y-1">
                      <span className="text-[9px] font-mono font-bold text-muted uppercase tracking-widest">Variable 1</span>
                      <code className="block text-[10px] font-mono text-ink bg-ink/5 p-1.5 rounded">VITE_SUPABASE_URL</code>
                    </div>
                    <div className="p-3 bg-paper rounded-xl border border-ink/5 space-y-1">
                      <span className="text-[9px] font-mono font-bold text-muted uppercase tracking-widest">Variable 2</span>
                      <code className="block text-[10px] font-mono text-ink bg-ink/5 p-1.5 rounded">VITE_SUPABASE_ANON_KEY</code>
                    </div>
                  </div>
                  <button 
                    onClick={refreshDbConnection}
                    className="w-full py-3 bg-ink text-paper rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-accent transition-all"
                  >
                    Refresh Connection Status
                  </button>
                </div>
              ) : (
                <div className="p-6 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-ink">Connection Active</h3>
                      <p className="text-xs text-muted">Your data is being synced to your Supabase instance.</p>
                    </div>
                  </div>
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                </div>
              )}
            </section>
          </motion.div>
        )}

        {/* Action Bar */}
        <div className="sticky bottom-8 z-40">
          <div className="p-6 bg-ink text-paper rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl border border-paper/10">
            <div className="flex items-center gap-6">
              <div className="flex flex-col">
                <span className="text-[9px] font-mono uppercase tracking-[0.3em] text-paper/40 mb-1">{t('status')}</span>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isSaved ? 'bg-emerald-400 animate-pulse' : 'bg-accent'}`} />
                  <span className="text-xs font-bold">{isSaved ? t('settings_saved') : t('pending_changes')}</span>
                </div>
              </div>
              {isSaved && (
                <motion.button
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={() => navigate('/modules')}
                  className="flex items-center gap-2 text-accent text-[10px] font-bold uppercase tracking-widest hover:underline"
                >
                  {t('continue_to_classrooms')} <ArrowRight className="w-3 h-3" />
                </motion.button>
              )}
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate('/dashboard')}
                className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-paper/40 hover:text-paper transition-colors"
              >
                {t('cancel')}
              </button>
              <button 
                onClick={handleSave}
                className={`px-10 py-4 rounded-full text-xs font-bold uppercase tracking-widest transition-all shadow-xl shadow-ink/20 flex items-center gap-3 ${
                  isSaved ? 'bg-emerald-500 text-paper' : 'bg-paper text-ink hover:bg-accent hover:text-paper'
                }`}
              >
                {isSaved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {isSaved ? t('profile_updated') : t('save_profile')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

