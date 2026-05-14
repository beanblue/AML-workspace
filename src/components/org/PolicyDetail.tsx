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
  PanelRightClose,
  PanelRightOpen,
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

type SectionType = 'chapter' | 'section' | 'article'

type SectionNode = {
  id: string
  type: SectionType
  title: string
  content: string
  parentId?: string
}

const CHAPTER_LINE_REGEX = /^#{1,2}\s*第[一二三四五六七八九十百千\d]+章[\s　]*(.*)/
const SECTION_LINE_REGEX = /^#{1,3}\s*第[一二三四五六七八九十百千\d]+节[\s　]*(.*)/
const ARTICLE_LINE_REGEX = /^第[一二三四五六七八九十百千\d]+条[\s　]+(.*)/

function parseSections(content: string): SectionNode[] {
  const text = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  if (!text) return []

  const lines = text.split('\n')
  const nodes: SectionNode[] = []
  let foundStructure = false

  let chapterCount = 0
  let sectionCount = 0
  let articleCount = 0

  let currentChapterId: string | undefined
  let currentSectionId: string | undefined
  let currentNodeId: string | undefined

  const appendToCurrent = (line: string) => {
    if (!currentNodeId) return
    const node = nodes.find((n) => n.id === currentNodeId)
    if (!node) return
    node.content = node.content ? `${node.content}\n${line}` : line
  }

  const startNode = (type: SectionType, title: string, initialContent: string, parentId?: string) => {
    if (type === 'chapter') chapterCount += 1
    if (type === 'section') sectionCount += 1
    if (type === 'article') articleCount += 1
    const id =
      type === 'chapter'
        ? `chapter-${chapterCount}`
        : type === 'section'
          ? `section-${sectionCount}`
          : `article-${articleCount}`

    nodes.push({
      id,
      type,
      title,
      content: initialContent,
      ...(parentId ? { parentId } : {}),
    })
    currentNodeId = id
    if (type === 'chapter') {
      currentChapterId = id
      currentSectionId = undefined
    }
    if (type === 'section') {
      currentSectionId = id
    }
  }

  for (const rawLine of lines) {
    const lineRaw = rawLine.replace(/\s+$/g, '')
    const lineTrim = lineRaw.trim()
    if (!lineTrim) continue
    if (lineTrim === '---') continue

    const lineForMatch = lineRaw.trimStart()

    const chapterMatch = lineForMatch.match(CHAPTER_LINE_REGEX)
    if (chapterMatch) {
      foundStructure = true
      startNode('chapter', lineForMatch.replace(/^#{1,6}\s*/, '').trim(), '')
      continue
    }

    const sectionMatch = lineForMatch.match(SECTION_LINE_REGEX)
    if (sectionMatch) {
      foundStructure = true
      startNode('section', lineForMatch.replace(/^#{1,6}\s*/, '').trim(), '', currentChapterId)
      continue
    }

    const articleMatch = !lineForMatch.startsWith('#') ? lineForMatch.match(ARTICLE_LINE_REGEX) : null
    if (articleMatch) {
      foundStructure = true
      const parentId = currentSectionId ?? currentChapterId
      startNode('article', lineTrim, '', parentId)
      continue
    }

    appendToCurrent(lineRaw)
  }

  if (!foundStructure) return []
  return nodes
}

function renderSectionContent(text: string) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  return (
    <div className="mt-3 space-y-2 text-sm leading-7 text-slate-800">
      {lines.map((line, idx) => {
        const trimmed = line.replace(/\s+$/g, '')
        if (!trimmed.trim()) return <div key={`blank-${idx}`} className="h-3" />
        const indent =
          /^（[一二三四五六七八九十百千零\d]+）/.test(trimmed)
            ? 'pl-6'
            : /^[一二三四五六七八九十百千零\d]+、/.test(trimmed) || /^\d+\./.test(trimmed)
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
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [aiCollapsed, setAiCollapsed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [allDocs, setAllDocs] = useState<NotionDocumentRow[]>([])
  const [pageContent, setPageContent] = useState<string>('')
  const [pageContentLoading, setPageContentLoading] = useState(false)
  const [favorites, setFavorites] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [openClauseId, setOpenClauseId] = useState<string | null>(null)
  const [activeTocId, setActiveTocId] = useState<string>('fulltext')
  const [collapsedTocIds, setCollapsedTocIds] = useState<string[]>([])
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

  const contentText = useMemo(() => getContent(doc), [doc])

  useEffect(() => {
    if (!doc?.id) return
    setPageContentLoading(true)
    setPageContent('')

    fetch(`/api/notion/page/${doc.id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status))
        return res.json()
      })
      .then((data) => {
        const text = String(data?.content ?? data?.body ?? data?.text ?? data?.markdown ?? '').trim()
        setPageContent(text)
      })
      .catch(() => setPageContent(''))
      .finally(() => setPageContentLoading(false))
  }, [doc?.id])

  const parseSourceText = useMemo(() => (pageContent.trim() ? pageContent : contentText), [contentText, pageContent])
  const sections = useMemo(() => parseSections(parseSourceText), [parseSourceText])
  const hasSectionLevel = useMemo(() => sections.some((s) => s.type === 'section'), [sections])

  const childrenMap = useMemo(() => {
    const map = new Map<string, string[]>()
    sections.forEach((node) => {
      if (!node.parentId) return
      const list = map.get(node.parentId) ?? []
      list.push(node.id)
      map.set(node.parentId, list)
    })
    return map
  }, [sections])

  const parentMap = useMemo(() => new Map(sections.map((s) => [s.id, s.parentId])), [sections])

  const firstArticleIdMap = useMemo(() => {
    const byId = new Map(sections.map((s) => [s.id, s]))

    const findFirstArticle = (nodeId: string): string | null => {
      const node = byId.get(nodeId)
      if (!node) return null
      if (node.type === 'article') return node.id
      const children = childrenMap.get(node.id) ?? []
      for (const cid of children) {
        const found = findFirstArticle(cid)
        if (found) return found
      }
      return null
    }

    const map = new Map<string, string>()
    sections.forEach((s) => {
      const found = findFirstArticle(s.id)
      if (found) map.set(s.id, found)
    })
    return map
  }, [childrenMap, sections])

  const activeAncestorIds = useMemo(() => {
    const set = new Set<string>()
    let cursor: string | undefined = activeTocId
    while (cursor) {
      set.add(cursor)
      cursor = parentMap.get(cursor)
    }
    return set
  }, [activeTocId, parentMap])

  const relatedDocs = useMemo(() => {
    const topic = topics[0]
    if (!topic) return []
    return allDocs
      .filter((item) => item.id !== doc?.id)
      .filter((item) => normalizeTextList(item.主题标签).includes(topic))
      .slice(0, 6)
  }, [allDocs, doc?.id, topics])

  const visibleSections = useMemo(() => {
    if (sections.length === 0) return []
    const kw = search.trim().toLowerCase()
    if (!kw) return sections

    const included = new Set<string>()
    const byId = new Map(sections.map((s) => [s.id, s]))
    const addAncestors = (node: SectionNode) => {
      if (!node.parentId) return
      const parent = byId.get(node.parentId)
      if (!parent) return
      included.add(parent.id)
      addAncestors(parent)
    }

    sections.forEach((node) => {
      if (node.type !== 'article') return
      const combined = `${node.title}\n${node.content}`.toLowerCase()
      if (!combined.includes(kw)) return
      included.add(node.id)
      addAncestors(node)
    })

    if (included.size === 0) return []
    return sections.filter((node) => included.has(node.id))
  }, [search, sections])

  useEffect(() => {
    if (visibleSections.length === 0) return
    const firstArticle = visibleSections.find((s) => s.type === 'article')
    setActiveTocId(firstArticle?.id ?? visibleSections[0]?.id ?? 'fulltext')
  }, [visibleSections])

  useEffect(() => {
    const ids = visibleSections.filter((item) => item.type === 'article').map((item) => item.id)
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
  }, [visibleSections])

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

      <div className="flex flex-col gap-3 xl:flex-row xl:items-stretch">
        <aside
          className={`rounded-xl border border-slate-200 bg-white ${collapsed ? 'xl:w-14' : 'xl:w-[260px]'} flex min-h-0 flex-col`}
        >
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
            <div className="min-h-0 flex-1 overflow-auto p-2">
              {sections.length === 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    document.getElementById('fulltext')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    setActiveTocId('fulltext')
                  }}
                  className={`w-full rounded px-2 py-2 text-left text-sm font-semibold ${
                    activeTocId === 'fulltext' ? 'bg-blue-50 text-blue-700' : 'bg-slate-50 text-slate-700 hover:bg-slate-200/70'
                  }`}
                >
                  全文
                </button>
              ) : (
                <div className="space-y-0.5">
                  {sections.map((node) => {
                    const children = childrenMap.get(node.id) ?? []
                    const hasChildren = children.length > 0
                    const isCollapsed = collapsedTocIds.includes(node.id)
                    const parentId = parentMap.get(node.id)
                    const parentCollapsed = parentId ? collapsedTocIds.includes(parentId) : false
                    const grandParentId = parentId ? parentMap.get(parentId) : undefined
                    const grandParentCollapsed = grandParentId ? collapsedTocIds.includes(grandParentId) : false
                    if (node.type === 'section' && parentCollapsed) return null
                    if (node.type === 'article' && (parentCollapsed || grandParentCollapsed)) return null

                    const indentClass =
                      node.type === 'chapter'
                        ? 'pl-2'
                        : node.type === 'section'
                          ? 'pl-5'
                          : hasSectionLevel
                            ? 'pl-8'
                            : 'pl-5'

                    const baseTitle =
                      node.type === 'article'
                        ? node.title.length > 32
                          ? `${node.title.slice(0, 32)}...`
                          : node.title
                        : node.title

                    const active = activeAncestorIds.has(node.id)

                    return (
                      <div key={node.id} className="flex items-center gap-1">
                        {node.type === 'article' ? <span className="w-6" /> : null}
                        {node.type !== 'article' ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (!hasChildren) return
                              setCollapsedTocIds((prev) =>
                                prev.includes(node.id) ? prev.filter((x) => x !== node.id) : [...prev, node.id],
                              )
                            }}
                            className={`rounded p-1 text-slate-500 hover:bg-slate-100 ${hasChildren ? '' : 'opacity-30'}`}
                          >
                            <ChevronRight className={`h-4 w-4 transition ${isCollapsed ? '' : 'rotate-90'}`} />
                          </button>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => {
                            const targetId = node.type === 'article' ? node.id : firstArticleIdMap.get(node.id) ?? node.id
                            document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                            setActiveTocId(targetId)
                          }}
                          className={`w-full rounded px-2 py-2 text-left text-sm ${indentClass} ${
                            node.type === 'chapter'
                              ? active
                                ? 'bg-blue-50 font-semibold text-blue-700'
                                : 'bg-slate-50 font-semibold text-slate-700 hover:bg-slate-200/70'
                              : node.type === 'section'
                                ? active
                                  ? 'bg-blue-50 font-medium text-blue-700'
                                  : 'bg-white font-medium text-slate-700 hover:bg-slate-50'
                                : active
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {baseTitle}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </aside>

        <main ref={contentRef} className="min-w-0 flex-1 space-y-3 px-2 xl:px-6">
          {pageContentLoading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">正文加载中...</div>
          ) : null}
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
              {sections.length === 0 ? (
                <div id="fulltext" className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">全文</span>
                    <span className="text-sm font-semibold text-slate-900">正文</span>
                  </div>
                  {renderSectionContent(parseSourceText)}
                </div>
              ) : visibleSections.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">无匹配条款</div>
              ) : (
                visibleSections.map((node) => {
                  if (node.type === 'chapter') {
                    return (
                      <div key={node.id} id={node.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm font-semibold text-slate-900">{node.title}</p>
                        {node.content ? renderSectionContent(node.content) : null}
                      </div>
                    )
                  }

                  if (node.type === 'section') {
                    return (
                      <div key={node.id} id={node.id} className="rounded-lg border border-slate-200 bg-white p-4">
                        <p className="text-sm font-semibold text-slate-900">{node.title}</p>
                        {node.content ? renderSectionContent(node.content) : null}
                      </div>
                    )
                  }

                  const noMatch = node.title.match(/^(第[一二三四五六七八九十百千\d]+条)/)
                  const no = noMatch?.[1] ?? '条款'
                  const lead = node.title.replace(no, '').trim()
                  const active = activeTocId === node.id

                  return (
                    <div
                      key={node.id}
                      id={node.id}
                      className={`rounded-lg border border-slate-200 bg-white p-4 ${active ? 'ring-1 ring-blue-200' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className={`flex flex-wrap items-center gap-2 rounded ${active ? 'bg-blue-50 px-2 py-1' : ''}`}>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{no}</span>
                            <span className="text-sm font-semibold text-slate-900">{lead || '—'}</span>
                          </div>
                          {renderSectionContent(node.content)}
                        </div>
                        <button
                          type="button"
                          onClick={() => setOpenClauseId((prev) => (prev === node.id ? null : node.id))}
                          className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                        >
                          {openClauseId === node.id ? '收起要点' : '展开要点'}
                        </button>
                      </div>
                      <ClauseInsight
                        clauseId={node.id}
                        open={openClauseId === node.id}
                        onToggle={() => setOpenClauseId((prev) => (prev === node.id ? null : node.id))}
                      />
                    </div>
                  )
                })
              )}
            </div>
          </article>
        </main>

        <aside
          className={`rounded-xl border border-slate-200 bg-white ${rightCollapsed ? 'xl:w-10' : 'xl:w-72 xl:max-w-[320px]'} flex min-h-0 flex-col`}
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
            {rightCollapsed ? (
              <div className="flex flex-1 items-center justify-center">
                <span className="text-xs font-medium text-slate-600" style={{ writingMode: 'vertical-rl' }}>
                  信息
                </span>
              </div>
            ) : (
              <span className="text-sm font-medium text-slate-800">信息</span>
            )}
            <button
              type="button"
              onClick={() => setRightCollapsed((prev) => !prev)}
              className="rounded border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-50"
            >
              {rightCollapsed ? <PanelRightOpen className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}
            </button>
          </div>

          {rightCollapsed ? null : (
            <div className="min-h-0 flex-1 space-y-3 overflow-auto p-3">
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
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}
