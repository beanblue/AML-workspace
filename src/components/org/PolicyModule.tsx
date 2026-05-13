import {
  ArrowDownUp,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  FileDown,
  FileUp,
  Printer,
  Search,
  Star,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { queryDatabase } from '../../api/notion'
import { useAMLData } from '../../hooks/useAMLData'
import type { ProcessLibraryItem } from '../../types'
import { DataTable, type TableColumn } from '../shared/DataTable'
import { Modal } from '../shared/Modal'
import { StatusBadge } from '../shared/StatusBadge'

type LibraryTab = 'documents' | 'process' | 'diagram'

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
  主题标签?: string[] | string
  适用范围?: string
  到期日期?: string
  失效日期?: string
  业务分类?: string[] | string
  主题分类?: string[] | string
}

type KeywordMode = 'include' | 'exclude'

type AdvancedKeyword = {
  mode: KeywordMode
  value: string
}

type AdvancedSearchState = {
  fullText: AdvancedKeyword
  title: AdvancedKeyword
  no: AdvancedKeyword
  publishFrom: string
  publishTo: string
  effectiveFrom: string
  effectiveTo: string
  topicCategories: string[]
  businessCategories: string[]
  sourceLevels: string[]
  timeliness: string[]
  efficacyLevels: string[]
}

type SortKey = 'relevance' | 'publishDate' | 'effectiveDate'

const TIMELINESS_OPTIONS = ['现行有效', '已废止', '修订中', '草案', '尚未生效']
const EFFICACY_OPTIONS = ['监管层', '总公司层', '分公司层', '部门层']

const STATUS_STYLE: Record<string, string> = {
  现行有效: 'bg-emerald-100 text-emerald-700',
  已废止: 'bg-red-100 text-red-700',
  修订中: 'bg-orange-100 text-orange-700',
  草案: 'bg-slate-100 text-slate-700',
  尚未生效: 'bg-blue-100 text-blue-700',
}

const TYPE_CLASS = 'bg-slate-100 text-slate-700'

const TOPIC_CLASS_POOL = [
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-orange-100 text-orange-700',
  'bg-slate-100 text-slate-700',
]

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

function parseDate(value: string): number | null {
  if (!value) return null
  const t = Date.parse(value)
  return Number.isNaN(t) ? null : t
}

function getTitle(row: NotionDocumentRow): string {
  return String(row.标题 ?? row.Name ?? '').trim()
}

function getSummary(row: NotionDocumentRow): string {
  return String(row.摘要 ?? '').trim()
}

function getKeyPoints(row: NotionDocumentRow): string {
  return String(row['关键要点/适用情景'] ?? '').trim()
}

function getPublishDate(row: NotionDocumentRow): string {
  return String(row.发布日期 ?? row['生效/发布日期'] ?? '').trim()
}

function getEffectiveDate(row: NotionDocumentRow): string {
  return String(row.生效日期 ?? row['生效/发布日期'] ?? '').trim()
}

function getDocNo(row: NotionDocumentRow): string {
  return String(row.编号 ?? row.文号 ?? row.制度编号 ?? '').trim()
}

function getDepartment(row: NotionDocumentRow): string {
  return String(row.发文部门 ?? row.发文机关 ?? row.部门 ?? row.来源 ?? '').trim()
}

function getTopics(row: NotionDocumentRow): string[] {
  return normalizeTextList(row.主题标签 ?? row.主题分类)
}

function detectSourceLevel(row: NotionDocumentRow): string {
  const source = String(row.来源 ?? '')
  const value = source.trim()
  if (!value) return '其他'
  if (value.includes('监管') || value.includes('人民银行') || value.includes('银保监') || value.includes('证监')) return '监管层'
  if (value.includes('总公司') || value.includes('总行') || value.includes('总部')) return '总公司层'
  if (value.includes('分公司') || value.includes('支行') || value.includes('营业部')) return '分公司层'
  return '其他'
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

function timelinessToBadgeStyle(timeliness: string): string {
  return STATUS_STYLE[timeliness] ?? 'bg-slate-100 text-slate-700'
}

function hashHeat(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) % 1000
  return Math.min(100, Math.max(5, Math.round((hash / 1000) * 100)))
}

function clampText(text: string, maxLen: number): string {
  const t = text.trim()
  if (t.length <= maxLen) return t
  return `${t.slice(0, maxLen)}...`
}

function toggleInArray<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((item) => item !== value) : [...arr, value]
}

