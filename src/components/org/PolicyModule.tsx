import { ArrowUpRight, ChevronRight, Download, Plus, Search, Upload, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAMLData } from '../../hooks/useAMLData'
import { notionService } from '../../services/notionService'
import type { PolicyProcessItem, ProcessLibraryItem } from '../../types'
import { DataTable, type TableColumn } from '../shared/DataTable'
import { Modal } from '../shared/Modal'
import { StatusBadge } from '../shared/StatusBadge'

const ROLE_OPTIONS = ['合规岗', '客户经理岗', '风控复核岗', '交易监测岗', '评级分析岗']

interface PolicyFilterState {
  sourceLevels: Array<PolicyProcessItem['sourceLevel']>
  documentTypes: Array<PolicyProcessItem['documentType']>
  statuses: Array<'生效' | '草稿' | '即将到期' | '废止归档'>
  issueTime: '不限' | '近1年' | '近3年' | '自定义'
}

type PolicyFormState = Pick<
  PolicyProcessItem,
  | 'sourceLevel'
  | 'documentType'
  | 'documentNo'
  | 'issuingUnit'
  | 'name'
  | 'effectiveDate'
  | 'abolishedDate'
  | 'version'
  | 'ownerDepartment'
  | 'relatedRoles'
  | 'summary'
  | 'fullText'
>

const defaultFilters: PolicyFilterState = {
  sourceLevels: [],
  documentTypes: [],
  statuses: [],
  issueTime: '不限',
}

const defaultPolicyForm: PolicyFormState = {
  sourceLevel: '监管层',
  documentType: '制度',
  documentNo: '',
  issuingUnit: '',
  name: '',
  effectiveDate: '',
  abolishedDate: '',
  version: 'V1.0',
  ownerDepartment: '',
  relatedRoles: [],
  summary: '',
  fullText: '',
}

function getExpiryDays(abolishedDate?: string): number | null {
  if (!abolishedDate) return null
  const diff = new Date(abolishedDate).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function toggleInArray<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((item) => item !== value) : [...arr, value]
}

