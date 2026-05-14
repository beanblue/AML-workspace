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
  X,
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

type PrintPaperSize = 'A4' | 'A3' | 'Letter'
type PrintOrientation = 'portrait' | 'landscape'
type PrintFont = '宋体' | '黑体' | '楷体' | '仿宋'
type PrintFontSize = '10pt' | '11pt' | '12pt' | '13pt'
type PrintLineHeight = '1.5' | '1.8' | '2.0' | '2.5'
type PrintIndent = '0' | '1' | '2'
type PrintParagraphSpacing = '4pt' | '6pt' | '8pt'
type PrintMargin = 'standard' | 'loose' | 'compact'
type PrintRange = 'full' | 'selection' | 'custom'

type PrintSettings = {
  paperSize: PrintPaperSize
  orientation: PrintOrientation
  bodyFont: PrintFont
  bodyFontSize: PrintFontSize
  titleFontMode: 'auto' | 'manual'
  titleFontSize: string
  lineHeight: PrintLineHeight
  indent: PrintIndent
  paragraphSpacing: PrintParagraphSpacing
  margin: PrintMargin
  showHeader: boolean
  showPageNumber: boolean
  range: PrintRange
  includeCover: boolean
  customOutlineIds: string[]
}

const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  paperSize: 'A4',
  orientation: 'portrait',
  bodyFont: '宋体',
  bodyFontSize: '12pt',
  titleFontMode: 'auto',
  titleFontSize: '',
  lineHeight: '1.8',
  indent: '2',
  paragraphSpacing: '4pt',
  margin: 'standard',
  showHeader: true,
  showPageNumber: true,
  range: 'full',
  includeCover: true,
  customOutlineIds: [],
}

function getPrintComputed(settings: PrintSettings) {
  const fontFamilyMap: Record<PrintFont, string> = {
    宋体: '"SimSun","宋体",serif',
    黑体: '"SimHei","黑体",sans-serif',
    楷体: '"KaiTi","楷体",serif',
    仿宋: '"FangSong","仿宋",serif',
  }

  const marginMap: Record<PrintMargin, string> = {
    standard: '2.5cm 2cm',
    loose: '3cm 2.5cm',
    compact: '2cm 1.5cm',
  }

  const bodySizeValue = Number.parseFloat(settings.bodyFontSize.replace('pt', ''))
  const titleSize =
    settings.titleFontMode === 'manual' && settings.titleFontSize.trim()
      ? settings.titleFontSize.trim()
      : `${Math.max(10, bodySizeValue + 2)}pt`

  const indentValue = settings.indent === '0' ? '0' : settings.indent === '1' ? '1em' : '2em'
  const pageSizeValue = settings.paperSize === 'Letter' ? 'Letter' : settings.paperSize
  const orientationValue = settings.orientation === 'landscape' ? 'landscape' : 'portrait'

  return {
    fontFamily: fontFamilyMap[settings.bodyFont],
    fontSize: settings.bodyFontSize,
    titleSize,
    lineHeight: settings.lineHeight,
    indent: indentValue,
    paragraphMargin: settings.paragraphSpacing,
    pageMargin: marginMap[settings.margin],
    pageSize: pageSizeValue,
    orientation: orientationValue,
  }
}

function applyPrintOverride(settings: PrintSettings, docTitle: string) {
  const computed = getPrintComputed(settings)
  const headerContent = settings.showHeader ? 'attr(data-doc-title)' : '""'
  const footerContent = settings.showPageNumber ? 'counter(page) "/" counter(pages)' : '""'

  const css = `:root{--print-font-family:${computed.fontFamily};--print-font-size:${computed.fontSize};--print-title-size:${computed.titleSize};--print-line-height:${computed.lineHeight};--print-indent:${computed.indent};--print-paragraph-margin:${computed.paragraphMargin};--print-page-margin:${computed.pageMargin};--print-page-size:${computed.pageSize};--print-page-orientation:${computed.orientation};}
@media print{body{font-family:var(--print-font-family)!important;font-size:var(--print-font-size)!important;color:#000;}h1{font-size:var(--print-title-size)!important;text-align:center!important;margin-bottom:20pt!important;}p{line-height:var(--print-line-height)!important;text-indent:var(--print-indent)!important;margin:var(--print-paragraph-margin) 0!important;}p.print-meta{text-indent:0!important;font-size:10pt!important;line-height:1.6!important;margin:2pt 0!important;}@page{size:var(--print-page-size) var(--print-page-orientation);margin:var(--print-page-margin);@top-center{content:${headerContent};font-size:10pt;color:#666;}@bottom-right{content:${footerContent};font-size:10pt;}}}
`

  const styleId = 'print-override'
  let style = document.getElementById(styleId) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = styleId
    document.head.appendChild(style)
  }
  style.textContent = css

  document.documentElement.setAttribute('data-doc-title', docTitle)
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

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

