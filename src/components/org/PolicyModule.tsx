import {
  ChevronDown,
  Download,
  Filter,
  Plus,
  Printer,
  Search,
  Star,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { queryDatabase } from '../../api/notion'
import { Modal } from '../shared/Modal'

type LibraryCategory = '全部' | '内控制度' | '法律法规' | '流程' | '图书' | '论文' | '其他'
type Timeliness = '有效' | '已废止' | '修订中' | '草案' | '尚未生效'
type SearchScope = 'title' | 'summary' | 'full'
type PageSize = 10 | 15 | 20 | 'all'
type SortKey = 'relevance' | 'publishDateAsc' | 'publishDateDesc' | 'effectiveDateAsc' | 'effectiveDateDesc'

type LibraryDoc = {
  id: string
  source: 'notion' | 'local'
  category: Exclude<LibraryCategory, '全部'>
  timeliness: Timeliness
  title: string
  docNo: string
  dept: string
  publishDate: string
  effectiveDate: string
  summary: string
  content: string
  sourceLevel: string
  topics: string[]
}

const CATEGORY_OPTIONS: LibraryCategory[] = ['全部', '内控制度', '法律法规', '流程', '图书', '论文', '其他']

const CATEGORY_CLASS: Record<Exclude<LibraryCategory, '全部'>, string> = {
  内控制度: 'bg-blue-100 text-blue-700',
  法律法规: 'bg-red-100 text-red-700',
  流程: 'bg-emerald-100 text-emerald-700',
  图书: 'bg-violet-100 text-violet-700',
  论文: 'bg-violet-100 text-violet-700',
  其他: 'bg-slate-100 text-slate-700',
}

const TIMELINESS_OPTIONS: Timeliness[] = ['有效', '已废止', '修订中', '草案', '尚未生效']

const TIMELINESS_CLASS: Record<Timeliness, string> = {
  有效: 'bg-emerald-100 text-emerald-700',
  已废止: 'bg-slate-100 text-slate-600',
  修订中: 'bg-orange-100 text-orange-700',
  草案: 'bg-blue-100 text-blue-700',
  尚未生效: 'bg-indigo-100 text-indigo-700',
}

const TOPIC_TAG_OPTIONS = `客户尽调（CDD）/ 加强尽调（EDD）/ 持续尽调·业务关系监控 / 客户风险评级 / 高风险客户 / 受益所有人识别 / 实际控制人 / 政治公众人物（PEP）/ 非面对面业务 / 代理人·聘才渠道 / 中介机构管理 / 交易监测 / 可疑交易识别 / 可疑交易报告 / 现金交易监测 / 大额交易 / 结构化交易 / 跨境交易 / 高风险国家·地区 / 制裁与名单筛查 / 黑名单·观察名单 / 关联交易 / 银行业务 / 保险产品 / 互联网·线上渠道 / 新产品评估 / 内部控制 / 反洗钱组织架构 / 岗责划分 / 合规培训 / 员工行为管理 / 数据质量·报送质量 / 文件管理与留痕 / 内部审计·稽核 / 绩效与考核（反洗钱）/ 监管检查 / 行政处罚案例 / 监管问答·FAQ / 监管通报 / 行业自律规范 / 典型案例 / 行业案例 / 刑事司法案例 / 风险提示 / 理论研究 / 实务研究 / 交易监测系统 / 名单筛查系统 / KYC系统 / 风险评分模型 / 报送系统 / 数据仓库·报表 / 保全 / 操作手册 / 风险评估`
  .split('/')
  .map((x) => x.trim())
  .filter(Boolean)

type PrintPaperSize = 'A4' | 'A3' | 'Letter'
type PrintOrientation = 'portrait' | 'landscape'
type PrintFont = '宋体' | '黑体' | '楷体' | '仿宋'
type PrintFontSize = '10pt' | '11pt' | '12pt' | '13pt'
type PrintLineHeight = '1.5' | '1.8' | '2.0' | '2.5'
type PrintIndent = '0' | '1' | '2'
type PrintParagraphSpacing = '4pt' | '6pt' | '8pt'
type PrintMargin = 'standard' | 'loose' | 'compact'

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

type AdvancedFilters = {
  departments: string[]
  publishStart: string
  publishEnd: string
  effectiveStart: string
  effectiveEnd: string
}

const DEFAULT_ADVANCED: AdvancedFilters = {
  departments: [],
  publishStart: '',
  publishEnd: '',
  effectiveStart: '',
  effectiveEnd: '',
}

type NotionDocumentRow = {
  id: string
  标题?: string
  Name?: string
  类型?: string
  状态?: string
  文档类型?: string
  来源?: string
  发文机关?: string
  发文部门?: string
  效力范围?: string
  来源层级?: string
  主题标签?: string[] | string
  '生效/发布日期'?: string
  发布日期?: string
  生效日期?: string
  摘要?: string
  '关键要点/适用情景'?: string
  '关键要点/适用情景 '?: string
  适用范围?: string
}

function toggleInArray<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
}

function inDateRange(date: string, start: string, end: string): boolean {
  const ts = date ? new Date(date).getTime() : Number.NaN
  if (Number.isNaN(ts)) return true
  const startTs = start ? new Date(start).getTime() : Number.NaN
  const endTs = end ? new Date(end).getTime() : Number.NaN
  if (!Number.isNaN(startTs) && ts < startTs) return false
  if (!Number.isNaN(endTs) && ts > endTs) return false
  return true
}

function highlightText(text: string, keyword: string) {
  if (!keyword.trim()) return text
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  const parts = text.split(regex)
  const keywordLower = keyword.toLowerCase()
  return parts.map((part, index) =>
    part.toLowerCase() === keywordLower ? (
      <mark key={`${part}-${index}`} className="bg-yellow-200 rounded px-0.5">
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    ),
  )
}

function safeText(value: unknown): string {
  return String(value ?? '').trim()
}

