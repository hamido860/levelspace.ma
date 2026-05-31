import React from 'react';
import { Layout } from '../components/Layout';
import { OnboardingModal } from '../components/OnboardingModal';
import { SEO } from '../components/SEO';

export const Onboarding: React.FC = () => {
  return (
    <Layout hideSidebar>
      <SEO title="Set up your Levelspace" />
      <main className="min-h-screen bg-background px-4 py-8 sm:px-6">
        <OnboardingModal isOpen inline />
      </main>
    </Layout>
  );
};
