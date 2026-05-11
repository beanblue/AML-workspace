import { Plus, Search, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAMLData } from '../../hooks/useAMLData'
import { notionService } from '../../services/notionService'
import type { PolicyProcessItem, ProcessLibraryItem, ReferenceKnowledgeItem } from '../../types'
import { DataTable, type TableColumn } from '../shared/DataTable'
import { Modal } from '../shared/Modal'
import { ModuleWorkspace } from '../shared/ModuleWorkspace'
import { StatusBadge } from '../shared/StatusBadge'

type PolicyTab = 'policy' | 'process' | 'knowledge'

const ROLE_OPTIONS = ['合规岗', '客户经理岗', '风控复核岗', '交易监测岗', '评级分析岗']
const TAG_OPTIONS = ['CDD', 'STR', '风险评级', '国际标准', 'FATF']

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

type KnowledgeFormState = Pick<
  ReferenceKnowledgeItem,
  'materialType' | 'title' | 'sourceOrg' | 'publishDate' | 'summary' | 'tags' | 'originLink' | 'personalNote'
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

const defaultKnowledgeForm: KnowledgeFormState = {
  materialType: '图书',
  title: '',
  sourceOrg: '',
  publishDate: '',
  summary: '',
  tags: [],
  originLink: '',
  personalNote: '',
}

function getExpiryDays(abolishedDate?: string): number | null {
  if (!abolishedDate) return null
  const diff = new Date(abolishedDate).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function toggleInArray<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((item) => item !== value) : [...arr, value]
}

