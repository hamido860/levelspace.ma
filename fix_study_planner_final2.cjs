const fs = require('fs');

const backupContent = `import React from 'react';
import { Layout } from '../components/Layout';
import { SEO } from '../components/SEO';

export const StudyPlanner: React.FC = () => {
  return (
    <Layout>
      <SEO title="Study Planner" />
      <div className="flex-grow flex items-center justify-center p-8 text-center text-muted">
        <p>Study Planner is under maintenance.</p>
      </div>
    </Layout>
  );
};
`;

fs.writeFileSync('src/pages/StudyPlanner.tsx', backupContent);
