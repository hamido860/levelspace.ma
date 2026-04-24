import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import 'mathlive';
import App from './App.tsx';
import './index.css';
import { seedDatabase } from './db/seed.ts';

import {ThemeProvider} from './context/ThemeContext.tsx';
import { AppSettingsProvider } from './context/AppSettingsContext.tsx';

seedDatabase().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ThemeProvider>
        <AppSettingsProvider>
          <App />
        </AppSettingsProvider>
      </ThemeProvider>
    </StrictMode>,
  );
});
