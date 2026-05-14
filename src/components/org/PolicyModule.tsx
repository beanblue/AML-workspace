import {
  ChevronDown,
  Download,
  Filter,
  Plus,
  Printer,
  Search,
  Star,
  Upload,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAMLData } from '../../hooks/useAMLData'
import type { PolicyProcessItem, ProcessLibraryItem, ReferenceKnowledgeItem } from '../../types'
import { Modal } from '../shared/Modal'

type LibraryCategory = '全部' | '内控制度' | '法律法规' | '流程' | '图书' | '论文' | '其他'
type Timeliness = '编码有效' | '已废止' | '修订中' | '草案' | '尚未生效'
type SearchScope = 'title' | 'summary' | 'full'
type PageSize = 10 | 15 | 20 | 'all'

type LibraryDoc = {
  id: string
  source: 'policy' | 'process' | 'knowledge' | 'local'
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

const CATEGORY_FILTER_CLASS: Record<LibraryCategory, string> = {
  全部: 'border-slate-200 bg-white text-slate-700',
  内控制度: 'border-blue-200 bg-blue-50 text-blue-700',
  法律法规: 'border-red-200 bg-red-50 text-red-700',
  流程: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  图书: 'border-violet-200 bg-violet-50 text-violet-700',
  论文: 'border-violet-200 bg-violet-50 text-violet-700',
  其他: 'border-slate-200 bg-slate-50 text-slate-700',
}

const TIMELINESS_OPTIONS: Timeliness[] = ['编码有效', '已废止', '修订中', '草案', '尚未生效']

const TIMELINESS_CLASS: Record<Timeliness, string> = {
  编码有效: 'bg-emerald-100 text-emerald-700',
  已废止: 'bg-slate-100 text-slate-600',
  修订中: 'bg-orange-100 text-orange-700',
  草案: 'bg-blue-100 text-blue-700',
  尚未生效: 'bg-indigo-100 text-indigo-700',
}

type AdvancedFilters = {
  scopes: SearchScope[]
  sourceLevels: string[]
  timeliness: Timeliness[]
  departments: string[]
  publishStart: string
  publishEnd: string
  effectiveStart: string
  effectiveEnd: string
}

const DEFAULT_ADVANCED: AdvancedFilters = {
  scopes: ['title', 'summary', 'full'],
  sourceLevels: [],
  timeliness: [],
  departments: [],
  publishStart: '',
  publishEnd: '',
  effectiveStart: '',
  effectiveEnd: '',
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
      <mark key={`${part}-${index}`} className="rounded bg-yellow-200 px-0.5">
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    ),
  )
}

function normalizePolicyStatus(item: PolicyProcessItem): Timeliness {
  if (item.status === 'archived') return '已废止'
  if (item.status === 'inactive') return '修订中'
  if (item.status === 'draft') return '草案'

  const ts = item.effectiveDate ? new Date(item.effectiveDate).getTime() : Number.NaN
  if (!Number.isNaN(ts) && ts > Date.now()) return '尚未生效'
  return '编码有效'
}

function normalizeProcessStatus(item: ProcessLibraryItem): Timeliness {
  if (item.status === 'archived') return '已废止'
  if (item.status === 'inactive') return '修订中'
  if (item.status === 'draft' || item.status === 'pending') return '草案'
  return '编码有效'
}

function normalizeKnowledgeStatus(item: ReferenceKnowledgeItem): Timeliness {
  const s = String(item.status ?? '')
  if (s.includes('废止')) return '已废止'
  if (s.includes('草案') || s.includes('拟稿')) return '草案'
  if (s.includes('未生效')) return '尚未生效'
  if (s.includes('仅参考')) return '修订中'
  const ts = item.publishDate ? new Date(item.publishDate).getTime() : Number.NaN
  if (!Number.isNaN(ts) && ts > Date.now()) return '尚未生效'
  return '编码有效'
}

function normalizeKnowledgeCategory(item: ReferenceKnowledgeItem): Exclude<LibraryCategory, '全部'> {
  if (item.materialType === '图书') return '图书'
  if (item.materialType === '论文') return '论文'
  if (item.materialType === '监管报告') return '法律法规'
  return '其他'
}

