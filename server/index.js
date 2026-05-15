import http from 'node:http'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const NOTION_VERSION = '2022-06-28'
const port = Number(process.env.PORT ?? '3000')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(__dirname, '../dist')

const toHyphenId = (idOrPath) => {
  const raw = String(idOrPath ?? '')
    .replace(/^collection:\/\//, '')
    .replace(/-/g, '')
    .trim()
  if (raw.length !== 32) return String(idOrPath ?? '').replace(/^collection:\/\//, '').trim()
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`
}

const isNotionId = (id) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id ?? '').trim())

const resolveDatabaseId = (databaseId) => {
  const envKeyMap = {
    documents: 'NOTION_DB_DOCUMENTS',
    org: 'NOTION_DB_ORG',
    kpi: 'NOTION_DB_KPI',
    self_eval: 'NOTION_DB_SELF_EVAL',
    suspicious: 'NOTION_DB_SUSPICIOUS',
    workunit: 'NOTION_DB_WORKUNIT',
    nodes: 'NOTION_DB_NODES',
  }

  const key = String(databaseId ?? '').trim()
  const envKey = envKeyMap[key]
  const value = envKey ? process.env[envKey] : key
  const resolved = toHyphenId(value)

  if (envKey) {
    if (!value) throw new Error(`未配置 ${envKey}，无法解析数据库 ID。`)
    if (!isNotionId(resolved)) throw new Error(`${envKey} 不是有效的 Notion 数据库 ID。`)
    return resolved
  }

  if (!isNotionId(resolved)) throw new Error('databaseId 不是有效的 Notion 数据库 ID。')
  return resolved
}

const readJson = async (req) =>
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
        resolve(JSON.parse(data))
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })

const sendJson = (res, statusCode, payload) => {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

const mimeTypeFor = (filePath) => {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.html') return 'text/html; charset=utf-8'
  if (ext === '.js') return 'application/javascript; charset=utf-8'
  if (ext === '.css') return 'text/css; charset=utf-8'
  if (ext === '.svg') return 'image/svg+xml'
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.json') return 'application/json; charset=utf-8'
  if (ext === '.map') return 'application/json; charset=utf-8'
  return 'application/octet-stream'
}

const serveFile = async (res, filePath) => {
  const stats = await stat(filePath)
  if (!stats.isFile()) return false
  res.statusCode = 200
  res.setHeader('Content-Type', mimeTypeFor(filePath))
  createReadStream(filePath).pipe(res)
  return true
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)

  const notionSearch = async (query) => {
    const token = process.env.NOTION_TOKEN ?? ''
    if (!token) {
      sendJson(res, 500, { message: 'Notion 中转未配置 NOTION_TOKEN。' })
      return null
    }

    const toText = (list) => (Array.isArray(list) ? list.map((item) => item?.plain_text ?? '').join('') : '')
    const formatPropertyValue = (prop) => {
      const type = prop?.type
      if (type === 'title') return toText(prop?.title)
      if (type === 'rich_text') return toText(prop?.rich_text)
      if (type === 'select') return prop?.select?.name ?? ''
      if (type === 'multi_select') return Array.isArray(prop?.multi_select) ? prop.multi_select.map((i) => i?.name ?? '').filter(Boolean) : []
      if (type === 'date') return prop?.date?.start ?? ''
      if (type === 'number') return prop?.number ?? null
      if (type === 'checkbox') return Boolean(prop?.checkbox)
      if (type === 'url') return prop?.url ?? ''
      if (type === 'email') return prop?.email ?? ''
      if (type === 'phone_number') return prop?.phone_number ?? ''
      return null
    }
    const formatPage = (page) => {
      const formatted = {
        id: page.id,
        createdAt: page.created_time,
        updatedAt: page.last_edited_time,
      }
      const props = page?.properties ?? {}
      for (const key of Object.keys(props)) {
        formatted[key] = formatPropertyValue(props[key])
      }
      return formatted
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

    if (!response.ok) {
      const text = await response.text()
      res.statusCode = response.status
      res.setHeader('Content-Type', 'application/json')
      res.end(text || JSON.stringify({ message: 'Notion 搜索失败。' }))
      return null
    }

    const data = await response.json()
    const results = Array.isArray(data?.results) ? data.results : []
    return results.map(formatPage)
  }

  if (url.pathname.startsWith('/api/notion/page/')) {
    if (req.method !== 'GET') {
      sendJson(res, 405, { message: 'Method Not Allowed' })
      return
    }

    const token = process.env.NOTION_TOKEN ?? ''
    if (!token) {
      sendJson(res, 500, { message: 'Notion 中转未配置 NOTION_TOKEN。' })
      return
    }

    const pageIdRaw = url.pathname.replace('/api/notion/page/', '').split('/')[0] ?? ''
    const pageId = toHyphenId(pageIdRaw)
    if (!pageId) {
      sendJson(res, 400, { message: '缺少页面 ID。' })
      return
    }

    const toText = (richText) =>
      Array.isArray(richText) ? richText.map((item) => item?.plain_text ?? '').join('') : ''

    const toLine = (block) => {
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
      const lines = []
      let cursor = undefined

      while (lines.length < 20000) {
        const endpoint = new URL(`https://api.notion.com/v1/blocks/${pageId}/children`)
        endpoint.searchParams.set('page_size', '100')
        if (cursor) endpoint.searchParams.set('start_cursor', cursor)

        const response = await fetch(endpoint.toString(), {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Notion-Version': NOTION_VERSION,
          },
        })

        if (!response.ok) {
          const text = await response.text()
          res.statusCode = response.status
          res.setHeader('Content-Type', 'application/json')
          res.end(text || JSON.stringify({ message: 'Notion 获取页面内容失败。' }))
          return
        }

        const data = await response.json()
        const results = Array.isArray(data?.results) ? data.results : []
        for (const block of results) {
          const line = toLine(block)
          if (line) lines.push(line)
        }

        if (!data?.has_more) break
        cursor = data?.next_cursor ?? undefined
        if (!cursor) break
      }

      sendJson(res, 200, { content: lines.join('') })
      return
    } catch (error) {
      sendJson(res, 500, { message: error instanceof Error ? error.message : 'Notion 获取页面内容失败。' })
      return
    }
  }

  if (url.pathname === '/api/notion/search') {
    if (req.method !== 'GET') {
      sendJson(res, 405, { message: 'Method Not Allowed' })
      return
    }

    const q = url.searchParams.get('q') ?? ''
    const query = String(q).trim()
    if (!query) {
      sendJson(res, 200, { results: [] })
      return
    }

    try {
      const results = await notionSearch(query)
      if (!results) return
      sendJson(res, 200, { results })
      return
    } catch (error) {
      sendJson(res, 500, { message: error instanceof Error ? error.message : 'Notion 搜索失败。' })
      return
    }
  }

  if (url.pathname === '/api/library/search') {
    if (req.method !== 'GET') {
      sendJson(res, 405, { message: 'Method Not Allowed' })
      return
    }

    const q = url.searchParams.get('q') ?? ''
    const query = String(q).trim()
    if (!query) {
      sendJson(res, 200, { results: [] })
      return
    }

    try {
      const results = await notionSearch(query)
      if (!results) return
      sendJson(res, 200, { results })
      return
    } catch (error) {
      sendJson(res, 500, { message: error instanceof Error ? error.message : 'Notion 搜索失败。' })
      return
    }
  }

  if (url.pathname === '/api/workunit/list') {
    if (req.method !== 'GET') {
      sendJson(res, 405, { message: 'Method Not Allowed' })
      return
    }

    const token = process.env.NOTION_TOKEN ?? ''
    if (!token) {
      sendJson(res, 500, { message: 'Notion 中转未配置 NOTION_TOKEN。' })
      return
    }

    const databaseIdRaw = process.env.NOTION_DB_WORKUNIT ?? ''
    const databaseId = toHyphenId(databaseIdRaw)
    if (!databaseIdRaw) {
      sendJson(res, 500, { message: '未配置 NOTION_DB_WORKUNIT，无法解析数据库 ID。' })
      return
    }
    if (!isNotionId(databaseId)) {
      sendJson(res, 500, { message: 'NOTION_DB_WORKUNIT 不是有效的 Notion 数据库 ID。' })
      return
    }

    const typeValue = String(url.searchParams.get('type') ?? '培训').trim() || '培训'

    const toText = (list) => (Array.isArray(list) ? list.map((item) => item?.plain_text ?? '').join('') : '')
    const formatPropertyValue = (prop) => {
      const type = prop?.type
      if (type === 'title') return toText(prop?.title)
      if (type === 'rich_text') return toText(prop?.rich_text)
      if (type === 'select') return prop?.select?.name ?? ''
      if (type === 'multi_select') return Array.isArray(prop?.multi_select) ? prop.multi_select.map((i) => i?.name ?? '').filter(Boolean) : []
      if (type === 'date') return prop?.date?.start ?? ''
      if (type === 'number') return prop?.number ?? null
      if (type === 'checkbox') return Boolean(prop?.checkbox)
      if (type === 'people') return Array.isArray(prop?.people) ? prop.people.map((p) => p?.name ?? '').filter(Boolean).join(',') : ''
      return null
    }

    const pick = (props, key) => (props && props[key] ? formatPropertyValue(props[key]) : '')
    const formatWorkUnit = (page) => {
      const props = page?.properties ?? {}
      const name = pick(props, '项目名称') || pick(props, '名称') || pick(props, '标题') || pick(props, 'Name') || ''
      return {
        id: page.id,
        项目名称: name,
        类型: pick(props, '类型'),
        状态: pick(props, '状态'),
        当前阶段: pick(props, '当前阶段'),
        负责人: pick(props, '负责人'),
        计划日期: pick(props, '计划日期'),
        目标对象: pick(props, '目标对象'),
        参与人数: pick(props, '参与人数'),
        满意度: pick(props, '满意度'),
        项目类型: pick(props, '项目类型'),
      }
    }

    try {
      const makeRequest = async (withFilter) => {
        const body = {
          page_size: 100,
          ...(withFilter
            ? {
                filter: {
                  property: '项目类型',
                  select: { equals: typeValue },
                },
              }
            : {}),
        }
        const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Notion-Version': NOTION_VERSION,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        })
        const text = await response.text()
        return { response, text }
      }

      let { response, text } = await makeRequest(true)
      if (!response.ok) {
        console.error('[workunit/list] query failed', {
          status: response.status,
          body: text,
          databaseId,
          typeValue,
        })
        ;({ response, text } = await makeRequest(false))
      }

      if (!response.ok) {
        console.error('[workunit/list] fallback query failed', {
          status: response.status,
          body: text,
          databaseId,
          typeValue,
        })
        sendJson(res, 500, { message: 'Notion 查询失败。', status: response.status })
        return
      }

      const data = JSON.parse(text)
      const results = Array.isArray(data?.results) ? data.results : []
      const mapped = results.map(formatWorkUnit).filter((row) => {
        const v = String(row.项目类型 ?? row.类型 ?? '').trim()
        return v === typeValue || v.includes(typeValue)
      })
      sendJson(
        res,
        200,
        {
          results: mapped.map(({ 项目类型, ...rest }) => rest),
        },
      )
      return
    } catch (error) {
      console.error('[workunit/list] exception', error)
      sendJson(res, 500, { message: error instanceof Error ? error.message : 'Notion 查询失败。' })
      return
    }
  }

  if (url.pathname === '/api/notion/query') {
    if (req.method !== 'POST') {
      sendJson(res, 405, { message: 'Method Not Allowed' })
      return
    }

    const token = process.env.NOTION_TOKEN ?? ''
    if (!token) {
      sendJson(res, 500, { message: 'Notion 中转未配置 NOTION_TOKEN。' })
      return
    }

    try {
      const body = await readJson(req)
      const databaseIdRaw = String(body.databaseId ?? '')
      const databaseId = resolveDatabaseId(databaseIdRaw)
      const filter = body.filter
      const startCursor = body.startCursor ? String(body.startCursor) : undefined

      if (!databaseId) {
        sendJson(res, 400, { message: '缺少 databaseId。' })
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
      return
    } catch (error) {
      const message = error instanceof Error ? error.message : '请求体解析失败'
      sendJson(res, message.includes('未配置') || message.includes('不是有效的 Notion 数据库 ID') ? 500 : 400, { message })
      return
    }
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405
    res.end('Method Not Allowed')
    return
  }

  const accept = req.headers.accept ?? ''
  const isHtmlRequest = typeof accept === 'string' && accept.includes('text/html')

  if (isHtmlRequest) {
    try {
      await serveFile(res, path.join(distDir, 'index.html'))
    } catch {
      res.statusCode = 404
      res.end('Not Found')
    }
    return
  }

  const safePath = path.normalize(url.pathname).replace(/^(\.\.[/\\])+/, '')
  const filePath = path.join(distDir, safePath)

  try {
    const ok = await serveFile(res, filePath)
    if (!ok) {
      res.statusCode = 404
      res.end('Not Found')
    }
  } catch {
    res.statusCode = 404
    res.end('Not Found')
  }
})

server.listen(port, () => {
  process.stdout.write(`Server listening on :${port}\n`)
})
