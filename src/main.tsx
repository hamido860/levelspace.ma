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

// Register Service Worker for complete offline capabilities
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('[ServiceWorker] Registered successfully with scope:', registration.scope);
      })
      .catch((error) => {
        console.error('[ServiceWorker] Registration failed:', error);
      });
  });
}

