import { Plus, RefreshCcw, Search, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAMLData } from '../../hooks/useAMLData'
import { notionService } from '../../services/notionService'
import type {
  PolicyProcessItem,
  ProcessLibraryItem,
  ReferenceKnowledgeItem,
} from '../../types'
import { DataTable, type TableColumn } from '../shared/DataTable'
import { Modal } from '../shared/Modal'
import { StatusBadge } from '../shared/StatusBadge'

type PolicyTab = 'policy' | 'process' | 'knowledge'

type PolicyFormState = Pick<
  PolicyProcessItem,
  | 'code'
  | 'name'
  | 'sourceLevel'
  | 'issuingUnit'
  | 'documentNo'
  | 'ownerDepartment'
  | 'version'
  | 'status'
  | 'effectiveDate'
  | 'abolishedDate'
  | 'relatedRoles'
  | 'fullText'
>

type KnowledgeFormState = Pick<
  ReferenceKnowledgeItem,
  | 'materialType'
  | 'title'
  | 'sourceOrg'
  | 'publishDate'
  | 'summary'
  | 'tags'
  | 'originLink'
  | 'personalNote'
>

const ROLE_OPTIONS = ['合规岗', '客户经理岗', '风控复核岗', '交易监测岗', '评级分析岗']
const TAG_OPTIONS = ['CDD', 'STR', '风险评级', '国际标准', 'FATF']

