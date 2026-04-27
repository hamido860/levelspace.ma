import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { SEO } from '../components/SEO';
import { Grade } from '../types';
import { 
  ArrowRight, 
  ChevronDown, 
  Sparkles,
  GraduationCap,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../db/db';
import { supabase } from '../db/supabase';

const grades: Grade[] = [
  'Grade 9',
  'Grade 10',
  'Grade 11',
  'Grade 12',
  'University / College',
  'Post-Graduate Research',
];

export const Onboarding: React.FC = () => {
  const [selectedGrade, setSelectedGrade] = useState<Grade | null>(
    (localStorage.getItem('selected_grade') as Grade) || null
  );
  const navigate = useNavigate();

  React.useEffect(() => {
    if (selectedGrade) {
      localStorage.setItem('selected_grade', selectedGrade);
    }
  }, [selectedGrade]);

    const handleContinue = async () => {
    if (selectedGrade) {
      let dbGradeId = selectedGrade;
      try {
        const { data } = await supabase.from('grades').select('id').eq('name', selectedGrade).limit(1);
        if (data?.[0]?.id) dbGradeId = data[0].id;
      } catch (err) {
        console.error('Failed to get grade UUID:', err);
      }
      localStorage.setItem('selected_grade', dbGradeId);
      await db.settings.put({ key: 'selected_grade', value: dbGradeId });
      navigate('/modules');
    }
  };

  return (
    <Layout hideSidebar>
      <SEO title="Onboarding" />
      <div className="flex-grow flex items-center justify-center px-8 py-16 min-h-screen bg-background font-sans relative overflow-hidden">
        {/* Decorative Background */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-40">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="w-full max-w-xl space-y-16 relative z-10"
        >
          {/* Progress */}
          <div className="flex flex-col items-center space-y-6">
            <div className="h-[2px] w-48 bg-ink/5 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: '33.33%' }}
                transition={{ duration: 1, delay: 0.5 }}
                className="h-full bg-accent rounded-full"
              />
            </div>
            <span className="text-[10px] font-mono font-bold text-muted uppercase tracking-[0.3em]">Step 01 / 03</span>
          </div>

          {/* Header */}
          <div className="text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent/5 rounded-full text-accent text-[10px] font-mono font-bold uppercase tracking-widest mb-4">
              <Sparkles className="w-3 h-3" />
              Personalization Engine
            </div>
            <h1 className="text-5xl md:text-6xl font-serif font-medium tracking-tight text-ink leading-[1.1]">
              Select your <br />
              <span className="italic opacity-80">academic standing</span>
            </h1>
            <p className="text-muted font-light text-lg max-w-md mx-auto leading-relaxed">
              We'll customize your academic curriculum based on your current studies and research goals.
            </p>
          </div>

          {/* Selection Area */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {grades.map((grade) => (
              <button
                key={grade}
                onClick={() => setSelectedGrade(grade)}
                className={`group relative flex items-center justify-between p-6 rounded-3xl border transition-all duration-300 ${
                  selectedGrade === grade 
                    ? 'bg-ink border-ink text-paper shadow-xl shadow-ink/20' 
                    : 'bg-paper border-ink/5 text-ink hover:border-accent/30 hover:bg-accent/5'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors ${
                    selectedGrade === grade ? 'bg-paper/10' : 'bg-background'
                  }`}>
                    <GraduationCap className={`w-5 h-5 ${selectedGrade === grade ? 'text-paper' : 'text-accent'}`} />
                  </div>
                  <span className="text-sm font-medium tracking-tight">{grade}</span>
                </div>
                <AnimatePresence>
                  {selectedGrade === grade && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                    >
                      <Check className="w-4 h-4 text-accent" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            ))}
          </div>

          {/* Footer Action */}
          <div className="pt-8 flex flex-col items-center space-y-8">
            <button
              onClick={handleContinue}
              disabled={!selectedGrade}
              className={`group w-full max-w-sm h-16 bg-accent text-paper rounded-full font-medium text-lg flex items-center justify-center gap-3 shadow-xl shadow-accent/20 transition-all duration-300 ${
                !selectedGrade ? 'opacity-30 grayscale cursor-not-allowed' : 'hover:bg-ink hover:shadow-ink/20 active:scale-[0.98]'
              }`}
            >
              Continue to Repository
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button className="text-[10px] font-mono font-bold text-muted hover:text-ink uppercase tracking-[0.2em] transition-colors">
              Skip for now
            </button>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
};
