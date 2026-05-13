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

const resolveDatabaseId = (databaseId) => {
  const map = {
    documents: process.env.NOTION_DB_DOCUMENTS,
    org: process.env.NOTION_DB_ORG,
    kpi: process.env.NOTION_DB_KPI,
    self_eval: process.env.NOTION_DB_SELF_EVAL,
    suspicious: process.env.NOTION_DB_SUSPICIOUS,
  }
  return toHyphenId(map[databaseId] ?? databaseId)
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
      sendJson(res, 400, { message: error instanceof Error ? error.message : '请求体解析失败' })
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

