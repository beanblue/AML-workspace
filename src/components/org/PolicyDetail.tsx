import {
  ArrowLeft,
  BookOpenText,
  ChevronDown,
  ChevronRight,
  Download,
  Link2,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Printer,
  Search,
  Share2,
  Star,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { queryDatabase } from '../../api/notion'

type NotionDocumentRow = {
  id: string
  标题?: string
  Name?: string
  类型?: string
  文档类型?: string
  状态?: string
  来源?: string
  发文部门?: string
  发文机关?: string
  部门?: string
  编号?: string
  文号?: string
  制度编号?: string
  发布日期?: string
  生效日期?: string
  '生效/发布日期'?: string
  摘要?: string
  '关键要点/适用情景'?: string
  正文?: string
  全文?: string
  内容?: string
  content?: string
  主题标签?: string[] | string
}

type InsightTab = '引用文档' | '修订沿革' | '合规解读'

const STATUS_STYLE: Record<string, string> = {
  现行有效: 'bg-emerald-100 text-emerald-700',
  已废止: 'bg-red-100 text-red-700',
  修订中: 'bg-orange-100 text-orange-700',
  草案: 'bg-slate-100 text-slate-700',
  尚未生效: 'bg-blue-100 text-blue-700',
}

const TYPE_CLASS = 'bg-slate-100 text-slate-700'

function normalizeTextList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).map((v) => v.trim()).filter(Boolean)
  if (typeof raw === 'string') {
    const v = raw.trim()
    if (!v) return []
    if (v.includes(',') || v.includes('，') || v.includes('、')) return v.split(/[,，、]/).map((x) => x.trim()).filter(Boolean)
    return [v]
  }
  return []
}

function normalizeTimeliness(statusRaw: string): string {
  const status = statusRaw.trim()
  if (!status) return '草案'
  if (status.includes('有效') || status === '生效') return '现行有效'
  if (status.includes('废止') || status.includes('失效')) return '已废止'
  if (status.includes('修订') || status.includes('修订中') || status.includes('更新')) return '修订中'
  if (status.includes('草案') || status.includes('拟稿') || status.includes('草稿')) return '草案'
  if (status.includes('未生效') || status.includes('尚未生效')) return '尚未生效'
  if (status.includes('仅参考')) return '现行有效'
  return '草案'
}

function getTitle(row: NotionDocumentRow | null): string {
  return String(row?.标题 ?? row?.Name ?? '').trim()
}

function getDepartment(row: NotionDocumentRow | null): string {
  return String(row?.发文部门 ?? row?.发文机关 ?? row?.部门 ?? row?.来源 ?? '').trim()
}

function getDocNo(row: NotionDocumentRow | null): string {
  return String(row?.编号 ?? row?.文号 ?? row?.制度编号 ?? '').trim()
}

function getPublishDate(row: NotionDocumentRow | null): string {
  return String(row?.发布日期 ?? row?.['生效/发布日期'] ?? '').trim()
}

function getEffectiveDate(row: NotionDocumentRow | null): string {
  return String(row?.生效日期 ?? row?.['生效/发布日期'] ?? '').trim()
}

function getContent(row: NotionDocumentRow | null): string {
  if (!row) return ''
  const record = row as unknown as Record<string, unknown>
  const raw =
    record.content ??
    record.Content ??
    record.CONTENT ??
    record.正文 ??
    record.全文 ??
    record.内容 ??
    record['正文内容'] ??
    row.content ??
    row.正文 ??
    row.全文 ??
    row.内容
  const text = typeof raw === 'string' ? raw.trim() : ''
  if (text) return text
  const summary = String(row?.摘要 ?? '').trim()
  const points = String(row?.['关键要点/适用情景'] ?? '').trim()
  return [summary, points].filter(Boolean).join('\n\n')
}

type Clause = {
  id: string
  no: string
  lead: string
  body: string
}

type Chapter = {
  id: string
  title: string
  clauses: Clause[]
}

const CHAPTER_REGEX = /^###\s*(第[一二三四五六七八九十百零\d]+[章节].*)/gm
const CLAUSE_REGEX = /\*\*(第[一二三四五六七八九十百零\d]+条)\*\*\s*(.*)/g

