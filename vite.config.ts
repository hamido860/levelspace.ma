import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const apiProxyTarget =
    env.VITE_API_PROXY_TARGET ||
    process.env.VITE_API_PROXY_TARGET ||
    process.env.API_PROXY_TARGET ||
    'http://127.0.0.1:4321';
  return {
    plugins: [react(), tailwindcss()],
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
