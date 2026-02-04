import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const supabaseUrl = env.VITE_SUPABASE_URL || 'https://mtjfypwrtvzhnzgatoim.supabase.co'

  return {
    logLevel: 'error',
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      host: true,
      proxy: {
        // Avoid CORS preflight issues in dev: browser hits same origin, Vite forwards to Supabase Edge Functions
        '/api/supabase-functions': {
          target: supabaseUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/supabase-functions/, '/functions/v1'),
          secure: true,
        },
      },
    },
  }
});
