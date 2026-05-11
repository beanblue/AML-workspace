import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    base: mode === 'production' ? '/AML-workspace/' : '/',
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/notion-api': {
          target: 'https://api.notion.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/notion-api/, ''),
          headers: {
            Authorization: `Bearer ${env.VITE_NOTION_TOKEN ?? ''}`,
            'Notion-Version': '2022-06-28',
          },
        },
      },
    },
  }
})
