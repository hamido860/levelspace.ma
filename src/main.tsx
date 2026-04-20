import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import 'mathlive';
import App from './App.tsx';
import './index.css';
import { seedDatabase } from './db/seed.ts';

import {ThemeProvider} from './context/ThemeContext.tsx';

seedDatabase().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </StrictMode>,
  );
});