function FilterGroup({
  title,
  open,
  onToggle,
  children,
}: {
  title: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between px-3 py-2 text-left">
        <span className="text-sm font-medium text-slate-800">{title}</span>
        <ChevronRight className={`h-4 w-4 text-slate-500 transition ${open ? 'rotate-90' : ''}`} />
      </button>
      {open ? <div className="border-t border-slate-200 px-3 py-3">{children}</div> : null}
    </div>
  )
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-28 rounded-full bg-slate-100">
      <div className="h-2 rounded-full bg-blue-600" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}

function ExportMenu({ onExport }: { onExport: (type: 'pdf' | 'excel' | 'word') => void }) {
  return (
    <details className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
        <FileDown className="h-4 w-4 text-slate-600" />
        导出
        <ChevronDown className="h-4 w-4 text-slate-500" />
      </summary>
      <div className="absolute left-0 z-30 mt-2 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
        {[
          { key: 'pdf', label: '导出PDF' },
          { key: 'excel', label: '导出Excel' },
          { key: 'word', label: '导出Word' },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onExport(item.key as 'pdf' | 'excel' | 'word')}
            className="w-full rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            {item.label}
          </button>
        ))}
      </div>
    </details>
  )
}

function AdvancedSearchModal({
  open,
  onClose,
  options,
  value,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  options: {
    topicCategories: string[]
    businessCategories: string[]
    sourceLevels: string[]
  }
  value: AdvancedSearchState
  onSubmit: (next: AdvancedSearchState) => void
}) {
  const [draft, setDraft] = useState<AdvancedSearchState>(value)

  useEffect(() => {
    if (open) setDraft(value)
  }, [open, value])

  const setKeyword = (key: keyof Pick<AdvancedSearchState, 'fullText' | 'title' | 'no'>, next: Partial<AdvancedKeyword>) => {
    setDraft((prev) => ({ ...prev, [key]: { ...prev[key], ...next } }))
  }

  const footer = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        onClick={() => {
          const reset: AdvancedSearchState = {
            fullText: { mode: 'include', value: '' },
            title: { mode: 'include', value: '' },
            no: { mode: 'include', value: '' },
            publishFrom: '',
            publishTo: '',
            effectiveFrom: '',
            effectiveTo: '',
            topicCategories: [],
            businessCategories: [],
            sourceLevels: [],
            timeliness: [],
            efficacyLevels: [],
          }
          setDraft(reset)
        }}
        className="rounded border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
      >
        重置
      </button>
      <button
        type="button"
        onClick={() => {
          const name = window.prompt('保存搜索条件名称')
          if (!name) return
          const listRaw = localStorage.getItem('aml-saved-search') ?? '[]'
          const list = JSON.parse(listRaw) as Array<{ name: string; value: AdvancedSearchState }>
          const next = [...list.filter((item) => item.name !== name), { name, value: draft }]
          localStorage.setItem('aml-saved-search', JSON.stringify(next))
        }}
        className="rounded border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
      >
        保存搜索条件
      </button>
      <button type="button" onClick={onClose} className="rounded border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
        取消
      </button>
      <button
        type="button"
        onClick={() => {
          onSubmit(draft)
          onClose()
        }}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        搜索
      </button>
    </div>
  )

  return (
    <Modal open={open} title="高级搜索" onClose={onClose} footer={footer}>
      <div className="space-y-5">
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-800">关键词搜索</p>
          {([
            { key: 'fullText', label: '全文' },
            { key: 'title', label: '标题' },
            { key: 'no', label: '编号' },
          ] as const).map((row) => (
            <div key={row.key} className="grid grid-cols-1 gap-2 md:grid-cols-12">
              <span className="md:col-span-2 text-sm text-slate-600">{row.label}</span>
              <select
                value={draft[row.key].mode}
                onChange={(e) => setKeyword(row.key, { mode: e.target.value as KeywordMode })}
                className="md:col-span-3 rounded border border-slate-200 bg-white px-2 py-2 text-sm"
              >
                <option value="include">包含</option>
                <option value="exclude">不包含</option>
              </select>
              <input
                value={draft[row.key].value}
                onChange={(e) => setKeyword(row.key, { value: e.target.value })}
                placeholder={`输入${row.label}关键词`}
                className="md:col-span-7 rounded border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-800">生效日期范围</p>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={draft.effectiveFrom}
                onChange={(e) => setDraft((prev) => ({ ...prev, effectiveFrom: e.target.value }))}
                className="rounded border border-slate-200 px-2 py-2 text-sm"
              />
              <input
                type="date"
                value={draft.effectiveTo}
                onChange={(e) => setDraft((prev) => ({ ...prev, effectiveTo: e.target.value }))}
                className="rounded border border-slate-200 px-2 py-2 text-sm"
              />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-800">发布日期范围</p>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={draft.publishFrom}
                onChange={(e) => setDraft((prev) => ({ ...prev, publishFrom: e.target.value }))}
                className="rounded border border-slate-200 px-2 py-2 text-sm"
              />
              <input
                type="date"
                value={draft.publishTo}
                onChange={(e) => setDraft((prev) => ({ ...prev, publishTo: e.target.value }))}
                className="rounded border border-slate-200 px-2 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-800">主题分类（多选）</p>
            <div className="flex flex-wrap gap-2">
              {options.topicCategories.map((item, idx) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, topicCategories: toggleInArray(prev.topicCategories, item) }))}
                  className={`rounded-full px-3 py-1 text-xs ${
                    draft.topicCategories.includes(item)
                      ? 'bg-blue-600 text-white'
                      : TOPIC_CLASS_POOL[idx % TOPIC_CLASS_POOL.length]
                  }`}
                >
                  {item}
                </button>
              ))}
              {options.topicCategories.length === 0 ? <span className="text-sm text-slate-500">—</span> : null}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-800">业务分类（多选）</p>
            <div className="max-h-40 space-y-2 overflow-auto rounded border border-slate-200 bg-white p-2">
              {options.businessCategories.length === 0 ? <span className="text-sm text-slate-500">—</span> : null}
              {options.businessCategories.map((item) => (
                <label key={item} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={draft.businessCategories.includes(item)}
                    onChange={() => setDraft((prev) => ({ ...prev, businessCategories: toggleInArray(prev.businessCategories, item) }))}
                  />
                  <span className="truncate">{item}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-800">来源层级（多选）</p>
            <div className="space-y-2 rounded border border-slate-200 bg-white p-2">
              {options.sourceLevels.map((item) => (
                <label key={item} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={draft.sourceLevels.includes(item)}
                    onChange={() => setDraft((prev) => ({ ...prev, sourceLevels: toggleInArray(prev.sourceLevels, item) }))}
                  />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-800">时效性</p>
            <div className="grid grid-cols-2 gap-2 rounded border border-slate-200 bg-white p-2">
              {TIMELINESS_OPTIONS.map((item) => (
                <label key={item} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={draft.timeliness.includes(item)}
                    onChange={() => setDraft((prev) => ({ ...prev, timeliness: toggleInArray(prev.timeliness, item) }))}
                  />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-800">效力级别</p>
            <div className="grid grid-cols-2 gap-2 rounded border border-slate-200 bg-white p-2">
              {EFFICACY_OPTIONS.map((item) => (
                <label key={item} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={draft.efficacyLevels.includes(item)}
                    onChange={() => setDraft((prev) => ({ ...prev, efficacyLevels: toggleInArray(prev.efficacyLevels, item) }))}
                  />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function ImportModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState('')
  const [autoTitle, setAutoTitle] = useState('')
  const [autoDate, setAutoDate] = useState('')
  const [category, setCategory] = useState('')
  const [department, setDepartment] = useState('')
  const [status, setStatus] = useState('现行有效')

  useEffect(() => {
    if (!open) return
    setDragOver(false)
    setFileName('')
    setAutoTitle('')
    setAutoDate('')
    setCategory('')
    setDepartment('')
    setStatus('现行有效')
  }, [open])

  const accept = '.docx,.pdf,.xlsx'

  const applyFile = (file: File) => {
    setFileName(file.name)
    const base = file.name.replace(/\.[^/.]+$/, '')
    setAutoTitle(base)
    setAutoDate(new Date().toISOString().slice(0, 10))
  }

  const footer = (
    <div className="flex items-center justify-end gap-2">
      <button type="button" onClick={onClose} className="rounded border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
        取消
      </button>
      <button
        type="button"
        onClick={() => {
          window.alert('导入已接收（Mock）：后续接入后端/Notion 写入后生效')
          onClose()
        }}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        导入
      </button>
    </div>
  )

  return (
    <Modal open={open} title="导入文档" onClose={onClose} footer={footer}>
      <div className="space-y-4">
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') fileInputRef.current?.click()
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            const file = e.dataTransfer.files?.[0]
            if (file) applyFile(file)
          }}
          className={`rounded-xl border-2 border-dashed p-6 text-center ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-slate-50'}`}
        >
          <FileUp className="mx-auto h-8 w-8 text-slate-500" />
          <p className="mt-2 text-sm font-medium text-slate-800">拖拽文件到此处，或点击选择文件</p>
          <p className="mt-1 text-xs text-slate-500">支持 .docx / .pdf / .xlsx</p>
          {fileName ? <p className="mt-3 text-sm text-slate-700">已选择：{fileName}</p> : null}
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) applyFile(file)
            }}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">自动识别标题</span>
            <input value={autoTitle} onChange={(e) => setAutoTitle(e.target.value)} className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">自动识别日期</span>
            <input type="date" value={autoDate} onChange={(e) => setAutoDate(e.target.value)} className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">分类</span>
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="如：法律法规/监管文件/内控制度" className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">部门</span>
            <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="如：合规部/运营部" className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-sm font-medium text-slate-700">状态</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm">
              {TIMELINESS_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </Modal>
  )
}

export function PolicyModule() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<LibraryTab>('documents')

  const [openGroup, setOpenGroup] = useState<Record<string, boolean>>({
    efficacy: true,
    timeliness: true,
    dept: true,
    publish: true,
    topic: true,
  })

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [favorites, setFavorites] = useState<string[]>([])
  const [keyword, setKeyword] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('relevance')

  const [filterEfficacy, setFilterEfficacy] = useState<string[]>([])
  const [filterTimeliness, setFilterTimeliness] = useState<string[]>([])
  const [filterDepartments, setFilterDepartments] = useState<string[]>([])
  const [filterPublishPreset, setFilterPublishPreset] = useState<'近1个月' | '近1年' | '近1-3年' | '近3年以上' | '不限'>('不限')
  const [filterTopics, setFilterTopics] = useState<string[]>([])

  const [advanced, setAdvanced] = useState<AdvancedSearchState>({
    fullText: { mode: 'include', value: '' },
    title: { mode: 'include', value: '' },
    no: { mode: 'include', value: '' },
    publishFrom: '',
    publishTo: '',
    effectiveFrom: '',
    effectiveTo: '',
    topicCategories: [],
    businessCategories: [],
    sourceLevels: [],
    timeliness: [],
    efficacyLevels: [],
  })

  const [importOpen, setImportOpen] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const [allRows, setAllRows] = useState<NotionDocumentRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: processData, loading: processLoading, error: processError } =
    useAMLData<ProcessLibraryItem[]>('policyProcess', 'query')
  const processes = processData ?? []
  const [expandedProcessId, setExpandedProcessId] = useState<string | null>(null)

  useEffect(() => {
    if (tab !== 'documents') return
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const result = await queryDatabase('documents')
        setAllRows(result.map((item) => item as unknown as NotionDocumentRow))
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    }
    void run()
  }, [tab])

  useEffect(() => {
    if (tab !== 'documents') return
    setSelectedIds([])
  }, [tab, keyword, filterDepartments, filterEfficacy, filterPublishPreset, filterTimeliness, filterTopics])

  const optionTopics = useMemo(() => {
    const stats = new Map<string, number>()
    allRows.forEach((row) => getTopics(row).forEach((t) => stats.set(t, (stats.get(t) ?? 0) + 1)))
    return Array.from(stats.entries()).sort((a, b) => b[1] - a[1]).map(([t]) => t)
  }, [allRows])

  const optionBusinessCategories = useMemo(() => {
    const stats = new Map<string, number>()
    allRows.forEach((row) => normalizeTextList(row.业务分类 ?? row.文档类型 ?? row.类型).forEach((t) => stats.set(t, (stats.get(t) ?? 0) + 1)))
    return Array.from(stats.entries()).sort((a, b) => b[1] - a[1]).map(([t]) => t)
  }, [allRows])

  const statsEfficacy = useMemo(() => {
    const map = new Map<string, number>()
    allRows.forEach((row) => {
      const lv = detectSourceLevel(row)
      map.set(lv, (map.get(lv) ?? 0) + 1)
    })
    return map
  }, [allRows])

  const statsTimeliness = useMemo(() => {
    const map = new Map<string, number>()
    allRows.forEach((row) => {
      const label = normalizeTimeliness(String(row.状态 ?? ''))
      map.set(label, (map.get(label) ?? 0) + 1)
    })
    return map
  }, [allRows])

  const statsDepartments = useMemo(() => {
    const map = new Map<string, number>()
    allRows.forEach((row) => {
      const dept = getDepartment(row)
      if (!dept) return
      map.set(dept, (map.get(dept) ?? 0) + 1)
    })
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [allRows])

  const applyKeywordRule = (text: string, rule: AdvancedKeyword): boolean => {
    const v = rule.value.trim().toLowerCase()
    if (!v) return true
    const inText = text.toLowerCase().includes(v)
    return rule.mode === 'include' ? inText : !inText
  }

  const matchDateRange = (raw: string, from: string, to: string): boolean => {
    if (!from && !to) return true
    const value = parseDate(raw)
    if (value == null) return false
    const fromValue = from ? parseDate(from) : null
    const toValue = to ? parseDate(to) : null
    if (fromValue != null && value < fromValue) return false
    if (toValue != null && value > toValue + 24 * 60 * 60 * 1000 - 1) return false
    return true
  }

  const filteredRows = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    const now = Date.now()
    const monthMs = 30 * 24 * 60 * 60 * 1000
    const yearMs = 365 * 24 * 60 * 60 * 1000

    return allRows.filter((row) => {
      const title = getTitle(row)
      const summary = getSummary(row)
      const keyPoints = getKeyPoints(row)
      const dept = getDepartment(row)
      const docNo = getDocNo(row)
      const publish = getPublishDate(row)
      const effective = getEffectiveDate(row)

      const efficacyLevel = detectSourceLevel(row)
      const timeliness = normalizeTimeliness(String(row.状态 ?? ''))
      const topics = getTopics(row)
      const business = normalizeTextList(row.业务分类 ?? row.文档类型 ?? row.类型)

      if (filterEfficacy.length > 0 && !filterEfficacy.includes(efficacyLevel)) return false
      if (filterTimeliness.length > 0 && !filterTimeliness.includes(timeliness)) return false
      if (filterDepartments.length > 0 && !filterDepartments.includes(dept)) return false
      if (filterTopics.length > 0 && !filterTopics.some((t) => topics.includes(t))) return false

      if (filterPublishPreset !== '不限') {
        const v = parseDate(publish)
        if (v == null) return false
        if (filterPublishPreset === '近1个月' && now - v > monthMs) return false
        if (filterPublishPreset === '近1年' && now - v > yearMs) return false
        if (filterPublishPreset === '近1-3年' && (now - v <= yearMs || now - v > 3 * yearMs)) return false
        if (filterPublishPreset === '近3年以上' && now - v <= 3 * yearMs) return false
      }

      if (kw) {
        const combined = `${title} ${summary} ${keyPoints}`.toLowerCase()
        if (!combined.includes(kw)) return false
      }

      const fullText = `${title} ${summary} ${keyPoints} ${dept} ${docNo}`.trim()
      if (!applyKeywordRule(fullText, advanced.fullText)) return false
      if (!applyKeywordRule(title, advanced.title)) return false
      if (!applyKeywordRule(docNo, advanced.no)) return false

      if (!matchDateRange(effective, advanced.effectiveFrom, advanced.effectiveTo)) return false
      if (!matchDateRange(publish, advanced.publishFrom, advanced.publishTo)) return false

      if (advanced.topicCategories.length > 0 && !advanced.topicCategories.some((t) => topics.includes(t))) return false
      if (advanced.businessCategories.length > 0 && !advanced.businessCategories.some((t) => business.includes(t))) return false
      if (advanced.sourceLevels.length > 0 && !advanced.sourceLevels.includes(efficacyLevel)) return false
      if (advanced.timeliness.length > 0 && !advanced.timeliness.includes(timeliness)) return false
      if (advanced.efficacyLevels.length > 0 && !advanced.efficacyLevels.includes(efficacyLevel)) return false

      return true
    })
  }, [
    advanced,
    allRows,
    filterDepartments,
    filterEfficacy,
    filterPublishPreset,
    filterTimeliness,
    filterTopics,
    keyword,
  ])

  const sortedRows = useMemo(() => {
    const kw = keyword.trim().toLowerCase()

    const relevanceScore = (row: NotionDocumentRow): number => {
      if (!kw) return 0
      const title = getTitle(row).toLowerCase()
      const summary = getSummary(row).toLowerCase()
      const keyPoints = getKeyPoints(row).toLowerCase()
      const score = (title.includes(kw) ? 3 : 0) + (summary.includes(kw) ? 2 : 0) + (keyPoints.includes(kw) ? 1 : 0)
      return score
    }

    return [...filteredRows].sort((a, b) => {
      if (sortKey === 'relevance') {
        const diff = relevanceScore(b) - relevanceScore(a)
        if (diff !== 0) return diff
      }

      if (sortKey === 'effectiveDate') {
        const aD = parseDate(getEffectiveDate(a)) ?? 0
        const bD = parseDate(getEffectiveDate(b)) ?? 0
        if (bD !== aD) return bD - aD
      }

      const aP = parseDate(getPublishDate(a)) ?? 0
      const bP = parseDate(getPublishDate(b)) ?? 0
      return bP - aP
    })
  }, [filteredRows, keyword, sortKey])

  const headerStats = useMemo(() => {
    const active = allRows.filter((row) => normalizeTimeliness(String(row.状态 ?? '')) === '现行有效').length
    const expired = allRows.filter((row) => normalizeTimeliness(String(row.状态 ?? '')) === '已废止').length
    const draft = allRows.filter((row) => normalizeTimeliness(String(row.状态 ?? '')) === '草案').length
    return { active, expired, draft }
  }, [allRows])

  const toggleAllVisible = () => {
    const visibleIds = sortedRows.map((row) => row.id)
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id))
    setSelectedIds(allSelected ? selectedIds.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...selectedIds, ...visibleIds])))
  }

  const handleBatchFavorite = () => {
    if (selectedIds.length === 0) return
    setFavorites((prev) => Array.from(new Set([...prev, ...selectedIds])))
  }

  const handleExport = (type: 'pdf' | 'excel' | 'word') => {
    window.alert(`Mock：${type.toUpperCase()} 导出`)
  }

  const toolBar = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setImportOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          <FileUp className="h-4 w-4 text-slate-600" />
          导入
        </button>

        <ExportMenu onExport={handleExport} />

        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          <Printer className="h-4 w-4 text-slate-600" />
          打印
        </button>

        <button
          type="button"
          onClick={handleBatchFavorite}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
            selectedIds.length === 0
              ? 'border-slate-200 bg-slate-50 text-slate-400'
              : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100/50'
          }`}
          disabled={selectedIds.length === 0}
        >
          <Star className="h-4 w-4" />
          批量收藏
        </button>
      </div>

      <button
        type="button"
        onClick={() => setAdvancedOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 hover:bg-blue-100/60"
      >
        <Search className="h-4 w-4" />
        高级搜索
      </button>
    </div>
  )

  const processColumns: Array<TableColumn<ProcessLibraryItem>> = [
    { key: 'processCode', title: '流程编号' },
    { key: 'processName', title: '流程名称' },
    { key: 'businessDomain', title: '业务域' },
    { key: 'version', title: '版本' },
    { key: 'status', title: '状态', render: (_, row) => <StatusBadge status={row.status} /> },
    {
      key: 'id',
      title: '操作',
      render: (_, row) => (
        <button
          type="button"
          onClick={() => setExpandedProcessId((prev) => (prev === row.id ? null : row.id))}
          className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700"
        >
          {expandedProcessId === row.id ? '收起步骤' : '查看步骤'}
        </button>
      ),
    },
  ]

  const totalVisible = sortedRows.length

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">文件库</h2>
          <p className="mt-1 text-sm text-slate-600">
            {tab === 'documents'
              ? `制度与流程 · 共 ${allRows.length} 条（现行 ${headerStats.active} / 废止 ${headerStats.expired} / 草案 ${headerStats.draft}）`
              : tab === 'process'
                ? `流程库 · 共 ${processes.length} 条`
                : '流程图示'}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
          <ExternalLink className="h-3 w-3" />
          来自 Notion
        </span>
      </div>

      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
        {([
          { key: 'documents', label: '制度与流程' },
          { key: 'process', label: '流程库' },
          { key: 'diagram', label: '流程图示' },
        ] as const).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`rounded px-3 py-1.5 text-sm ${
              tab === item.key ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'documents' ? (
        <section className="space-y-3">
          {toolBar}

          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-[280px] flex-1 items-center rounded-lg border border-slate-200 bg-slate-50 px-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="搜索制度标题、摘要、关键要点..."
                  className="w-full border-none bg-transparent px-2 py-2 text-sm outline-none"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <details className="relative">
                  <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                    <ArrowDownUp className="h-4 w-4 text-slate-600" />
                    {sortKey === 'relevance' ? '按相关度' : sortKey === 'effectiveDate' ? '按生效日期' : '按发布日期'}
                    <ChevronDown className="h-4 w-4 text-slate-500" />
                  </summary>
                  <div className="absolute right-0 z-30 mt-2 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                    {([
                      { key: 'relevance', label: '按相关度' },
                      { key: 'publishDate', label: '按发布日期' },
                      { key: 'effectiveDate', label: '按生效日期' },
                    ] as const).map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setSortKey(item.key)}
                        className={`w-full rounded px-3 py-2 text-left text-sm ${
                          sortKey === item.key ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </details>

                <button
                  type="button"
                  onClick={() => {
                    setFilterEfficacy([])
                    setFilterTimeliness([])
                    setFilterDepartments([])
                    setFilterPublishPreset('不限')
                    setFilterTopics([])
                    setAdvanced({
                      fullText: { mode: 'include', value: '' },
                      title: { mode: 'include', value: '' },
                      no: { mode: 'include', value: '' },
                      publishFrom: '',
                      publishTo: '',
                      effectiveFrom: '',
                      effectiveTo: '',
                      topicCategories: [],
                      businessCategories: [],
                      sourceLevels: [],
                      timeliness: [],
                      efficacyLevels: [],
                    })
                    setKeyword('')
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  重置
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
            <aside className="lg:col-span-3 space-y-3">
              <FilterGroup
                title="效力层级"
                open={openGroup.efficacy}
                onToggle={() => setOpenGroup((prev) => ({ ...prev, efficacy: !prev.efficacy }))}
              >
                <div className="space-y-1">
                  {['监管层', '总公司层', '分公司层', '其他'].map((lv) => (
                    <button
                      key={lv}
                      type="button"
                      onClick={() => setFilterEfficacy((prev) => toggleInArray(prev, lv))}
                      className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-sm ${
                        filterEfficacy.includes(lv) ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>{lv}</span>
                      <span className="text-xs text-slate-500">{statsEfficacy.get(lv) ?? 0}</span>
                    </button>
                  ))}
                </div>
              </FilterGroup>

              <FilterGroup
                title="时效性"
                open={openGroup.timeliness}
                onToggle={() => setOpenGroup((prev) => ({ ...prev, timeliness: !prev.timeliness }))}
              >
                <div className="space-y-1">
                  {TIMELINESS_OPTIONS.map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setFilterTimeliness((prev) => toggleInArray(prev, label))}
                      className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-sm ${
                        filterTimeliness.includes(label) ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${timelinessToBadgeStyle(label)}`}>{label}</span>
                      <span className="text-xs text-slate-500">{statsTimeliness.get(label) ?? 0}</span>
                    </button>
                  ))}
                </div>
              </FilterGroup>

              <FilterGroup
                title="发文部门"
                open={openGroup.dept}
                onToggle={() => setOpenGroup((prev) => ({ ...prev, dept: !prev.dept }))}
              >
                <DepartmentFilter
                  items={statsDepartments}
                  values={filterDepartments}
                  onChange={setFilterDepartments}
                />
              </FilterGroup>

              <FilterGroup
                title="发布日期"
                open={openGroup.publish}
                onToggle={() => setOpenGroup((prev) => ({ ...prev, publish: !prev.publish }))}
              >
                <div className="space-y-1">
                  {(['近1个月', '近1年', '近1-3年', '近3年以上', '不限'] as const).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setFilterPublishPreset(preset)}
                      className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-sm ${
                        filterPublishPreset === preset ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>{preset}</span>
                    </button>
                  ))}
                </div>
              </FilterGroup>

              <FilterGroup
                title="主题标签"
                open={openGroup.topic}
                onToggle={() => setOpenGroup((prev) => ({ ...prev, topic: !prev.topic }))}
              >
                <div className="flex flex-wrap gap-2">
                  {optionTopics.slice(0, 24).map((topic, idx) => (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => setFilterTopics((prev) => toggleInArray(prev, topic))}
                      className={`rounded-full px-3 py-1 text-xs ${
                        filterTopics.includes(topic)
                          ? 'bg-blue-600 text-white'
                          : TOPIC_CLASS_POOL[idx % TOPIC_CLASS_POOL.length]
                      }`}
                    >
                      {topic}
                    </button>
                  ))}
                  {optionTopics.length === 0 ? <span className="text-sm text-slate-500">—</span> : null}
                </div>
              </FilterGroup>
            </aside>

            <div className="lg:col-span-9 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                <div className="flex flex-wrap items-center gap-3">
                  <span>结果：{totalVisible} 条</span>
                  {selectedIds.length > 0 ? <span>已选：{selectedIds.length} 条</span> : null}
                </div>
                <button type="button" onClick={toggleAllVisible} className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                  {totalVisible > 0 && sortedRows.every((row) => selectedIds.includes(row.id)) ? '取消全选' : '全选当前'}
                </button>
              </div>

              {loading ? <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">加载中...</div> : null}
              {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div> : null}
              {!loading && !error && sortedRows.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">暂无数据</div>
              ) : null}

              {!loading && !error && sortedRows.length > 0 ? (
                <div className="space-y-2">
                  {sortedRows.map((row) => {
                    const timeliness = normalizeTimeliness(String(row.状态 ?? ''))
                    const title = getTitle(row)
                    const docType = String(row.文档类型 ?? row.类型 ?? '').trim()
                    const dept = getDepartment(row)
                    const docNo = getDocNo(row)
                    const publish = getPublishDate(row)
                    const effective = getEffectiveDate(row)
                    const summary = getSummary(row)
                    const heat = hashHeat(row.id)

                    const checked = selectedIds.includes(row.id)
                    const favored = favorites.includes(row.id)

                    return (
                      <article key={row.id} className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => setSelectedIds((prev) => toggleInArray(prev, row.id))}
                            className="mt-1"
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`rounded-full px-2 py-0.5 text-xs ${timelinessToBadgeStyle(timeliness)}`}>{timeliness}</span>
                                  {docType ? <span className={`rounded-full px-2 py-0.5 text-xs ${TYPE_CLASS}`}>{docType}</span> : null}
                                </div>

                                <button
                                  type="button"
                                  onClick={() => navigate(`/library/${row.id}`)}
                                  className="mt-2 inline-flex max-w-full items-center gap-2 text-left text-base font-semibold text-slate-900 hover:text-blue-700"
                                >
                                  <span className="truncate">{title || '未命名文档'}</span>
                                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                                </button>
                              </div>

                              <div className="flex shrink-0 items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => window.alert('Mock：下载')}
                                  className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
                                >
                                  <Download className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => window.print()}
                                  className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
                                >
                                  <Printer className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setFavorites((prev) => (favored ? prev.filter((id) => id !== row.id) : [...prev, row.id]))}
                                  className={`rounded-lg border p-2 ${
                                    favored ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                  }`}
                                >
                                  <Star className="h-4 w-4" />
                                </button>
                              </div>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                              {dept ? <span>{dept}</span> : null}
                              {docNo ? <span>编号：{docNo}</span> : null}
                              {publish ? <span>发布日期：{publish}</span> : null}
                              {effective ? <span>生效日期：{effective}</span> : null}
                            </div>

                            <p className="mt-2 text-sm leading-6 text-slate-700">{clampText(summary || getKeyPoints(row) || '—', 120)}</p>

                            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                <span>查阅热度</span>
                                <ProgressBar value={heat} />
                                <span>{heat}%</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                <span className="inline-flex items-center gap-1">
                                  <ArrowUpRight className="h-3 w-3" />
                                  来源：{detectSourceLevel(row)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {tab === 'process' ? (
        <section className="space-y-3">
          <DataTable
            columns={processColumns}
            data={processes}
            rowKey={(row) => row.id}
            loading={processLoading}
            error={processError}
          />
          {expandedProcessId ? (
            <article className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-900">步骤时间轴</h3>
              <div className="mt-3 space-y-2">
                {(processes.find((item) => item.id === expandedProcessId)?.steps ?? []).map((step) => (
                  <div key={step.id} className="flex gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
                      {step.index}
                    </div>
                    <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                      <p className="font-medium">{step.name}</p>
                      <p>触发条件：{step.triggerCondition}</p>
                      <p>责任岗位：{step.ownerRole}</p>
                      <p>时效要求：{step.sla}</p>
                      <p>留痕要求：{step.evidenceRequirement}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ) : null}
        </section>
      ) : null}

      {tab === 'diagram' ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
          流程图示功能建设中
        </div>
      ) : null}

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />

      <AdvancedSearchModal
        open={advancedOpen}
        onClose={() => setAdvancedOpen(false)}
        options={{
          topicCategories: optionTopics.slice(0, 40),
          businessCategories: optionBusinessCategories.slice(0, 60),
          sourceLevels: ['监管层', '总公司层', '分公司层', '其他'],
        }}
        value={advanced}
        onSubmit={(next) => {
          setAdvanced(next)
          setFilterTopics(next.topicCategories)
          setFilterEfficacy(next.sourceLevels.length > 0 ? next.sourceLevels : next.efficacyLevels)
          setFilterTimeliness(next.timeliness)
        }}
      />
    </section>
  )
}

function DepartmentFilter({
  items,
  values,
  onChange,
}: {
  items: Array<[string, number]>
  values: string[]
  onChange: (next: string[]) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? items : items.slice(0, 5)

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        {visible.map(([dept, count]) => (
          <button
            key={dept}
            type="button"
            onClick={() => onChange(toggleInArray(values, dept))}
            className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-sm ${
              values.includes(dept) ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span className="truncate">{dept}</span>
            <span className="text-xs text-slate-500">{count}</span>
          </button>
        ))}
      </div>
      {items.length > 5 ? (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="w-full rounded bg-slate-100 px-2 py-1.5 text-xs text-slate-700"
        >
          {expanded ? '收起' : '查看更多'}
        </button>
      ) : null}
    </div>
  )
}
