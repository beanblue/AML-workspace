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
    workunit: env.NOTION_DB_WORKUNIT,
    nodes: env.NOTION_DB_NODES,
  }
  return toHyphenId(map[databaseId] ?? databaseId)
}

const notionApiProxyPlugin = (env: Record<string, string>): Plugin => {
  const token = env.NOTION_TOKEN ?? ''

  return {
    name: 'notion-api-proxy',
    configureServer(server) {
      server.middlewares.use('/api/notion/search', async (req, res, next) => {
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

        try {
          const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`)
          const query = String(url.searchParams.get('q') ?? '').trim()
          if (!query) {
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ results: [] }))
            return
          }

          const response = await fetch('https://api.notion.com/v1/search', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Notion-Version': NOTION_VERSION,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query,
              page_size: 50,
              filter: { property: 'object', value: 'page' },
            }),
          })

          const text = await response.text()
          res.statusCode = response.status
          res.setHeader('Content-Type', 'application/json')
          res.end(text)
        } catch (error) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ message: error instanceof Error ? error.message : 'Notion 搜索失败。' }))
        }
      })

      server.middlewares.use('/api/library/search', async (req, res, next) => {
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

        try {
          const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`)
          const query = String(url.searchParams.get('q') ?? '').trim()
          if (!query) {
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ results: [] }))
            return
          }

          const response = await fetch('https://api.notion.com/v1/search', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Notion-Version': NOTION_VERSION,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query,
              page_size: 50,
              filter: { property: 'object', value: 'page' },
            }),
          })

          const text = await response.text()
          res.statusCode = response.status
          res.setHeader('Content-Type', 'application/json')
          res.end(text)
        } catch (error) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ message: error instanceof Error ? error.message : 'Notion 搜索失败。' }))
        }
      })

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

      server.middlewares.use('/api/workunit/list', async (req, res, next) => {
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

        const databaseIdRaw = env.NOTION_DB_WORKUNIT ?? ''
        if (!databaseIdRaw) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ message: '未配置 NOTION_DB_WORKUNIT，无法解析数据库 ID。' }))
          return
        }

        try {
          const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`)
          const typeValue = String(url.searchParams.get('type') ?? '').trim()
          const databaseId = toHyphenId(databaseIdRaw)

          const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Notion-Version': NOTION_VERSION,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              page_size: 100,
            }),
          })

          const text = await response.text()
          if (!response.ok) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Notion 查询失败。', status: response.status, body: text }))
            return
          }

          const data = JSON.parse(text) as any
          const results = Array.isArray(data?.results) ? data.results : []
          const filtered = results.filter((page: any) => {
            if (!typeValue) return true
            const name = String(page?.properties?.['项目类型']?.select?.name ?? '').trim()
            return name === typeValue
          })

          const toPlainText = (list?: Array<{ plain_text?: string }>) => list?.map((t) => t.plain_text ?? '').join('') ?? ''
          const propTitle = (prop: any) => toPlainText(prop?.title)
          const propRichText = (prop: any) => toPlainText(prop?.rich_text)
          const propSelect = (prop: any) => String(prop?.select?.name ?? '')
          const propStatus = (prop: any) => String(prop?.status?.name ?? prop?.select?.name ?? '')
          const propNumber = (prop: any) => (typeof prop?.number === 'number' ? prop.number : null)
          const propDate = (prop: any) => String(prop?.date?.start ?? '')

          const mapped = filtered.map((page: any) => {
            const props = page?.properties ?? {}
            return {
              id: page.id,
              name: propTitle(props['项目名称']) || propTitle(props['名称']) || propTitle(props['标题']) || propTitle(props['Name']) || '',
              type: propSelect(props['项目类型']),
              stage: propSelect(props['当前阶段']),
              status: propStatus(props['状态']),
              source: propSelect(props['项目来源']),
              owner: propRichText(props['负责人']),
              department: propRichText(props['牵头部门']),
              planStartDate: propDate(props['计划开始日期']) || propDate(props['计划日期']) || '',
              planEndDate: propDate(props['计划完成日期']) || '',
              planDate: propDate(props['计划日期']) || propDate(props['计划开始日期']) || '',
              target: propRichText(props['目标对象/参与范围']),
              participants: propNumber(props['实际参与人数']) ?? 0,
              satisfaction: propNumber(props['满意度评分']),
              summary: propRichText(props['项目摘要']),
            }
          })

          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(mapped))
        } catch (error) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ message: error instanceof Error ? error.message : 'Notion 查询失败。' }))
        }
      })

      server.middlewares.use('/api/workunit/create', async (req, res, next) => {
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

        const databaseIdRaw = env.NOTION_DB_WORKUNIT ?? ''
        if (!databaseIdRaw) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ message: '未配置 NOTION_DB_WORKUNIT，无法解析数据库 ID。' }))
          return
        }

        try {
          const databaseId = toHyphenId(databaseIdRaw)
          const body = await readJsonBody(req)
          const name = String((body as any)?.name ?? '').trim()
          const owner = String((body as any)?.owner ?? '').trim()
          const target = String((body as any)?.target ?? '').trim()
          const planEndDate = String((body as any)?.planEndDate ?? '').trim()
          const source = (String((body as any)?.source ?? '年度计划').trim() || '年度计划') as string
          if (!name) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ message: '缺少 项目名称(name)。' }))
            return
          }

          const properties: Record<string, unknown> = {
            项目名称: { title: [{ text: { content: name } }] },
            项目类型: { select: { name: '培训' } },
            当前阶段: { select: { name: '需求立项' } },
            状态: { status: { name: '立项中' } },
            项目来源: { select: { name: source } },
            ...(owner ? { 负责人: { rich_text: [{ text: { content: owner } }] } } : {}),
            ...(target ? { '目标对象/参与范围': { rich_text: [{ text: { content: target } }] } } : {}),
            ...(planEndDate ? { 计划完成日期: { date: { start: planEndDate } } } : {}),
          }

          const response = await fetch('https://api.notion.com/v1/pages', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Notion-Version': NOTION_VERSION,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              parent: { database_id: databaseId },
              properties,
            }),
          })

          const text = await response.text()
          res.statusCode = response.status
          res.setHeader('Content-Type', 'application/json')
          res.end(text)
        } catch (error) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ message: error instanceof Error ? error.message : 'Notion 创建失败。' }))
        }
      })

      server.middlewares.use('/api/workunit', async (req, res, next) => {
        if (req.method !== 'PATCH') {
          next()
          return
        }

        const rawUrl = String(req.url ?? '')
        const parts = rawUrl.replace(/^\//, '').split(/[?#]/)[0]?.split('/') ?? []
        if (parts.length !== 4 || parts[0] !== 'api' || parts[1] !== 'workunit' || parts[3] !== 'stage') {
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
          const pageId = toHyphenId(parts[2] ?? '')
          const body = await readJsonBody(req)
          const stage = String((body as any)?.stage ?? '').trim()
          if (!stage) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ message: '缺少 stage。' }))
            return
          }

          const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
              'Notion-Version': NOTION_VERSION,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              properties: {
                当前阶段: { select: { name: stage } },
              },
            }),
          })

          const text = await response.text()
          if (!response.ok) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Notion 更新失败。', status: response.status, body: text }))
            return
          }

          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: true }))
        } catch (error) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ message: error instanceof Error ? error.message : 'Notion 更新失败。' }))
        }
      })

      server.middlewares.use('/api/nodes/list', async (req, res, next) => {
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

        const databaseIdRaw = env.NOTION_DB_NODES ?? ''
        if (!databaseIdRaw) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ message: '未配置 NOTION_DB_NODES，无法解析数据库 ID。' }))
          return
        }

        try {
          const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`)
          const workUnitIdRaw = String(url.searchParams.get('workUnitId') ?? '').trim()
          if (!workUnitIdRaw) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ message: '缺少 workUnitId。' }))
            return
          }

          const workUnitId = toHyphenId(workUnitIdRaw)
          const databaseId = toHyphenId(databaseIdRaw)

          const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Notion-Version': NOTION_VERSION,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ page_size: 100 }),
          })

          const text = await response.text()
          if (!response.ok) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Notion 查询失败。', status: response.status, body: text }))
            return
          }

          const data = JSON.parse(text) as any
          const results = Array.isArray(data?.results) ? data.results : []

          const toPlainText = (list?: Array<{ plain_text?: string }>) => list?.map((t) => t.plain_text ?? '').join('') ?? ''
          const propTitle = (prop: any) => toPlainText(prop?.title)
          const propRichText = (prop: any) => toPlainText(prop?.rich_text)
          const propSelect = (prop: any) => String(prop?.select?.name ?? '')
          const propStatus = (prop: any) => String(prop?.status?.name ?? prop?.select?.name ?? '')
          const propDate = (prop: any) => String(prop?.date?.start ?? '')
          const propPeople = (prop: any) =>
            Array.isArray(prop?.people) ? prop.people.map((p: any) => String(p?.name ?? '')).filter(Boolean).join(' / ') : ''
          const propRelationIds = (prop: any) => (Array.isArray(prop?.relation) ? prop.relation.map((r: any) => String(r?.id ?? '')) : [])

          const filtered = results.filter((page: any) => {
            const props = page?.properties ?? {}
            const rel = props['所属工作项目']
            const ids = propRelationIds(rel).map((x: string) => toHyphenId(x).replace(/-/g, ''))
            return ids.includes(workUnitId.replace(/-/g, ''))
          })

          const mapped = filtered.map((page: any) => {
            const props = page?.properties ?? {}
            return {
              id: page.id,
              name:
                propTitle(props['节点名称']) ||
                propTitle(props['任务名称']) ||
                propTitle(props['名称']) ||
                propTitle(props['标题']) ||
                propTitle(props['Name']) ||
                '',
              stage: propSelect(props['所属阶段']) || '',
              status: propStatus(props['状态']),
              assignee: propPeople(props['负责人']) || propPeople(props['执行人']) || propRichText(props['负责人']) || '',
              dueDate: propDate(props['截止日期']) || propDate(props['到期日']) || propDate(props['计划完成日期']) || '',
            }
          })

          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(mapped))
        } catch (error) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ message: error instanceof Error ? error.message : 'Notion 查询失败。' }))
        }
      })

      server.middlewares.use('/api/nodes/create', async (req, res, next) => {
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

        const databaseIdRaw = env.NOTION_DB_NODES ?? ''
        if (!databaseIdRaw) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ message: '未配置 NOTION_DB_NODES，无法解析数据库 ID。' }))
          return
        }

        try {
          const body = await readJsonBody(req)
          const name = String((body as any)?.title ?? (body as any)?.name ?? '').trim()
          const workUnitIdRaw = String((body as any)?.workUnitId ?? '').trim()
          const stage = String((body as any)?.stage ?? '').trim()
          if (!name || !workUnitIdRaw || !stage) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ message: '缺少 title / workUnitId / stage。' }))
            return
          }

          const databaseId = toHyphenId(databaseIdRaw)
          const workUnitId = toHyphenId(workUnitIdRaw)

          const response = await fetch('https://api.notion.com/v1/pages', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Notion-Version': NOTION_VERSION,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              parent: { database_id: databaseId },
              properties: {
                节点名称: { title: [{ text: { content: name } }] },
                所属工作项目: { relation: [{ id: workUnitId }] },
                所属阶段: { select: { name: stage } },
              },
            }),
          })

          const text = await response.text()
          if (!response.ok) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Notion 创建失败。', status: response.status, body: text }))
            return
          }

          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: true }))
        } catch (error) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ message: error instanceof Error ? error.message : 'Notion 创建失败。' }))
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
    build: {
      rollupOptions: {
        output: {
          entryFileNames: 'assets/[name].[hash].js',
          chunkFileNames: 'assets/[name].[hash].js',
          assetFileNames: 'assets/[name].[hash].[ext]',
        },
      },
    },
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
