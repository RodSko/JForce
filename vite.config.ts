import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(process.env.API_KEY || env.API_KEY)
    },
    build: {
      // Aumenta o limite para evitar o aviso amarelo no Vercel
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          // Organiza o código em pedaços menores (Code Splitting)
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              if (id.includes('xlsx') || id.includes('docx') || id.includes('html2canvas')) {
                return 'vendor-utils';
              }
              if (id.includes('recharts') || id.includes('d3')) {
                return 'vendor-charts';
              }
              return 'vendor';
            }
          }
        }
      }
    }
  };
});