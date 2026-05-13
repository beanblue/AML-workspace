type NotionFilter = Record<string, unknown>

interface NotionRichText {
  plain_text?: string
}

interface NotionProperty {
  type?: string
  title?: NotionRichText[]
  rich_text?: NotionRichText[]
  select?: { name?: string } | null
  multi_select?: Array<{ name?: string }>
  date?: { start?: string | null } | null
  number?: number | null
  checkbox?: boolean
  url?: string | null
  email?: string | null
  phone_number?: string | null
}

interface NotionPage {
  id: string
  created_time: string
  last_edited_time: string
  properties: Record<string, NotionProperty>
}

interface NotionQueryResponse {
  results: NotionPage[]
  has_more?: boolean
  next_cursor?: string | null
}

export type NotionFormattedRow = {
  id: string
  createdAt: string
  updatedAt: string
  [key: string]: unknown
}

const toText = (list?: NotionRichText[]): string => list?.map((item) => item.plain_text ?? '').join('') ?? ''

const formatPropertyValue = (prop: NotionProperty): unknown => {
  const type = prop.type
  if (type === 'title') return toText(prop.title)
  if (type === 'rich_text') return toText(prop.rich_text)
  if (type === 'select') return prop.select?.name ?? ''
  if (type === 'multi_select') return prop.multi_select?.map((item) => item.name ?? '').filter(Boolean) ?? []
  if (type === 'date') return prop.date?.start ?? ''
  if (type === 'number') return prop.number ?? null
  if (type === 'checkbox') return Boolean(prop.checkbox)
  if (type === 'url') return prop.url ?? ''
  if (type === 'email') return prop.email ?? ''
  if (type === 'phone_number') return prop.phone_number ?? ''
  return null
}

const formatPage = (page: NotionPage): NotionFormattedRow => {
  const formatted: NotionFormattedRow = {
    id: page.id,
    createdAt: page.created_time,
    updatedAt: page.last_edited_time,
  }

  for (const [key, prop] of Object.entries(page.properties ?? {})) {
    formatted[key] = formatPropertyValue(prop)
  }

  return formatted
}

export async function queryDatabase(databaseId: string, filter?: NotionFilter): Promise<NotionFormattedRow[]> {
  const rows: NotionPage[] = []
  let cursor: string | null | undefined = null

  while (rows.length < 100) {
    const response = await fetch('/api/notion/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        databaseId,
        ...(filter ? { filter } : {}),
        ...(cursor ? { startCursor: cursor } : {}),
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(text || `Notion 查询失败：${response.status}`)
    }

    const data = (await response.json()) as NotionQueryResponse
    rows.push(...(data.results ?? []))

    if (!data.has_more) break
    cursor = data.next_cursor
    if (!cursor) break
  }

  return rows.slice(0, 100).map(formatPage)
}
