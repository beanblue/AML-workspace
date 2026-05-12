import { ArrowUpRight, ChevronRight, Download, Plus, Search, Upload, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAMLData } from '../../hooks/useAMLData'
import { notionService } from '../../services/notionService'
import type { PolicyProcessItem, ProcessLibraryItem } from '../../types'
import { Modal } from '../shared/Modal'
import { StatusBadge } from '../shared/StatusBadge'

const ROLE_OPTIONS = ['合规岗', '客户经理岗', '风控复核岗', '交易监测岗', '评级分析岗']

type LibraryTab = 'policy' | 'process' | 'diagram'

interface PolicyFilterState {
  sourceLevels: Array<PolicyProcessItem['sourceLevel']>
  documentTypes: Array<PolicyProcessItem['documentType']>
  statuses: Array<'生效' | '草稿' | '即将到期' | '废止归档'>
  issueTime: '不限' | '近1年' | '近3年' | '自定义'
}

interface ProcessFilterState {
  domains: string[]
  statuses: Array<ProcessLibraryItem['status']>
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

const defaultPolicyFilters: PolicyFilterState = {
  sourceLevels: [],
  documentTypes: [],
  statuses: [],
  issueTime: '不限',
}

const defaultProcessFilters: ProcessFilterState = {
  domains: [],
  statuses: [],
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

const SOURCE_LEVEL_CLASS: Record<PolicyProcessItem['sourceLevel'], string> = {
  监管层: 'bg-red-100 text-red-700',
  总公司层: 'bg-blue-100 text-blue-700',
  分公司层: 'bg-emerald-100 text-emerald-700',
}

const SOURCE_LEVEL_LINE_CLASS: Record<PolicyProcessItem['sourceLevel'], string> = {
  监管层: 'bg-red-500',
  总公司层: 'bg-blue-500',
  分公司层: 'bg-emerald-500',
}

const DOCUMENT_TYPE_CLASS: Record<PolicyProcessItem['documentType'], string> = {
  制度: 'bg-slate-100 text-slate-700',
  办法: 'bg-slate-100 text-slate-700',
  规定: 'bg-slate-100 text-slate-700',
  通知: 'bg-slate-100 text-slate-700',
  其他: 'bg-slate-100 text-slate-700',
}

const PROCESS_STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  active: '生效',
  inactive: '停用',
  archived: '归档',
  pending: '待处理',
  completed: '已完成',
  overdue: '已逾期',
}

export function PolicyModule() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<LibraryTab>('policy')

  const [policyFilters, setPolicyFilters] = useState<PolicyFilterState>(defaultPolicyFilters)
  const [policySearch, setPolicySearch] = useState('')
  const [sortBy, setSortBy] = useState<'issueDate' | 'expiryDate' | 'sourceLevel'>('issueDate')
  const [selectedPolicyIds, setSelectedPolicyIds] = useState<string[]>([])

  const [processFilters, setProcessFilters] = useState<ProcessFilterState>(defaultProcessFilters)
  const [processSearch, setProcessSearch] = useState('')
  const [expandedProcessId, setExpandedProcessId] = useState<string | null>(null)

