import {
  ArrowDownUp,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Search,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { queryDatabase } from '../../api/notion'
import { useAMLData } from '../../hooks/useAMLData'
import type { ProcessLibraryItem } from '../../types'
import { DataTable, type TableColumn } from '../shared/DataTable'
import { StatusBadge } from '../shared/StatusBadge'

type LibraryTab = 'documents' | 'process' | 'diagram'

type DocumentStatus = '有效' | '拟稿草案' | '已废止' | '仅参考' | string

type NotionDocumentRow = {
  id: string
  标题?: string
  Name?: string
  类型?: string
  状态?: DocumentStatus
  文档类型?: string
  反洗钱识别标签?: string
  适用范围?: string
  来源?: string
  '生效/发布日期'?: string
  摘要?: string
  '关键要点/适用情景'?: string
  主题标签?: string[] | string
  到期日期?: string
  失效日期?: string
}

type SortKey = 'date' | 'expiry' | 'source'

const STATUS_CLASS: Record<string, string> = {
  有效: 'bg-emerald-100 text-emerald-700',
  拟稿: 'bg-blue-100 text-blue-700',
  拟稿草案: 'bg-blue-100 text-blue-700',
  已废止: 'bg-slate-100 text-slate-700',
  仅参考: 'bg-yellow-100 text-yellow-800',
}

const TYPE_CLASS = 'bg-slate-100 text-slate-700'

const SOURCE_LEVEL_LINE_CLASS: Record<string, string> = {
  监管层: 'bg-red-500',
  总公司层: 'bg-blue-500',
  分公司层: 'bg-emerald-500',
  其他: 'bg-slate-300',
}

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

function toDateValue(value: string): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

function getExpiryDays(row: NotionDocumentRow): number | null {
  const dateRaw = String(row.到期日期 ?? row.失效日期 ?? '')
  const dateValue = toDateValue(dateRaw)
  if (dateValue == null) return null
  const diff = dateValue - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function detectSourceLevel(source: string): string {
  const value = source.trim()
  if (!value) return '其他'
  if (value.includes('监管') || value.includes('人民银行') || value.includes('银保监') || value.includes('证监')) return '监管层'
  if (value.includes('总公司') || value.includes('总行') || value.includes('总部')) return '总公司层'
  if (value.includes('分公司') || value.includes('支行') || value.includes('营业部')) return '分公司层'
  return '其他'
}

function toggleInArray<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((item) => item !== value) : [...arr, value]
}

function MultiSelect({
  label,
  options,
  values,
  onChange,
}: {
  label: string
  options: string[]
  values: string[]
  onChange: (next: string[]) => void
}) {
  const selectedCount = values.length

  return (
    <details className="relative">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
        <span className="truncate">{label}</span>
        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
          {selectedCount > 0 ? `${selectedCount}项` : '全部'}
          <ChevronDown className="h-4 w-4" />
        </span>
      </summary>
      <div className="absolute left-0 z-20 mt-2 w-[260px] rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
        <div className="max-h-64 overflow-auto">
          {options.length === 0 ? (
            <div className="px-2 py-2 text-sm text-slate-500">暂无可选项</div>
          ) : (
            options.map((option) => (
              <label key={option} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={values.includes(option)}
                  onChange={() => onChange(toggleInArray(values, option))}
                />
                <span className="min-w-0 flex-1 truncate text-slate-700">{option}</span>
              </label>
            ))
          )}
        </div>
        {values.length > 0 ? (
          <button type="button" onClick={() => onChange([])} className="mt-2 w-full rounded bg-slate-100 px-2 py-1.5 text-xs text-slate-700">
            清空 {label}
          </button>
        ) : null}
      </div>
    </details>
  )
}

export function PolicyModule() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<LibraryTab>('documents')

  const [typeValues, setTypeValues] = useState<string[]>([])
  const [statusValues, setStatusValues] = useState<string[]>([])
  const [docTypeValues, setDocTypeValues] = useState<string[]>([])
  const [scopeValues, setScopeValues] = useState<string[]>([])
  const [topicValues, setTopicValues] = useState<string[]>([])
  const [sourceLevelValues, setSourceLevelValues] = useState<string[]>([])
  const [expiringOnly, setExpiringOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('date')

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

  const typeOptions = useMemo(
    () => Array.from(new Set(allRows.map((r) => String(r.类型 ?? '')).filter(Boolean))).sort(),
    [allRows],
  )
  const statusOptions = useMemo(
    () => Array.from(new Set(allRows.map((r) => String(r.状态 ?? '')).filter(Boolean))).sort(),
    [allRows],
  )
  const docTypeOptions = useMemo(
    () => Array.from(new Set(allRows.map((r) => String(r.文档类型 ?? '')).filter(Boolean))).sort(),
    [allRows],
  )
  const sourceLevelOptions = useMemo(() => ['监管层', '总公司层', '分公司层', '其他'], [])

  const selectedTags = useMemo(() => {
    const tags: Array<{ key: string; label: string; onRemove: () => void }> = []
    if (search.trim()) tags.push({ key: 'search', label: `搜索：${search.trim()}`, onRemove: () => setSearch('') })
    typeValues.forEach((v) =>
      tags.push({ key: `type-${v}`, label: `类型：${v}`, onRemove: () => setTypeValues((prev) => prev.filter((x) => x !== v)) }),
    )
    statusValues.forEach((v) =>
      tags.push({
        key: `status-${v}`,
        label: `状态：${v}`,
        onRemove: () => setStatusValues((prev) => prev.filter((x) => x !== v)),
      }),
    )
    docTypeValues.forEach((v) =>
      tags.push({
        key: `docType-${v}`,
        label: `文档类型：${v}`,
        onRemove: () => setDocTypeValues((prev) => prev.filter((x) => x !== v)),
      }),
    )
    sourceLevelValues.forEach((v) =>
      tags.push({
        key: `sourceLevel-${v}`,
        label: `来源层级：${v}`,
        onRemove: () => setSourceLevelValues((prev) => prev.filter((x) => x !== v)),
      }),
    )
    scopeValues.forEach((v) =>
      tags.push({
        key: `scope-${v}`,
        label: `适用范围：${v}`,
        onRemove: () => setScopeValues((prev) => prev.filter((x) => x !== v)),
      }),
    )
    topicValues.forEach((v) =>
      tags.push({
        key: `topic-${v}`,
        label: `主题：${v}`,
        onRemove: () => setTopicValues((prev) => prev.filter((x) => x !== v)),
      }),
    )
    if (expiringOnly) tags.push({ key: 'expiring', label: '即将到期≤30天', onRemove: () => setExpiringOnly(false) })
    return tags
  }, [docTypeValues, expiringOnly, scopeValues, search, sourceLevelValues, statusValues, topicValues, typeValues])

  const clearAllFilters = () => {
    setTypeValues([])
    setStatusValues([])
    setDocTypeValues([])
    setScopeValues([])
    setTopicValues([])
    setSourceLevelValues([])
    setExpiringOnly(false)
    setSearch('')
  }

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return allRows.filter((row) => {
      const type = String(row.类型 ?? '')
      const status = String(row.状态 ?? '')
      const docType = String(row.文档类型 ?? '')
      const scopeList = normalizeTextList(row.适用范围)
      const topicList = normalizeTextList(row.主题标签)
      const sourceLevel = detectSourceLevel(String(row.来源 ?? ''))

      if (typeValues.length > 0 && !typeValues.includes(type)) return false
      if (statusValues.length > 0 && !statusValues.includes(status)) return false
      if (docTypeValues.length > 0 && !docTypeValues.includes(docType)) return false
      if (scopeValues.length > 0 && !scopeValues.some((v) => scopeList.includes(v))) return false
      if (topicValues.length > 0 && !topicValues.some((v) => topicList.includes(v))) return false
      if (sourceLevelValues.length > 0 && !sourceLevelValues.includes(sourceLevel)) return false

      if (expiringOnly) {
        const days = getExpiryDays(row)
        if (days == null || days < 0 || days > 30) return false
      }

      if (keyword) {
        const title = String(row.标题 ?? row.Name ?? '')
        const summary = String(row.摘要 ?? '')
        const keyPoints = String(row['关键要点/适用情景'] ?? '')
        if (![title, summary, keyPoints].join(' ').toLowerCase().includes(keyword)) return false
      }

      return true
    })
  }, [allRows, docTypeValues, expiringOnly, scopeValues, search, sourceLevelValues, statusValues, topicValues, typeValues])

  const sortedRows = useMemo(() => {
    const sourceOrder: Record<string, number> = { 监管层: 0, 总公司层: 1, 分公司层: 2, 其他: 3 }

    return [...filteredRows].sort((a, b) => {
      if (sortKey === 'source') {
        const diff = sourceOrder[detectSourceLevel(String(a.来源 ?? ''))] - sourceOrder[detectSourceLevel(String(b.来源 ?? ''))]
        if (diff !== 0) return diff
      }

      if (sortKey === 'expiry') {
        const aDays = getExpiryDays(a)
        const bDays = getExpiryDays(b)
        if (aDays == null && bDays == null) return 0
        if (aDays == null) return 1
        if (bDays == null) return -1
        if (aDays !== bDays) return aDays - bDays
      }

      const aDate = toDateValue(String(a['生效/发布日期'] ?? '')) ?? 0
      const bDate = toDateValue(String(b['生效/发布日期'] ?? '')) ?? 0
      return bDate - aDate
    })
  }, [filteredRows, sortKey])

  const activeCount = useMemo(() => allRows.filter((row) => String(row.状态 ?? '') === '有效').length, [allRows])
  const draftCount = useMemo(() => allRows.filter((row) => String(row.状态 ?? '').includes('拟稿')).length, [allRows])
  const expiringCount = useMemo(
    () =>
      allRows.filter((row) => {
        const days = getExpiryDays(row)
        return days != null && days >= 0 && days <= 30
      }).length,
    [allRows],
  )

  const sourceLevelStats = useMemo(() => {
    const stats: Record<string, number> = { 监管层: 0, 总公司层: 0, 分公司层: 0, 其他: 0 }
    allRows.forEach((row) => {
      const level = detectSourceLevel(String(row.来源 ?? ''))
      stats[level] = (stats[level] ?? 0) + 1
    })
    return stats
  }, [allRows])

  const scopeStats = useMemo(() => {
    const stats = new Map<string, number>()
    allRows.forEach((row) => {
      normalizeTextList(row.适用范围).forEach((scope) => stats.set(scope, (stats.get(scope) ?? 0) + 1))
    })
    return Array.from(stats.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [allRows])

  const topicStats = useMemo(() => {
    const stats = new Map<string, number>()
    allRows.forEach((row) => {
      normalizeTextList(row.主题标签).forEach((topic) => stats.set(topic, (stats.get(topic) ?? 0) + 1))
    })
    return Array.from(stats.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10)
  }, [allRows])

  const statusStats = useMemo(() => {
    const stats = new Map<string, number>()
    allRows.forEach((row) => {
      const status = String(row.状态 ?? '')
      if (!status) return
      stats.set(status, (stats.get(status) ?? 0) + 1)
    })
    return Array.from(stats.entries()).sort((a, b) => b[1] - a[1])
  }, [allRows])

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

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">文件库</h2>
          <p className="mt-1 text-sm text-slate-600">
            {tab === 'documents' ? `制度与流程 · 共 ${allRows.length} 条` : tab === 'process' ? `流程库 · 共 ${processes.length} 条` : '流程图示'}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
          <ExternalLink className="h-3 w-3" />
          来自 Notion
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => {
            setTab('documents')
            setStatusValues([])
            setExpiringOnly(false)
          }}
          className="rounded-lg border border-slate-200 bg-white p-4 text-left hover:bg-slate-50"
        >
          <p className="text-xs text-slate-500">现行制度数</p>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-2xl font-semibold text-slate-900">{activeCount}</p>
            <span className="inline-flex items-center gap-1 text-sm text-emerald-700">
              <ArrowUpRight className="h-4 w-4" />
              可点击筛选 →
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setTab('documents')
            setExpiringOnly(true)
          }}
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-left hover:bg-red-100/40"
        >
          <p className="text-xs text-red-700">即将到期（≤30天）</p>
          <p className="mt-2 text-2xl font-semibold text-red-700">{expiringCount}</p>
          <p className="mt-2 text-sm text-red-700">点击筛选 →</p>
        </button>

        <button
          type="button"
          onClick={() => {
            setTab('documents')
            setStatusValues(['拟稿草案'])
          }}
          className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-left hover:bg-orange-100/40"
        >
          <p className="text-xs text-orange-700">待审核草稿</p>
          <p className="mt-2 text-2xl font-semibold text-orange-700">{draftCount}</p>
          <p className="mt-2 text-sm text-orange-700">点击筛选 →</p>
        </button>

        <button
          type="button"
          onClick={() => setTab('process')}
          className="rounded-lg border border-slate-200 bg-white p-4 text-left hover:bg-slate-50"
        >
          <p className="text-xs text-slate-500">流程数量</p>
          <p className="mt-2 text-2xl font-semibold text-blue-600">{processes.length}</p>
          <p className="mt-2 text-sm text-blue-700">切换至流程库 →</p>
        </button>
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
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-[280px] flex-1 items-center rounded-lg border border-slate-200 bg-slate-50 px-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="搜索标题 / 摘要 / 关键要点..."
                  className="w-full border-none bg-transparent px-2 py-2 text-sm outline-none"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <MultiSelect label="类型" options={typeOptions} values={typeValues} onChange={setTypeValues} />
                <MultiSelect label="状态" options={statusOptions} values={statusValues} onChange={setStatusValues} />
                <MultiSelect label="文档类型" options={docTypeOptions} values={docTypeValues} onChange={setDocTypeValues} />
                <details className="relative">
                  <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                    <ArrowDownUp className="h-4 w-4 text-slate-500" />
                    {sortKey === 'date' ? '按日期' : sortKey === 'expiry' ? '按到期紧迫' : '按来源层级'}
                    <ChevronDown className="h-4 w-4 text-slate-500" />
                  </summary>
                  <div className="absolute right-0 z-20 mt-2 w-48 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                    {([
                      { key: 'date', label: '按发文日期' },
                      { key: 'expiry', label: '按到期日期（紧迫优先）' },
                      { key: 'source', label: '按来源层级' },
                    ] as const).map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setSortKey(item.key)}
                        className={`w-full rounded px-2 py-2 text-left text-sm ${
                          sortKey === item.key ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </details>
                <button type="button" onClick={clearAllFilters} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  清空
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {selectedTags.length === 0 ? (
                <span className="text-xs text-slate-500">未选择筛选条件</span>
              ) : (
                selectedTags.map((tag) => (
                  <button
                    key={tag.key}
                    type="button"
                    onClick={tag.onRemove}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    {tag.label} ×
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium text-slate-600">来源层级/制定主体</p>
              <div className="mt-3 space-y-2">
                {sourceLevelOptions.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setSourceLevelValues((prev) => toggleInArray(prev, level))}
                    className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-sm ${
                      sourceLevelValues.includes(level) ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{level}</span>
                    <span className="text-xs text-slate-500">{sourceLevelStats[level] ?? 0}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium text-slate-600">适用范围</p>
              <div className="mt-3 space-y-2">
                {scopeStats.length === 0 ? <span className="text-sm text-slate-500">—</span> : null}
                {scopeStats.map(([scope, count]) => (
                  <button
                    key={scope}
                    type="button"
                    onClick={() => setScopeValues((prev) => toggleInArray(prev, scope))}
                    className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-sm ${
                      scopeValues.includes(scope) ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="truncate">{scope}</span>
                    <span className="text-xs text-slate-500">{count}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium text-slate-600">主题标签</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {topicStats.length === 0 ? <span className="text-sm text-slate-500">—</span> : null}
                {topicStats.map(([topic, count], idx) => (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => setTopicValues((prev) => toggleInArray(prev, topic))}
                    className={`rounded-full px-3 py-1 text-xs ${
                      topicValues.includes(topic)
                        ? 'bg-blue-600 text-white'
                        : TOPIC_CLASS_POOL[idx % TOPIC_CLASS_POOL.length]
                    }`}
                  >
                    {topic} · {count}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium text-slate-600">状态/有效性</p>
              <div className="mt-3 space-y-2">
                {statusStats.length === 0 ? <span className="text-sm text-slate-500">—</span> : null}
                {statusStats.map(([status, count]) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusValues((prev) => toggleInArray(prev, status))}
                    className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-sm ${
                      statusValues.includes(status) ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${STATUS_CLASS[status] ?? 'bg-slate-100 text-slate-700'}`}>
                      {status}
                    </span>
                    <span className="text-xs text-slate-500">{count}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 text-sm text-slate-600">
            <span>当前结果：{sortedRows.length} 条</span>
          </div>

          {loading ? <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">加载中...</div> : null}
          {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div> : null}
          {!loading && !error && sortedRows.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">暂无数据</div>
          ) : null}

          {!loading && !error && sortedRows.length > 0 ? (
            <div className="space-y-2">
              {sortedRows.map((row) => {
                const title = String(row.标题 ?? row.Name ?? '')
                const type = String(row.类型 ?? '')
                const status = String(row.状态 ?? '')
                const source = String(row.来源 ?? '')
                const date = String(row['生效/发布日期'] ?? '')
                const statusClass = STATUS_CLASS[status] ?? 'bg-slate-100 text-slate-700'
                const sourceLevel = detectSourceLevel(source)
                const lineClass = SOURCE_LEVEL_LINE_CLASS[sourceLevel] ?? SOURCE_LEVEL_LINE_CLASS.其他
                const expiryDays = getExpiryDays(row)
                const expiring = expiryDays != null && expiryDays >= 0 && expiryDays <= 30

                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => navigate(`/library/${row.id}`)}
                    className="relative w-full rounded-xl border border-slate-200 bg-white p-4 text-left hover:bg-slate-50"
                  >
                    <span className={`absolute left-0 top-0 h-full w-1 rounded-l-xl ${lineClass}`} />
                    <div className="pl-2">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            {type ? <span className={`rounded-full px-2 py-0.5 text-xs ${TYPE_CLASS}`}>{type}</span> : null}
                            {status ? (
                              <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass}`}>{status}</span>
                            ) : null}
                            {expiring ? (
                              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                                即将到期 {expiryDays} 天
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-base font-semibold text-slate-900">{title || '未命名文档'}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                            {source ? <span>{source}</span> : null}
                            {date ? <span>{date}</span> : null}
                          </div>
                        </div>
                        <span className="inline-flex shrink-0 items-center gap-1 text-sm text-blue-600">
                          查看全文
                          <ChevronRight className="h-4 w-4" />
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : null}
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
          流程图示功能开发中
        </div>
      ) : null}
    </section>
  )
}
