import React from 'react';
import { Check, Zap, Shield, Star, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { updateProfile } from '../db/supabase';
import { useNavigate } from 'react-router-dom';

export const Pricing: React.FC = () => {
  const { user, profile, isPro } = useAuth();
  const navigate = useNavigate();

  const handleUpgrade = async (plan: 'free' | 'pro') => {
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      await updateProfile(user.id, { plan });
      alert(`Successfully switched to ${plan} plan!`);
      window.location.reload();
    } catch (error) {
      console.error('Error upgrading:', error);
      alert('Failed to upgrade. Please try again.');
    }
  };

  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: '$0',
      description: 'Perfect for getting started with your studies.',
      features: [
        'Up to 3 active modules',
        'Guided support tools',
        'Standard flashcards',
        'Community support',
      ],
      buttonText: isPro ? 'Downgrade' : 'Current Plan',
      highlight: false,
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '$9.99',
      period: '/month',
      description: 'Unlock full potential with advanced learning tools.',
      features: [
        'Unlimited modules',
        'Advanced Tutor Support (Gemini 3.1 Pro)',
        'Unlimited Flashcard generation',
        'Theme Tracker & Lit Devices',
        'Priority Support',
        'Cloud Sync & Backup',
      ],
      buttonText: isPro ? 'Current Plan' : 'Upgrade to Pro',
      highlight: true,
    },
  ];

  return (
    <div className="min-h-screen bg-background p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold text-ink tracking-tight">
            Choose Your Learning Path
          </h1>
          <p className="text-muted max-w-2xl mx-auto">
            Whether you're just starting out or looking for deep academic mastery, we have a plan that fits your needs.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {plans.map((plan) => (
            <motion.div
              key={plan.id}
              whileHover={{ y: -5 }}
              className={`relative p-8 rounded-3xl border transition-all ${
                plan.highlight
                  ? 'bg-ink border-ink text-paper shadow-2xl shadow-ink/20'
                  : 'bg-paper border-ink/5 text-ink'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-accent text-paper text-[10px] font-bold uppercase tracking-widest px-4 py-1 rounded-full shadow-lg">
                  Most Popular
                </div>
              )}

              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    {plan.period && <span className="opacity-60 text-sm">{plan.period}</span>}
                  </div>
                  <p className={`text-sm ${plan.highlight ? 'text-paper/70' : 'text-muted'}`}>
                    {plan.description}
                  </p>
                </div>

                <div className="space-y-4">
                  {plan.features.map((feature, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                        plan.highlight ? 'bg-paper/10 text-accent' : 'bg-accent/10 text-accent'
                      }`}>
                        <Check className="w-3 h-3" />
                      </div>
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handleUpgrade(plan.id as 'free' | 'pro')}
                  disabled={(plan.id === 'pro' && isPro) || (plan.id === 'free' && !isPro)}
                  className={`w-full py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                    plan.highlight
                      ? 'bg-accent text-paper hover:bg-accent/90'
                      : 'bg-ink text-paper hover:bg-ink/90'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {plan.buttonText}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="bg-paper border border-ink/5 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center text-accent">
              <Star className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-ink">Student Discount</h4>
              <p className="text-sm text-muted">Are you a student? Get 50% off Pro plan with a valid .edu email.</p>
            </div>
          </div>
          <button className="px-6 py-3 border border-ink/10 rounded-xl text-sm font-bold hover:bg-ink/5 transition-all">
            Verify Student Status
          </button>
        </div>
      </div>
    </div>
  );
};
