import React from 'react';
import { Layout } from '../components/Layout';
import { SEO } from '../components/SEO';
import { AiKeyManager } from '../components/settings/AiKeyManager';

export const AiKeysSettings: React.FC = () => {
  return (
    <Layout>
      <SEO title="AI API Keys | Levelspace" description="Manage your encrypted AI provider API keys." />
      <AiKeyManager />
    </Layout>
  );
};