const defaultPolicyForm: PolicyFormState = {
  code: '',
  name: '',
  sourceLevel: '监管层',
  issuingUnit: '',
  documentNo: '',
  ownerDepartment: '',
  version: 'V1.0',
  status: 'draft',
  effectiveDate: '',
  abolishedDate: '',
  relatedRoles: [],
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

function getDaysToExpiry(abolishedDate?: string): number | null {
  if (!abolishedDate) return null
  const now = new Date()
  const target = new Date(abolishedDate)
  const diff = target.getTime() - now.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function SourceLevelBadge({ level }: { level: PolicyProcessItem['sourceLevel'] }) {
  const map: Record<PolicyProcessItem['sourceLevel'], string> = {
    监管层: 'bg-red-100 text-red-700',
    总公司层: 'bg-blue-100 text-blue-700',
    分公司层: 'bg-emerald-100 text-emerald-700',
  }
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[level]}`}>{level}</span>
}

export function PolicyModule() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<PolicyTab>('policy')

  const [policySearch, setPolicySearch] = useState('')
  const [policyModalOpen, setPolicyModalOpen] = useState(false)
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null)
  const [policyForm, setPolicyForm] = useState<PolicyFormState>(defaultPolicyForm)
  const [policyAttachmentName, setPolicyAttachmentName] = useState<string>('')

  const [expandedProcessId, setExpandedProcessId] = useState<string | null>(null)

  const [knowledgeTypeFilter, setKnowledgeTypeFilter] = useState<'all' | ReferenceKnowledgeItem['materialType']>('all')
  const [knowledgeTagFilter, setKnowledgeTagFilter] = useState<'all' | string>('all')
  const [knowledgeSearch, setKnowledgeSearch] = useState('')
  const [knowledgeModalOpen, setKnowledgeModalOpen] = useState(false)
  const [knowledgeInputMode, setKnowledgeInputMode] = useState<'manual' | 'upload'>('manual')
  const [knowledgeForm, setKnowledgeForm] = useState<KnowledgeFormState>(defaultKnowledgeForm)
  const [knowledgeAttachmentName, setKnowledgeAttachmentName] = useState('')
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState<string | null>(null)

  const {
    data: policiesData,
    loading: policyLoading,
    error: policyError,
    setData: setPoliciesData,
    refetch: refetchPolicies,
  } = useAMLData<PolicyProcessItem[]>('policy', 'query')

  const { data: processData, loading: processLoading, error: processError } =
    useAMLData<ProcessLibraryItem[]>('policyProcess', 'query')

  const {
    data: knowledgeData,
    loading: knowledgeLoading,
    error: knowledgeError,
    setData: setKnowledgeData,
  } = useAMLData<ReferenceKnowledgeItem[]>('policyKnowledge', 'query')

  const policies = useMemo(() => policiesData ?? [], [policiesData])
  const processes = useMemo(() => processData ?? [], [processData])
  const knowledges = useMemo(() => knowledgeData ?? [], [knowledgeData])

  const filteredPolicies = useMemo(() => {
    const keyword = policySearch.trim().toLowerCase()
    if (!keyword) return policies
    return policies.filter((row) => {
      const text = [row.name, row.documentNo, row.issuingUnit, row.fullText].join(' ').toLowerCase()
      return text.includes(keyword)
    })
  }, [policies, policySearch])

  const filteredKnowledges = useMemo(() => {
    return knowledges.filter((item) => {
      const typeMatch = knowledgeTypeFilter === 'all' || item.materialType === knowledgeTypeFilter
      const tagMatch = knowledgeTagFilter === 'all' || item.tags.includes(knowledgeTagFilter)
      const keyword = knowledgeSearch.trim().toLowerCase()
      const keywordMatch =
        keyword === '' ||
        [item.title, item.summary, item.personalNote].join(' ').toLowerCase().includes(keyword)
      return typeMatch && tagMatch && keywordMatch
    })
  }, [knowledges, knowledgeSearch, knowledgeTagFilter, knowledgeTypeFilter])

  const selectedKnowledge = filteredKnowledges.find((item) => item.id === selectedKnowledgeId) ?? null

  const openPolicyCreateModal = () => {
    setEditingPolicyId(null)
    setPolicyAttachmentName('')
    setPolicyForm(defaultPolicyForm)
    setPolicyModalOpen(true)
  }

  const openPolicyEditModal = (item: PolicyProcessItem) => {
    setEditingPolicyId(item.id)
    setPolicyAttachmentName(item.fileName ?? '')
    setPolicyForm({
      code: item.code,
      name: item.name,
      sourceLevel: item.sourceLevel,
      issuingUnit: item.issuingUnit,
      documentNo: item.documentNo,
      ownerDepartment: item.ownerDepartment,
      version: item.version,
      status: item.status,
      effectiveDate: item.effectiveDate,
      abolishedDate: item.abolishedDate ?? '',
      relatedRoles: item.relatedRoles,
      fullText: item.fullText,
    })
    setPolicyModalOpen(true)
  }

  const submitPolicyForm = async () => {
    if (
      !policyForm.code.trim() ||
      !policyForm.name.trim() ||
      !policyForm.issuingUnit.trim() ||
      !policyForm.documentNo.trim() ||
      !policyForm.effectiveDate
    ) {
      window.alert('请完整填写制度编码、名称、发文单位、文号和生效日期')
      return
    }

    if (editingPolicyId) {
      await notionService.savePolicy({ id: editingPolicyId, ...policyForm })
      setPoliciesData(
        policies.map((item) =>
          item.id === editingPolicyId
            ? {
                ...item,
                ...policyForm,
                abolishedDate: policyForm.abolishedDate || undefined,
                fileName: policyAttachmentName || undefined,
                updatedAt: new Date().toISOString(),
              }
            : item,
        ),
      )
    } else {
      const saved = await notionService.savePolicy(policyForm)
      const newItem: PolicyProcessItem = {
        id: saved.data.id,
        category: '制度',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        description: '',
        historyVersions: [{ version: policyForm.version, updatedAt: new Date().toISOString(), note: '初始创建' }],
        annotations: [],
        fileName: policyAttachmentName || undefined,
        ...policyForm,
        abolishedDate: policyForm.abolishedDate || undefined,
      }
      setPoliciesData([newItem, ...policies])
    }
    setPolicyModalOpen(false)
  }

  const policyColumns: Array<TableColumn<PolicyProcessItem>> = [
    { key: 'code', title: '制度编码' },
    { key: 'name', title: '制度名称' },
    { key: 'sourceLevel', title: '来源层级', render: (_, row) => <SourceLevelBadge level={row.sourceLevel} /> },
    { key: 'issuingUnit', title: '发文单位' },
    { key: 'documentNo', title: '文号' },
    { key: 'abolishedDate', title: '废止日期', render: (value) => (value ? String(value) : '-') },
    {
      key: 'status',
      title: '有效性状态',
      render: (_, row) => {
        const days = getDaysToExpiry(row.abolishedDate)
        return (
          <div className="flex items-center gap-1">
            <StatusBadge status={row.status} />
            {days !== null && days >= 0 && days <= 30 ? (
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">即将到期</span>
            ) : null}
          </div>
        )
      },
    },
    {
      key: 'id',
      title: '操作',
      className: 'whitespace-nowrap',
      render: (_, row) => (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate(`/org/policy/${row.id}`)}
            className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700"
          >
            查看全文
          </button>
          <button
            type="button"
            onClick={() => openPolicyEditModal(row)}
            className="rounded border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50"
          >
            编辑
          </button>
        </div>
      ),
    },
  ]

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
    {
      key: 'materialType',
      title: '资料类型',
      render: (value) => <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{String(value)}</span>,
    },
    { key: 'title', title: '标题' },
    { key: 'sourceOrg', title: '作者/来源机构' },
    { key: 'publishDate', title: '发布日期' },
    { key: 'summary', title: '摘要' },
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
          className="rounded border border-orange-200 bg-orange-50 px-2 py-1 text-xs text-orange-700"
          onClick={() => setSelectedKnowledgeId(row.id)}
        >
          查看详情
        </button>
      ),
    },
  ]

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">制度与流程管理</h2>
          <p className="mt-1 text-sm text-slate-500">制度库、流程库、参考知识库三位一体管理。</p>
        </div>
      </div>

      <div className="inline-flex rounded-lg border border-slate-200 p-1">
        {[
          ['policy', '制度库'],
          ['process', '流程库'],
          ['knowledge', '参考知识库'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key as PolicyTab)}
            className={`rounded px-3 py-1.5 text-sm ${
              activeTab === key ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'policy' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 lg:grid-cols-3">
            <label className="space-y-1 lg:col-span-2">
              <span className="text-xs font-medium text-slate-600">全库搜索</span>
              <div className="flex items-center rounded border border-slate-200 bg-white px-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={policySearch}
                  onChange={(event) => setPolicySearch(event.target.value)}
                  placeholder="搜索名称、文号、发文单位、全文关键字"
                  className="w-full border-none px-2 py-2 text-sm outline-none"
                />
              </div>
            </label>
            <div className="flex items-end gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                <Upload className="h-4 w-4" />
                上传制度文件
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.md,.txt"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) window.alert(`已选择文件：${file.name}`)
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() => void refetchPolicies()}
                className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                <RefreshCcw className="h-4 w-4" />
                刷新
              </button>
              <button
                type="button"
                onClick={openPolicyCreateModal}
                className="inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                新建制度
              </button>
            </div>
          </div>

          <DataTable
            columns={policyColumns}
            rowKey={(row) => row.id}
            data={filteredPolicies}
            loading={policyLoading}
            error={policyError}
            emptyText="未找到匹配的制度记录"
          />
        </div>
      ) : null}

      {activeTab === 'process' ? (
        <div className="space-y-4">
          <DataTable
            columns={processColumns}
            rowKey={(row) => row.id}
            data={processes}
            loading={processLoading}
            error={processError}
            emptyText="暂无流程数据"
          />

          {expandedProcessId ? (
            <article className="rounded-lg border border-slate-200 p-4">
              <h3 className="text-base font-semibold text-slate-900">流程步骤时间轴</h3>
              <div className="mt-3 space-y-3">
                {(processes.find((item) => item.id === expandedProcessId)?.steps ?? []).map((step) => (
                  <div key={step.id} className="flex gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
                      {step.index}
                    </div>
                    <div className="flex-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                      <p className="font-semibold text-slate-900">{step.name}</p>
                      <p className="mt-1 text-slate-600">触发条件：{step.triggerCondition}</p>
                      <p className="text-slate-600">责任岗位：{step.ownerRole}</p>
                      <p className="text-slate-600">时效要求：{step.sla}</p>
                      <p className="text-slate-600">留痕要求：{step.evidenceRequirement}</p>
                      <p className="text-slate-600">备注：{step.note ?? '-'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ) : null}
        </div>
      ) : null}

      {activeTab === 'knowledge' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 lg:grid-cols-4">
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-600">资料类型</span>
              <select
                value={knowledgeTypeFilter}
                onChange={(event) => setKnowledgeTypeFilter(event.target.value as typeof knowledgeTypeFilter)}
                className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="all">全部类型</option>
                <option value="图书">图书</option>
                <option value="论文">论文</option>
                <option value="监管报告">监管报告</option>
                <option value="新闻资讯">新闻资讯</option>
                <option value="观点文章">观点文章</option>
                <option value="其他">其他</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-600">标签筛选</span>
              <select
                value={knowledgeTagFilter}
                onChange={(event) => setKnowledgeTagFilter(event.target.value)}
                className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="all">全部标签</option>
                {TAG_OPTIONS.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 lg:col-span-2">
              <span className="text-xs font-medium text-slate-600">全文搜索</span>
              <div className="flex items-center rounded border border-slate-200 bg-white px-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={knowledgeSearch}
                  onChange={(event) => setKnowledgeSearch(event.target.value)}
                  placeholder="搜索标题、摘要、笔记"
                  className="w-full border-none px-2 py-2 text-sm outline-none"
                />
              </div>
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setKnowledgeModalOpen(true)}
              className="inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              新增资料
            </button>
          </div>

          <DataTable
            columns={knowledgeColumns}
            rowKey={(row) => row.id}
            data={filteredKnowledges}
            loading={knowledgeLoading}
            error={knowledgeError}
            emptyText="暂无匹配资料"
          />

          {selectedKnowledge ? (
            <article className="rounded-lg border border-slate-200 p-4">
              <h3 className="text-base font-semibold text-slate-900">资料详情页</h3>
              <p className="mt-2 text-sm text-slate-700">{selectedKnowledge.summary}</p>
              <div className="mt-3 space-y-2 text-sm">
                <p>
                  原文链接：
                  {selectedKnowledge.originLink ? (
                    <a className="ml-1 text-blue-600 underline" href={selectedKnowledge.originLink} target="_blank">
                      {selectedKnowledge.originLink}
                    </a>
                  ) : (
                    `附件预览：${selectedKnowledge.attachmentName ?? '无'}`
                  )}
                </p>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-600">个人笔记</span>
                  <textarea
                    value={selectedKnowledge.personalNote}
                    onChange={(event) => {
                      setKnowledgeData(
                        knowledges.map((item) =>
                          item.id === selectedKnowledge.id
                            ? { ...item, personalNote: event.target.value, updatedAt: new Date().toISOString() }
                            : item,
                        ),
                      )
                    }}
                    className="h-24 w-full rounded border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
              </div>
            </article>
          ) : null}
        </div>
      ) : null}

      <Modal
        open={policyModalOpen}
        title={editingPolicyId ? '编辑制度' : '新建制度'}
        onClose={() => setPolicyModalOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => setPolicyModalOpen(false)}
            >
              取消
            </button>
            <button
              type="button"
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              onClick={() => void submitPolicyForm()}
            >
              保存
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-600">来源层级</span>
            <select
              value={policyForm.sourceLevel}
              onChange={(event) =>
                setPolicyForm((prev) => ({ ...prev, sourceLevel: event.target.value as PolicyFormState['sourceLevel'] }))
              }
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="监管层">监管层</option>
              <option value="总公司层">总公司层</option>
              <option value="分公司层">分公司层</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-600">发文单位</span>
            <input
              value={policyForm.issuingUnit}
              onChange={(event) => setPolicyForm((prev) => ({ ...prev, issuingUnit: event.target.value }))}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-600">制度编码</span>
            <input
              value={policyForm.code}
              onChange={(event) => setPolicyForm((prev) => ({ ...prev, code: event.target.value }))}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-600">文号</span>
            <input
              value={policyForm.documentNo}
              onChange={(event) => setPolicyForm((prev) => ({ ...prev, documentNo: event.target.value }))}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              placeholder="如：合规〔2026〕001号"
            />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-medium text-slate-600">制度名称</span>
            <input
              value={policyForm.name}
              onChange={(event) => setPolicyForm((prev) => ({ ...prev, name: event.target.value }))}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-600">生效日期</span>
            <input
              type="date"
              value={policyForm.effectiveDate}
              onChange={(event) => setPolicyForm((prev) => ({ ...prev, effectiveDate: event.target.value }))}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-600">废止日期</span>
            <input
              type="date"
              value={policyForm.abolishedDate}
              onChange={(event) => setPolicyForm((prev) => ({ ...prev, abolishedDate: event.target.value }))}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-600">版本</span>
            <input
              value={policyForm.version}
              onChange={(event) => setPolicyForm((prev) => ({ ...prev, version: event.target.value }))}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-600">状态</span>
            <select
              value={policyForm.status}
              onChange={(event) => setPolicyForm((prev) => ({ ...prev, status: event.target.value as PolicyFormState['status'] }))}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="draft">草稿</option>
              <option value="active">生效</option>
              <option value="inactive">停用</option>
              <option value="archived">已归档</option>
            </select>
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-medium text-slate-600">关联岗位（多选）</span>
            <div className="flex flex-wrap gap-2 rounded border border-slate-200 p-2">
              {ROLE_OPTIONS.map((role) => {
                const checked = policyForm.relatedRoles.includes(role)
                return (
                  <label key={role} className="inline-flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setPolicyForm((prev) => ({
                          ...prev,
                          relatedRoles: checked
                            ? prev.relatedRoles.filter((item) => item !== role)
                            : [...prev.relatedRoles, role],
                        }))
                      }
                    />
                    {role}
                  </label>
                )
              })}
            </div>
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-medium text-slate-600">制度全文</span>
            <textarea
              value={policyForm.fullText}
              onChange={(event) => setPolicyForm((prev) => ({ ...prev, fullText: event.target.value }))}
              className="h-32 w-full rounded border border-slate-200 px-3 py-2 text-sm"
              placeholder="支持粘贴全文内容"
            />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-medium text-slate-600">附件上传（PDF/DOC/DOCX/MD）</span>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.md"
              onChange={(event) => setPolicyAttachmentName(event.target.files?.[0]?.name ?? '')}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
            />
            {policyAttachmentName ? <p className="text-xs text-slate-500">已选择：{policyAttachmentName}</p> : null}
          </label>
        </div>
      </Modal>

      <Modal
        open={knowledgeModalOpen}
        title="新增参考资料"
        onClose={() => setKnowledgeModalOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => setKnowledgeModalOpen(false)}
            >
              取消
            </button>
            <button
              type="button"
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              onClick={() => {
                if (!knowledgeForm.title.trim()) {
                  window.alert('请填写资料标题')
                  return
                }
                const item: ReferenceKnowledgeItem = {
                  id: `ref-${Date.now()}`,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  attachmentName: knowledgeInputMode === 'upload' ? knowledgeAttachmentName : undefined,
                  ...knowledgeForm,
                }
                setKnowledgeData([item, ...knowledges])
                setKnowledgeForm(defaultKnowledgeForm)
                setKnowledgeAttachmentName('')
                setKnowledgeModalOpen(false)
              }}
            >
              保存
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="inline-flex rounded border border-slate-200 p-1 text-sm">
            <button
              type="button"
              onClick={() => setKnowledgeInputMode('manual')}
              className={`rounded px-2 py-1 ${knowledgeInputMode === 'manual' ? 'bg-blue-600 text-white' : 'text-slate-600'}`}
            >
              手动录入
            </button>
            <button
              type="button"
              onClick={() => setKnowledgeInputMode('upload')}
              className={`rounded px-2 py-1 ${knowledgeInputMode === 'upload' ? 'bg-blue-600 text-white' : 'text-slate-600'}`}
            >
              上传文件
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              placeholder="标题"
              value={knowledgeForm.title}
              onChange={(event) => setKnowledgeForm((prev) => ({ ...prev, title: event.target.value }))}
              className="rounded border border-slate-200 px-3 py-2 text-sm md:col-span-2"
            />
            <input
              placeholder="来源机构/作者"
              value={knowledgeForm.sourceOrg}
              onChange={(event) => setKnowledgeForm((prev) => ({ ...prev, sourceOrg: event.target.value }))}
              className="rounded border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={knowledgeForm.publishDate}
              onChange={(event) => setKnowledgeForm((prev) => ({ ...prev, publishDate: event.target.value }))}
              className="rounded border border-slate-200 px-3 py-2 text-sm"
            />
            <textarea
              placeholder="摘要"
              value={knowledgeForm.summary}
              onChange={(event) => setKnowledgeForm((prev) => ({ ...prev, summary: event.target.value }))}
              className="h-20 rounded border border-slate-200 px-3 py-2 text-sm md:col-span-2"
            />
            {knowledgeInputMode === 'manual' ? (
              <input
                placeholder="原文链接"
                value={knowledgeForm.originLink ?? ''}
                onChange={(event) => setKnowledgeForm((prev) => ({ ...prev, originLink: event.target.value }))}
                className="rounded border border-slate-200 px-3 py-2 text-sm md:col-span-2"
              />
            ) : (
              <input
                type="file"
                onChange={(event) => setKnowledgeAttachmentName(event.target.files?.[0]?.name ?? '')}
                className="rounded border border-slate-200 px-3 py-2 text-sm md:col-span-2"
              />
            )}
          </div>
        </div>
      </Modal>
    </section>
  )
}
