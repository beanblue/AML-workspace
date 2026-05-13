import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const isGitHubPages = process.env.DEPLOY_TARGET === 'github'
const FALLBACK_DB_ID_RAW = 'ee38fb1070e24a39a553fce111752217'

const toHyphenId = (idOrPath: string): string => {
  const raw = idOrPath.replace(/^collection:\/\//, '').replace(/-/g, '').trim()
  if (raw.length !== 32) return idOrPath.replace(/^collection:\/\//, '').trim()
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`
}

const readJsonBody = async (req: NodeJS.ReadableStream): Promise<Record<string, unknown>> =>
  new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
    })
    req.on('end', () => {
      if (!data) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(data) as Record<string, unknown>)
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })

const notionLocalRoutePlugin = (env: Record<string, string>): Plugin => {
  const token = env.VITE_NOTION_TOKEN ?? ''
  const dbCandidates = Array.from(
    new Set([toHyphenId(env.VITE_NOTION_DB_RESOURCE ?? ''), toHyphenId(FALLBACK_DB_ID_RAW)].filter(Boolean)),
  )

  return {
    name: 'notion-local-route',
    configureServer(server) {
      server.middlewares.use('/notion-local/query', async (req, res, next) => {
        if (req.method !== 'POST') {
          next()
          return
        }

        if (!token || dbCandidates.length === 0) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ message: 'Notion 中转未配置 token 或数据库 ID。' }))
          return
        }

        try {
          const body = await readJsonBody(req)
          const filter = body.filter
          let lastError = '未知错误'

          for (const dbId of dbCandidates) {
            const controller = new AbortController()
            const timer = setTimeout(() => controller.abort(), 15000)
            try {
              const response = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Notion-Version': '2022-06-28',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  page_size: 100,
                  ...(filter ? { filter } : {}),
                }),
                signal: controller.signal,
              })
              clearTimeout(timer)

              const text = await response.text()
              if (response.ok) {
                res.statusCode = 200
                res.setHeader('Content-Type', 'application/json')
                res.end(text)
                return
              }
              lastError = `${response.status} ${text.slice(0, 500)}`
            } catch (error) {
              clearTimeout(timer)
              lastError = error instanceof Error ? error.message : String(error)
            }
          }

          res.statusCode = 502
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ message: `Notion 中转失败：${lastError}` }))
        } catch (error) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              message: error instanceof Error ? error.message : '请求体解析失败',
            }),
          )
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    base: isGitHubPages ? '/AML-workspace/' : '/',
    plugins: [react(), tailwindcss(), notionLocalRoutePlugin(env)],
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