export function PolicyModule({ view }: { view: 'policy' | 'process' }) {
  const navigate = useNavigate()
  const tab = view
  const [filters, setFilters] = useState<PolicyFilterState>(defaultFilters)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'issueDate' | 'expiryDate' | 'sourceLevel' | 'name'>('issueDate')
  const [policyModalOpen, setPolicyModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [policyForm, setPolicyForm] = useState<PolicyFormState>(defaultPolicyForm)
  const [policyAttachment, setPolicyAttachment] = useState('')

  const [expandedProcessId, setExpandedProcessId] = useState<string | null>(null)

  const { data, loading, error, setData } = useAMLData<PolicyProcessItem[]>('policy', 'query')
  const { data: processData, loading: processLoading, error: processError } =
    useAMLData<ProcessLibraryItem[]>('policyProcess', 'query')

  const policies = data ?? []
  const processes = processData ?? []

  const filteredPolicies = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    const now = Date.now()
    const oneYearMs = 365 * 24 * 60 * 60 * 1000
    const threeYearMs = 3 * oneYearMs

    const rows = policies.filter((item) => {
      const sourceMatch = filters.sourceLevels.length === 0 || filters.sourceLevels.includes(item.sourceLevel)
      const typeMatch = filters.documentTypes.length === 0 || filters.documentTypes.includes(item.documentType)

      const days = getExpiryDays(item.abolishedDate)
      const statusLabel =
        days !== null && days >= 0 && days <= 30
          ? '即将到期'
          : item.status === 'active'
            ? '生效'
            : item.status === 'draft'
              ? '草稿'
              : '废止归档'
      const statusMatch = filters.statuses.length === 0 || filters.statuses.includes(statusLabel)

      const issueTimeMatch =
        filters.issueTime === '不限' ||
        (filters.issueTime === '近1年' && now - new Date(item.issueDate).getTime() <= oneYearMs) ||
        (filters.issueTime === '近3年' && now - new Date(item.issueDate).getTime() <= threeYearMs) ||
        filters.issueTime === '自定义'

      const searchMatch =
        keyword === '' ||
        [item.name, item.documentNo, item.issuingUnit, item.fullText, item.summary].join(' ').toLowerCase().includes(keyword)

      return sourceMatch && typeMatch && statusMatch && issueTimeMatch && searchMatch
    })

    const sourceLevelOrder: Record<PolicyProcessItem['sourceLevel'], number> = {
      监管层: 0,
      总公司层: 1,
      分公司层: 2,
    }

    return [...rows].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name, 'zh-CN')

      if (sortBy === 'expiryDate') {
        const aDays = getExpiryDays(a.abolishedDate)
        const bDays = getExpiryDays(b.abolishedDate)
        if (aDays == null && bDays == null) return new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime()
        if (aDays == null) return 1
        if (bDays == null) return -1
        if (aDays !== bDays) return aDays - bDays
        return new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime()
      }

      if (sortBy === 'sourceLevel') {
        const diff = sourceLevelOrder[a.sourceLevel] - sourceLevelOrder[b.sourceLevel]
        if (diff !== 0) return diff
        return new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime()
      }

      return new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime()
    })
  }, [filters, policies, search, sortBy])

  const openCreateModal = () => {
    setEditingId(null)
    setPolicyForm(defaultPolicyForm)
    setPolicyAttachment('')
    setPolicyModalOpen(true)
  }

  const openEditModal = (item: PolicyProcessItem) => {
    setEditingId(item.id)
    setPolicyAttachment(item.fileName ?? '')
    setPolicyForm({
      sourceLevel: item.sourceLevel,
      documentType: item.documentType,
      documentNo: item.documentNo,
      issuingUnit: item.issuingUnit,
      name: item.name,
      effectiveDate: item.effectiveDate,
      abolishedDate: item.abolishedDate ?? '',
      version: item.version,
      ownerDepartment: item.ownerDepartment,
      relatedRoles: item.relatedRoles,
      summary: item.summary,
      fullText: item.fullText,
    })
    setPolicyModalOpen(true)
  }

  const submitPolicyForm = async () => {
    if (!policyForm.name.trim() || !policyForm.documentNo.trim() || !policyForm.effectiveDate) {
      window.alert('请至少填写名称、文号和生效日期')
      return
    }

    if (editingId) {
      await notionService.savePolicy({ id: editingId, ...policyForm })
      setData(
        policies.map((item) =>
          item.id === editingId
            ? {
                ...item,
                ...policyForm,
                fileName: policyAttachment || undefined,
                abolishedDate: policyForm.abolishedDate || undefined,
                updatedAt: new Date().toISOString(),
              }
            : item,
        ),
      )
    } else {
      const saved = await notionService.savePolicy({
        ...policyForm,
        code: `AML-ZD-${new Date().getFullYear()}-${String(policies.length + 1).padStart(3, '0')}`,
      })
      setData([
        {
          id: saved.data.id,
          category: '制度',
          code: `AML-ZD-${new Date().getFullYear()}-${String(policies.length + 1).padStart(3, '0')}`,
          issueDate: new Date().toISOString().slice(0, 10),
          status: 'draft',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          historyVersions: [{ version: policyForm.version, updatedAt: new Date().toISOString(), note: '初始创建' }],
          annotations: [],
          description: policyForm.summary,
          fileName: policyAttachment || undefined,
          ...policyForm,
          abolishedDate: policyForm.abolishedDate || undefined,
        },
        ...policies,
      ])
    }
    setPolicyModalOpen(false)
  }

  const processColumns: Array<TableColumn<ProcessLibraryItem>> = [
    { key: 'processCode', title: '流程编码' },
    { key: 'processName', title: '流程名称' },
    { key: 'businessDomain', title: '所属业务域' },
    { key: 'version', title: '版本' },
    { key: 'status', title: '状态', render: (value) => <StatusBadge status={(value as never) ?? 'draft'} /> },
    { key: 'updatedAt', title: '更新时间' },
    {
      key: 'id',
      title: '详情',
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

  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const activePolicies = useMemo(() => policies.filter((item) => item.status === 'active'), [policies])
  const draftPolicies = useMemo(() => policies.filter((item) => item.status === 'draft'), [policies])
  const expiringPolicies = useMemo(() => {
    return policies
      .map((item) => ({ item, days: getExpiryDays(item.abolishedDate) }))
      .filter((row): row is { item: PolicyProcessItem; days: number } => row.days !== null && row.days >= 0 && row.days <= 30)
      .sort((a, b) => a.days - b.days)
  }, [policies])

  const thisMonthNewCount = useMemo(() => {
    const now = new Date()
    return activePolicies.filter((item) => {
      const d = new Date(item.issueDate)
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    }).length
  }, [activePolicies])

  const urgencyPercent = useMemo(() => {
    if (expiringPolicies.length === 0) return 0
    const minDays = expiringPolicies[0]?.days ?? 30
    return Math.max(0, Math.min(100, Math.round(((30 - minDays) / 30) * 100)))
  }, [expiringPolicies])

  const recentProcessCount = useMemo(() => {
    const now = Date.now()
    const threshold = 30 * 24 * 60 * 60 * 1000
    return processes.filter((item) => now - new Date(item.updatedAt).getTime() <= threshold).length
  }, [processes])

  const statusLine =
    tab === 'process'
      ? `共 ${processes.length} 个流程，${recentProcessCount} 个近期更新`
      : `共 ${activePolicies.length} 份现行制度，${expiringPolicies.length} 份即将到期，${draftPolicies.length} 份待审核`

  const urgentPolicy = expiringPolicies[0]

  const clearAllFilters = () => {
    setSearch('')
    setFilters(defaultFilters)
  }

  const selectedTags = useMemo(() => {
    const tags: Array<{ key: string; label: string; onRemove: () => void }> = []
    if (search.trim()) tags.push({ key: 'search', label: `搜索：${search.trim()}`, onRemove: () => setSearch('') })
    filters.sourceLevels.forEach((value) =>
      tags.push({
        key: `source-${value}`,
        label: `来源：${value}`,
        onRemove: () => setFilters((prev) => ({ ...prev, sourceLevels: prev.sourceLevels.filter((v) => v !== value) })),
      }),
    )
    filters.documentTypes.forEach((value) =>
      tags.push({
        key: `type-${value}`,
        label: `类型：${value}`,
        onRemove: () => setFilters((prev) => ({ ...prev, documentTypes: prev.documentTypes.filter((v) => v !== value) })),
      }),
    )
    filters.statuses.forEach((value) =>
      tags.push({
        key: `status-${value}`,
        label: `状态：${value}`,
        onRemove: () => setFilters((prev) => ({ ...prev, statuses: prev.statuses.filter((v) => v !== value) })),
      }),
    )
    if (filters.issueTime !== '不限') {
      tags.push({
        key: `issueTime-${filters.issueTime}`,
        label: `发文：${filters.issueTime}`,
        onRemove: () => setFilters((prev) => ({ ...prev, issueTime: '不限' })),
      })
    }
    return tags
  }, [filters.documentTypes, filters.issueTime, filters.sourceLevels, filters.statuses, search])

  const toggleSelected = (policyId: string) => {
    setSelectedIds((prev) => (prev.includes(policyId) ? prev.filter((id) => id !== policyId) : [...prev, policyId]))
  }

  const clearSelection = () => setSelectedIds([])

  const bulkAbolish = () => {
    if (selectedIds.length === 0) return
    const today = new Date().toISOString().slice(0, 10)
    setData(
      policies.map((item) =>
        selectedIds.includes(item.id)
          ? {
              ...item,
              status: 'archived',
              abolishedDate: item.abolishedDate ?? today,
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    )
    clearSelection()
  }

  const bulkExport = () => {
    if (selectedIds.length === 0) return
    window.alert(`Mock：批量导出 ${selectedIds.length} 份制度`)
  }

  return (
    <section className="space-y-4">
      <p className="text-sm text-slate-600">{statusLine}</p>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
        <article className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">现行制度数</p>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-2xl font-semibold text-slate-900">{activePolicies.length}</p>
            <span className="inline-flex items-center gap-1 text-sm text-emerald-700">
              <ArrowUpRight className="h-4 w-4" />
              本月新增 +{thisMonthNewCount}
            </span>
          </div>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">即将到期（≤30天）</p>
          <p className="mt-2 text-2xl font-semibold text-red-600">{expiringPolicies.length}</p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-red-500" style={{ width: `${urgencyPercent}%` }} />
          </div>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">待审核草稿数</p>
          <p className="mt-2 text-2xl font-semibold text-orange-600">{draftPolicies.length}</p>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">流程数量</p>
          <p className="mt-2 text-2xl font-semibold text-blue-600">{processes.length}</p>
        </article>
      </div>

      {urgentPolicy ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          <span>
            制度《{urgentPolicy.item.name}》距废止还有 {urgentPolicy.days} 天
          </span>
          <button
            type="button"
            onClick={() => navigate(`/org/policy/${urgentPolicy.item.id}`)}
            className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-sm text-orange-700"
          >
            立即查看
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
            <Upload className="h-4 w-4" />
            + 上传文件
            <input
              type="file"
              accept=".pdf,.doc,.docx,.md,.txt"
              className="hidden"
              onChange={(event) => {
                if (event.target.files?.[0]) window.alert(`已选择 ${event.target.files[0].name}`)
              }}
            />
          </label>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-2 text-sm text-white"
          >
            <Plus className="h-4 w-4" />
            + 新建
          </button>
        </div>

        {tab === 'policy' ? (
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
            className="rounded border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="issueDate">按发文日期（默认）</option>
            <option value="expiryDate">按到期日期（最紧迫优先）</option>
            <option value="sourceLevel">按来源层级</option>
            <option value="name">按名称</option>
          </select>
        ) : null}
      </div>

      {tab === 'policy' ? (
        <div className="flex gap-4">
          <aside className="w-[240px] shrink-0 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <label>
              <div className="flex items-center rounded border border-slate-200 bg-white px-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="全库搜索"
                  className="w-full border-none px-2 py-2 text-sm outline-none"
                />
              </div>
            </label>

            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {selectedTags.length === 0 ? (
                  <span className="text-xs text-slate-500">未选择任何筛选条件</span>
                ) : (
                  selectedTags.map((tag) => (
                    <button
                      key={tag.key}
                      type="button"
                      onClick={tag.onRemove}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                    >
                      {tag.label}
                      <X className="h-3 w-3 text-slate-400" />
                    </button>
                  ))
                )}
              </div>
              {selectedTags.length > 0 ? (
                <button type="button" onClick={clearAllFilters} className="text-xs text-blue-600">
                  清除全部
                </button>
              ) : null}
            </div>

            <div className="space-y-1 text-sm">
              <p className="text-xs font-medium text-slate-600">来源层级</p>
              {(['监管层', '总公司层', '分公司层'] as const).map((item) => (
                <label key={item} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={filters.sourceLevels.includes(item)}
                    onChange={() => setFilters((prev) => ({ ...prev, sourceLevels: toggleInArray(prev.sourceLevels, item) }))}
                  />
                  {item}
                </label>
              ))}
            </div>

            <div className="space-y-1 text-sm">
              <p className="text-xs font-medium text-slate-600">文件类型</p>
              {(['制度', '办法', '规定', '通知', '其他'] as const).map((item) => (
                <label key={item} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={filters.documentTypes.includes(item)}
                    onChange={() =>
                      setFilters((prev) => ({ ...prev, documentTypes: toggleInArray(prev.documentTypes, item) }))
                    }
                  />
                  {item}
                </label>
              ))}
            </div>

            <div className="space-y-1 text-sm">
              <p className="text-xs font-medium text-slate-600">状态</p>
              {(['生效', '草稿', '即将到期', '废止归档'] as const).map((item) => (
                <label key={item} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={filters.statuses.includes(item)}
                    onChange={() => setFilters((prev) => ({ ...prev, statuses: toggleInArray(prev.statuses, item) }))}
                  />
                  {item}
                </label>
              ))}
            </div>

            <label className="space-y-1 text-sm">
              <p className="text-xs font-medium text-slate-600">发文时间</p>
              <select
                value={filters.issueTime}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, issueTime: event.target.value as PolicyFilterState['issueTime'] }))
                }
                className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
              >
                <option value="不限">不限</option>
                <option value="近1年">近1年</option>
                <option value="近3年">近3年</option>
                <option value="自定义">自定义</option>
              </select>
            </label>

            <button
              type="button"
              onClick={clearAllFilters}
              className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-600"
            >
              重置
            </button>
          </aside>

          <div className="min-w-0 flex-1 space-y-3">
            {selectedIds.length > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-sm text-slate-700">已选中 {selectedIds.length} 条</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={bulkAbolish}
                    className="rounded bg-red-600 px-3 py-1.5 text-sm text-white"
                  >
                    批量废止
                  </button>
                  <button
                    type="button"
                    onClick={bulkExport}
                    className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
                  >
                    <Download className="h-4 w-4" />
                    批量导出
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
                  >
                    取消选择
                  </button>
                </div>
              </div>
            ) : null}

            {loading ? <div className="rounded border border-slate-200 p-4 text-sm text-slate-500">制度库加载中...</div> : null}
            {error ? <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

            {!loading && !error ? (
              <div className="space-y-2">
                {filteredPolicies.map((item) => {
                  const days = getExpiryDays(item.abolishedDate)
                  const expiring = days !== null && days >= 0 && days <= 30
                  const checked = selectedIds.includes(item.id)

                  return (
                    <article key={item.id} className="relative rounded-lg border border-slate-200 bg-white p-4">
                      <span
                        className={`absolute left-0 top-0 h-full w-1 rounded-l-lg ${
                          item.sourceLevel === '监管层'
                            ? 'bg-red-500'
                            : item.sourceLevel === '总公司层'
                              ? 'bg-blue-500'
                              : 'bg-emerald-500'
                        }`}
                      />
                      <div className="flex items-start gap-3 pl-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelected(item.id)}
                          className="mt-1"
                        />
                        <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-base font-semibold text-slate-900">{item.name}</p>
                              {expiring ? (
                                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">
                                  即将到期
                                </span>
                              ) : (
                                <StatusBadge status={item.status} />
                              )}
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                              {item.documentNo} | {item.issuingUnit} | 生效日期 {item.effectiveDate}
                            </p>
                            <p className="mt-2 text-sm text-slate-500">{item.summary.slice(0, 80)}</p>
                          </div>
                          <div className="flex shrink-0 flex-col gap-1">
                            <button
                              type="button"
                              onClick={() => navigate(`/org/policy/${item.id}`)}
                              className="inline-flex items-center justify-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700"
                            >
                              查看
                              <ChevronRight className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(item)}
                              className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600"
                            >
                              编辑
                            </button>
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
      ) : null}

      {tab === 'process' ? (
        <div className="space-y-3">
          <DataTable
            columns={processColumns}
            data={processes}
            rowKey={(row) => row.id}
            loading={processLoading}
            error={processError}
          />
          {expandedProcessId ? (
            <article className="rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-900">步骤时间轴</h3>
              <div className="mt-2 space-y-2">
                {(processes.find((item) => item.id === expandedProcessId)?.steps ?? []).map((step) => (
                  <div key={step.id} className="flex gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
                      {step.index}
                    </div>
                    <div className="rounded border border-slate-200 bg-slate-50 p-2 text-sm text-slate-700">
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
        </div>
      ) : null}

      <Modal
        open={policyModalOpen}
        title={editingId ? '编辑制度' : '新建制度'}
        onClose={() => setPolicyModalOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded border border-slate-200 px-3 py-1.5 text-sm"
              onClick={() => setPolicyModalOpen(false)}
            >
              取消
            </button>
            <button
              type="button"
              className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white"
              onClick={() => void submitPolicyForm()}
            >
              保存
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-slate-600">来源层级</span>
            <select
              value={policyForm.sourceLevel}
              onChange={(event) => setPolicyForm((prev) => ({ ...prev, sourceLevel: event.target.value as PolicyFormState['sourceLevel'] }))}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="监管层">监管层</option>
              <option value="总公司层">总公司层</option>
              <option value="分公司层">分公司层</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-600">类型</span>
            <select
              value={policyForm.documentType}
              onChange={(event) => setPolicyForm((prev) => ({ ...prev, documentType: event.target.value as PolicyFormState['documentType'] }))}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="制度">制度</option>
              <option value="办法">办法</option>
              <option value="规定">规定</option>
              <option value="通知">通知</option>
              <option value="其他">其他</option>
            </select>
          </label>
          <input
            placeholder="文号"
            value={policyForm.documentNo}
            onChange={(event) => setPolicyForm((prev) => ({ ...prev, documentNo: event.target.value }))}
            className="rounded border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            placeholder="发文单位"
            value={policyForm.issuingUnit}
            onChange={(event) => setPolicyForm((prev) => ({ ...prev, issuingUnit: event.target.value }))}
            className="rounded border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            placeholder="名称"
            value={policyForm.name}
            onChange={(event) => setPolicyForm((prev) => ({ ...prev, name: event.target.value }))}
            className="rounded border border-slate-200 px-3 py-2 text-sm md:col-span-2"
          />
          <input
            type="date"
            value={policyForm.effectiveDate}
            onChange={(event) => setPolicyForm((prev) => ({ ...prev, effectiveDate: event.target.value }))}
            className="rounded border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={policyForm.abolishedDate}
            onChange={(event) => setPolicyForm((prev) => ({ ...prev, abolishedDate: event.target.value }))}
            className="rounded border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            placeholder="版本"
            value={policyForm.version}
            onChange={(event) => setPolicyForm((prev) => ({ ...prev, version: event.target.value }))}
            className="rounded border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            placeholder="归属部门"
            value={policyForm.ownerDepartment}
            onChange={(event) => setPolicyForm((prev) => ({ ...prev, ownerDepartment: event.target.value }))}
            className="rounded border border-slate-200 px-3 py-2 text-sm"
          />
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs text-slate-600">关联岗位（多选）</span>
            <div className="flex flex-wrap gap-2 rounded border border-slate-200 p-2 text-sm">
              {ROLE_OPTIONS.map((role) => (
                <label key={role} className="inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={policyForm.relatedRoles.includes(role)}
                    onChange={() =>
                      setPolicyForm((prev) => ({ ...prev, relatedRoles: toggleInArray(prev.relatedRoles, role) }))
                    }
                  />
                  {role}
                </label>
              ))}
            </div>
          </label>
          <textarea
            placeholder="摘要"
            value={policyForm.summary}
            onChange={(event) => setPolicyForm((prev) => ({ ...prev, summary: event.target.value }))}
            className="h-20 rounded border border-slate-200 px-3 py-2 text-sm md:col-span-2"
          />
          <textarea
            placeholder="制度全文"
            value={policyForm.fullText}
            onChange={(event) => setPolicyForm((prev) => ({ ...prev, fullText: event.target.value }))}
            className="h-32 rounded border border-slate-200 px-3 py-2 text-sm md:col-span-2"
          />
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs text-slate-600">附件上传</span>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.md,.txt"
              onChange={(event) => setPolicyAttachment(event.target.files?.[0]?.name ?? '')}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
        </div>
      </Modal>
    </section>
  )
}
