import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const isGitHubPages = process.env.DEPLOY_TARGET === 'github'
const FALLBACK_DB_ID_RAW = 'ee38fb1070e24a39a553fce111752217'
const NOTION_VERSION = '2022-06-28'

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

const resolveDatabaseId = (env: Record<string, string>, databaseId: string): string => {
  const map: Record<string, string | undefined> = {
    documents: env.NOTION_DB_DOCUMENTS,
    org: env.NOTION_DB_ORG,
    kpi: env.NOTION_DB_KPI,
    self_eval: env.NOTION_DB_SELF_EVAL,
    suspicious: env.NOTION_DB_SUSPICIOUS,
  }
  return toHyphenId(map[databaseId] ?? databaseId)
}

const notionApiProxyPlugin = (env: Record<string, string>): Plugin => {
  const token = env.NOTION_TOKEN ?? ''

  return {
    name: 'notion-api-proxy',
    configureServer(server) {
      server.middlewares.use('/api/notion/query', async (req, res, next) => {
        if (req.method !== 'POST') {
          next()
          return
        }

        if (!token) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ message: 'Notion 中转未配置 NOTION_TOKEN。' }))
          return
        }

        try {
          const body = await readJsonBody(req)
          const databaseIdRaw = String(body.databaseId ?? '')
          const databaseId = resolveDatabaseId(env, databaseIdRaw)
          const filter = body.filter
          const startCursor = body.startCursor ? String(body.startCursor) : undefined

          if (!databaseId) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ message: '缺少 databaseId。' }))
            return
          }

          const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Notion-Version': NOTION_VERSION,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              page_size: 100,
              ...(startCursor ? { start_cursor: startCursor } : {}),
              ...(filter ? { filter } : {}),
            }),
          })

          const text = await response.text()
          res.statusCode = response.status
          res.setHeader('Content-Type', 'application/json')
          res.end(text)
        } catch (error) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ message: error instanceof Error ? error.message : '请求体解析失败' }))
        }
      })

      server.middlewares.use('/api/notion/page', async (req, res, next) => {
        if (req.method !== 'GET') {
          next()
          return
        }

        if (!token) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ message: 'Notion 中转未配置 NOTION_TOKEN。' }))
          return
        }

        const rawUrl = String(req.url ?? '')
        const pageIdRaw = rawUrl.replace(/^\//, '').split(/[/?#]/)[0] ?? ''
        if (!pageIdRaw) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ message: '缺少页面 ID。' }))
          return
        }

        const toText = (list?: Array<{ plain_text?: string }>): string => list?.map((t) => t.plain_text ?? '').join('') ?? ''
        const toLine = (block: any): string => {
          const type = block?.type
          if (type === 'heading_1') return `# ${toText(block.heading_1?.rich_text)}\n`
          if (type === 'heading_2') return `## ${toText(block.heading_2?.rich_text)}\n`
          if (type === 'heading_3') return `### ${toText(block.heading_3?.rich_text)}\n`
          if (type === 'paragraph') return `${toText(block.paragraph?.rich_text)}\n`
          if (type === 'divider') return `---\n`
          if (type === 'bulleted_list_item') return `- ${toText(block.bulleted_list_item?.rich_text)}\n`
          if (type === 'numbered_list_item') return `1. ${toText(block.numbered_list_item?.rich_text)}\n`
          return ''
        }

        try {
          const lines: string[] = []
          let cursor: string | undefined

          while (lines.length < 20000) {
            const endpoint = new URL(`https://api.notion.com/v1/blocks/${toHyphenId(pageIdRaw)}/children`)
            endpoint.searchParams.set('page_size', '100')
            if (cursor) endpoint.searchParams.set('start_cursor', cursor)

            const response = await fetch(endpoint.toString(), {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${token}`,
                'Notion-Version': NOTION_VERSION,
              },
            })

            const text = await response.text()
            if (!response.ok) {
              res.statusCode = response.status
              res.setHeader('Content-Type', 'application/json')
              res.end(text)
              return
            }

            const data = JSON.parse(text) as any
            const results = Array.isArray(data?.results) ? data.results : []
            for (const block of results) {
              const line = toLine(block)
              if (line) lines.push(line)
            }

            if (!data?.has_more) break
            cursor = data?.next_cursor ?? undefined
            if (!cursor) break
          }

          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ content: lines.join('') }))
        } catch (error) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ message: error instanceof Error ? error.message : 'Notion 获取页面内容失败。' }))
        }
      })
    },
  }
}

const notionLocalRoutePlugin = (env: Record<string, string>): Plugin => {
  const token = env.NOTION_TOKEN ?? env.VITE_NOTION_TOKEN ?? ''
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
                  'Notion-Version': NOTION_VERSION,
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
    plugins: [react(), tailwindcss(), notionApiProxyPlugin(env), notionLocalRoutePlugin(env)],
    server: {
      proxy: {
        '/notion-api': {
          target: 'https://api.notion.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/notion-api/, ''),
          headers: {
            Authorization: `Bearer ${env.NOTION_TOKEN ?? ''}`,
            'Notion-Version': NOTION_VERSION,
          },
        },
      },
    },
  }
})
