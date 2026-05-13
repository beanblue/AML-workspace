import fs from 'node:fs'
import path from 'node:path'

const NOTION_VERSION = '2022-06-28'
const ROOT_DIR = process.cwd()
const ENV_PATH = path.join(ROOT_DIR, '.env')

const parseEnv = (content) => {
  const env = {}
  const lines = content.split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim()
    env[key] = value
  }
  return env
}

const readEnvFile = () => {
  if (!fs.existsSync(ENV_PATH)) return ''
  return fs.readFileSync(ENV_PATH, 'utf8')
}

const upsertEnvLines = (content, updates) => {
  const lines = content.split(/\r?\n/)
  const seen = new Set()
  const out = lines.map((line) => {
    const idx = line.indexOf('=')
    if (idx === -1) return line
    const key = line.slice(0, idx).trim()
    if (!(key in updates)) return line
    seen.add(key)
    return `${key}=${updates[key] ?? ''}`
  })

  for (const [key, value] of Object.entries(updates)) {
    if (seen.has(key)) continue
    out.push(`${key}=${value ?? ''}`)
  }

  while (out.length > 0 && out[out.length - 1].trim() === '') out.pop()
  return `${out.join('\n')}\n`
}

const toText = (richText) => (Array.isArray(richText) ? richText.map((t) => t?.plain_text ?? '').join('') : '')

const getDatabaseTitle = (db) => {
  if (db?.title) return toText(db.title)
  if (db?.properties?.Name?.title) return toText(db.properties.Name.title)
  return ''
}

const searchAllDatabases = async (token) => {
  const results = []
  let cursor = undefined

  while (results.length < 500) {
    const response = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filter: { value: 'database', property: 'object' },
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(text || `Notion search 失败：${response.status}`)
    }

    const data = await response.json()
    results.push(...(data.results ?? []))

    if (!data.has_more) break
    cursor = data.next_cursor
    if (!cursor) break
  }

  return results
}

const main = async () => {
  const envContent = readEnvFile()
  const env = parseEnv(envContent)
  const token = env.NOTION_TOKEN

  if (!token) {
    process.stderr.write('缺少 NOTION_TOKEN，请先在 .env 中填写。\n')
    process.exit(1)
  }

  const targets = [
    { keyword: '反洗钱资料库', envKey: 'NOTION_DB_DOCUMENTS' },
    { keyword: '组织结构库', envKey: 'NOTION_DB_ORG' },
    { keyword: '考核指标库', envKey: 'NOTION_DB_KPI' },
    { keyword: '自评指标体库', envKey: 'NOTION_DB_SELF_EVAL' },
    { keyword: '可疑指标库', envKey: 'NOTION_DB_SUSPICIOUS' },
  ]

  const databases = await searchAllDatabases(token)
  const matched = []

  for (const target of targets) {
    const hit = databases.find((db) => getDatabaseTitle(db).includes(target.keyword))
    matched.push({
      keyword: target.keyword,
      envKey: target.envKey,
      id: hit?.id ?? '',
      title: hit ? getDatabaseTitle(hit) : '',
    })
  }

  const missing = matched.filter((item) => !item.id)
  if (missing.length > 0) {
    process.stderr.write(`未找到以下数据库：${missing.map((item) => item.keyword).join('、')}\n`)
  }

  const updates = Object.fromEntries(matched.filter((item) => item.id).map((item) => [item.envKey, item.id]))
  const nextContent = upsertEnvLines(envContent, updates)
  fs.writeFileSync(ENV_PATH, nextContent, 'utf8')

  for (const item of matched) {
    if (!item.id) {
      process.stdout.write(`${item.envKey}: 未找到（匹配标题包含 "${item.keyword}"）\n`)
    } else {
      process.stdout.write(`${item.envKey}: ${item.title} -> ${item.id}\n`)
    }
  }

  if (missing.length > 0) process.exit(1)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})

