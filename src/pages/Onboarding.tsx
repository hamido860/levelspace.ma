import React from 'react';
import { Layout } from '../components/Layout';
import { SEO } from '../components/SEO';
import { OnboardingModal } from '../components/OnboardingModal';

export const Onboarding: React.FC = () => {
  return (
    <Layout hideSidebar>
      <SEO title="Onboarding" />
      <div className="flex-grow flex flex-col px-8 py-16 min-h-screen bg-background font-sans relative overflow-hidden">
        <OnboardingModal isOpen={true} inline={true} />
      </div>
    </Layout>
  );
};
