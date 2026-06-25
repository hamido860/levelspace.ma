/// <reference types="vitest" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  // Supabase URL and anon key are public browser credentials. RLS protects data access.
  const defaultSupabaseUrl = 'https://pimojkivimygenhygsto.supabase.co';
  const defaultSupabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpbW9qa2l2aW15Z2VuaHlnc3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MzAzNDksImV4cCI6MjA5MDEwNjM0OX0.3PqRdyQMlz3aMaqSnm8_oD6iYJpN-CVilA6bk5G88wM';
  const publicSupabaseUrl =
    env.NEXT_PUBLIC_SUPABASE_URL ||
    env.SUPABASE_URL ||
    env.VITE_SUPABASE_URL ||
    defaultSupabaseUrl;
  const publicSupabaseAnonKey =
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    env.SUPABASE_ANON_KEY ||
    env.VITE_SUPABASE_ANON_KEY ||
    defaultSupabaseAnonKey;
  const apiProxyTarget =
    env.VITE_API_PROXY_TARGET ||
    process.env.VITE_API_PROXY_TARGET ||
    process.env.API_PROXY_TARGET ||
    'http://127.0.0.1:4321';
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'emit-public-supabase-config',
        generateBundle() {
          this.emitFile({
            type: 'asset',
            fileName: 'supabase-config.json',
            source: JSON.stringify({
              configured: Boolean(publicSupabaseUrl && publicSupabaseAnonKey),
              url: publicSupabaseUrl || null,
              anonKey: publicSupabaseAnonKey || null,
            }),
          });
        },
      },
    ],
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks: {
            // Core React — always needed
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],

            // Supabase client
            'vendor-supabase': ['@supabase/supabase-js'],

            // UI / animation — load after paint
            'vendor-ui': ['motion', 'framer-motion', 'lucide-react'],

            // Math rendering — lazy load only on lesson pages
            'vendor-katex': ['katex'],

            // Heavy ML runtime — isolated chunk, loaded only if needed
            'vendor-onnx': ['onnxruntime-web'],
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
