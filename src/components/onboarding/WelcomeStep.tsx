import React from 'react';
import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';

interface WelcomeStepProps {
  userName: string;
}

export const WelcomeStep: React.FC<WelcomeStepProps> = ({ userName }) => {
  return (
    <motion.div
      key="step-0"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex-1 flex flex-col items-center justify-center text-center space-y-8"
    >
      <div className="relative">
        <div className="absolute -inset-4 bg-accent/20 blur-2xl rounded-full animate-pulse" />
        <div className="relative w-20 h-20 bg-accent rounded-3xl flex items-center justify-center text-paper shadow-md rotate-3">
          <Sparkles className="w-8 h-8" />
        </div>
      </div>
      <div className="space-y-4">
        <h1 className="text-xl sm:text-3xl font-display font-bold text-ink leading-[1.1] tracking-tight">
          Welcome, <span className="text-accent capitalize">{userName}</span><br />
          Let's personalize your space
        </h1>
        <p className="text-muted text-sm max-w-sm mx-auto font-medium leading-relaxed">
          We'll tailor your academic curriculum to match your exact level and track.
        </p>
      </div>
    </motion.div>
  );
};