function SourceBadge({ value }: { value: PolicyProcessItem['sourceLevel'] }) {
  const map: Record<PolicyProcessItem['sourceLevel'], string> = {
    监管层: 'bg-red-100 text-red-700',
    总公司层: 'bg-blue-100 text-blue-700',
    分公司层: 'bg-emerald-100 text-emerald-700',
  }
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[value]}`}>{value}</span>
}

function FileTypeBadge({ value }: { value: PolicyProcessItem['documentType'] }) {
  return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{value}</span>
}

export function PolicyModule() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<PolicyTab>('policy')
  const [filters, setFilters] = useState<PolicyFilterState>(defaultFilters)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'issueDate' | 'name'>('issueDate')
  const [policyModalOpen, setPolicyModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [policyForm, setPolicyForm] = useState<PolicyFormState>(defaultPolicyForm)
  const [policyAttachment, setPolicyAttachment] = useState('')

  const [expandedProcessId, setExpandedProcessId] = useState<string | null>(null)

  const [knowledgeTypeFilter, setKnowledgeTypeFilter] = useState<'all' | ReferenceKnowledgeItem['materialType']>('all')
  const [knowledgeTagFilter, setKnowledgeTagFilter] = useState<'all' | string>('all')
  const [knowledgeSearch, setKnowledgeSearch] = useState('')
  const [knowledgeModalOpen, setKnowledgeModalOpen] = useState(false)
  const [knowledgeInputMode, setKnowledgeInputMode] = useState<'manual' | 'upload'>('manual')
  const [knowledgeForm, setKnowledgeForm] = useState<KnowledgeFormState>(defaultKnowledgeForm)
  const [knowledgeAttachmentName, setKnowledgeAttachmentName] = useState('')
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState<string | null>(null)

  const { data, loading, error, setData } = useAMLData<PolicyProcessItem[]>('policy', 'query')
  const { data: processData, loading: processLoading, error: processError } =
    useAMLData<ProcessLibraryItem[]>('policyProcess', 'query')
  const {
    data: knowledgeData,
    loading: knowledgeLoading,
    error: knowledgeError,
    setData: setKnowledgeData,
  } = useAMLData<ReferenceKnowledgeItem[]>('policyKnowledge', 'query')

  const policies = data ?? []
  const processes = processData ?? []
  const knowledges = knowledgeData ?? []

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

    return [...rows].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name, 'zh-CN')
      return new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime()
    })
  }, [filters, policies, search, sortBy])

  const filteredKnowledges = useMemo(() => {
    const keyword = knowledgeSearch.trim().toLowerCase()
    return knowledges.filter((item) => {
      const typeMatch = knowledgeTypeFilter === 'all' || item.materialType === knowledgeTypeFilter
      const tagMatch = knowledgeTagFilter === 'all' || item.tags.includes(knowledgeTagFilter)
      const searchMatch = keyword === '' || [item.title, item.summary, item.personalNote].join(' ').toLowerCase().includes(keyword)
      return typeMatch && tagMatch && searchMatch
    })
  }, [knowledgeSearch, knowledgeTagFilter, knowledgeTypeFilter, knowledges])

  const selectedKnowledge = filteredKnowledges.find((item) => item.id === selectedKnowledgeId) ?? null

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

  const knowledgeColumns: Array<TableColumn<ReferenceKnowledgeItem>> = [
    { key: 'materialType', title: '资料类型', render: (v) => <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{String(v)}</span> },
    { key: 'title', title: '标题' },
    { key: 'sourceOrg', title: '作者/来源机构' },
    { key: 'publishDate', title: '发布日期' },
    {
      key: 'tags',
      title: '标签',
      render: (value) => (
        <div className="flex flex-wrap gap-1">
          {(value as string[]).map((tag) => (
            <span key={tag} className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">
              {tag}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'id',
      title: '详情',
      render: (_, row) => (
        <button
          type="button"
          onClick={() => setSelectedKnowledgeId(row.id)}
          className="rounded border border-orange-200 bg-orange-50 px-2 py-1 text-xs text-orange-700"
        >
          查看详情
        </button>
      ),
    },
  ]

  return (
    <ModuleWorkspace
      title="制度与流程管理"
      description="制度库 / 流程库 / 知识库的一体化工作台。"
      metrics={[
        { label: '制度数量', value: String(policies.length) },
        { label: '流程数量', value: String(processes.length) },
        { label: '知识条目', value: String(knowledges.length) },
        { label: '即将到期制度', value: String(policies.filter((i) => (getExpiryDays(i.abolishedDate) ?? 999) <= 30).length) },
      ]}
      alerts={['制度《客户身份识别管理制度》距废止还有 12 天']}
    >
      <div className="inline-flex rounded-lg border border-slate-200 p-1">
        {[
          ['policy', '制度库'],
          ['process', '流程库'],
          ['knowledge', '知识库'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key as PolicyTab)}
            className={`rounded px-3 py-1.5 text-sm ${tab === key ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'policy' ? (
        <div className="flex gap-4">
          <aside className="w-[220px] shrink-0 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-800">筛选条件</p>
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
                onChange={(event) => setFilters((prev) => ({ ...prev, issueTime: event.target.value as PolicyFilterState['issueTime'] }))}
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
              onClick={() => setFilters(defaultFilters)}
              className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-600"
            >
              重置
            </button>
          </aside>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 lg:grid-cols-5">
              <label className="lg:col-span-2">
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
                className="inline-flex items-center justify-center gap-1 rounded bg-blue-600 px-3 py-2 text-sm text-white"
              >
                <Plus className="h-4 w-4" />
                + 新建
              </button>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as 'issueDate' | 'name')}
                className="rounded border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="issueDate">按发文日期</option>
                <option value="name">按名称</option>
              </select>
            </div>

            {loading ? <div className="rounded border border-slate-200 p-4 text-sm text-slate-500">制度库加载中...</div> : null}
            {error ? <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
            {!loading && !error ? (
              <div className="space-y-2">
                {filteredPolicies.map((item) => {
                  const days = getExpiryDays(item.abolishedDate)
                  const expiring = days !== null && days >= 0 && days <= 30
                  return (
                    <article key={item.id} className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1">
                            <SourceBadge value={item.sourceLevel} />
                            <FileTypeBadge value={item.documentType} />
                            <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                            {expiring ? (
                              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">⚠️即将到期</span>
                            ) : (
                              <StatusBadge status={item.status} />
                            )}
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.documentNo} | {item.issuingUnit} | 生效日期 {item.effectiveDate}
                          </p>
                          <p className="mt-1 text-sm text-slate-700">{item.summary.slice(0, 80)}</p>
                        </div>
                        <div className="flex shrink-0 flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => navigate(`/org/policy/${item.id}`)}
                            className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700"
                          >
                            查看全文
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
          <DataTable columns={processColumns} data={processes} rowKey={(row) => row.id} loading={processLoading} error={processError} />
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

      {tab === 'knowledge' ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 lg:grid-cols-4">
            <select
              value={knowledgeTypeFilter}
              onChange={(event) => setKnowledgeTypeFilter(event.target.value as typeof knowledgeTypeFilter)}
              className="rounded border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="all">按类型筛选</option>
              <option value="图书">图书</option>
              <option value="论文">论文</option>
              <option value="监管报告">监管报告</option>
              <option value="新闻资讯">新闻资讯</option>
              <option value="观点文章">观点文章</option>
            </select>
            <select
              value={knowledgeTagFilter}
              onChange={(event) => setKnowledgeTagFilter(event.target.value)}
              className="rounded border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="all">按标签筛选</option>
              {TAG_OPTIONS.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
            <label className="lg:col-span-2">
              <div className="flex items-center rounded border border-slate-200 bg-white px-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={knowledgeSearch}
                  onChange={(event) => setKnowledgeSearch(event.target.value)}
                  placeholder="全文搜索"
                  className="w-full border-none px-2 py-2 text-sm outline-none"
                />
              </div>
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setKnowledgeModalOpen(true)}
              className="inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-2 text-sm text-white"
            >
              <Plus className="h-4 w-4" />
              新建资料
            </button>
          </div>

          <DataTable
            columns={knowledgeColumns}
            data={filteredKnowledges}
            rowKey={(row) => row.id}
            loading={knowledgeLoading}
            error={knowledgeError}
          />

          {selectedKnowledge ? (
            <article className="rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-900">资料详情</h3>
              <p className="mt-1 text-sm text-slate-700">{selectedKnowledge.summary}</p>
              <label className="mt-2 block space-y-1">
                <span className="text-xs text-slate-600">个人笔记</span>
                <textarea
                  value={selectedKnowledge.personalNote}
                  onChange={(event) =>
                    setKnowledgeData(
                      knowledges.map((item) =>
                        item.id === selectedKnowledge.id ? { ...item, personalNote: event.target.value } : item,
                      ),
                    )
                  }
                  className="h-24 w-full rounded border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <p className="mt-2 text-sm">
                原文链接：
                {selectedKnowledge.originLink ? (
                  <a href={selectedKnowledge.originLink} target="_blank" className="ml-1 text-blue-600 underline">
                    {selectedKnowledge.originLink}
                  </a>
                ) : (
                  selectedKnowledge.attachmentName ?? '无'
                )}
              </p>
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
            <button type="button" className="rounded border border-slate-200 px-3 py-1.5 text-sm" onClick={() => setPolicyModalOpen(false)}>
              取消
            </button>
            <button type="button" className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white" onClick={() => void submitPolicyForm()}>
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
          <input placeholder="文号" value={policyForm.documentNo} onChange={(event) => setPolicyForm((prev) => ({ ...prev, documentNo: event.target.value }))} className="rounded border border-slate-200 px-3 py-2 text-sm" />
          <input placeholder="发文单位" value={policyForm.issuingUnit} onChange={(event) => setPolicyForm((prev) => ({ ...prev, issuingUnit: event.target.value }))} className="rounded border border-slate-200 px-3 py-2 text-sm" />
          <input placeholder="名称" value={policyForm.name} onChange={(event) => setPolicyForm((prev) => ({ ...prev, name: event.target.value }))} className="rounded border border-slate-200 px-3 py-2 text-sm md:col-span-2" />
          <input type="date" value={policyForm.effectiveDate} onChange={(event) => setPolicyForm((prev) => ({ ...prev, effectiveDate: event.target.value }))} className="rounded border border-slate-200 px-3 py-2 text-sm" />
          <input type="date" value={policyForm.abolishedDate} onChange={(event) => setPolicyForm((prev) => ({ ...prev, abolishedDate: event.target.value }))} className="rounded border border-slate-200 px-3 py-2 text-sm" />
          <input placeholder="版本" value={policyForm.version} onChange={(event) => setPolicyForm((prev) => ({ ...prev, version: event.target.value }))} className="rounded border border-slate-200 px-3 py-2 text-sm" />
          <input placeholder="归属部门" value={policyForm.ownerDepartment} onChange={(event) => setPolicyForm((prev) => ({ ...prev, ownerDepartment: event.target.value }))} className="rounded border border-slate-200 px-3 py-2 text-sm" />
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs text-slate-600">关联岗位（多选）</span>
            <div className="flex flex-wrap gap-2 rounded border border-slate-200 p-2 text-sm">
              {ROLE_OPTIONS.map((role) => (
                <label key={role} className="inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={policyForm.relatedRoles.includes(role)}
                    onChange={() => setPolicyForm((prev) => ({ ...prev, relatedRoles: toggleInArray(prev.relatedRoles, role) }))}
                  />
                  {role}
                </label>
              ))}
            </div>
          </label>
          <textarea placeholder="摘要" value={policyForm.summary} onChange={(event) => setPolicyForm((prev) => ({ ...prev, summary: event.target.value }))} className="h-20 rounded border border-slate-200 px-3 py-2 text-sm md:col-span-2" />
          <textarea placeholder="制度全文" value={policyForm.fullText} onChange={(event) => setPolicyForm((prev) => ({ ...prev, fullText: event.target.value }))} className="h-32 rounded border border-slate-200 px-3 py-2 text-sm md:col-span-2" />
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs text-slate-600">附件上传</span>
            <input type="file" accept=".pdf,.doc,.docx,.md,.txt" onChange={(event) => setPolicyAttachment(event.target.files?.[0]?.name ?? '')} className="w-full rounded border border-slate-200 px-3 py-2 text-sm" />
            {policyAttachment ? <p className="text-xs text-slate-500">已选择：{policyAttachment}</p> : null}
          </label>
        </div>
      </Modal>

      <Modal
        open={knowledgeModalOpen}
        title="新增参考资料"
        onClose={() => setKnowledgeModalOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setKnowledgeModalOpen(false)} className="rounded border border-slate-200 px-3 py-1.5 text-sm">
              取消
            </button>
            <button
              type="button"
              onClick={() => {
                if (!knowledgeForm.title.trim()) return
                setKnowledgeData([
                  {
                    id: `ref-${Date.now()}`,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    attachmentName: knowledgeInputMode === 'upload' ? knowledgeAttachmentName : undefined,
                    ...knowledgeForm,
                  },
                  ...knowledges,
                ])
                setKnowledgeForm(defaultKnowledgeForm)
                setKnowledgeAttachmentName('')
                setKnowledgeModalOpen(false)
              }}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white"
            >
              保存
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="inline-flex rounded border border-slate-200 p-1 text-sm">
            <button type="button" onClick={() => setKnowledgeInputMode('manual')} className={`rounded px-2 py-1 ${knowledgeInputMode === 'manual' ? 'bg-blue-600 text-white' : ''}`}>
              手动录入
            </button>
            <button type="button" onClick={() => setKnowledgeInputMode('upload')} className={`rounded px-2 py-1 ${knowledgeInputMode === 'upload' ? 'bg-blue-600 text-white' : ''}`}>
              上传文件
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <input placeholder="标题" value={knowledgeForm.title} onChange={(event) => setKnowledgeForm((prev) => ({ ...prev, title: event.target.value }))} className="rounded border border-slate-200 px-3 py-2 text-sm md:col-span-2" />
            <input placeholder="来源机构/作者" value={knowledgeForm.sourceOrg} onChange={(event) => setKnowledgeForm((prev) => ({ ...prev, sourceOrg: event.target.value }))} className="rounded border border-slate-200 px-3 py-2 text-sm" />
            <input type="date" value={knowledgeForm.publishDate} onChange={(event) => setKnowledgeForm((prev) => ({ ...prev, publishDate: event.target.value }))} className="rounded border border-slate-200 px-3 py-2 text-sm" />
            <textarea placeholder="摘要" value={knowledgeForm.summary} onChange={(event) => setKnowledgeForm((prev) => ({ ...prev, summary: event.target.value }))} className="h-20 rounded border border-slate-200 px-3 py-2 text-sm md:col-span-2" />
            {knowledgeInputMode === 'manual' ? (
              <input placeholder="原文链接" value={knowledgeForm.originLink ?? ''} onChange={(event) => setKnowledgeForm((prev) => ({ ...prev, originLink: event.target.value }))} className="rounded border border-slate-200 px-3 py-2 text-sm md:col-span-2" />
            ) : (
              <input type="file" onChange={(event) => setKnowledgeAttachmentName(event.target.files?.[0]?.name ?? '')} className="rounded border border-slate-200 px-3 py-2 text-sm md:col-span-2" />
            )}
          </div>
        </div>
      </Modal>
    </ModuleWorkspace>
  )
}