function toHyphenId(idOrPath: string): string {
  const raw = String(idOrPath ?? '')
    .replace(/^collection:\/\//, '')
    .replace(/-/g, '')
    .trim()
  if (raw.length !== 32) return String(idOrPath ?? '').replace(/^collection:\/\//, '').trim()
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`
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

function formatBatchFilename(count: number) {
  const date = new Date().toISOString().slice(0, 10)
  return `批量导出_${date}_${count}篇`
}

function parseFileNameTitle(name: string): string {
  return name.replace(/\.[^/.]+$/, '').trim()
}

function normalizeTopics(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v ?? '').trim()).filter(Boolean)
  const raw = String(value ?? '').trim()
  if (!raw) return []
  return raw
    .split(/[,，;；]/g)
    .map((v) => v.trim())
    .filter(Boolean)
}

function normalizeNotionCategory(typeValue: string): Exclude<LibraryCategory, '全部'> {
  const raw = typeValue.trim()
  const normalized = raw.toLowerCase()

  if (!raw) return '其他'
  if (raw.includes('法律') || raw.includes('法规') || raw.includes('监管') || normalized.includes('law')) return '法律法规'
  if (raw.includes('制度') || raw.includes('规定') || raw.includes('办法')) return '内控制度'
  if (raw.includes('图书') || raw === '书' || raw.includes('书籍')) return '图书'
  if (raw.includes('论文') || raw.includes('研究')) return '论文'
  if (raw.includes('流程')) return '流程'
  return '其他'
}

function normalizeNotionTimeliness(statusValue: string, dateValue: string): Timeliness {
  const status = statusValue.trim()
  if (status.includes('废止') || status.includes('失效')) return '已废止'
  if (status.includes('修订') || status.includes('更新')) return '修订中'
  if (status.includes('草案') || status.includes('拟稿') || status.includes('草稿')) return '草案'
  if (status.includes('未生效') || status.includes('尚未生效')) return '尚未生效'

  const ts = dateValue ? new Date(dateValue).getTime() : Number.NaN
  if (!Number.isNaN(ts) && ts > Date.now()) return '尚未生效'
  if (status.includes('有效') || status === '生效' || status.includes('现行')) return '有效'
  return '有效'
}

export function PolicyModule() {
  const navigate = useNavigate()

  const [localDocs, setLocalDocs] = useState<LibraryDoc[]>([])
  const [notionDocs, setNotionDocs] = useState<LibraryDoc[]>([])
  const [notionSearchDocs, setNotionSearchDocs] = useState<LibraryDoc[]>([])
  const [notionSearchLoading, setNotionSearchLoading] = useState(false)
  const [notionSearchError, setNotionSearchError] = useState<string | null>(null)
  const [notionLoading, setNotionLoading] = useState(false)
  const [notionError, setNotionError] = useState<string | null>(null)

  const [category, setCategory] = useState<LibraryCategory[]>(['全部'])
  const [timeliness, setTimeliness] = useState<Timeliness[]>([])
  const [keyword, setKeyword] = useState('')
  const [sourceLevels, setSourceLevels] = useState<string[]>([])
  const [searchScopes, setSearchScopes] = useState<SearchScope[]>(['title', 'summary', 'full'])
  const [topicTags, setTopicTags] = useState<string[]>([])

  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [advancedDraft, setAdvancedDraft] = useState<AdvancedFilters>(DEFAULT_ADVANCED)
  const [advanced, setAdvanced] = useState<AdvancedFilters>(DEFAULT_ADVANCED)

  const [pageSize, setPageSize] = useState<PageSize>(10)
  const [sortBy, setSortBy] = useState<SortKey>('relevance')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  const [mergePrint, setMergePrint] = useState(true)
  const [printSettings, setPrintSettings] = useState<PrintSettings>(() => {
    try {
      const raw = localStorage.getItem('aml-print-settings')
      if (!raw) return DEFAULT_PRINT_SETTINGS
      const parsed = JSON.parse(raw) as Partial<PrintSettings>
      return { ...DEFAULT_PRINT_SETTINGS, ...parsed }
    } catch {
      return DEFAULT_PRINT_SETTINGS
    }
  })
  const [pendingPrint, setPendingPrint] = useState(false)
  const [printDocs, setPrintDocs] = useState<LibraryDoc[]>([])
  const [separatePrint, setSeparatePrint] = useState(false)
  const [printIndex, setPrintIndex] = useState(0)

  const [createOpen, setCreateOpen] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createFileContent, setCreateFileContent] = useState('')
  const [createPasteContent, setCreatePasteContent] = useState('')
  const [createTitle, setCreateTitle] = useState('')
  const [createCategory, setCreateCategory] = useState<Exclude<LibraryCategory, '全部'>>('内控制度')
  const [createTimeliness, setCreateTimeliness] = useState<Timeliness>('草案')
  const [createPublishDate, setCreatePublishDate] = useState('')

  const exportMenuRef = useRef<HTMLDivElement | null>(null)
  const sortMenuRef = useRef<HTMLDivElement | null>(null)
  const createFileInputRef = useRef<HTMLInputElement | null>(null)
  const beforePrintTitleRef = useRef<string>('')

  const [pageContentCache, setPageContentCache] = useState<Record<string, string>>({})
  const [printBodyById, setPrintBodyById] = useState<Record<string, string>>({})

  const parseFile = async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (ext === 'txt' || ext === 'md') {
      return (await file.text()).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
    }
    if (ext === 'docx') {
      const arrayBuffer = await file.arrayBuffer()
      const mammoth = await import('mammoth/mammoth.browser')
      const result = await mammoth.convertToMarkdown(
        { arrayBuffer },
        {
          styleMap: [
            "p[style-name='Heading 1'] => # $1",
            "p[style-name='Heading 2'] => ## $1",
            "p[style-name='Heading 3'] => ### $1",
          ],
        },
      )
      return String(result?.value ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
    }
    if (ext === 'pdf') {
      const arrayBuffer = await file.arrayBuffer()
      const pdfjs = await import('pdfjs-dist/build/pdf')
      ;(pdfjs as any).GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url,
      ).toString()
      const loadingTask = (pdfjs as any).getDocument({ data: arrayBuffer })
      const pdf = await loadingTask.promise
      const parts: string[] = []
      for (let i = 1; i <= pdf.numPages; i += 1) {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        const pageText = (textContent.items as Array<{ str?: string }>).map((it) => it.str ?? '').join('')
        if (pageText.trim()) parts.push(pageText.trim())
      }
      return parts.join('\n\n').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
    }
    throw new Error('不支持的文件类型')
  }

  const mapNotionRowToDoc = (row: NotionDocumentRow): LibraryDoc => {
    const title = safeText(row.标题 ?? row.Name) || '未命名资料'
    const typeRaw = safeText(row.类型 ?? row.文档类型)
    const statusRaw = safeText(row.状态)
    const dept = safeText(row.来源 ?? row.发文机关 ?? row.发文部门)
    const publishDate = safeText(row['生效/发布日期'] ?? row.发布日期)
    const effectiveDate = safeText(row['生效/发布日期'] ?? row.生效日期 ?? row.发布日期)
    const summary = safeText(row.摘要)
    const keyPoints = safeText((row as any)['关键要点/适用情景'] ?? (row as any)['关键要点/适用情景 '] ?? '')
    const scope = safeText(row.适用范围)
    const content = [summary, keyPoints, scope].filter(Boolean).join('\n')
    const sourceLevelRaw = safeText((row as any).效力范围 ?? (row as any).来源层级 ?? '')
    const topics = normalizeTopics((row as any).主题标签 ?? '')
    const guessedSourceLevel = (() => {
      const raw = sourceLevelRaw || dept
      if (raw.includes('监管') || raw.includes('人行') || raw.includes('央行')) return '监管层'
      if (raw.includes('总公司') || raw.includes('总部')) return '总公司层'
      if (raw.includes('分公司') || raw.includes('支行') || raw.includes('网点')) return '分公司层'
      const cat = normalizeNotionCategory(typeRaw)
      if (cat === '法律法规') return '监管层'
      if (cat === '流程') return '分公司层'
      if (cat === '内控制度') return '总公司层'
      return '其他'
    })()

    return {
      id: row.id,
      source: 'notion',
      category: normalizeNotionCategory(typeRaw),
      timeliness: normalizeNotionTimeliness(statusRaw, effectiveDate || publishDate),
      title,
      docNo: '',
      dept,
      publishDate,
      effectiveDate,
      summary,
      content,
      sourceLevel: guessedSourceLevel,
      topics,
    }
  }

  useEffect(() => {
    const run = async () => {
      setNotionLoading(true)
      setNotionError(null)
      try {
        const rows = (await queryDatabase('documents')) as unknown as NotionDocumentRow[]
        setNotionDocs(rows.map(mapNotionRowToDoc))
      } catch (e) {
        setNotionError(e instanceof Error ? e.message : String(e))
        setNotionDocs([])
      } finally {
        setNotionLoading(false)
      }
    }

    void run()
  }, [])

  useEffect(() => {
    const q = keyword.trim()
    if (!q) {
      setNotionSearchDocs([])
      setNotionSearchError(null)
      setNotionSearchLoading(false)
      return
    }

    setNotionSearchLoading(true)
    setNotionSearchError(null)
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      fetch(`/api/library/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then(async (res) => {
          if (!res.ok) throw new Error(String(res.status))
          return res.json()
        })
        .then((data) => {
          const rows = Array.isArray(data?.results) ? (data.results as NotionDocumentRow[]) : []
          setNotionSearchDocs(rows.map(mapNotionRowToDoc))
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === 'AbortError') return
          setNotionSearchDocs([])
          setNotionSearchError(err instanceof Error ? err.message : String(err))
        })
        .finally(() => setNotionSearchLoading(false))
    }, 300)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [keyword])

  const localSearchDocs = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    if (!q) return localDocs
    const scopes = new Set(searchScopes.length > 0 ? searchScopes : (['title', 'summary', 'full'] as const))
    return localDocs.filter((d) => {
      const parts: string[] = []
      if (scopes.has('title')) parts.push(d.title)
      if (scopes.has('summary')) parts.push(d.summary)
      if (scopes.has('full')) parts.push(d.content)
      return parts.join('\n').toLowerCase().includes(q)
    })
  }, [keyword, localDocs, searchScopes])

  const docsForFilter = useMemo(() => {
    const q = keyword.trim()
    if (!q) return [...localDocs, ...notionDocs]
    return [...localSearchDocs, ...notionSearchDocs]
  }, [keyword, localDocs, localSearchDocs, notionDocs, notionSearchDocs])

  const docsForStats = useMemo(() => [...localDocs, ...notionDocs], [localDocs, notionDocs])

  const loading = notionLoading || (keyword.trim() ? notionSearchLoading : false)
  const error = notionError || notionSearchError

  const stats = useMemo(() => {
    const total = docsForStats.length
    const law = docsForStats.filter((d) => d.category === '法律法规').length
    const internal = docsForStats.filter((d) => d.category === '内控制度').length
    const process = docsForStats.filter((d) => d.category === '流程').length
    const book = docsForStats.filter((d) => d.category === '图书').length
    const thesis = docsForStats.filter((d) => d.category === '论文').length
    return { total, law, internal, process, book, thesis }
  }, [docsForStats])

  const departments = useMemo(() => Array.from(new Set(docsForStats.map((d) => d.dept).filter(Boolean))).sort(), [docsForStats])

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    const scopes = new Set(searchScopes.length > 0 ? searchScopes : (['title', 'summary', 'full'] as const))

    const rows = docsForFilter
      .filter((d) => (category.length === 0 || category.includes('全部') ? true : category.includes(d.category)))
      .filter((d) => (timeliness.length === 0 ? true : timeliness.includes(d.timeliness)))
      .filter((d) => (sourceLevels.length === 0 ? true : sourceLevels.includes(d.sourceLevel || '其他')))
      .filter((d) => (topicTags.length === 0 ? true : d.topics.some((t) => topicTags.includes(t))))
      .filter((d) => (advanced.departments.length === 0 ? true : advanced.departments.includes(d.dept)))
      .filter((d) => inDateRange(d.publishDate, advanced.publishStart, advanced.publishEnd))
      .filter((d) => inDateRange(d.effectiveDate, advanced.effectiveStart, advanced.effectiveEnd))
      .filter((d) => {
        if (!kw) return true
        const parts: string[] = []
        if (scopes.has('title')) parts.push(d.title)
        if (scopes.has('summary')) parts.push(d.summary)
        if (scopes.has('full')) parts.push(d.content)
        return parts.join(' ').toLowerCase().includes(kw)
      })

    const score = (d: LibraryDoc) => {
      if (!kw) return 0
      const text = [d.title, d.summary, d.content].join(' ').toLowerCase()
      let idx = 0
      let s = 0
      while (true) {
        const next = text.indexOf(kw, idx)
        if (next === -1) break
        s += 1
        idx = next + kw.length
      }
      return s
    }

    const toTs = (value: string) => {
      const ts = value ? new Date(value).getTime() : Number.NaN
      return Number.isNaN(ts) ? 0 : ts
    }

    const publishTs = (d: LibraryDoc) => toTs(d.publishDate)
    const effectiveTs = (d: LibraryDoc) => toTs(d.effectiveDate || d.publishDate)

    const sorted = [...rows].sort((a, b) => {
      if (sortBy === 'relevance') {
        const diff = score(b) - score(a)
        if (diff !== 0) return diff
        return publishTs(b) - publishTs(a)
      }

      if (sortBy === 'publishDateAsc') return publishTs(a) - publishTs(b)
      if (sortBy === 'publishDateDesc') return publishTs(b) - publishTs(a)
      if (sortBy === 'effectiveDateAsc') return effectiveTs(a) - effectiveTs(b)
      if (sortBy === 'effectiveDateDesc') return effectiveTs(b) - effectiveTs(a)

      return publishTs(b) - publishTs(a)
    })

    return sorted
  }, [advanced, category, docsForFilter, keyword, searchScopes, sortBy, sourceLevels, timeliness, topicTags])

  const pageRows = useMemo(() => {
    if (pageSize === 'all') return filtered
    return filtered.slice(0, pageSize)
  }, [filtered, pageSize])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const canBatch = selectedIds.length > 0

  const selectedDocs = useMemo(() => {
    const map = new Map<string, LibraryDoc>()
    ;[...docsForStats, ...docsForFilter].forEach((d) => map.set(d.id, d))
    return selectedIds.map((id) => map.get(id)).filter(Boolean) as LibraryDoc[]
  }, [docsForFilter, docsForStats, selectedIds])

  const getDocMarkdown = async (doc: LibraryDoc) => {
    if (doc.source === 'local') return doc.content
    const cached = pageContentCache[doc.id]
    if (cached !== undefined) return cached
    try {
      const res = await fetch(`/api/notion/page/${encodeURIComponent(toHyphenId(doc.id))}`)
      if (!res.ok) throw new Error(String(res.status))
      const data = await res.json()
      const text = String(data?.content ?? data?.body ?? data?.text ?? data?.markdown ?? '').trim()
      const resolved = text || doc.content
      setPageContentCache((prev) => ({ ...prev, [doc.id]: resolved }))
      return resolved
    } catch {
      const resolved = doc.content
      setPageContentCache((prev) => ({ ...prev, [doc.id]: resolved }))
      return resolved
    }
  }

  const buildMergedMarkdown = async (docs: LibraryDoc[]) => {
    const parts: string[] = []
    for (const doc of docs) {
      const body = await getDocMarkdown(doc)
      const meta: string[] = []
      meta.push(`# ${doc.title}`)
      meta.push('')
      meta.push(`发文机关：${doc.dept || '-'} | 发布日期：${doc.publishDate || '-'} | 生效日期：${doc.effectiveDate || '-'}`)
      meta.push(`分类：${doc.category} | 效力状态：${doc.timeliness}`)
      meta.push('')
      parts.push([...meta, body].join('\n'))
    }
    return parts.join('\n\n---\n\n').trim()
  }

  const buildMergedTxt = async (docs: LibraryDoc[]) => {
    const parts: string[] = []
    for (const doc of docs) {
      const body = await getDocMarkdown(doc)
      const meta = `【${doc.title}】\n发文机关：${doc.dept || '-'} | 发布日期：${doc.publishDate || '-'} | 生效日期：${doc.effectiveDate || '-'}\n分类：${doc.category} | 效力状态：${doc.timeliness}\n`
      parts.push(`${meta}\n${body}`)
    }
    return parts.join('\n\n' + '-'.repeat(30) + '\n\n').trim()
  }

  const exportDocs = async (format: 'md' | 'txt') => {
    if (selectedDocs.length === 0) return
    const base = selectedDocs.length === 1 ? selectedDocs[0].title : formatBatchFilename(selectedDocs.length)
    const text = format === 'md' ? await buildMergedMarkdown(selectedDocs) : await buildMergedTxt(selectedDocs)
    const type = format === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8'
    downloadBlob(new Blob([text], { type }), `${base}.${format}`)
  }

  const exportDocListCsv = async () => {
    if (selectedDocs.length === 0) return
    const base = selectedDocs.length === 1 ? selectedDocs[0].title : formatBatchFilename(selectedDocs.length)
    const header = ['文档名称', '分类', '发文机关', '发布日期', '生效日期', '效力状态', '摘要']
    const escape = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const rows = selectedDocs.map((d) =>
      [
        d.title,
        d.category,
        d.dept,
        d.publishDate,
        d.effectiveDate,
        d.timeliness,
        d.summary,
      ].map(escape).join(','),
    )
    const csv = [header.map(escape).join(','), ...rows].join('\n')
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${base}_文档清单.csv`)
  }

  const exportDocListXlsx = async () => {
    if (selectedDocs.length === 0) return
    const base = selectedDocs.length === 1 ? selectedDocs[0].title : formatBatchFilename(selectedDocs.length)
    const XLSX = await import('xlsx')
    const rows = selectedDocs.map((d) => ({
      文档名称: d.title,
      分类: d.category,
      发文机关: d.dept,
      发布日期: d.publishDate,
      生效日期: d.effectiveDate,
      效力状态: d.timeliness,
      摘要: d.summary,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '文档清单')
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    downloadBlob(
      new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `${base}_文档清单.xlsx`,
    )
  }

  const CHAPTER_LINE_REGEX = /^#{1,2}\s*第[一二三四五六七八九十百千\d]+章[\s　]*(.*)/
  const SECTION_LINE_REGEX = /^#{1,3}\s*第[一二三四五六七八九十百千\d]+节[\s　]*(.*)/
  const ARTICLE_LINE_REGEX = /^第[一二三四五六七八九十百千\d]+条[\s　]+(.*)/
  const HEADING_H2_REGEX = /^##\s+(.+)$/
  const HEADING_H3_REGEX = /^###\s+(.+)$/

  const exportClausesXlsx = async () => {
    if (selectedDocs.length === 0) return
    const base = selectedDocs.length === 1 ? selectedDocs[0].title : formatBatchFilename(selectedDocs.length)
    const XLSX = await import('xlsx')
    const rows: Array<Record<string, string>> = []

    for (const doc of selectedDocs) {
      const body = await getDocMarkdown(doc)
      const text = body.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      const lines = text.split('\n')

      let chapterTitle = ''
      let sectionTitle = ''
      let currentArticleNo = ''
      let currentArticleText = ''
      let hasClause = false
      let hasHeading = false

      const flushArticle = () => {
        if (!currentArticleText.trim()) return
        rows.push({
          文档名称: doc.title,
          章节: [chapterTitle, sectionTitle].filter(Boolean).join(' / '),
          条文编号: currentArticleNo,
          条文内容: currentArticleText.trim(),
        })
        currentArticleNo = ''
        currentArticleText = ''
      }

      for (const raw of lines) {
        const line = raw.replace(/\s+$/g, '')
        const trimmed = line.trim()
        if (!trimmed) continue

        const h2 = trimmed.match(HEADING_H2_REGEX)
        if (h2) {
          hasHeading = true
          flushArticle()
          chapterTitle = h2[1].trim()
          sectionTitle = ''
          continue
        }
        const h3 = trimmed.match(HEADING_H3_REGEX)
        if (h3) {
          hasHeading = true
          flushArticle()
          sectionTitle = h3[1].trim()
          continue
        }

        const chapter = trimmed.match(CHAPTER_LINE_REGEX)
        if (chapter) {
          hasClause = true
          flushArticle()
          chapterTitle = trimmed.replace(/^#{1,2}\s*/, '').trim()
          sectionTitle = ''
          continue
        }
        const section = trimmed.match(SECTION_LINE_REGEX)
        if (section) {
          hasClause = true
          flushArticle()
          sectionTitle = trimmed.replace(/^#{1,3}\s*/, '').trim()
          continue
        }

        const article = trimmed.match(ARTICLE_LINE_REGEX)
        if (article) {
          hasClause = true
          flushArticle()
          currentArticleNo = trimmed.split(/\s+/)[0]
          currentArticleText = trimmed
          continue
        }

        if (trimmed.startsWith('#')) continue

        if (hasClause) {
          currentArticleText = currentArticleText ? `${currentArticleText}\n${line}` : line
        } else if (hasHeading) {
          rows.push({
            文档名称: doc.title,
            章节: [chapterTitle, sectionTitle].filter(Boolean).join(' / '),
            条文编号: '',
            条文内容: trimmed,
          })
        } else {
          rows.push({
            文档名称: doc.title,
            章节: '',
            条文编号: '',
            条文内容: trimmed,
          })
        }
      }

      flushArticle()
    }

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '条目')
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    downloadBlob(
      new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `${base}_条目.xlsx`,
    )
  }

  const exportDocx = async () => {
    if (selectedDocs.length === 0) return
    const base = selectedDocs.length === 1 ? selectedDocs[0].title : formatBatchFilename(selectedDocs.length)
    const mod = await import('docx')
    const { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } = mod as unknown as typeof import('docx')

    const sections = await Promise.all(
      selectedDocs.map(async (doc) => {
        const body = await getDocMarkdown(doc)
        const children: any[] = []
        children.push(
          new Paragraph({
            text: doc.title,
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
          }),
        )
        children.push(new Paragraph({ children: [new TextRun({ text: `发文机关：${doc.dept || '-'}` })] }))
        children.push(new Paragraph({ children: [new TextRun({ text: `发布日期：${doc.publishDate || '-'}  生效日期：${doc.effectiveDate || '-'}` })] }))
        children.push(new Paragraph({ children: [new TextRun({ text: `分类：${doc.category}  效力状态：${doc.timeliness}` })] }))
        children.push(new Paragraph({ text: '' }))

        body
          .replace(/\r\n/g, '\n')
          .replace(/\r/g, '\n')
          .split('\n')
          .map((x) => x.trim())
          .filter(Boolean)
          .forEach((line) => {
            const h1 = line.match(/^#\s+(.+)$/)
            const h2 = line.match(/^##\s+(.+)$/)
            const h3 = line.match(/^###\s+(.+)$/)
            if (h1) children.push(new Paragraph({ text: h1[1].trim(), heading: HeadingLevel.HEADING_1 }))
            else if (h2) children.push(new Paragraph({ text: h2[1].trim(), heading: HeadingLevel.HEADING_2 }))
            else if (h3) children.push(new Paragraph({ text: h3[1].trim(), heading: HeadingLevel.HEADING_3 }))
            else children.push(new Paragraph({ children: [new TextRun(line)] }))
          })

        return { children }
      }),
    )

    const docx = new Document({ sections })
    const blob = await Packer.toBlob(docx)
    downloadBlob(blob, `${base}.docx`)
  }

  const startPrint = async (docs: LibraryDoc[], mode: 'merge' | 'separate') => {
    if (docs.length === 0) return
    const pairs = await Promise.all(docs.map(async (d) => [d.id, await getDocMarkdown(d)] as const))
    const map: Record<string, string> = {}
    pairs.forEach(([id, body]) => {
      map[id] = body
    })
    setPrintBodyById(map)
    setPrintDocs(docs)
    setSeparatePrint(mode === 'separate')
    setPrintIndex(0)
    setPendingPrint(true)
  }

  const triggerPrint = () => {
    if (printDocs.length === 0) return
    const currentDocs = separatePrint ? [printDocs[printIndex]].filter(Boolean) : printDocs
    if (currentDocs.length === 0) return
    const base = currentDocs.length === 1 ? currentDocs[0].title : formatBatchFilename(currentDocs.length)
    localStorage.setItem('aml-print-settings', JSON.stringify(printSettings))
    applyPrintOverride(printSettings, base)
    beforePrintTitleRef.current = document.title
    document.title = base

    const cleanup = () => {
      document.title = beforePrintTitleRef.current
      document.documentElement.removeAttribute('data-doc-title')
    }

    window.addEventListener(
      'afterprint',
      () => {
        cleanup()
        if (separatePrint) setPrintIndex((prev) => prev + 1)
      },
      { once: true },
    )
    window.print()
  }

  useEffect(() => {
    if (!pendingPrint) return
    setPendingPrint(false)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => triggerPrint())
    })
  }, [pendingPrint])

  useEffect(() => {
    if (!printOpen) return
    applyPrintOverride(printSettings, printDocs.length === 1 ? printDocs[0]?.title ?? '资料库' : formatBatchFilename(printDocs.length || 1))
    return () => {
      document.documentElement.removeAttribute('data-doc-title')
    }
  }, [printOpen, printDocs, printSettings])

  useEffect(() => {
    if (!separatePrint) return
    if (printIndex <= 0) return
    if (printIndex >= printDocs.length) {
      setSeparatePrint(false)
      setPrintOpen(false)
      return
    }
    setPendingPrint(true)
  }, [printDocs.length, printIndex, separatePrint])

  const previewComputed = useMemo(() => getPrintComputed(printSettings), [printSettings])
  const previewLines = useMemo(() => {
    const doc = printDocs[0]
    if (!doc) return []
    const text = (printBodyById[doc.id] ?? doc.content).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    return text
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 3)
  }, [printBodyById, printDocs])

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (exportMenuRef.current?.contains(target)) return
      if (sortMenuRef.current?.contains(target)) return
      setExportMenuOpen(false)
      setSortMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggleCategory = (value: LibraryCategory) => {
    setCategory((prev) => {
      if (value === '全部') return ['全部']
      const base = prev.filter((v) => v !== '全部')
      const next = toggleInArray(base, value)
      return next.length === 0 ? ['全部'] : next
    })
  }

  const toggleSourceLevel = (value: string) => {
    setSourceLevels((prev) => toggleInArray(prev, value))
  }

  const toggleSearchScope = (value: SearchScope) => {
    setSearchScopes((prev) => {
      const next = toggleInArray(prev, value)
      return next.length === 0 ? prev : next
    })
  }

  const toggleTopicTag = (value: string) => {
    setTopicTags((prev) => toggleInArray(prev, value))
  }

  const sortLabel = useMemo(() => {
    if (sortBy === 'relevance') return '相关度'
    if (sortBy === 'publishDateAsc') return '发布日期 ↑'
    if (sortBy === 'publishDateDesc') return '发布日期 ↓'
    if (sortBy === 'effectiveDateAsc') return '生效日期 ↑'
    if (sortBy === 'effectiveDateDesc') return '生效日期 ↓'
    return '相关度'
  }, [sortBy])

  const handleCreateFile = async (file: File) => {
    setCreateError(null)
    setCreateLoading(true)
    if (!createTitle.trim()) setCreateTitle(parseFileNameTitle(file.name))
    try {
      const text = await parseFile(file)
      setCreateFileContent(text)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err))
      setCreateFileContent('')
    } finally {
      setCreateLoading(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">资料库</h2>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
        <button
          type="button"
          onClick={() => setCategory(['全部'])}
          className={`rounded-xl border p-4 text-left transition hover:bg-slate-100 ${
            category.includes('全部') ? 'border-slate-300 bg-slate-100' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <p className="text-xs text-slate-600">全部资料</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.total}</p>
          <p className="mt-2 text-xs text-slate-500">全部资料：包含其他类型</p>
        </button>

        <button
          type="button"
          onClick={() => setCategory(['法律法规'])}
          className={`rounded-xl border p-4 text-left transition hover:bg-red-100 ${
            category.includes('法律法规') && !category.includes('全部') ? 'border-red-300 bg-red-100' : 'border-red-200 bg-red-50'
          }`}
        >
          <p className="text-xs text-red-700">法律法规</p>
          <p className="mt-2 text-2xl font-semibold text-red-800">{stats.law}</p>
          <p className="mt-2 text-xs text-red-600/80">法律法规：监管/人行/银保监文件</p>
        </button>

        <button
          type="button"
          onClick={() => setCategory(['内控制度'])}
          className={`rounded-xl border p-4 text-left transition hover:bg-blue-100 ${
            category.includes('内控制度') && !category.includes('全部') ? 'border-blue-300 bg-blue-100' : 'border-blue-200 bg-blue-50'
          }`}
        >
          <p className="text-xs text-blue-700">内控制度</p>
          <p className="mt-2 text-2xl font-semibold text-blue-800">{stats.internal}</p>
          <p className="mt-2 text-xs text-blue-700/70">内控制度：制度/规定/办法</p>
        </button>

        <button
          type="button"
          onClick={() => setCategory(['流程'])}
          className={`rounded-xl border p-4 text-left transition hover:bg-emerald-100 ${
            category.includes('流程') && !category.includes('全部') ? 'border-emerald-300 bg-emerald-100' : 'border-emerald-200 bg-emerald-50'
          }`}
        >
          <p className="text-xs text-emerald-700">操作流程</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-800">{stats.process}</p>
          <p className="mt-2 text-xs text-emerald-700/70">操作流程：流程指引与规范</p>
        </button>

        <button
          type="button"
          onClick={() => setCategory(['图书'])}
          className={`rounded-xl border p-4 text-left transition hover:bg-violet-100 ${
            category.includes('图书') && !category.includes('全部') ? 'border-violet-300 bg-violet-100' : 'border-violet-200 bg-violet-50'
          }`}
        >
          <p className="text-xs text-violet-700">图书专著</p>
          <p className="mt-2 text-2xl font-semibold text-violet-800">{stats.book}</p>
          <p className="mt-2 text-xs text-violet-700/70">图书专著：书籍/专著类资料</p>
        </button>

        <button
          type="button"
          onClick={() => setCategory(['论文'])}
          className={`rounded-xl border p-4 text-left transition hover:bg-orange-100 ${
            category.includes('论文') && !category.includes('全部') ? 'border-orange-300 bg-orange-100' : 'border-orange-200 bg-orange-50'
          }`}
        >
          <p className="text-xs text-orange-700">学术论文</p>
          <p className="mt-2 text-2xl font-semibold text-orange-800">{stats.thesis}</p>
          <p className="mt-2 text-xs text-orange-700/70">学术论文：论文/研究类资料</p>
        </button>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-gray-200 bg-slate-50 px-4 py-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-700">内容类别</span>
              {CATEGORY_OPTIONS.map((c) => {
                const selected = category.includes(c)
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCategory(c)}
                    className={`rounded-full border px-3 py-1.5 text-sm ${
                      selected ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-indigo-200 bg-indigo-100 text-indigo-700'
                    }`}
                  >
                    {c}
                  </button>
                )
              })}

              <span className="mx-2 text-slate-300">|</span>

              <span className="text-sm font-medium text-slate-700">搜索范围</span>
              {([
                { key: 'title', label: '标题' },
                { key: 'summary', label: '摘要' },
                { key: 'full', label: '全文' },
              ] as const).map((item) => {
                const selected = searchScopes.includes(item.key)
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => toggleSearchScope(item.key)}
                    className={`rounded-full border px-3 py-1.5 text-sm ${
                      selected
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-emerald-200 bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-700">效力状态</span>
              {TIMELINESS_OPTIONS.map((t) => {
                const selected = timeliness.includes(t)
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTimeliness((prev) => toggleInArray(prev, t))}
                    className={`rounded-full border px-3 py-1.5 text-sm ${
                      selected ? 'border-sky-500 bg-sky-500 text-white' : 'border-sky-200 bg-sky-100 text-sky-700'
                    }`}
                  >
                    {t}
                  </button>
                )
              })}

              <span className="mx-2 text-slate-300">|</span>

              <span className="text-sm font-medium text-slate-700">效力范围</span>
              {['监管层', '总公司层', '分公司层', '其他'].map((v) => {
                const selected = sourceLevels.includes(v)
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => toggleSourceLevel(v)}
                    className={`rounded-full border px-3 py-1.5 text-sm ${
                      selected ? 'border-amber-500 bg-amber-500 text-white' : 'border-amber-200 bg-amber-100 text-amber-800'
                    }`}
                  >
                    {v}
                  </button>
                )
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-700">主题标签</span>
              {TOPIC_TAG_OPTIONS.map((t) => {
                const selected = topicTags.includes(t)
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTopicTag(t)}
                    className={`rounded-full border px-3 py-1.5 text-sm ${
                      selected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-indigo-200 bg-indigo-100 text-indigo-700'
                    }`}
                  >
                    {t}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center rounded-lg border border-slate-200 bg-white px-3">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="全文搜索（标题/摘要/正文）"
                className="w-full border-none px-2 py-2 text-sm outline-none"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setAdvancedDraft(advanced)
                setAdvancedOpen(true)
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <Filter className="h-4 w-4" />
              高级搜索
            </button>

            <button
              type="button"
              onClick={() => {
                setKeyword('')
                setCategory(['全部'])
                setTimeliness([])
                setSourceLevels([])
                setSearchScopes(['title', 'summary', 'full'])
                setTopicTags([])
                setAdvanced(DEFAULT_ADVANCED)
                setSelectedIds([])
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              重置
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setCreateError(null)
                  setCreateLoading(false)
                  setCreateFileContent('')
                  setCreatePasteContent('')
                  setCreateTitle('')
                  setCreateCategory('内控制度')
                  setCreateTimeliness('草案')
                  setCreatePublishDate('')
                  setCreateOpen(true)
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                <Plus className="h-4 w-4" />
                新建资料
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-500">搜索范围为资料库全部内容，支持标题/摘要/正文关键字匹配，搜索结果中高亮显示关键词出现位置</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div ref={exportMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setExportMenuOpen((prev) => !prev)}
              className={`inline-flex items-center gap-2 rounded border bg-white px-3 py-2 text-sm ${
                canBatch ? 'border-slate-200 text-slate-700 hover:bg-slate-50' : 'cursor-not-allowed border-slate-200 text-slate-400'
              }`}
              disabled={!canBatch}
            >
              <Download className="h-4 w-4" />
              导出
              <ChevronDown className={`h-4 w-4 transition ${exportMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {exportMenuOpen && canBatch ? (
              <div className="absolute left-0 top-[calc(100%+8px)] z-30 w-72 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                <div className="px-4 py-2 text-xs font-semibold text-slate-500">正文内容导出</div>
                <button
                  type="button"
                  onClick={() => {
                    setExportMenuOpen(false)
                    void startPrint(selectedDocs, 'merge')
                  }}
                  className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <span>导出为 PDF</span>
                  <span className="text-xs text-slate-400">打印另存为</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setExportMenuOpen(false)
                    await exportDocx()
                  }}
                  className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <span>导出为 Word</span>
                  <span className="text-xs text-slate-400">.docx</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setExportMenuOpen(false)
                    await exportDocs('md')
                  }}
                  className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <span>导出为 Markdown</span>
                  <span className="text-xs text-slate-400">.md</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setExportMenuOpen(false)
                    await exportDocs('txt')
                  }}
                  className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <span>导出为 TXT</span>
                  <span className="text-xs text-slate-400">.txt</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setExportMenuOpen(false)
                    await exportClausesXlsx()
                  }}
                  className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <span>导出为 Excel（按条目）</span>
                  <span className="text-xs text-slate-400">.xlsx</span>
                </button>

                <div className="my-1 h-px bg-slate-100" />
                <div className="px-4 py-2 text-xs font-semibold text-slate-500">文档信息清单导出</div>
                <button
                  type="button"
                  onClick={async () => {
                    setExportMenuOpen(false)
                    await exportDocListXlsx()
                  }}
                  className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <span>导出文档清单为 Excel</span>
                  <span className="text-xs text-slate-400">.xlsx</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setExportMenuOpen(false)
                    await exportDocListCsv()
                  }}
                  className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <span>导出文档清单为 CSV</span>
                  <span className="text-xs text-slate-400">.csv</span>
                </button>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => {
              setPrintDocs(selectedDocs)
              setPrintIndex(0)
              setSeparatePrint(false)
              setMergePrint(true)
              setPrintOpen(true)
            }}
            className={`inline-flex items-center gap-2 rounded border bg-white px-3 py-2 text-sm ${
              canBatch ? 'border-slate-200 text-slate-700 hover:bg-slate-50' : 'cursor-not-allowed border-slate-200 text-slate-400'
            }`}
            disabled={!canBatch}
          >
            <Printer className="h-4 w-4" />
            打印
          </button>

          <button
            type="button"
            onClick={() => window.alert('Mock：批量收藏')}
            className={`inline-flex items-center gap-2 rounded border bg-white px-3 py-2 text-sm ${
              canBatch ? 'border-slate-200 text-slate-700 hover:bg-slate-50' : 'cursor-not-allowed border-slate-200 text-slate-400'
            }`}
            disabled={!canBatch}
          >
            <Star className="h-4 w-4" />
            批量收藏
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
            <span>每页显示:</span>
            <select
              value={String(pageSize)}
              onChange={(e) => {
                const v = e.target.value
                setPageSize(v === 'all' ? 'all' : (Number(v) as 10 | 15 | 20))
              }}
              className="border-none bg-transparent text-sm outline-none"
            >
              <option value="10">10</option>
              <option value="15">15</option>
              <option value="20">20</option>
              <option value="all">全部</option>
            </select>
          </div>

          <div ref={sortMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setSortMenuOpen((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <span>排序</span>
              <span className="text-slate-500">{sortLabel}</span>
              <ChevronDown className={`h-4 w-4 transition ${sortMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {sortMenuOpen ? (
              <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                {([
                  { key: 'relevance', label: '相关度（默认）' },
                  { key: 'publishDateAsc', label: '发布日期 ↑' },
                  { key: 'publishDateDesc', label: '发布日期 ↓' },
                  { key: 'effectiveDateAsc', label: '生效日期 ↑' },
                  { key: 'effectiveDateDesc', label: '生效日期 ↓' },
                ] as const satisfies ReadonlyArray<{ key: SortKey; label: string }>).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setSortBy(item.key)
                      setSortMenuOpen(false)
                    }}
                    className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm ${
                      sortBy === item.key ? 'bg-slate-50 text-slate-900' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {item.label}
                    {sortBy === item.key ? <span className="text-xs text-blue-600">已选</span> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => {
              setPageSize(10)
              setSortBy('relevance')
              setSortMenuOpen(false)
              setSelectedIds([])
            }}
            className="rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            重置
          </button>
        </div>
      </div>

      {loading ? <div className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-500">加载中...</div> : null}
      {error ? <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

      <div className="space-y-3">
        {pageRows.map((doc) => {
          const selected = selectedSet.has(doc.id)
          const categoryClass = CATEGORY_CLASS[doc.category]
          return (
            <article key={doc.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() =>
                    setSelectedIds((prev) => (prev.includes(doc.id) ? prev.filter((x) => x !== doc.id) : [...prev, doc.id]))
                  }
                  className="mt-1"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${categoryClass}`}>{doc.category}</span>
                    <button
                      type="button"
                      onClick={() => navigate(`/org/library/${doc.id}`)}
                      className="min-w-0 flex-1 truncate text-left text-base font-semibold text-slate-900 hover:text-blue-700"
                    >
                      {highlightText(doc.title, keyword)}
                    </button>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${TIMELINESS_CLASS[doc.timeliness]}`}>{doc.timeliness}</span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                    {doc.dept ? <span>{doc.dept}</span> : null}
                    {doc.publishDate ? <span>发布日期：{doc.publishDate}</span> : null}
                    {doc.effectiveDate ? <span>生效日期：{doc.effectiveDate}</span> : null}
                    {doc.docNo ? <span>文号：{doc.docNo}</span> : null}
                  </div>

                  {doc.summary ? (
                    <div className="mt-2 text-sm text-slate-500">
                      {highlightText(doc.summary.length > 80 ? `${doc.summary.slice(0, 80)}...` : doc.summary, keyword)}
                    </div>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedIds([doc.id])
                        setExportMenuOpen(true)
                      }}
                      className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      导出
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedIds([doc.id])
                        setPrintDocs([doc])
                        setPrintIndex(0)
                        setSeparatePrint(false)
                        setMergePrint(true)
                        setPrintOpen(true)
                      }}
                      className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      打印
                    </button>
                    <button
                      type="button"
                      onClick={() => window.alert('Mock：收藏')}
                      className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      收藏
                    </button>
                  </div>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      <div className="print-content hidden">
        {(() => {
          const printingDocs = separatePrint ? [printDocs[printIndex]].filter(Boolean) : printDocs
          return printingDocs.map((doc, idx) => {
            const body = (printBodyById[doc.id] ?? doc.content).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
            const lines = body.split('\n').map((x) => x.trim()).filter(Boolean)
            return (
              <div
                key={`${doc.id}-${idx}`}
                style={
                  idx < printingDocs.length - 1
                    ? { breakAfter: 'page', pageBreakAfter: 'always', paddingBottom: '24pt' }
                    : { paddingBottom: '24pt' }
                }
              >
                <p className="print-meta">{'─'.repeat(32)}</p>
                <h1>{doc.title}</h1>
                <p className="print-meta">
                  发文机关：{doc.dept || '-'} | 发布日期：{doc.publishDate || '-'} | 生效日期：{doc.effectiveDate || '-'}
                </p>
                <p className="print-meta">{'─'.repeat(32)}</p>
                {lines.map((line, lineIdx) => (
                  <p key={`${doc.id}-${lineIdx}`}>{line.replace(/^#{1,6}\s+/, '')}</p>
                ))}
              </div>
            )
          })
        })()}
      </div>

      <Modal
        open={advancedOpen}
        title="高级搜索"
        onClose={() => setAdvancedOpen(false)}
        footer={
          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setAdvancedDraft(DEFAULT_ADVANCED)}
              className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              重置
            </button>
            <button
              type="button"
              onClick={() => {
                setAdvanced(advancedDraft)
                setAdvancedOpen(false)
              }}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
            >
              应用筛选
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-sm text-slate-700">
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-800">发文部门 / 作者</p>
            <select
              multiple
              value={advancedDraft.departments}
              onChange={(e) => setAdvancedDraft((prev) => ({ ...prev, departments: Array.from(e.target.selectedOptions).map((o) => o.value) }))}
              className="h-40 w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-800">发布日期范围</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={advancedDraft.publishStart}
                  onChange={(e) => setAdvancedDraft((prev) => ({ ...prev, publishStart: e.target.value }))}
                  className="rounded border border-slate-200 px-3 py-2 text-sm"
                />
                <input
                  type="date"
                  value={advancedDraft.publishEnd}
                  onChange={(e) => setAdvancedDraft((prev) => ({ ...prev, publishEnd: e.target.value }))}
                  className="rounded border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-800">生效日期范围</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={advancedDraft.effectiveStart}
                  onChange={(e) => setAdvancedDraft((prev) => ({ ...prev, effectiveStart: e.target.value }))}
                  className="rounded border border-slate-200 px-3 py-2 text-sm"
                />
                <input
                  type="date"
                  value={advancedDraft.effectiveEnd}
                  onChange={(e) => setAdvancedDraft((prev) => ({ ...prev, effectiveEnd: e.target.value }))}
                  className="rounded border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>
        </div>
      </Modal>

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
                关闭
              </button>
            </div>

            <div className="flex h-[70vh]">
              <div className="w-[360px] overflow-y-auto border-r border-slate-200 p-5 text-sm text-slate-700">
                <div className="space-y-6">
                  {printDocs.length > 1 ? (
                    <div>
                      <p className="text-xs font-semibold tracking-wide text-slate-500">多篇打印</p>
                      <div className="mt-3 space-y-2">
                        <label className="flex items-center gap-2">
                          <input type="radio" checked={mergePrint} onChange={() => setMergePrint(true)} />
                          合并为一份文件打印（默认）
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="radio" checked={!mergePrint} onChange={() => setMergePrint(false)} />
                          分别打印
                        </label>
                      </div>
                    </div>
                  ) : null}

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
                                printSettings.paperSize === v ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white'
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
                                printSettings.orientation === v.key ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white'
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
                          onChange={(e) => setPrintSettings((prev) => ({ ...prev, bodyFontSize: e.target.value as PrintFontSize }))}
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
                            onClick={() => setPrintSettings((prev) => ({ ...prev, titleFontMode: 'auto', titleFontSize: '' }))}
                            className={`rounded border px-3 py-1.5 text-sm ${
                              printSettings.titleFontMode === 'auto' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white'
                            }`}
                          >
                            自动（正文+2pt）
                          </button>
                          <button
                            type="button"
                            onClick={() => setPrintSettings((prev) => ({ ...prev, titleFontMode: 'manual' }))}
                            className={`rounded border px-3 py-1.5 text-sm ${
                              printSettings.titleFontMode === 'manual' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white'
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
                                printSettings.lineHeight === v ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white'
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
                                printSettings.indent === v.key ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white'
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
                          onChange={(e) => setPrintSettings((prev) => ({ ...prev, paragraphSpacing: e.target.value as PrintParagraphSpacing }))}
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
                                printSettings.showHeader === item.v ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white'
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
                                printSettings.showPageNumber === item.v ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white'
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
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                  预览仅展示前3段落，实际打印按选中结果输出
                </div>
                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-5">
                  <div style={{ fontFamily: previewComputed.fontFamily, fontSize: previewComputed.fontSize, lineHeight: previewComputed.lineHeight, color: '#000' }}>
                    <div style={{ fontSize: previewComputed.titleSize, fontWeight: 700, textAlign: 'center', marginBottom: '20pt' }}>
                      {printDocs[0]?.title ?? '资料库'}
                    </div>
                    {previewLines.map((line, idx) => (
                      <div key={idx} style={{ textIndent: previewComputed.indent, margin: `${previewComputed.paragraphMargin} 0` }}>
                        {line}
                      </div>
                    ))}
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
                    void startPrint(printDocs, printDocs.length > 1 && !mergePrint ? 'separate' : 'merge')
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

      <Modal
        open={createOpen}
        title="新建资料"
        onClose={() => setCreateOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => {
                if (!createTitle.trim()) return
                const content = [createFileContent, createPasteContent].map((x) => x.trim()).filter(Boolean).join('\n\n')
                const newDoc: LibraryDoc = {
                  id: `local-${Date.now()}`,
                  source: 'local',
                  title: createTitle.trim(),
                  category: createCategory,
                  timeliness: createTimeliness,
                  docNo: '',
                  dept: '',
                  publishDate: createPublishDate,
                  effectiveDate: '',
                  summary: '',
                  content,
                  sourceLevel:
                    createCategory === '法律法规'
                      ? '监管层'
                      : createCategory === '流程'
                        ? '分公司层'
                        : createCategory === '内控制度'
                          ? '总公司层'
                          : '其他',
                  topics: [],
                }
                setLocalDocs((prev) => [newDoc, ...prev])
                setCreateOpen(false)
              }}
              className={`rounded px-4 py-2 text-sm text-white ${
                createTitle.trim() ? 'bg-red-600 hover:bg-red-700' : 'cursor-not-allowed bg-slate-300'
              }`}
              disabled={!createTitle.trim()}
            >
              确认新建
            </button>
          </div>
        }
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="text-sm font-medium text-slate-800">文件导入</div>
            <input
              ref={createFileInputRef}
              type="file"
              accept=".docx,.pdf,.md,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                void handleCreateFile(file)
              }}
            />
            <div
              role="button"
              tabIndex={0}
              onClick={() => createFileInputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') createFileInputRef.current?.click()
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                const file = event.dataTransfer.files?.[0]
                if (!file) return
                void handleCreateFile(file)
              }}
              className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600 hover:bg-slate-100"
            >
              <div className="text-slate-700">点击选择文件，或拖拽到此处</div>
              <div className="mt-1 text-xs text-slate-500">支持格式：.docx / .pdf / .md / .txt</div>
            </div>
            {createLoading ? <div className="text-sm text-slate-500">正在解析文件...</div> : null}
            {createError ? <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{createError}</div> : null}
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-slate-800">粘贴文本</div>
            <textarea
              value={createPasteContent}
              onChange={(e) => setCreatePasteContent(e.target.value)}
              placeholder="直接粘贴文档内容…"
              className="h-[6.5rem] w-full rounded border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-3">
            <div className="text-sm font-medium text-slate-800">手动填写基础信息</div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="space-y-1 md:col-span-2">
                <span className="text-sm text-slate-600">文档标题（必填）</span>
                <input
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm text-slate-600">内容类别</span>
                <select
                  value={createCategory}
                  onChange={(e) => setCreateCategory(e.target.value as any)}
                  className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  {CATEGORY_OPTIONS.filter((c) => c !== '全部').map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-sm text-slate-600">效力状态</span>
                <select
                  value={createTimeliness}
                  onChange={(e) => setCreateTimeliness(e.target.value as Timeliness)}
                  className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  {TIMELINESS_OPTIONS.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-sm text-slate-600">发布日期</span>
                <input
                  type="date"
                  value={createPublishDate}
                  onChange={(e) => setCreatePublishDate(e.target.value)}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            </div>
          </div>
        </div>
      </Modal>
    </section>
  )
}