function safeText(value: string | undefined | null): string {
  return String(value ?? '').trim()
}

function parseFileNameTitle(name: string): string {
  return name.replace(/\.[^/.]+$/, '').trim()
}

export function PolicyModule() {
  const navigate = useNavigate()

  const policies = useAMLData<PolicyProcessItem[]>('policy', 'query')
  const processes = useAMLData<ProcessLibraryItem[]>('policyProcess', 'query')
  const knowledge = useAMLData<ReferenceKnowledgeItem[]>('policyKnowledge', 'query')

  const [localDocs, setLocalDocs] = useState<LibraryDoc[]>([])

  const [category, setCategory] = useState<LibraryCategory>('全部')
  const [timeliness, setTimeliness] = useState<Timeliness[]>([])
  const [keyword, setKeyword] = useState('')

  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [advancedDraft, setAdvancedDraft] = useState<AdvancedFilters>(DEFAULT_ADVANCED)
  const [advanced, setAdvanced] = useState<AdvancedFilters>(DEFAULT_ADVANCED)

  const [pageSize, setPageSize] = useState<PageSize>(10)
  const [sortBy, setSortBy] = useState<'relevance' | 'publishDate' | 'effectiveDate'>('relevance')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const [newMenuOpen, setNewMenuOpen] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)

  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importTitle, setImportTitle] = useState('')
  const [importCategory, setImportCategory] = useState<Exclude<LibraryCategory, '全部'>>('内控制度')
  const [importDept, setImportDept] = useState('')
  const [importPublishDate, setImportPublishDate] = useState('')
  const [importEffectiveDate, setImportEffectiveDate] = useState('')
  const [importContent, setImportContent] = useState('')

  const [pasteTitle, setPasteTitle] = useState('')
  const [pasteCategory, setPasteCategory] = useState<Exclude<LibraryCategory, '全部'>>('内控制度')
  const [pasteDept, setPasteDept] = useState('')
  const [pastePublishDate, setPastePublishDate] = useState('')
  const [pasteEffectiveDate, setPasteEffectiveDate] = useState('')
  const [pasteContent, setPasteContent] = useState('')

  const newMenuRef = useRef<HTMLDivElement | null>(null)
  const exportMenuRef = useRef<HTMLDivElement | null>(null)

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

  const remoteDocs = useMemo(() => {
    const list: LibraryDoc[] = []

    ;(policies.data ?? []).forEach((item) => {
      const category = item.category === '流程' ? '流程' : '内控制度'
      list.push({
        id: item.id,
        source: 'policy',
        category,
        timeliness: normalizePolicyStatus(item),
        title: item.name,
        docNo: safeText(item.documentNo || item.code),
        dept: safeText(item.issuingUnit),
        publishDate: safeText(item.issueDate),
        effectiveDate: safeText(item.effectiveDate),
        summary: safeText(item.summary),
        content: safeText(item.fullText),
        sourceLevel: safeText(item.sourceLevel),
      })
    })

    ;(processes.data ?? []).forEach((item) => {
      list.push({
        id: item.id,
        source: 'process',
        category: '流程',
        timeliness: normalizeProcessStatus(item),
        title: item.processName,
        docNo: safeText(item.processCode),
        dept: safeText(item.businessDomain),
        publishDate: safeText(item.updatedAt?.slice(0, 10)),
        effectiveDate: '',
        summary: safeText(item.steps?.[0]?.triggerCondition ?? ''),
        content: safeText(
          [
            item.processName,
            '',
            ...(item.steps ?? []).map((step) => `${step.index}. ${step.name}\n${step.triggerCondition}`),
          ].join('\n'),
        ),
        sourceLevel: '',
      })
    })

    ;(knowledge.data ?? []).forEach((item) => {
      list.push({
        id: item.id,
        source: 'knowledge',
        category: normalizeKnowledgeCategory(item),
        timeliness: normalizeKnowledgeStatus(item),
        title: item.title,
        docNo: '',
        dept: safeText(item.sourceOrg),
        publishDate: safeText(item.publishDate),
        effectiveDate: '',
        summary: safeText(item.summary),
        content: safeText([item.summary, item.keyPoints, item.scope].filter(Boolean).join('\n')),
        sourceLevel: '',
      })
    })

    return list
  }, [knowledge.data, policies.data, processes.data])

  const docs = useMemo(() => [...localDocs, ...remoteDocs], [localDocs, remoteDocs])

  const loading = policies.loading || processes.loading || knowledge.loading
  const error = policies.error || processes.error || knowledge.error

  const stats = useMemo(() => {
    const total = docs.length
    const active = docs.filter((d) => d.timeliness === '编码有效').length
    const archived = docs.filter((d) => d.timeliness === '已废止').length
    const revising = docs.filter((d) => d.timeliness === '修订中').length
    const draft = docs.filter((d) => d.timeliness === '草案').length
    return { total, active, archived, revising, draft }
  }, [docs])

  const departments = useMemo(() => Array.from(new Set(docs.map((d) => d.dept).filter(Boolean))).sort(), [docs])

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    const scopes = new Set(advanced.scopes)

    const rows = docs
      .filter((d) => (category === '全部' ? true : d.category === category))
      .filter((d) => (timeliness.length === 0 ? true : timeliness.includes(d.timeliness)))
      .filter((d) => (advanced.sourceLevels.length === 0 ? true : advanced.sourceLevels.includes(d.sourceLevel)))
      .filter((d) => (advanced.timeliness.length === 0 ? true : advanced.timeliness.includes(d.timeliness)))
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

    const sorted = [...rows].sort((a, b) => {
      if (sortBy === 'relevance') {
        const diff = score(b) - score(a)
        if (diff !== 0) return diff
      }
      if (sortBy === 'effectiveDate') return new Date(b.effectiveDate || 0).getTime() - new Date(a.effectiveDate || 0).getTime()
      return new Date(b.publishDate || 0).getTime() - new Date(a.publishDate || 0).getTime()
    })

    return sorted
  }, [advanced, category, docs, keyword, sortBy, timeliness])

  const pageRows = useMemo(() => {
    if (pageSize === 'all') return filtered
    return filtered.slice(0, pageSize)
  }, [filtered, pageSize])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const canBatch = selectedIds.length > 0

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (newMenuRef.current?.contains(target)) return
      if (exportMenuRef.current?.contains(target)) return
      setNewMenuOpen(false)
      setExportMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">资料库</h2>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">全部资料数</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs text-emerald-700">编码有效数</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-800">{stats.active}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs text-slate-600">已废止数</p>
          <p className="mt-2 text-2xl font-semibold text-slate-800">{stats.archived}</p>
        </div>
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
          <p className="text-xs text-orange-700">修订中数</p>
          <p className="mt-2 text-2xl font-semibold text-orange-800">{stats.revising}</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs text-blue-700">草案数</p>
          <p className="mt-2 text-2xl font-semibold text-blue-800">{stats.draft}</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-700">库类别：</span>
          {CATEGORY_OPTIONS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-full border px-3 py-1.5 text-sm ${category === c ? CATEGORY_FILTER_CLASS[c] : 'border-slate-200 bg-white text-slate-700'}`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-700">时效标签：</span>
          {TIMELINESS_OPTIONS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTimeliness((prev) => toggleInArray(prev, t))}
              className={`rounded-full border px-3 py-1 text-sm ${
                timeliness.includes(t) ? `border-blue-200 bg-blue-50 text-blue-700` : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              {t}
            </button>
          ))}
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
                setCategory('全部')
                setTimeliness([])
                setAdvanced(DEFAULT_ADVANCED)
                setSelectedIds([])
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              重置
            </button>

            <div ref={newMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setNewMenuOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                新建资料
                <ChevronDown className={`h-4 w-4 transition ${newMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {newMenuOpen ? (
                <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setNewMenuOpen(false)
                      setImportOpen(true)
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <Upload className="h-4 w-4 text-slate-500" />
                    导入文件
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewMenuOpen(false)
                      setPasteOpen(true)
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <Plus className="h-4 w-4 text-slate-500" />
                    粘贴内容新建
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <p className="text-xs text-slate-500">搜索范围为资料库全部内容，支持标题/摘要/正文关键字匹配，搜索结果中高亮显示关键词出现位置</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <Upload className="h-4 w-4" />
            导入
          </button>

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
              <div className="absolute left-0 top-[calc(100%+8px)] z-30 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setExportMenuOpen(false)
                    window.alert('Mock：导出选中内容')
                  }}
                  className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <span>导出</span>
                  <span className="text-xs text-slate-400">Mock</span>
                </button>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => window.alert('Mock：打印选中内容')}
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

          <div className="inline-flex items-center gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
            <span>更多</span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="border-none bg-transparent text-sm outline-none">
              <option value="relevance">相关度</option>
              <option value="publishDate">发布日期</option>
              <option value="effectiveDate">生效日期</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setPageSize(10)
              setSortBy('relevance')
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
                      onClick={() => window.alert('Mock：导出')}
                      className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      导出
                    </button>
                    <button
                      type="button"
                      onClick={() => window.alert('Mock：打印')}
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
            <p className="text-sm font-medium text-slate-800">搜索范围</p>
            <div className="flex flex-wrap gap-2">
              {([
                { key: 'title', label: '标题' },
                { key: 'summary', label: '摘要' },
                { key: 'full', label: '全文' },
              ] as const).map((item) => (
                <label key={item.key} className="inline-flex items-center gap-2 rounded border border-slate-200 bg-white px-3 py-2">
                  <input
                    type="checkbox"
                    checked={advancedDraft.scopes.includes(item.key)}
                    onChange={() => setAdvancedDraft((prev) => ({ ...prev, scopes: toggleInArray(prev.scopes, item.key) }))}
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-800">效能体系</p>
            <div className="flex flex-wrap gap-2">
              {['监管层', '总公司层', '分公司层', '其他'].map((v) => (
                <label key={v} className="inline-flex items-center gap-2 rounded border border-slate-200 bg-white px-3 py-2">
                  <input
                    type="checkbox"
                    checked={advancedDraft.sourceLevels.includes(v)}
                    onChange={() => setAdvancedDraft((prev) => ({ ...prev, sourceLevels: toggleInArray(prev.sourceLevels, v) }))}
                  />
                  {v}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-800">时效性</p>
            <div className="flex flex-wrap gap-2">
              {TIMELINESS_OPTIONS.map((v) => (
                <label key={v} className="inline-flex items-center gap-2 rounded border border-slate-200 bg-white px-3 py-2">
                  <input
                    type="checkbox"
                    checked={advancedDraft.timeliness.includes(v)}
                    onChange={() => setAdvancedDraft((prev) => ({ ...prev, timeliness: toggleInArray(prev.timeliness, v) }))}
                  />
                  {v}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-800">发文部门</p>
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

      <Modal
        open={importOpen}
        title="导入文件"
        onClose={() => setImportOpen(false)}
        footer={
          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => {
                setImportTitle('')
                setImportDept('')
                setImportPublishDate('')
                setImportEffectiveDate('')
                setImportContent('')
                setImportError(null)
              }}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              重置
            </button>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                关闭
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!importTitle.trim() || !importContent.trim()) return
                  const newDoc: LibraryDoc = {
                    id: `local-${Date.now()}`,
                    source: 'local',
                    title: importTitle.trim(),
                    category: importCategory,
                    timeliness: '草案',
                    docNo: '',
                    dept: importDept.trim(),
                    publishDate: importPublishDate,
                    effectiveDate: importEffectiveDate,
                    summary: '',
                    content: importContent.trim(),
                    sourceLevel: '',
                  }
                  setLocalDocs((prev) => [newDoc, ...prev])
                  setImportOpen(false)
                }}
                className={`rounded px-3 py-1.5 text-sm text-white ${
                  importTitle.trim() && importContent.trim() ? 'bg-blue-600 hover:bg-blue-700' : 'cursor-not-allowed bg-slate-300'
                }`}
                disabled={!importTitle.trim() || !importContent.trim()}
              >
                添加到列表
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
            支持 .docx / .pdf / .md / .txt，Notion 导出的 .md 文件可直接导入
          </div>

          <input
            type="file"
            accept=".docx,.pdf,.md,.txt"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              setImportError(null)
              setImportLoading(true)
              setImportTitle(parseFileNameTitle(file.name))
              try {
                const text = await parseFile(file)
                setImportContent(text)
              } catch (err) {
                setImportError(err instanceof Error ? err.message : String(err))
                setImportContent('')
              } finally {
                setImportLoading(false)
              }
            }}
            className="w-full text-sm"
          />

          {importLoading ? <div className="text-sm text-slate-500">正在解析文件...</div> : null}
          {importError ? <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{importError}</div> : null}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm text-slate-600">标题</span>
              <input value={importTitle} onChange={(e) => setImportTitle(e.target.value)} className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
            </label>

            <label className="space-y-1">
              <span className="text-sm text-slate-600">分类</span>
              <select value={importCategory} onChange={(e) => setImportCategory(e.target.value as any)} className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm">
                {CATEGORY_OPTIONS.filter((c) => c !== '全部').map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-sm text-slate-600">发文机关/部门</span>
              <input value={importDept} onChange={(e) => setImportDept(e.target.value)} className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-sm text-slate-600">发布日期</span>
                <input type="date" value={importPublishDate} onChange={(e) => setImportPublishDate(e.target.value)} className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
              </label>
              <label className="space-y-1">
                <span className="text-sm text-slate-600">生效日期</span>
                <input type="date" value={importEffectiveDate} onChange={(e) => setImportEffectiveDate(e.target.value)} className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
              </label>
            </div>
          </div>

          <label className="space-y-1">
            <span className="text-sm text-slate-600">内容</span>
            <textarea value={importContent} onChange={(e) => setImportContent(e.target.value)} className="h-56 w-full rounded border border-slate-200 px-3 py-2 text-sm" />
          </label>
        </div>
      </Modal>

      <Modal
        open={pasteOpen}
        title="粘贴内容新建"
        onClose={() => setPasteOpen(false)}
        footer={
          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => {
                setPasteTitle('')
                setPasteDept('')
                setPastePublishDate('')
                setPasteEffectiveDate('')
                setPasteContent('')
              }}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              重置
            </button>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPasteOpen(false)}
                className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                关闭
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!pasteTitle.trim() || !pasteContent.trim()) return
                  const newDoc: LibraryDoc = {
                    id: `local-${Date.now()}`,
                    source: 'local',
                    title: pasteTitle.trim(),
                    category: pasteCategory,
                    timeliness: '草案',
                    docNo: '',
                    dept: pasteDept.trim(),
                    publishDate: pastePublishDate,
                    effectiveDate: pasteEffectiveDate,
                    summary: '',
                    content: pasteContent.trim(),
                    sourceLevel: '',
                  }
                  setLocalDocs((prev) => [newDoc, ...prev])
                  setPasteOpen(false)
                }}
                className={`rounded px-3 py-1.5 text-sm text-white ${
                  pasteTitle.trim() && pasteContent.trim() ? 'bg-blue-600 hover:bg-blue-700' : 'cursor-not-allowed bg-slate-300'
                }`}
                disabled={!pasteTitle.trim() || !pasteContent.trim()}
              >
                添加到列表
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm text-slate-600">标题</span>
              <input value={pasteTitle} onChange={(e) => setPasteTitle(e.target.value)} className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-slate-600">分类</span>
              <select value={pasteCategory} onChange={(e) => setPasteCategory(e.target.value as any)} className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm">
                {CATEGORY_OPTIONS.filter((c) => c !== '全部').map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-sm text-slate-600">发文机关/部门</span>
              <input value={pasteDept} onChange={(e) => setPasteDept(e.target.value)} className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-sm text-slate-600">发布日期</span>
                <input type="date" value={pastePublishDate} onChange={(e) => setPastePublishDate(e.target.value)} className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
              </label>
              <label className="space-y-1">
                <span className="text-sm text-slate-600">生效日期</span>
                <input type="date" value={pasteEffectiveDate} onChange={(e) => setPasteEffectiveDate(e.target.value)} className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
              </label>
            </div>
          </div>

          <label className="space-y-1">
            <span className="text-sm text-slate-600">内容</span>
            <textarea value={pasteContent} onChange={(e) => setPasteContent(e.target.value)} className="h-56 w-full rounded border border-slate-200 px-3 py-2 text-sm" placeholder="粘贴正文内容..." />
          </label>
        </div>
      </Modal>
    </section>
  )
}

