import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Carrega variáveis de ambiente baseadas no modo (development/production)
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [react()],
    define: {
      // Garante que process.env.API_KEY esteja disponível no código cliente
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    }
  };
});