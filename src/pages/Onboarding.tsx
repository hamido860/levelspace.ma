import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { SEO } from '../components/SEO';
import { OnboardingModal } from '../components/OnboardingModal';

export const Onboarding: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Layout hideSidebar>
      <SEO title="Onboarding" />
      <div className="min-h-screen bg-background">
        <OnboardingModal isOpen onComplete={() => navigate('/modules')} />
      </div>
    </Layout>
  );
};