  const [policyModalOpen, setPolicyModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [policyForm, setPolicyForm] = useState<PolicyFormState>(defaultPolicyForm)
  const [policyAttachment, setPolicyAttachment] = useState('')

  const { data, loading, error, setData } = useAMLData<PolicyProcessItem[]>('policy', 'query')
  const { data: processData, loading: processLoading, error: processError } =
    useAMLData<ProcessLibraryItem[]>('policyProcess', 'query')

  const policies = data ?? []
  const processes = processData ?? []

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

  const policyUrgencyPercent = useMemo(() => {
    if (expiringPolicies.length === 0) return 0
    const minDays = expiringPolicies[0]?.days ?? 30
    return Math.max(0, Math.min(100, Math.round(((30 - minDays) / 30) * 100)))
  }, [expiringPolicies])

  const recentProcessCount = useMemo(() => {
    const now = Date.now()
    const threshold = 30 * 24 * 60 * 60 * 1000
    return processes.filter((item) => now - new Date(item.updatedAt).getTime() <= threshold).length
  }, [processes])

  const sourceLevelOrder: Record<PolicyProcessItem['sourceLevel'], number> = {
    监管层: 0,
    总公司层: 1,
    分公司层: 2,
  }

  const filteredPolicies = useMemo(() => {
    const keyword = policySearch.trim().toLowerCase()
    const now = Date.now()
    const oneYearMs = 365 * 24 * 60 * 60 * 1000
    const threeYearMs = 3 * oneYearMs

    const rows = policies.filter((item) => {
      const sourceMatch =
        policyFilters.sourceLevels.length === 0 || policyFilters.sourceLevels.includes(item.sourceLevel)
      const typeMatch =
        policyFilters.documentTypes.length === 0 || policyFilters.documentTypes.includes(item.documentType)

      const days = getExpiryDays(item.abolishedDate)
      const statusLabel =
        days !== null && days >= 0 && days <= 30
          ? '即将到期'
          : item.status === 'active'
            ? '生效'
            : item.status === 'draft'
              ? '草稿'
              : '废止归档'
      const statusMatch =
        policyFilters.statuses.length === 0 || policyFilters.statuses.includes(statusLabel)

      const issueTimeMatch =
        policyFilters.issueTime === '不限' ||
        (policyFilters.issueTime === '近1年' && now - new Date(item.issueDate).getTime() <= oneYearMs) ||
        (policyFilters.issueTime === '近3年' && now - new Date(item.issueDate).getTime() <= threeYearMs) ||
        policyFilters.issueTime === '自定义'

      const searchMatch =
        keyword === '' ||
        [item.name, item.documentNo, item.issuingUnit, item.fullText, item.summary].join(' ').toLowerCase().includes(keyword)

      return sourceMatch && typeMatch && statusMatch && issueTimeMatch && searchMatch
    })

    return [...rows].sort((a, b) => {
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
  }, [policies, policyFilters.documentTypes, policyFilters.issueTime, policyFilters.sourceLevels, policyFilters.statuses, policySearch, sortBy, sourceLevelOrder])

  const processDomains = useMemo(() => Array.from(new Set(processes.map((item) => item.businessDomain))).filter(Boolean), [processes])

  const filteredProcesses = useMemo(() => {
    const keyword = processSearch.trim().toLowerCase()
    return processes.filter((item) => {
      const domainMatch = processFilters.domains.length === 0 || processFilters.domains.includes(item.businessDomain)
      const statusMatch = processFilters.statuses.length === 0 || processFilters.statuses.includes(item.status)
      const searchMatch =
        keyword === '' ||
        [item.processName, item.processCode, item.businessDomain].join(' ').toLowerCase().includes(keyword)
      return domainMatch && statusMatch && searchMatch
    })
  }, [processFilters.domains, processFilters.statuses, processSearch, processes])

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

  const clearPolicyFilters = () => {
    setPolicySearch('')
    setPolicyFilters(defaultPolicyFilters)
  }

  const clearProcessFilters = () => {
    setProcessSearch('')
    setProcessFilters(defaultProcessFilters)
  }

  const policySelectedTags = useMemo(() => {
    const tags: Array<{ key: string; label: string; onRemove: () => void }> = []
    if (policySearch.trim()) tags.push({ key: 'search', label: `搜索：${policySearch.trim()}`, onRemove: () => setPolicySearch('') })
    policyFilters.sourceLevels.forEach((value) =>
      tags.push({
        key: `source-${value}`,
        label: `来源：${value}`,
        onRemove: () => setPolicyFilters((prev) => ({ ...prev, sourceLevels: prev.sourceLevels.filter((v) => v !== value) })),
      }),
    )
    policyFilters.documentTypes.forEach((value) =>
      tags.push({
        key: `type-${value}`,
        label: `类型：${value}`,
        onRemove: () =>
          setPolicyFilters((prev) => ({ ...prev, documentTypes: prev.documentTypes.filter((v) => v !== value) })),
      }),
    )
    policyFilters.statuses.forEach((value) =>
      tags.push({
        key: `status-${value}`,
        label: `状态：${value}`,
        onRemove: () => setPolicyFilters((prev) => ({ ...prev, statuses: prev.statuses.filter((v) => v !== value) })),
      }),
    )
    if (policyFilters.issueTime !== '不限') {
      tags.push({
        key: `issueTime-${policyFilters.issueTime}`,
        label: `发文：${policyFilters.issueTime}`,
        onRemove: () => setPolicyFilters((prev) => ({ ...prev, issueTime: '不限' })),
      })
    }
    return tags
  }, [policyFilters.documentTypes, policyFilters.issueTime, policyFilters.sourceLevels, policyFilters.statuses, policySearch])

  const processSelectedTags = useMemo(() => {
    const tags: Array<{ key: string; label: string; onRemove: () => void }> = []
    if (processSearch.trim()) tags.push({ key: 'search', label: `搜索：${processSearch.trim()}`, onRemove: () => setProcessSearch('') })
    processFilters.domains.forEach((value) =>
      tags.push({
        key: `domain-${value}`,
        label: `业务域：${value}`,
        onRemove: () => setProcessFilters((prev) => ({ ...prev, domains: prev.domains.filter((v) => v !== value) })),
      }),
    )
    processFilters.statuses.forEach((value) =>
      tags.push({
        key: `status-${String(value)}`,
        label: `状态：${PROCESS_STATUS_LABEL[String(value)] ?? String(value)}`,
        onRemove: () => setProcessFilters((prev) => ({ ...prev, statuses: prev.statuses.filter((v) => v !== value) })),
      }),
    )
    return tags
  }, [processFilters.domains, processFilters.statuses, processSearch])

  const toggleSelectedPolicy = (policyId: string) => {
    setSelectedPolicyIds((prev) => (prev.includes(policyId) ? prev.filter((id) => id !== policyId) : [...prev, policyId]))
  }

  const clearSelection = () => setSelectedPolicyIds([])

  const bulkAbolish = () => {
    if (selectedPolicyIds.length === 0) return
    const today = new Date().toISOString().slice(0, 10)
    setData(
      policies.map((item) =>
        selectedPolicyIds.includes(item.id)
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
    if (selectedPolicyIds.length === 0) return
    window.alert(`Mock：批量导出 ${selectedPolicyIds.length} 份制度`)
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">文件库</h2>
          <p className="mt-1 text-sm text-slate-600">
            {tab === 'process'
              ? `共 ${processes.length} 个流程，${recentProcessCount} 个近期更新`
              : tab === 'diagram'
                ? '流程图示功能开发中'
                : `共 ${activePolicies.length} 份现行制度，${expiringPolicies.length} 份即将到期，${draftPolicies.length} 份待审核`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => {
            setTab('policy')
            clearPolicyFilters()
          }}
          className="rounded-lg border border-slate-200 bg-white p-4 text-left hover:bg-slate-50"
        >
          <p className="text-xs text-slate-500">现行制度数</p>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-2xl font-semibold text-slate-900">{activePolicies.length}</p>
            <span className="inline-flex items-center gap-1 text-sm text-emerald-700">
              <ArrowUpRight className="h-4 w-4" />
              本月新增 +{thisMonthNewCount}
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setTab('policy')
            setPolicySearch('')
            setPolicyFilters((prev) => ({ ...prev, statuses: ['即将到期'] }))
          }}
          className="rounded-lg border border-slate-200 bg-white p-4 text-left hover:bg-slate-50"
        >
          <p className="text-xs text-slate-500">即将到期（≤30天）</p>
          <p className="mt-2 text-2xl font-semibold text-red-600">{expiringPolicies.length}</p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-red-500" style={{ width: `${policyUrgencyPercent}%` }} />
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setTab('policy')
            setPolicySearch('')
            setPolicyFilters((prev) => ({ ...prev, statuses: ['草稿'] }))
          }}
          className="rounded-lg border border-slate-200 bg-white p-4 text-left hover:bg-slate-50"
        >
          <p className="text-xs text-slate-500">待审核草稿</p>
          <p className="mt-2 text-2xl font-semibold text-orange-600">{draftPolicies.length}</p>
        </button>

        <button
          type="button"
          onClick={() => setTab('process')}
          className="rounded-lg border border-slate-200 bg-white p-4 text-left hover:bg-slate-50"
        >
          <p className="text-xs text-slate-500">流程数量</p>
          <p className="mt-2 text-2xl font-semibold text-blue-600">{processes.length}</p>
        </button>
      </div>

      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
        {([
          { key: 'policy', label: '制度文件' },
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

      {tab === 'diagram' ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
          流程图示功能开发中
        </div>
      ) : null}

      {tab === 'policy' ? (
        <div className="flex gap-4">
          <aside className="w-[260px] shrink-0 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <label>
              <div className="flex items-center rounded border border-slate-200 bg-white px-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={policySearch}
                  onChange={(event) => setPolicySearch(event.target.value)}
                  placeholder="全库搜索框"
                  className="w-full border-none px-2 py-2 text-sm outline-none"
                />
              </div>
            </label>

            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {policySelectedTags.length === 0 ? (
                  <span className="text-xs text-slate-500">未选择任何筛选条件</span>
                ) : (
                  policySelectedTags.map((tag) => (
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
              {policySelectedTags.length > 0 ? (
                <button type="button" onClick={clearPolicyFilters} className="text-xs text-blue-600">
                  清除
                </button>
              ) : null}
            </div>

            <div className="space-y-1 text-sm">
              <p className="text-xs font-medium text-slate-600">来源层级（多选）</p>
              {(['监管层', '总公司层', '分公司层'] as const).map((item) => (
                <label key={item} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={policyFilters.sourceLevels.includes(item)}
                    onChange={() =>
                      setPolicyFilters((prev) => ({ ...prev, sourceLevels: toggleInArray(prev.sourceLevels, item) }))
                    }
                  />
                  {item}
                </label>
              ))}
            </div>

            <div className="space-y-1 text-sm">
              <p className="text-xs font-medium text-slate-600">文件类型（多选）</p>
              {(['制度', '办法', '规定', '通知', '其他'] as const).map((item) => (
                <label key={item} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={policyFilters.documentTypes.includes(item)}
                    onChange={() =>
                      setPolicyFilters((prev) => ({ ...prev, documentTypes: toggleInArray(prev.documentTypes, item) }))
                    }
                  />
                  {item}
                </label>
              ))}
            </div>

            <div className="space-y-1 text-sm">
              <p className="text-xs font-medium text-slate-600">状态（多选）</p>
              {(['生效', '草稿', '即将到期', '废止归档'] as const).map((item) => (
                <label key={item} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={policyFilters.statuses.includes(item)}
                    onChange={() =>
                      setPolicyFilters((prev) => ({ ...prev, statuses: toggleInArray(prev.statuses, item) }))
                    }
                  />
                  {item}
                </label>
              ))}
            </div>

            <label className="space-y-1 text-sm">
              <p className="text-xs font-medium text-slate-600">发文时间</p>
              <select
                value={policyFilters.issueTime}
                onChange={(event) =>
                  setPolicyFilters((prev) => ({ ...prev, issueTime: event.target.value as PolicyFilterState['issueTime'] }))
                }
                className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
              >
                <option value="不限">不限</option>
                <option value="近1年">近1年</option>
                <option value="近3年">近3年</option>
                <option value="自定义">自定义</option>
              </select>
            </label>
          </aside>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-slate-600">共 {filteredPolicies.length} 条</div>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
                className="rounded border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="issueDate">按发文日期</option>
                <option value="expiryDate">按到期日期（紧迫优先）</option>
                <option value="sourceLevel">按来源层级</option>
              </select>
            </div>

            {selectedPolicyIds.length > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-sm text-slate-700">已选中 {selectedPolicyIds.length} 条</span>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={bulkAbolish} className="rounded bg-red-600 px-3 py-1.5 text-sm text-white">
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

            {loading ? <div className="rounded border border-slate-200 p-4 text-sm text-slate-500">制度文件加载中...</div> : null}
            {error ? <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

            {!loading && !error ? (
              <div className="space-y-2">
                {filteredPolicies.map((item) => {
                  const days = getExpiryDays(item.abolishedDate)
                  const expiring = days !== null && days >= 0 && days <= 30
                  const checked = selectedPolicyIds.includes(item.id)

                  return (
                    <article key={item.id} className="relative rounded-xl border border-slate-200 bg-white p-4">
                      <span
                        className={`absolute left-0 top-0 h-full w-1 rounded-l-xl ${SOURCE_LEVEL_LINE_CLASS[item.sourceLevel]}`}
                      />
                      <div className="flex items-start gap-3 pl-2">
                        <input type="checkbox" checked={checked} onChange={() => toggleSelectedPolicy(item.id)} className="mt-1" />

                        <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-base font-semibold text-slate-900">{item.name}</p>
                              {expiring ? (
                                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">即将到期</span>
                              ) : (
                                <StatusBadge status={item.status} />
                              )}
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                              <span className={`rounded-full px-2 py-0.5 ${SOURCE_LEVEL_CLASS[item.sourceLevel]}`}>{item.sourceLevel}</span>
                              <span className={`rounded-full px-2 py-0.5 ${DOCUMENT_TYPE_CLASS[item.documentType]}`}>{item.documentType}</span>
                              <span>{item.documentNo}</span>
                              <span>{item.version}</span>
                            </div>

                            <p className="mt-2 text-sm text-slate-500">{item.summary.slice(0, 80)}</p>
                            <p className={`mt-2 text-sm ${expiring ? 'text-red-600' : 'text-slate-600'}`}>
                              🕐 生效日期 {item.effectiveDate} · 到期日期 {item.abolishedDate ?? '-'}
                            </p>
                          </div>

                          <div className="flex shrink-0 flex-col gap-2">
                            <button
                              type="button"
                              onClick={() => navigate(`/org/library/${item.id}`)}
                              className="inline-flex items-center justify-center gap-1 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700"
                            >
                              查看全文
                              <ChevronRight className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(item)}
                              className="rounded border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
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
        <div className="flex gap-4">
          <aside className="w-[260px] shrink-0 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <label>
              <div className="flex items-center rounded border border-slate-200 bg-white px-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={processSearch}
                  onChange={(event) => setProcessSearch(event.target.value)}
                  placeholder="全库搜索框"
                  className="w-full border-none px-2 py-2 text-sm outline-none"
                />
              </div>
            </label>

            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {processSelectedTags.length === 0 ? (
                  <span className="text-xs text-slate-500">未选择任何筛选条件</span>
                ) : (
                  processSelectedTags.map((tag) => (
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
              {processSelectedTags.length > 0 ? (
                <button type="button" onClick={clearProcessFilters} className="text-xs text-blue-600">
                  清除
                </button>
              ) : null}
            </div>

            <div className="space-y-1 text-sm">
              <p className="text-xs font-medium text-slate-600">业务域（多选）</p>
              {processDomains.map((domain) => (
                <label key={domain} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={processFilters.domains.includes(domain)}
                    onChange={() => setProcessFilters((prev) => ({ ...prev, domains: toggleInArray(prev.domains, domain) }))}
                  />
                  {domain}
                </label>
              ))}
            </div>

            <div className="space-y-1 text-sm">
              <p className="text-xs font-medium text-slate-600">状态（多选）</p>
              {(['active', 'draft', 'archived'] as const).map((status) => (
                <label key={status} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={processFilters.statuses.includes(status)}
                    onChange={() => setProcessFilters((prev) => ({ ...prev, statuses: toggleInArray(prev.statuses, status) }))}
                  />
                  {PROCESS_STATUS_LABEL[status] ?? status}
                </label>
              ))}
            </div>
          </aside>

          <div className="min-w-0 flex-1 space-y-3">
            {processLoading ? <div className="rounded border border-slate-200 p-4 text-sm text-slate-500">流程加载中...</div> : null}
            {processError ? <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{processError}</div> : null}

            {!processLoading && !processError ? (
              <div className="space-y-2">
                {filteredProcesses.map((item) => {
                  const expanded = expandedProcessId === item.id
                  return (
                    <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-base font-semibold text-slate-900">{item.processName}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">{item.businessDomain}</span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">{item.version}</span>
                            <StatusBadge status={item.status} />
                            <span>最近更新 {item.updatedAt}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setExpandedProcessId((prev) => (prev === item.id ? null : item.id))}
                          className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
                        >
                          {expanded ? '收起步骤' : '查看步骤'}
                        </button>
                      </div>

                      {expanded ? (
                        <div className="mt-4 space-y-2">
                          {item.steps.map((step) => (
                            <div key={step.id} className="flex gap-3">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
                                {step.index}
                              </div>
                              <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                                <p className="font-medium">{step.name}</p>
                                <p>业务域：{item.businessDomain}</p>
                                <p>触发条件：{step.triggerCondition}</p>
                                <p>责任岗位：{step.ownerRole}</p>
                                <p>时效要求：{step.sla}</p>
                                <p>留痕要求：{step.evidenceRequirement}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  )
                })}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <Modal
        open={policyModalOpen}
        title={editingId ? '编辑制度文件' : '新建制度文件'}
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
            <span className="text-xs text-slate-600">文件类型</span>
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