function parsePolicyMarkdown(content: string): Chapter[] {
  const text = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  if (!text) {
    return [
      {
        id: 'chapter-full',
        title: '全文',
        clauses: [
          {
            id: 'fulltext',
            no: '全文',
            lead: '',
            body: '暂无正文内容（待接入全文解析）。',
          },
        ],
      },
    ]
  }

  const chapters: Array<{ index: number; title: string }> = []
  for (const match of text.matchAll(CHAPTER_REGEX)) {
    chapters.push({ index: match.index ?? 0, title: String(match[1] ?? '').trim() })
  }
  chapters.sort((a, b) => a.index - b.index)

  const clauses: Array<{ index: number; end: number; no: string; first: string }> = []
  for (const match of text.matchAll(CLAUSE_REGEX)) {
    const idx = match.index ?? 0
    const no = String(match[1] ?? '').trim()
    const first = String(match[2] ?? '').trim()
    clauses.push({ index: idx, end: idx + String(match[0] ?? '').length, no, first })
  }
  clauses.sort((a, b) => a.index - b.index)

  if (clauses.length === 0) {
    return [
      {
        id: 'chapter-full',
        title: '全文',
        clauses: [
          {
            id: 'fulltext',
            no: '全文',
            lead: '',
            body: text,
          },
        ],
      },
    ]
  }

  const chapterAt = (pos: number): { index: number; title: string } | null => {
    let last: { index: number; title: string } | null = null
    for (const c of chapters) {
      if (c.index <= pos) last = c
      else break
    }
    return last
  }

  const nextChapterIndexAfter = (pos: number): number => {
    for (const c of chapters) {
      if (c.index > pos) return c.index
    }
    return Number.POSITIVE_INFINITY
  }

  const groups = new Map<string, Chapter>()
  const ensureChapter = (title: string): Chapter => {
    const key = title || '未分章'
    const existing = groups.get(key)
    if (existing) return existing
    const chapter: Chapter = { id: `chapter-${groups.size + 1}`, title: key, clauses: [] }
    groups.set(key, chapter)
    return chapter
  }

  clauses.forEach((clause, idx) => {
    const nextClauseStart = clauses[idx + 1]?.index ?? Number.POSITIVE_INFINITY
    const nextChapterStart = nextChapterIndexAfter(clause.index)
    const end = Math.min(nextClauseStart, nextChapterStart, text.length)
    const tail = text.slice(clause.end, end).trim()
    const body = [clause.first, tail].filter(Boolean).join('\n').trim()
    const lead = clause.first || body.split('\n').map((x) => x.trim()).find(Boolean) || ''

    const chapter = chapterAt(clause.index)
    const chapterTitle = chapter?.title ?? '未分章'
    const group = ensureChapter(chapterTitle)
    group.clauses.push({
      id: `clause-${group.clauses.length + 1}-${group.id}`,
      no: clause.no,
      lead,
      body: body || '—',
    })
  })

  const ordered: Chapter[] = []
  for (const entry of groups.values()) ordered.push(entry)
  return ordered
}

function renderClauseBody(body: string) {
  const lines = body.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')

  return (
    <div className="mt-3 space-y-2 text-sm leading-7 text-slate-800">
      {lines.map((line, idx) => {
        const trimmed = line.replace(/\s+$/g, '')
        if (!trimmed.trim()) return <div key={`blank-${idx}`} className="h-3" />
        const indent =
          /^（[一二三四五六七八九十百零\d]+）/.test(trimmed)
            ? 'pl-6'
            : /^[一二三四五六七八九十百零\d]+、/.test(trimmed) || /^\d+\./.test(trimmed)
              ? 'pl-4'
              : 'pl-0'
        return (
          <p key={`line-${idx}`} className={`whitespace-pre-wrap ${indent}`}>
            {trimmed}
          </p>
        )
      })}
    </div>
  )
}