function ClauseInsight({ clauseId }: { clauseId: string }) {
  const [tab, setTab] = useState<InsightTab>('引用文档')

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 pb-3 pt-3">
      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
        {(['引用文档', '修订沿革', '合规解读'] as const).map((item) => (
          <button
            key={`${clauseId}-${item}`}
            type="button"
            onClick={() => setTab(item)}
            className={`rounded px-3 py-1.5 text-sm ${tab === item ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
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
  )
}

export default function PolicyDetail() {
  const { policyId, id } = useParams()
  const pageId = policyId ?? id
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
  const [activeTocId, setActiveTocId] = useState<string>('fulltext')
  const [collapsedTocIds, setCollapsedTocIds] = useState<string[]>([])
  const [printOpen, setPrintOpen] = useState(false)
  const [pendingPrint, setPendingPrint] = useState(false)
  const [selectedText, setSelectedText] = useState('')
  const [exportOpen, setExportOpen] = useState(false)
  const [printSettings, setPrintSettings] = useState<PrintSettings>(() => {
    const raw = localStorage.getItem('aml-print-settings')
    if (!raw) return DEFAULT_PRINT_SETTINGS
    try {
      const parsed = JSON.parse(raw) as Partial<PrintSettings> & { customChapters?: string[] }
      const customOutlineIds =
        Array.isArray(parsed.customOutlineIds) && parsed.customOutlineIds.length > 0
          ? parsed.customOutlineIds
          : Array.isArray(parsed.customChapters)
            ? parsed.customChapters
            : []
      return { ...DEFAULT_PRINT_SETTINGS, ...parsed, customOutlineIds }
    } catch {
      return DEFAULT_PRINT_SETTINGS
    }
  })
  const contentRef = useRef<HTMLDivElement | null>(null)
  const beforePrintTitleRef = useRef<string>('')
  const exportRef = useRef<HTMLDivElement | null>(null)

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

  const doc = useMemo(() => allDocs.find((item) => item.id === pageId) ?? null, [allDocs, pageId])
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

  const printOutlineOptions = useMemo(() => {
    const byId = new Map(sections.map((s) => [s.id, s]))
    return sections
      .filter((node) => node.type === 'chapter' || node.type === 'section')
      .map((node) => ({
        id: node.id,
        title: node.title,
        type: node.type,
        parentId: node.parentId,
        depth: node.type === 'section' ? 1 : 0,
        parentTitle: node.parentId ? byId.get(node.parentId)?.title ?? '' : '',
      }))
  }, [sections])

  const printableSections = useMemo(() => {
    if (printSettings.range !== 'custom') return sections
    if (printSettings.customOutlineIds.length === 0) return []

    const selected = new Set(printSettings.customOutlineIds)
    const included = new Set<string>()
    const byId = new Map(sections.map((s) => [s.id, s]))

    const addNode = (node: SectionNode | undefined) => {
      if (!node) return
      included.add(node.id)
      const children = childrenMap.get(node.id) ?? []
      children.forEach((cid) => addNode(byId.get(cid)))
    }

    sections.forEach((node) => {
      if (node.type !== 'chapter' && node.type !== 'section') return
      if (!selected.has(node.id)) return
      addNode(node)
    })

    return sections.filter((node) => included.has(node.id))
  }, [childrenMap, printSettings.customOutlineIds, printSettings.range, sections])

  const effectivePrintRange = useMemo(() => {
    if (printSettings.range !== 'selection') return printSettings.range
    return selectedText.trim() ? 'selection' : 'full'
  }, [printSettings.range, selectedText])

  const printableForRange = useMemo(() => {
    if (effectivePrintRange === 'custom') return printableSections
    return sections
  }, [effectivePrintRange, printableSections, sections])

  const previewArticles = useMemo(() => {
    if (effectivePrintRange === 'selection') {
      return selectedText
        .split('\n')
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 3)
        .map((line, idx) => ({ id: `sel-${idx}`, title: '', lines: [line] }))
    }

    const articles = printableForRange.filter((n) => n.type === 'article').slice(0, 3)
    return articles.map((a) => ({
      id: a.id,
      title: a.title,
      lines: [a.title, ...(a.content ? a.content.split('\n') : [])].map((x) => x.trim()).filter(Boolean),
    }))
  }, [effectivePrintRange, printableForRange, selectedText])

  const previewComputed = useMemo(() => getPrintComputed(printSettings), [printSettings])

  const triggerPrint = () => {
    if (!doc) return
    localStorage.setItem('aml-print-settings', JSON.stringify(printSettings))
    applyPrintOverride(printSettings, title || '文档标题')

    const prevTitle = document.title
    beforePrintTitleRef.current = prevTitle
    document.title = title || '文档标题'

    const cleanup = () => {
      document.title = beforePrintTitleRef.current || prevTitle
      document.documentElement.removeAttribute('data-doc-title')
    }

    window.addEventListener('afterprint', cleanup, { once: true })
    window.print()
  }

  useEffect(() => {
    if (!printOpen) return
    applyPrintOverride(printSettings, title || '文档标题')
    return () => {
      document.documentElement.removeAttribute('data-doc-title')
    }
  }, [printOpen, printSettings, title])

  useEffect(() => {
    if (!pendingPrint) return
    setPendingPrint(false)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => triggerPrint())
    })
  }, [pendingPrint])

  useEffect(() => {
    const handler = () => {
      const sel = window.getSelection()
      const text = sel?.toString() ?? ''
      if (!text.trim()) {
        setSelectedText('')
        return
      }
      const anchor = sel?.anchorNode
      const focus = sel?.focusNode
      const container = contentRef.current
      if (!container) return
      if ((anchor && container.contains(anchor)) || (focus && container.contains(focus))) {
        setSelectedText(text)
        return
      }
      setSelectedText('')
    }

    document.addEventListener('selectionchange', handler)
    return () => document.removeEventListener('selectionchange', handler)
  }, [])

  useEffect(() => {
    if (!exportOpen) return
    const handler = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (exportRef.current?.contains(target)) return
      setExportOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [exportOpen])

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
      <div className="no-print space-y-3">
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
                <div ref={exportRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setExportOpen((prev) => !prev)}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="h-4 w-4" />
                    导出
                    <ChevronDown className={`h-4 w-4 text-slate-500 transition ${exportOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {exportOpen ? (
                    <div className="absolute right-0 top-[calc(100%+8px)] z-40 w-60 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                      <button
                        type="button"
                        onClick={() => {
                          setExportOpen(false)
                          triggerPrint()
                        }}
                        className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <span>导出为 PDF</span>
                        <span className="text-xs text-slate-400">打印另存为</span>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          setExportOpen(false)
                          const filename = `${title || '制度正文'}.md`
                          const text =
                            effectivePrintRange === 'selection'
                              ? selectedText.trim()
                              : (() => {
                                  const lines: string[] = []
                                  if (title) lines.push(`# ${title}`, '')
                                  if (dept || docNo || publish) {
                                    if (dept) lines.push(`- 发文机关：${dept}`)
                                    if (docNo) lines.push(`- 文号：${docNo}`)
                                    if (publish) lines.push(`- 发布日期：${publish}`)
                                    lines.push('')
                                  }
                                  printableForRange.forEach((node) => {
                                    if (node.type === 'chapter') lines.push(`## ${node.title}`, '')
                                    else if (node.type === 'section') lines.push(`### ${node.title}`, '')
                                    else {
                                      lines.push(node.title)
                                      if (node.content) lines.push(node.content)
                                      lines.push('')
                                    }
                                  })
                                  return lines.join('\n')
                                })()
                          downloadBlob(new Blob([text], { type: 'text/markdown;charset=utf-8' }), filename)
                        }}
                        className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <span>导出为 Markdown</span>
                        <span className="text-xs text-slate-400">.md</span>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          setExportOpen(false)
                          const mod = await import('docx')
                          const {
                            AlignmentType,
                            Document,
                            HeadingLevel,
                            Packer,
                            Paragraph,
                            TextRun,
                          } = mod as unknown as typeof import('docx')

                          const children: any[] = []
                          children.push(
                            new Paragraph({
                              text: title || '制度正文',
                              heading: HeadingLevel.TITLE,
                              alignment: AlignmentType.CENTER,
                            }),
                          )
                          if (dept || docNo || publish) {
                            if (dept) children.push(new Paragraph({ children: [new TextRun({ text: `发文机关：${dept}` })] }))
                            if (docNo) children.push(new Paragraph({ children: [new TextRun({ text: `文号：${docNo}` })] }))
                            if (publish) children.push(new Paragraph({ children: [new TextRun({ text: `发布日期：${publish}` })] }))
                            children.push(new Paragraph({ text: '' }))
                          }

                          const addLine = (text: string) => children.push(new Paragraph({ children: [new TextRun(text)] }))

                          if (effectivePrintRange === 'selection') {
                            selectedText
                              .split('\n')
                              .map((x) => x.trim())
                              .filter(Boolean)
                              .forEach(addLine)
                          } else {
                            printableForRange.forEach((node) => {
                              if (node.type === 'chapter') {
                                children.push(new Paragraph({ text: node.title, heading: HeadingLevel.HEADING_1 }))
                                return
                              }
                              if (node.type === 'section') {
                                children.push(new Paragraph({ text: node.title, heading: HeadingLevel.HEADING_2 }))
                                return
                              }
                              const lines = [node.title, ...(node.content ? node.content.split('\n') : [])]
                                .map((x) => x.trim())
                                .filter(Boolean)
                              lines.forEach(addLine)
                            })
                          }

                          const docx = new Document({ sections: [{ children }] })
                          const blob = await Packer.toBlob(docx)
                          downloadBlob(blob, `${title || '制度正文'}.docx`)
                        }}
                        className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <span>导出为 Word</span>
                        <span className="text-xs text-slate-400">.docx</span>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          setExportOpen(false)
                          const mod = await import('pptxgenjs')
                          const PptxGenJS = (mod as any).default ?? (mod as any)
                          const pptx = new PptxGenJS()

                          const addSlide = (slideTitle: string, body: string) => {
                            const slide = pptx.addSlide()
                            slide.addText(slideTitle, { x: 0.5, y: 0.3, w: 12.3, h: 0.6, fontSize: 24, bold: true })
                            slide.addText(body, { x: 0.6, y: 1.1, w: 12.2, h: 5.8, fontSize: 14, color: '333333' })
                          }

                          if (effectivePrintRange === 'selection') {
                            addSlide(title || '制度正文', selectedText.trim().slice(0, 2000))
                          } else {
                            const byId = new Map(printableForRange.map((n) => [n.id, n]))
                            const chapterIds = printableForRange.filter((n) => n.type === 'chapter').map((n) => n.id)
                            const chapterOf = (node: any) => {
                              let pid = node.parentId
                              while (pid) {
                                const parent = byId.get(pid)
                                if (!parent) break
                                if (parent.type === 'chapter') return parent
                                pid = parent.parentId
                              }
                              return null
                            }

                            const chapterMap = new Map<string, { title: string; lines: string[] }>()
                            printableForRange.forEach((node) => {
                              if (node.type !== 'article') return
                              const chapter = chapterOf(node)
                              const chapterId = chapter?.id ?? 'chapter'
                              const chapterTitle = chapter?.title ?? '正文'
                              const existing = chapterMap.get(chapterId) ?? { title: chapterTitle, lines: [] }
                              existing.lines.push(node.title)
                              if (node.content) existing.lines.push(node.content)
                              chapterMap.set(chapterId, existing)
                            })

                            const orderedKeys = chapterIds.length > 0 ? chapterIds : Array.from(chapterMap.keys())
                            orderedKeys.forEach((key) => {
                              const block = chapterMap.get(key)
                              if (!block) return
                              addSlide(block.title, block.lines.join('\n').slice(0, 3500))
                            })
                          }

                          addSlide('封底', `${title || '制度正文'}\n${dept ? `发文机关：${dept}` : ''}`.trim())
                          await pptx.writeFile({ fileName: `${title || '制度正文'}.pptx` })
                        }}
                        className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <span>导出为 PPT</span>
                        <span className="text-xs text-slate-400">实验性</span>
                      </button>
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setPrintOpen(true)}
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
                      <div className="min-w-0">
                        <div className={`flex flex-wrap items-center gap-2 rounded ${active ? 'bg-blue-50 px-2 py-1' : ''}`}>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{no}</span>
                          <span className="text-sm font-semibold text-slate-900">{lead || '—'}</span>
                        </div>
                        {renderSectionContent(node.content)}
                      </div>
                      <ClauseInsight clauseId={node.id} />
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
      </div>

      <div className="print-content hidden">
        <h1>{title || '文档标题'}</h1>
        {printSettings.includeCover ? (
          <div className="mb-4">
            {dept ? <p className="print-meta">发文机关：{dept}</p> : null}
            {docNo ? <p className="print-meta">文号：{docNo}</p> : null}
            {publish ? <p className="print-meta">发布日期：{publish}</p> : null}
          </div>
        ) : null}

        {effectivePrintRange === 'selection' ? (
          selectedText
            .split('\n')
            .map((x) => x.trim())
            .filter(Boolean)
            .map((line, idx) => <p key={`sel-${idx}`}>{line}</p>)
        ) : (
          printableForRange
            .filter((node) => node.type !== 'article' || (node.type === 'article' && node.title.trim()))
            .map((node) => {
              if (node.type === 'chapter') return <h2 key={node.id}>{node.title}</h2>
              if (node.type === 'section') return <h3 key={node.id}>{node.title}</h3>
              const lines = [node.title, ...(node.content ? node.content.split('\n') : [])].map((x) => x.trim()).filter(Boolean)
              return (
                <div key={node.id}>
                  {lines.map((line, idx) => (
                    <p key={`${node.id}-${idx}`}>{line}</p>
                  ))}
                </div>
              )
            })
        )}
      </div>

      {printOpen ? (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
          <div className="w-full max-w-[900px] overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h3 className="text-lg font-semibold text-slate-900">打印设置</h3>
              <button
                type="button"
                onClick={() => setPrintOpen(false)}
                className="rounded border border-slate-200 p-1 text-slate-600 hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex h-[70vh]">
              <div className="w-[360px] overflow-y-auto border-r border-slate-200 p-5 text-sm text-slate-700">
                <div className="space-y-6">
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-slate-500">基本信息</p>
                    <div className="mt-3 space-y-4">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-slate-700">纸张尺寸</p>
                        <div className="flex flex-wrap gap-2">
                          {(['A4', 'A3', 'Letter'] as const).map((v) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => setPrintSettings((prev) => ({ ...prev, paperSize: v }))}
                              className={`rounded border px-3 py-1.5 text-sm ${
                                printSettings.paperSize === v
                                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                                  : 'border-slate-200 bg-white'
                              }`}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm font-medium text-slate-700">打印方向</p>
                        <div className="flex flex-wrap gap-2">
                          {([
                            { key: 'portrait', label: '纵向' },
                            { key: 'landscape', label: '横向' },
                          ] as const).map((v) => (
                            <button
                              key={v.key}
                              type="button"
                              onClick={() => setPrintSettings((prev) => ({ ...prev, orientation: v.key }))}
                              className={`rounded border px-3 py-1.5 text-sm ${
                                printSettings.orientation === v.key
                                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                                  : 'border-slate-200 bg-white'
                              }`}
                            >
                              {v.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold tracking-wide text-slate-500">字体设置</p>
                    <div className="mt-3 space-y-4">
                      <label className="space-y-2">
                        <span className="text-sm font-medium text-slate-700">正文字体</span>
                        <select
                          value={printSettings.bodyFont}
                          onChange={(e) => setPrintSettings((prev) => ({ ...prev, bodyFont: e.target.value as PrintFont }))}
                          className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm"
                        >
                          {(['宋体', '黑体', '楷体', '仿宋'] as const).map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-2">
                        <span className="text-sm font-medium text-slate-700">正文字号</span>
                        <select
                          value={printSettings.bodyFontSize}
                          onChange={(e) =>
                            setPrintSettings((prev) => ({ ...prev, bodyFontSize: e.target.value as PrintFontSize }))
                          }
                          className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm"
                        >
                          {(['10pt', '11pt', '12pt', '13pt'] as const).map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="space-y-2">
                        <p className="text-sm font-medium text-slate-700">标题字号</p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setPrintSettings((prev) => ({ ...prev, titleFontMode: 'auto', titleFontSize: '' }))
                            }
                            className={`rounded border px-3 py-1.5 text-sm ${
                              printSettings.titleFontMode === 'auto'
                                ? 'border-blue-200 bg-blue-50 text-blue-700'
                                : 'border-slate-200 bg-white'
                            }`}
                          >
                            自动（正文+2pt）
                          </button>
                          <button
                            type="button"
                            onClick={() => setPrintSettings((prev) => ({ ...prev, titleFontMode: 'manual' }))}
                            className={`rounded border px-3 py-1.5 text-sm ${
                              printSettings.titleFontMode === 'manual'
                                ? 'border-blue-200 bg-blue-50 text-blue-700'
                                : 'border-slate-200 bg-white'
                            }`}
                          >
                            手动输入
                          </button>
                        </div>
                        {printSettings.titleFontMode === 'manual' ? (
                          <input
                            value={printSettings.titleFontSize}
                            onChange={(e) => setPrintSettings((prev) => ({ ...prev, titleFontSize: e.target.value }))}
                            placeholder="例如 16pt"
                            className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                          />
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold tracking-wide text-slate-500">段落设置</p>
                    <div className="mt-3 space-y-4">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-slate-700">行间距</p>
                        <div className="flex flex-wrap gap-2">
                          {(['1.5', '1.8', '2.0', '2.5'] as const).map((v) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => setPrintSettings((prev) => ({ ...prev, lineHeight: v }))}
                              className={`rounded border px-3 py-1.5 text-sm ${
                                printSettings.lineHeight === v
                                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                                  : 'border-slate-200 bg-white'
                              }`}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm font-medium text-slate-700">首行缩进</p>
                        <div className="flex flex-wrap gap-2">
                          {([
                            { key: '0', label: '无' },
                            { key: '1', label: '1字' },
                            { key: '2', label: '2字' },
                          ] as const).map((v) => (
                            <button
                              key={v.key}
                              type="button"
                              onClick={() => setPrintSettings((prev) => ({ ...prev, indent: v.key }))}
                              className={`rounded border px-3 py-1.5 text-sm ${
                                printSettings.indent === v.key
                                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                                  : 'border-slate-200 bg-white'
                              }`}
                            >
                              {v.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <label className="space-y-2">
                        <span className="text-sm font-medium text-slate-700">段前间距</span>
                        <select
                          value={printSettings.paragraphSpacing}
                          onChange={(e) =>
                            setPrintSettings((prev) => ({
                              ...prev,
                              paragraphSpacing: e.target.value as PrintParagraphSpacing,
                            }))
                          }
                          className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm"
                        >
                          {(['4pt', '6pt', '8pt'] as const).map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold tracking-wide text-slate-500">页面设置</p>
                    <div className="mt-3 space-y-4">
                      <label className="space-y-2">
                        <span className="text-sm font-medium text-slate-700">页边距</span>
                        <select
                          value={printSettings.margin}
                          onChange={(e) => setPrintSettings((prev) => ({ ...prev, margin: e.target.value as PrintMargin }))}
                          className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm"
                        >
                          <option value="standard">标准（2.5cm）</option>
                          <option value="loose">宽松（3cm）</option>
                          <option value="compact">紧凑（2cm）</option>
                        </select>
                      </label>

                      <div className="space-y-2">
                        <p className="text-sm font-medium text-slate-700">显示页眉（文件名）</p>
                        <div className="flex gap-2">
                          {[{ v: true, label: '开' }, { v: false, label: '关' }].map((item) => (
                            <button
                              key={String(item.v)}
                              type="button"
                              onClick={() => setPrintSettings((prev) => ({ ...prev, showHeader: item.v }))}
                              className={`rounded border px-3 py-1.5 text-sm ${
                                printSettings.showHeader === item.v
                                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                                  : 'border-slate-200 bg-white'
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm font-medium text-slate-700">显示页码</p>
                        <div className="flex gap-2">
                          {[{ v: true, label: '开' }, { v: false, label: '关' }].map((item) => (
                            <button
                              key={String(item.v)}
                              type="button"
                              onClick={() => setPrintSettings((prev) => ({ ...prev, showPageNumber: item.v }))}
                              className={`rounded border px-3 py-1.5 text-sm ${
                                printSettings.showPageNumber === item.v
                                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                                  : 'border-slate-200 bg-white'
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold tracking-wide text-slate-500">打印范围</p>
                    <div className="mt-3 space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {([
                          { key: 'full', label: '全文' },
                          { key: 'selection', label: '选中内容' },
                          { key: 'custom', label: '自定义章节' },
                        ] as const).map((item) => {
                          const selectionDisabled = item.key === 'selection' && !selectedText.trim()
                          return (
                            <button
                              key={item.key}
                              type="button"
                              disabled={selectionDisabled}
                              onClick={() => setPrintSettings((prev) => ({ ...prev, range: item.key }))}
                              className={`rounded border px-3 py-1.5 text-sm ${
                                selectionDisabled
                                  ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
                                  : printSettings.range === item.key
                                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                                    : 'border-slate-200 bg-white'
                              }`}
                            >
                              {item.label}
                            </button>
                          )
                        })}
                      </div>

                      {printSettings.range === 'custom' ? (
                        <div className="space-y-2 rounded border border-slate-200 bg-slate-50 p-3">
                          {printOutlineOptions.length === 0 ? (
                            <p className="text-sm text-slate-500">未识别到章/节，无法自定义章节。</p>
                          ) : (
                            printOutlineOptions.map((node) => (
                              <label
                                key={node.id}
                                className={`flex items-start gap-2 text-sm text-slate-700 ${node.depth === 1 ? 'pl-5' : ''}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={printSettings.customOutlineIds.includes(node.id)}
                                  onChange={() =>
                                    setPrintSettings((prev) => ({
                                      ...prev,
                                      customOutlineIds: prev.customOutlineIds.includes(node.id)
                                        ? prev.customOutlineIds.filter((x) => x !== node.id)
                                        : [...prev.customOutlineIds, node.id],
                                    }))
                                  }
                                />
                                <span className="flex-1">
                                  {node.depth === 1 && node.parentTitle ? (
                                    <span className="text-xs text-slate-500">{node.parentTitle} · </span>
                                  ) : null}
                                  {node.title}
                                </span>
                              </label>
                            ))
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold tracking-wide text-slate-500">内容选项</p>
                    <div className="mt-3 space-y-2">
                      <p className="text-sm font-medium text-slate-700">包含封面页（含标题+元信息）</p>
                      <div className="flex gap-2">
                        {[{ v: true, label: '开' }, { v: false, label: '关' }].map((item) => (
                          <button
                            key={String(item.v)}
                            type="button"
                            onClick={() => setPrintSettings((prev) => ({ ...prev, includeCover: item.v }))}
                            className={`rounded border px-3 py-1.5 text-sm ${
                              printSettings.includeCover === item.v
                                ? 'border-blue-200 bg-blue-50 text-blue-700'
                                : 'border-slate-200 bg-white'
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                  预览仅显示前3条，实际打印为全文 / 选中内容 / 自定义章节的结果
                </div>
                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-5">
                  <div
                    style={{
                      fontFamily: previewComputed.fontFamily,
                      fontSize: previewComputed.fontSize,
                      lineHeight: previewComputed.lineHeight,
                      color: '#000',
                    }}
                  >
                    <div style={{ fontSize: previewComputed.titleSize, fontWeight: 700, textAlign: 'center', marginBottom: '20pt' }}>
                      {title || '文档标题'}
                    </div>
                    {printSettings.includeCover ? (
                      <div style={{ marginBottom: '10pt' }}>
                        {dept ? <div style={{ fontSize: '10pt', lineHeight: '1.6', margin: '2pt 0' }}>发文机关：{dept}</div> : null}
                        {docNo ? <div style={{ fontSize: '10pt', lineHeight: '1.6', margin: '2pt 0' }}>文号：{docNo}</div> : null}
                        {publish ? <div style={{ fontSize: '10pt', lineHeight: '1.6', margin: '2pt 0' }}>发布日期：{publish}</div> : null}
                      </div>
                    ) : null}

                    {previewArticles.length === 0 ? (
                      <div className="text-sm text-slate-500">暂无可预览内容</div>
                    ) : (
                      previewArticles.map((article) => (
                        <div key={article.id} style={{ marginBottom: '10pt' }}>
                          {article.lines.map((line, idx) => (
                            <div
                              key={`${article.id}-${idx}`}
                              style={{
                                textIndent: previewComputed.indent,
                                margin: `${previewComputed.paragraphMargin} 0`,
                              }}
                            >
                              {line}
                            </div>
                          ))}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-5 py-3">
              <button
                type="button"
                onClick={() => setPrintSettings(DEFAULT_PRINT_SETTINGS)}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                恢复默认
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPrintOpen(false)}
                  className="rounded border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem('aml-print-settings', JSON.stringify(printSettings))
                    setPrintOpen(false)
                    setPendingPrint(true)
                  }}
                  className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  预览 & 打印
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
