import { ChevronDown, ChevronRight, ExternalLink, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
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
  来源?: string
  '生效/发布日期'?: string
  摘要?: string
  '关键要点/适用情景'?: string
}

const STATUS_CLASS: Record<string, string> = {
  有效: 'bg-emerald-100 text-emerald-700',
  拟稿: 'bg-blue-100 text-blue-700',
  拟稿草案: 'bg-blue-100 text-blue-700',
  已废止: 'bg-slate-100 text-slate-700',
  仅参考: 'bg-yellow-100 text-yellow-800',
}

const TYPE_CLASS = 'bg-slate-100 text-slate-700'

export function PolicyModule() {
  const [tab, setTab] = useState<LibraryTab>('documents')

  const [typeFilter, setTypeFilter] = useState('全部')
  const [statusFilter, setStatusFilter] = useState('全部')
  const [docTypeFilter, setDocTypeFilter] = useState('全部')
  const [search, setSearch] = useState('')
  const [expandedIds, setExpandedIds] = useState<string[]>([])

  const [rows, setRows] = useState<NotionDocumentRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: processData, loading: processLoading, error: processError } =
    useAMLData<ProcessLibraryItem[]>('policyProcess', 'query')
  const processes = processData ?? []
  const [expandedProcessId, setExpandedProcessId] = useState<string | null>(null)

  const availableTypes = useMemo(() => Array.from(new Set(rows.map((r) => r.类型).filter(Boolean))) as string[], [rows])
  const availableStatuses = useMemo(
    () => Array.from(new Set(rows.map((r) => r.状态).filter(Boolean))) as string[],
    [rows],
  )
  const availableDocTypes = useMemo(
    () => Array.from(new Set(rows.map((r) => r.文档类型).filter(Boolean))) as string[],
    [rows],
  )

  useEffect(() => {
    if (tab !== 'documents') return

    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const and: unknown[] = []

        if (typeFilter !== '全部') {
          and.push({ property: '类型', select: { equals: typeFilter } })
        }
        if (statusFilter !== '全部') {
          and.push({ property: '状态', select: { equals: statusFilter } })
        }
        if (docTypeFilter !== '全部') {
          and.push({ property: '文档类型', select: { equals: docTypeFilter } })
        }

        const filter = and.length > 0 ? { and } : undefined
        const result = await queryDatabase('documents', filter as Record<string, unknown> | undefined)
        const mapped = result.map((item) => item as unknown as NotionDocumentRow)
        setRows(mapped)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    }

    void run()
  }, [docTypeFilter, statusFilter, tab, typeFilter])

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return rows
    return rows.filter((row) => {
      const title = String(row.标题 ?? row.Name ?? '')
      const summary = String(row.摘要 ?? '')
      const source = String(row.来源 ?? '')
      return [title, summary, source].join(' ').toLowerCase().includes(keyword)
    })
  }, [rows, search])

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

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
      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
        {([
          { key: 'documents', label: '制度与流程' },
          { key: 'process', label: '操作流程' },
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
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex min-w-[260px] flex-1 items-center rounded border border-slate-200 bg-slate-50 px-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="搜索制度/流程/任务..."
                  className="w-full border-none bg-transparent px-2 py-2 text-sm outline-none"
                />
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                <ExternalLink className="h-3 w-3" />
                来自 Notion
              </span>
            </div>

            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-16 text-xs text-slate-500">类型</span>
                <div className="relative">
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <select
                    value={typeFilter}
                    onChange={(event) => setTypeFilter(event.target.value)}
                    className="w-[240px] appearance-none rounded border border-slate-200 bg-white px-3 py-2 pr-8 text-sm"
                  >
                    <option value="全部">全部</option>
                    {availableTypes.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="w-16 text-xs text-slate-500">状态</span>
                <div className="relative">
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className="w-[240px] appearance-none rounded border border-slate-200 bg-white px-3 py-2 pr-8 text-sm"
                  >
                    <option value="全部">全部</option>
                    {availableStatuses.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="w-16 text-xs text-slate-500">文档类型</span>
                <div className="relative">
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <select
                    value={docTypeFilter}
                    onChange={(event) => setDocTypeFilter(event.target.value)}
                    className="w-[240px] appearance-none rounded border border-slate-200 bg-white px-3 py-2 pr-8 text-sm"
                  >
                    <option value="全部">全部</option>
                    {availableDocTypes.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">加载中...</div>
          ) : null}
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>
          ) : null}

          {!loading && !error && filteredRows.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">暂无数据</div>
          ) : null}

          {!loading && !error && filteredRows.length > 0 ? (
            <div className="space-y-2">
              {filteredRows.map((row) => {
                const title = String(row.标题 ?? row.Name ?? '')
                const type = String(row.类型 ?? '')
                const status = String(row.状态 ?? '')
                const source = String(row.来源 ?? '')
                const date = String(row['生效/发布日期'] ?? '')
                const summary = String(row.摘要 ?? '')
                const keyPoints = String(row['关键要点/适用情景'] ?? '')
                const expanded = expandedIds.includes(row.id)
                const statusClass = STATUS_CLASS[status] ?? 'bg-slate-100 text-slate-700'

                return (
                  <article key={row.id} className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {type ? (
                            <span className={`rounded-full px-2 py-0.5 text-xs ${TYPE_CLASS}`}>{type}</span>
                          ) : null}
                          {status ? (
                            <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass}`}>{status}</span>
                          ) : null}
                        </div>
                        <p className="mt-2 text-base font-semibold text-slate-900">{title || '未命名文档'}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                          <span>{source}</span>
                          <span>{date}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleExpanded(row.id)}
                        className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                      >
                        {expanded ? '收起' : '展开'}
                        <ChevronRight className={`h-4 w-4 transition ${expanded ? 'rotate-90' : ''}`} />
                      </button>
                    </div>

                    {expanded ? (
                      <div className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                        <div>
                          <p className="text-xs font-medium text-slate-500">摘要</p>
                          <p className="mt-1 whitespace-pre-line">{summary || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-500">关键要点 / 适用情景</p>
                          <p className="mt-1 whitespace-pre-line">{keyPoints || '—'}</p>
                        </div>
                      </div>
                    ) : null}
                  </article>
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