function ClauseInsight({
  clauseId,
  open,
  onToggle,
}: {
  clauseId: string
  open: boolean
  onToggle: () => void
}) {
  const [tab, setTab] = useState<InsightTab>('引用文档')

  useEffect(() => {
    if (!open) setTab('引用文档')
  }, [open])

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between px-3 py-2 text-left">
        <span className="text-sm font-medium text-slate-800">要点</span>
        <ChevronRight className={`h-4 w-4 text-slate-500 transition ${open ? 'rotate-90' : ''}`} />
      </button>
      {open ? (
        <div className="border-t border-slate-200 px-3 pb-3">
          <div className="mt-3 inline-flex rounded-lg border border-slate-200 bg-white p-1">
            {(['引用文档', '修订沿革', '合规解读'] as const).map((item) => (
              <button
                key={`${clauseId}-${item}`}
                type="button"
                onClick={() => setTab(item)}
                className={`rounded px-3 py-1.5 text-sm ${
                  tab === item ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="mt-3 rounded border border-slate-200 bg-white p-3 text-sm text-slate-700">
            {tab === '引用文档' ? '暂无引用文档，接入关联库后自动展示。' : null}
            {tab === '修订沿革' ? '暂无修订沿革，接入版本库后自动展示。' : null}
            {tab === '合规解读' ? '暂无合规解读，接入解读库后自动展示。' : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function PolicyDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [collapsed, setCollapsed] = useState(false)
  const [aiCollapsed, setAiCollapsed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [allDocs, setAllDocs] = useState<NotionDocumentRow[]>([])
  const [favorites, setFavorites] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [openClauseId, setOpenClauseId] = useState<string | null>(null)
  const [activeTocId, setActiveTocId] = useState<string>('fulltext')
  const contentRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const result = await queryDatabase('documents')
        setAllDocs(result.map((item) => item as unknown as NotionDocumentRow))
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    }
    void run()
  }, [])

  const doc = useMemo(() => allDocs.find((item) => item.id === id) ?? null, [allDocs, id])
  const content = (doc as unknown as { content?: unknown } | null)?.content
  console.log('[DEBUG content]', (typeof content === 'string' ? content : JSON.stringify(content ?? '')).slice(0, 300))
  const title = getTitle(doc)
  const timeliness = normalizeTimeliness(String(doc?.状态 ?? ''))
  const statusClass = STATUS_STYLE[timeliness] ?? 'bg-slate-100 text-slate-700'
  const dept = getDepartment(doc)
  const docNo = getDocNo(doc)
  const publish = getPublishDate(doc)
  const effective = getEffectiveDate(doc)
  const type = String(doc?.文档类型 ?? doc?.类型 ?? '').trim()
  const summary = String(doc?.摘要 ?? '').trim()
  const keyPoints = String(doc?.['关键要点/适用情景'] ?? '').trim()
  const topics = useMemo(() => normalizeTextList(doc?.主题标签), [doc?.主题标签])

  const contentText = useMemo(() => (typeof content === 'string' && content.trim() ? content : getContent(doc)), [content, doc])
  const chapters = useMemo(() => parsePolicyMarkdown(contentText), [contentText])
  const allClauses = useMemo(() => chapters.flatMap((chapter) => chapter.clauses), [chapters])
  const clauseChapterMap = useMemo(() => {
    const map = new Map<string, string>()
    chapters.forEach((chapter) => {
      chapter.clauses.forEach((clause) => map.set(clause.id, chapter.id))
    })
    return map
  }, [chapters])

  const relatedDocs = useMemo(() => {
    const topic = topics[0]
    if (!topic) return []
    return allDocs
      .filter((item) => item.id !== doc?.id)
      .filter((item) => normalizeTextList(item.主题标签).includes(topic))
      .slice(0, 6)
  }, [allDocs, doc?.id, topics])

  const filteredClauses = useMemo(() => {
    const kw = search.trim().toLowerCase()
    if (!kw) return allClauses
    return allClauses.filter((clause) => {
      const combined = `${clause.no} ${clause.lead} ${clause.body}`.toLowerCase()
      return combined.includes(kw)
    })
  }, [allClauses, search])

  const activeChapterId = clauseChapterMap.get(activeTocId) ?? chapters[0]?.id ?? 'chapter-full'

  useEffect(() => {
    if (filteredClauses.length === 0) return
    setActiveTocId(filteredClauses[0]?.id ?? 'fulltext')
  }, [filteredClauses])

  useEffect(() => {
    const ids = filteredClauses.map((item) => item.id)
    if (ids.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => (a.boundingClientRect.top ?? 0) - (b.boundingClientRect.top ?? 0))
        const first = visible[0]
        if (first?.target?.id) setActiveTocId(first.target.id)
      },
      { root: null, rootMargin: '-15% 0px -70% 0px', threshold: [0.1, 0.25, 0.5] },
    )

    ids.forEach((cid) => {
      const el = document.getElementById(cid)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [filteredClauses])

  const counts = useMemo(() => {
    const n = relatedDocs.length
    return {
      flows: Math.min(3, n),
      basis: Math.min(4, n),
      guides: Math.min(2, n),
      cases: 0,
      trainings: Math.min(2, n),
    }
  }, [relatedDocs.length])

  if (loading) {
    return <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">全文加载中...</div>
  }

  if (error || !doc) {
    return (
      <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-medium text-red-700">未找到制度全文</p>
        <p className="text-xs text-red-600">{error ?? '该制度可能已删除或尚未同步。'}</p>
        <button
          type="button"
          onClick={() => navigate('/org/library')}
          className="rounded border border-red-200 bg-white px-3 py-1.5 text-sm text-red-700"
        >
          返回文件库
        </button>
      </div>
    )
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate('/org/library')}
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          返回
        </button>
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <span className="inline-flex items-center gap-1">
            文件库 <ChevronRight className="h-4 w-4" />
          </span>
          <span className="inline-flex items-center gap-1">
            制度与流程 <ChevronRight className="h-4 w-4" />
          </span>
          <span className="text-slate-700">{title || '文档标题'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[220px_1fr_280px]">
        <aside className={`rounded-xl border border-slate-200 bg-white ${collapsed ? 'xl:w-14' : 'xl:w-[220px]'}`}>
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
            <div className="flex items-center gap-2">
              <BookOpenText className="h-4 w-4 text-slate-600" />
              {collapsed ? null : <span className="text-sm font-medium text-slate-800">目录</span>}
            </div>
            <button
              type="button"
              onClick={() => setCollapsed((prev) => !prev)}
              className="rounded border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-50"
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          </div>

          {collapsed ? null : (
            <div className="max-h-[75vh] overflow-auto p-2">
              {chapters.map((chapter) => {
                const firstClauseId = chapter.clauses[0]?.id
                return (
                  <div key={chapter.id} className="mb-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!firstClauseId) return
                        const el = document.getElementById(firstClauseId)
                        el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }}
                      className={`w-full rounded px-2 py-2 text-left text-sm font-semibold ${
                        activeChapterId === chapter.id ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200/70'
                      }`}
                    >
                      {chapter.title}
                    </button>

                    <div className="mt-1 space-y-1">
                      {chapter.clauses.map((clause) => (
                        <button
                          key={clause.id}
                          type="button"
                          onClick={() => {
                            const el = document.getElementById(clause.id)
                            el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                          }}
                          className={`w-full rounded px-2 py-1.5 text-left text-sm ${
                            activeTocId === clause.id ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {clause.no}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </aside>

        <main ref={contentRef} className="space-y-3">
          <article className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold text-slate-900">{title || '未命名文档'}</h1>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass}`}>{timeliness}</span>
                  {type ? <span className={`rounded-full px-2 py-0.5 text-xs ${TYPE_CLASS}`}>{type}</span> : null}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                  {dept ? <span>发文机关：{dept}</span> : null}
                  {docNo ? <span>编号：{docNo}</span> : null}
                  {publish ? <span>发布日期：{publish}</span> : null}
                  {effective ? <span>生效日期：{effective}</span> : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.alert('Mock：导出')}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Download className="h-4 w-4" />
                  导出
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Printer className="h-4 w-4" />
                  打印
                </button>
                <button
                  type="button"
                  onClick={() => setFavorites((prev) => (prev.includes(doc.id) ? prev.filter((x) => x !== doc.id) : [...prev, doc.id]))}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    favorites.includes(doc.id)
                      ? 'border-amber-200 bg-amber-50 text-amber-700'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Star className="h-4 w-4" />
                  收藏
                </button>
                <button
                  type="button"
                  onClick={() => window.alert('Mock：分享链接')}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Share2 className="h-4 w-4" />
                  分享
                </button>
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => setAiCollapsed((prev) => !prev)}
              className="flex w-full items-center justify-between px-5 py-3 text-left"
            >
              <span className="text-sm font-semibold text-slate-900">AI 编辑提示</span>
              <ChevronDown className={`h-4 w-4 text-slate-500 transition ${aiCollapsed ? '' : 'rotate-180'}`} />
            </button>
            {aiCollapsed ? null : (
              <div className="border-t border-slate-200 px-5 pb-4">
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-medium text-slate-500">摘要</p>
                    <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{summary || '—'}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-medium text-slate-500">关键要点</p>
                    <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{keyPoints || '—'}</p>
                  </div>
                </div>
              </div>
            )}
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                <button type="button" className="rounded bg-slate-100 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-200">
                  关联流程({counts.flows})
                </button>
                <button type="button" className="rounded bg-slate-100 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-200">
                  监管依据({counts.basis})
                </button>
                <button type="button" className="rounded bg-slate-100 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-200">
                  操作指引({counts.guides})
                </button>
                <button type="button" className="rounded bg-slate-100 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-200">
                  相关案例({counts.cases})
                </button>
                <button type="button" className="rounded bg-slate-100 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-200">
                  培训材料({counts.trainings})
                </button>
              </div>

              <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="条文内搜索"
                  className="w-48 border-none bg-transparent px-2 py-2 text-sm outline-none"
                />
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="space-y-4">
              {filteredClauses.map((item) => (
                <div key={item.id} id={item.id} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{item.no}</span>
                        <span className="text-sm font-semibold text-slate-900">{item.lead || (item.no === '全文' ? '正文' : '—')}</span>
                      </div>
                      {renderClauseBody(item.body)}
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpenClauseId((prev) => (prev === item.id ? null : item.id))}
                      className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      {openClauseId === item.id ? '收起要点' : '展开要点'}
                    </button>
                  </div>
                  <ClauseInsight clauseId={item.id} open={openClauseId === item.id} onToggle={() => setOpenClauseId((prev) => (prev === item.id ? null : item.id))} />
                </div>
              ))}
            </div>
          </article>
        </main>

        <aside className="space-y-3">
          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">制度图谱</p>
              <Network className="h-4 w-4 text-slate-500" />
            </div>
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <svg viewBox="0 0 240 140" className="h-36 w-full">
                <circle cx="40" cy="70" r="16" fill="#93c5fd" />
                <circle cx="120" cy="35" r="16" fill="#a7f3d0" />
                <circle cx="120" cy="105" r="16" fill="#fde68a" />
                <circle cx="200" cy="70" r="16" fill="#cbd5e1" />
                <line x1="56" y1="70" x2="104" y2="42" stroke="#94a3b8" strokeWidth="2" />
                <line x1="56" y1="70" x2="104" y2="98" stroke="#94a3b8" strokeWidth="2" />
                <line x1="136" y1="35" x2="184" y2="70" stroke="#94a3b8" strokeWidth="2" />
                <line x1="136" y1="105" x2="184" y2="70" stroke="#94a3b8" strokeWidth="2" />
              </svg>
            </div>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">关联流程</p>
              <Link2 className="h-4 w-4 text-slate-500" />
            </div>
            <div className="mt-3 space-y-2">
              {counts.flows === 0 ? <p className="text-sm text-slate-500">暂无关联流程</p> : null}
              {Array.from({ length: counts.flows }).map((_, idx) => (
                <button
                  key={`flow-${idx}`}
                  type="button"
                  onClick={() => navigate('/org/library')}
                  className="flex w-full items-center justify-between rounded border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <span className="truncate">流程示例 {idx + 1}</span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">监管依据</p>
            <div className="mt-3 space-y-2">
              {counts.basis === 0 ? <p className="text-sm text-slate-500">暂无监管依据</p> : null}
              {Array.from({ length: counts.basis }).map((_, idx) => (
                <div key={`basis-${idx}`} className="rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  监管依据示例 {idx + 1}
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">相关制度</p>
            <div className="mt-3 space-y-2">
              {relatedDocs.length === 0 ? <p className="text-sm text-slate-500">暂无相关制度</p> : null}
              {relatedDocs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(`/library/${item.id}`)}
                  className="flex w-full items-center justify-between rounded border border-slate-200 bg-white px-3 py-2 text-left hover:bg-slate-50"
                >
                  <span className="truncate text-sm text-slate-700">{getTitle(item) || '未命名文档'}</span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>
              ))}
            </div>
          </article>

          {topics.length > 0 ? (
            <article className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">主题标签</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {topics.map((t, idx) => (
                  <span
                    key={t}
                    className={`rounded-full px-3 py-1 text-xs ${idx % 2 === 0 ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </article>
          ) : null}
        </aside>
      </div>
    </section>
  )
}
