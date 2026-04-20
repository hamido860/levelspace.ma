import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  GraduationCap, ArrowRight, CheckCircle2, Sparkles, BookOpen, Layers, 
  BookA, BrainCircuit, LibraryBig, Globe
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../db/db';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

const CYCLES = [
  { id: 'primary', name: 'Primary Education', desc: 'Enseignement Primaire', icon: BookA },
  { id: 'college', name: 'Middle School', desc: 'Collège', icon: LibraryBig },
  { id: 'lycee', name: 'High School', desc: 'Lycée', icon: GraduationCap },
  { id: 'higher', name: 'Higher Education', desc: 'Classes Préparatoires / Univ', icon: BrainCircuit },
];

const GRADES_MAP: Record<string, string[]> = {
  primary: [
    '1ère année primaire', '2ème année primaire', '3ème année primaire', 
    '4ème année primaire', '5ème année primaire', '6ème année primaire'
  ],
  college: [
    '1ère année collège', '2ème année collège', '3ème année collège'
  ],
  lycee: [
    'Tronc Commun', '1ère année Bac', '2ème année Bac'
  ],
  higher: [
    'CPGE (1ère année)', 'CPGE (2ème année)'
  ]
};

const TRACKS_MAP: Record<string, string[]> = {
  'Tronc Commun': ['Tronc Commun Scientifique', 'Tronc Commun Littéraire', 'Tronc Commun Technologique'],
  '1ère année Bac': ['Sciences Mathématiques', 'Sciences Expérimentales', 'Sciences et Technologies', 'Lettres et Sciences Humaines', 'Sciences Économiques et Gestion'],
  '2ème année Bac': ['Sciences Mathématiques A', 'Sciences Mathématiques B', 'Sciences Physiques', 'SVT', 'Sciences Agronomiques', 'Lettres', 'Sciences Humaines', 'Sciences Économiques', 'Techniques de Gestion Comptable']
};

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onComplete }) => {
  const { profile, user } = useAuth();
  
  const [step, setStep] = useState(0);
  const [selectedCycle, setSelectedCycle] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedTrack, setSelectedTrack] = useState('');
  const [selectedOption, setSelectedOption] = useState('');

  const userName = profile?.full_name || (user?.email ? user.email.split('@')[0] : 'Explorer');

  const requiresTrack = selectedCycle === 'lycee';
  const totalSteps = requiresTrack ? 5 : 4; // 0=Welcome, 1=Cycle, 2=Grade, 3=Track(if lycee), 4/option=Done 

  const handleNext = () => setStep(s => Math.min(s + 1, totalSteps));
  const handleBack = () => setStep(s => Math.max(s - 1, 0));

  const handleComplete = async () => {
    localStorage.setItem('selected_country', 'Morocco');
    localStorage.setItem('selected_cycle', selectedCycle);
    localStorage.setItem('selected_grade', selectedGrade);
    if (selectedTrack) localStorage.setItem('selected_bac_track', selectedTrack);
    if (selectedOption) localStorage.setItem('selected_option', selectedOption);
    localStorage.setItem('has_completed_onboarding', 'true');

    await db.settings.put({ key: 'selected_country', value: 'Morocco' });
    await db.settings.put({ key: 'selected_cycle', value: selectedCycle });
    await db.settings.put({ key: 'selected_grade', value: selectedGrade });
    if (selectedTrack) await db.settings.put({ key: 'selected_bac_track', value: selectedTrack });
    if (selectedOption) await db.settings.put({ key: 'selected_option', value: selectedOption });
    await db.settings.put({ key: 'has_completed_onboarding', value: 'true' });

    onComplete();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-ink/40 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-paper w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden border border-ink/10 relative"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-transparent pointer-events-none" />
        
        <div className="absolute top-0 left-0 w-full h-1 bg-ink/5">
          <motion.div 
            className="h-full bg-accent"
            initial={{ width: '0%' }}
            animate={{ width: `${(step / totalSteps) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <div className="p-8 md:p-12 min-h-[500px] flex flex-col">
          <AnimatePresence mode="wait">
            
            {/* STEP 0: WELCOME */}
            {step === 0 && (
              <motion.div
                key="step-0"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex-1 flex flex-col items-center justify-center text-center space-y-8"
              >
                <div className="relative">
                  <div className="absolute -inset-4 bg-accent/20 blur-2xl rounded-full animate-pulse" />
                  <div className="relative w-24 h-24 bg-accent rounded-[2rem] flex items-center justify-center text-paper shadow-xl rotate-3">
                    <Sparkles className="w-12 h-12" />
                  </div>
                </div>
                <div className="space-y-4">
                  <h1 className="text-4xl sm:text-5xl font-display font-black text-ink leading-[1.1] tracking-tight">
                    Welcome, <span className="text-accent capitalize">{userName}</span><br />
                    Let's personalize your space
                  </h1>
                  <p className="text-muted text-lg max-w-md mx-auto font-medium leading-relaxed">
                    We'll tailor your academic curriculum to match your exact level and track.
                  </p>
                </div>
              </motion.div>
            )}

            {/* STEP 1: CYCLE */}
            {step === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col"
              >
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center text-accent">
                    <Layers className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-display font-bold text-ink">Academic Phase</h2>
                    <p className="text-muted">Select your current educational cycle.</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {CYCLES.map(cycle => (
                    <button
                      key={cycle.id}
                      onClick={() => { setSelectedCycle(cycle.id); setSelectedGrade(""); setSelectedTrack(""); }}
                      className={`p-5 rounded-[1.5rem] border-2 transition-all text-left flex items-start gap-4 group ${
                        selectedCycle === cycle.id 
                          ? 'bg-accent/5 border-accent shadow-lg shadow-accent/10 scale-[1.02]' 
                          : 'bg-surface-low border-transparent hover:border-accent/30 hover:bg-paper hover:shadow-md'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                        selectedCycle === cycle.id ? 'bg-accent text-paper' : 'bg-surface-mid text-ink-secondary group-hover:bg-accent/10 group-hover:text-accent'
                      }`}>
                        <cycle.icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className={`font-bold text-lg leading-tight mb-1 ${selectedCycle === cycle.id ? 'text-accent' : 'text-ink'}`}>
                          {cycle.name}
                        </h3>
                        <p className="text-sm text-muted font-medium">{cycle.desc}</p>
                      </div>
                      {selectedCycle === cycle.id && <CheckCircle2 className="w-5 h-5 text-accent shrink-0" />}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* STEP 2: GRADE */}
            {step === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col"
              >
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center text-accent">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-display font-bold text-ink">Select Grade</h2>
                    <p className="text-muted">Which specific year are you currently in?</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                  {GRADES_MAP[selectedCycle]?.map(grade => (
                    <button
                      key={grade}
                      onClick={() => { setSelectedGrade(grade); setSelectedTrack(""); }}
                      className={`p-4 rounded-2xl border-2 font-bold transition-all text-center flex items-center justify-center gap-2 ${
                        selectedGrade === grade 
                          ? 'bg-accent border-accent text-paper shadow-lg shadow-accent/20' 
                          : 'bg-surface-low border-transparent text-ink hover:border-accent/30 hover:bg-paper'
                      }`}
                    >
                      {grade}
                      {selectedGrade === grade && <CheckCircle2 className="w-4 h-4" />}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* STEP 3: TRACK (For Lycée) */}
            {step === 3 && requiresTrack && (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col"
              >
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center text-accent">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-display font-bold text-ink">Specialty / Track</h2>
                    <p className="text-muted">Choose your specific focus area.</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-3 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                  {TRACKS_MAP[selectedGrade]?.map(track => (
                    <button
                      key={track}
                      onClick={() => setSelectedTrack(track)}
                      className={`p-4 rounded-2xl border-2 font-bold transition-all text-left flex items-center justify-between group ${
                        selectedTrack === track 
                          ? 'bg-accent/10 border-accent text-accent shadow-md' 
                          : 'bg-surface-low border-transparent text-ink hover:border-accent/30 hover:bg-paper'
                      }`}
                    >
                      {track}
                      {selectedTrack === track && <CheckCircle2 className="w-5 h-5" />}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* STEP 4: INTERNATIONAL OPTION (If applicable) */}
            {step === (requiresTrack ? 4 : 3) && (
              <motion.div
                 key="step-option"
                 initial={{ opacity: 0, x: 20 }}
                 animate={{ opacity: 1, x: 0 }}
                 exit={{ opacity: 0, x: -20 }}
                 className="flex-1 flex flex-col"
              >
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center text-accent">
                    <Globe className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-display font-bold text-ink">Language Option</h2>
                    <p className="text-muted">In which language do you study scientific subjects?</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {[
                    { id: 'biof_fr', name: 'Option Français (BIOF)', desc: 'Math, Physics, and SVT are taught in French' },
                    { id: 'general_ar', name: 'Option Arabe (Général)', desc: 'Scientific subjects taught in Arabic' },
                    { id: 'biof_en', name: 'Option Anglais (BIOF)', desc: 'Starting slowly in some regions' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setSelectedOption(opt.id)}
                      className={`p-5 rounded-2xl border-2 transition-all text-left flex items-start justify-between group ${
                        selectedOption === opt.id 
                          ? 'bg-accent/5 border-accent shadow-md' 
                          : 'bg-surface-low border-transparent hover:border-accent/30 hover:bg-paper'
                      }`}
                    >
                      <div>
                        <h3 className={`font-bold text-lg mb-1 ${selectedOption === opt.id ? 'text-accent' : 'text-ink'}`}>{opt.name}</h3>
                        <p className="text-sm text-muted">{opt.desc}</p>
                      </div>
                      {selectedOption === opt.id && <CheckCircle2 className="w-6 h-6 text-accent mt-2" />}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* STEP: DONE SUMMARY */}
            {step === totalSteps && (
               <motion.div
                 key="step-final"
                 initial={{ opacity: 0, scale: 0.95 }}
                 animate={{ opacity: 1, scale: 1 }}
                 exit={{ opacity: 0, scale: 0.95 }}
                 className="flex-1 flex flex-col items-center justify-center text-center space-y-10"
               >
                 <div className="relative">
                   <div className="absolute -inset-6 bg-emerald-500/20 blur-3xl rounded-full" />
                   <div className="relative w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center text-paper shadow-xl">
                     <CheckCircle2 className="w-12 h-12" />
                   </div>
                 </div>

                 <div className="space-y-2">
                   <h2 className="text-3xl sm:text-4xl font-display font-black text-ink tracking-tight">
                     Workspace Ready
                   </h2>
                   <p className="text-muted font-medium text-lg">Your academic profile is perfectly configured.</p>
                 </div>

                 <div className="w-full bg-surface-low border border-ink/5 rounded-3xl p-6 text-left space-y-4">
                   <div className="flex justify-between border-b border-ink/5 pb-3">
                     <span className="text-muted font-bold uppercase text-sm tracking-wider">Cycle</span>
                     <span className="font-bold text-ink">{CYCLES.find(c => c.id === selectedCycle)?.name}</span>
                   </div>
                   <div className="flex justify-between border-b border-ink/5 pb-3">
                     <span className="text-muted font-bold uppercase text-sm tracking-wider">Grade</span>
                     <span className="font-bold text-ink">{selectedGrade}</span>
                   </div>
                   {requiresTrack && selectedTrack && (
                     <div className="flex justify-between border-b border-ink/5 pb-3">
                       <span className="text-muted font-bold uppercase text-sm tracking-wider">Track</span>
                       <span className="font-bold text-ink text-right max-w-[200px] truncate">{selectedTrack}</span>
                     </div>
                   )}
                   {selectedOption && (
                     <div className="flex justify-between">
                       <span className="text-muted font-bold uppercase text-sm tracking-wider">Option</span>
                       <span className="font-bold text-ink truncate max-w-[200px]">{selectedOption === 'biof_fr' ? 'Français' : (selectedOption === 'general_ar' ? 'Arabe' : 'Anglais')}</span>
                     </div>
                   )}
                 </div>
               </motion.div>
            )}

          </AnimatePresence>

          {/* Navigation Controls */}
          <div className="mt-8 flex items-center justify-between pt-6 border-t border-ink/10 relative z-10 w-full">
            {step > 0 ? (
              <button
                onClick={handleBack}
                className="px-6 py-3 rounded-2xl font-bold text-muted hover:text-ink hover:bg-ink/5 transition-all flex items-center gap-2 group"
              >
                <ArrowRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform" />
                Back
              </button>
            ) : (
              <div />
            )}

            {step < totalSteps ? (
              <button
                onClick={handleNext}
                disabled={
                  (step === 1 && !selectedCycle) || 
                  (step === 2 && !selectedGrade) || 
                  (step === 3 && requiresTrack && !selectedTrack) ||
                  (step === (requiresTrack ? 4 : 3) && !selectedOption)
                }
                className="px-8 py-3 bg-ink text-paper rounded-2xl font-bold flex items-center gap-2 hover:bg-accent transition-all disabled:opacity-30 disabled:hover:bg-ink shadow-lg hover:-translate-y-1"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleComplete}
                className="px-8 py-3 bg-accent text-paper rounded-2xl font-bold flex items-center gap-2 hover:bg-[var(--accent-hover)] transition-all shadow-xl shadow-accent/20 hover:-translate-y-1 group"
              >
                Enter Platform
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
