import {
  Check,
  ChevronRight,
  FileText,
  Plus,
  Upload,
  X,
} from 'lucide-react'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

type NotionWorkUnitRow = {
  id: string
  [key: string]: unknown
}

type NotionNodeRow = {
  id: string
  name?: string
  stage?: string
  order?: number | null
  status?: string
  assignee?: string
  dueDate?: string
  [key: string]: unknown
}

type StageKey = '需求立项' | '计划设计' | '材料准备' | '培训实施' | '归档评估'

const STAGES: StageKey[] = ['需求立项', '计划设计', '材料准备', '培训实施', '归档评估']

type DemandStatus = '待开始' | '进行中' | '已完成'

type DemandMethodKind = '政策' | '指令' | '岗位' | '计划' | '日常' | '问卷' | '访谈' | '座谈' | '复盘'

type DemandOption = {
  id: string
  label: string
  kind: DemandMethodKind
  recommended?: boolean
}

type UnifiedEntry = {
  activeTab: 'db' | 'upload' | 'paste'
  libraryDb: string
  librarySelectedItems: string[]
  uploadedFiles: { id: string; name: string; size: number }[]
  pastedTexts: { id: string; text: string }[]
  trainingRequirements: { id: string; text: string }[]
}

type DemandDetail = { kind: DemandMethodKind } & UnifiedEntry

type DemandMatrixRow = {
  optionId: string
  label: string
  kind: DemandMethodKind
  status: DemandStatus
  owner: string
  dueDate: string
  detail: DemandDetail
  convertedCount: number
}

function safeText(value: unknown): string {
  return String(value ?? '').trim()
}

function stageIndex(value: string): number {
  const idx = STAGES.indexOf(value as StageKey)
  return idx === -1 ? 0 : idx
}

function normalizeStage(value: string): StageKey {
  if (value === '课件制作') return '材料准备'
  if (value === '归档闭环') return '归档评估'
  if (STAGES.includes(value as StageKey)) return value as StageKey
  return '需求立项'
}

function getWorkUnitName(row: NotionWorkUnitRow | null): string {
  return (
    safeText((row as any)?.name) ||
    safeText(row?.项目名称) ||
    safeText(row?.名称) ||
    safeText(row?.标题) ||
    safeText((row as any)?.Name) ||
    '未命名培训'
  )
}

function getWorkUnitType(row: NotionWorkUnitRow | null): string {
  return safeText((row as any)?.type) || safeText(row?.类型) || safeText(row?.项目类型) || '培训'
}

function getWorkUnitStage(row: NotionWorkUnitRow | null): StageKey {
  const raw = safeText((row as any)?.stage) || safeText(row?.当前阶段) || safeText(row?.阶段) || '需求立项'
  return normalizeStage(raw)
}

function getWorkUnitOwner(row: NotionWorkUnitRow | null): string {
  return safeText((row as any)?.owner) || safeText(row?.负责人) || safeText(row?.Owner) || safeText(row?.owner) || '未指定'
}

function getWorkUnitPlanDate(row: NotionWorkUnitRow | null): string {
  return safeText((row as any)?.planDate) || safeText(row?.计划日期) || safeText(row?.计划开始) || safeText(row?.开始日期) || ''
}

function createEmptyDemandDetail(kind: DemandMethodKind, _label?: string): DemandDetail {
  return {
    kind,
    activeTab: 'db',
    libraryDb: '',
    librarySelectedItems: [],
    uploadedFiles: [],
    pastedTexts: [],
    trainingRequirements: [],
  }
}

const MOCK_CONVERTED_COUNT: Record<string, number> = {
  policy: 2,
  directive: 0,
  role: 1,
  daily: 0,
}

const UNIFIED_MOCK_REQS: Record<DemandMethodKind, string[]> = {
  政策: ['了解反洗钱法最新修订内容', '掌握客户身份识别流程', '熟悉可疑交易报告规范', '学习合规监管最新要求', '理解政策文件核心条款'],
  指令: ['理解监管指令核心要求', '落实合规整改具体事项', '建立合规跟踪与反馈机制', '明确专项指令执行职责', '掌握指令执行时限要求'],
  岗位: ['识别本岗位主要合规风险点', '掌握岗位日常操作规范', '了解违规行为处理流程', '熟悉岗位培训考核标准', '建立岗位风险防控意识'],
  计划: ['梳理全年合规培训重点方向', '建立分层分类培训体系', '制定各阶段考核标准', '明确培训目标与预期成效', '优化培训资源配置计划'],
  日常: ['熟悉日常合规操作要点', '掌握问题发现与上报流程', '了解违规案例与警示教训', '强化日常行为合规意识', '建立持续学习习惯'],
  问卷: ['员工对合规流程理解存在偏差', '需加强反洗钱实操培训', '新员工入职培训需系统化', '提升员工合规自查能力', '强化问卷反馈问题专项培训'],
  访谈: ['中层管理者需提升合规意识', '部门间协作流程不清晰', '需针对岗位差异化设计课程', '加强访谈发现问题的整改跟踪', '建立管理层培训定期机制'],
  座谈: ['现有培训形式参与度低', '建议增加案例讨论环节', '需定期复盘培训效果', '优化座谈会议培训议题设置', '强化培训成果的实践转化'],
  复盘: ['针对上次薄弱环节加强专项培训', '优化培训形式提升参与度', '建立培训效果跟踪机制', '修正上次培训中的知识误区', '提升培训课件质量与实用性'],
}

function createDemandMatrixRow(option: DemandOption): DemandMatrixRow {
  return {
    optionId: option.id,
    label: option.label,
    kind: option.kind,
    status: '待开始',
    owner: '',
    dueDate: '',
    detail: createEmptyDemandDetail(option.kind, option.label),
    convertedCount: MOCK_CONVERTED_COUNT[option.id] ?? 0,
  }
}

function buildPlanRange(start: string, end: string): string {
  const s = safeText(start)
  const e = safeText(end)
  if (s && e) return `${s} - ${e}`
  if (s) return s
  if (e) return e
  return ''
}


const LIBRARY_DBS = [
  {
    id: 'aml',
    name: '反洗钱合规库',
    items: ['反洗钱法（2024修订）', '金融机构反洗钱监督管理办法', '关于加强客户身份识别工作的通知', '年度合规培训工作方案'],
  },
  {
    id: 'training',
    name: '员工培训资料库',
    items: ['反洗钱基础知识培训材料', '员工合规意识提升手册', '案例分析：可疑交易识别', '新员工入职合规培训课件'],
  },
  {
    id: 'ops',
    name: '操作规程文档库',
    items: ['柜面操作合规规程', '客户开户流程规范', '大额交易申报操作指引', '可疑交易报告填报规范'],
  },
]



function extractKeywords(reqs: { id: string; text: string }[], max = 3): string[] {
  const result: string[] = []
  for (const r of reqs) {
    const t = r.text.trim()
    if (!t) continue
    // Take first 5–6 Chinese chars as a keyword chip
    result.push(t.slice(0, 6).replace(/[，。、：；！？]/g, ''))
    if (result.length >= max) break
  }
  return result.filter(Boolean)
}

function getTrainingReqs(detail: DemandDetail): { id: string; text: string }[] {
  return detail.trainingRequirements
}




// ── UnifiedSourcePanel ────────────────────────────────────────────────────────

function UnifiedSourcePanel({
  label,
  draft,
  onClose,
  onSave,
}: {
  label: string
  draft: DemandDetail
  onClose: () => void
  onSave: (d: DemandDetail) => void
}) {
  const [local, setLocal] = useState<DemandDetail>(draft)
  const [pasteInput, setPasteInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const mockReqs = UNIFIED_MOCK_REQS[local.kind] ?? []
  const selectedDb = LIBRARY_DBS.find((db) => db.id === local.libraryDb)

  const [aiError, setAiError] = useState<string | null>(null)

  const handleExtract = async () => {
    setAiError(null)

    // Collect from ALL three tabs simultaneously
    const parts: string[] = []
    if (local.librarySelectedItems.length > 0) {
      parts.push('系统数据库已选条目：\n' + local.librarySelectedItems.map((x) => x).join('\n'))
    }
    if (local.uploadedFiles.length > 0) {
      parts.push('已上传文件：\n' + local.uploadedFiles.map((f) => `文件：${f.name}`).join('\n'))
    }
    if (local.pastedTexts.length > 0) {
      parts.push('粘贴文本内容：\n' + local.pastedTexts.map((p) => p.text).join('\n\n'))
    }

    if (parts.length === 0) {
      setAiError('请先添加资料来源内容')
      return
    }

    const content = parts.join('\n\n---\n\n')
    const prompt =
      `你是一名培训需求分析专家。以下是从【${label}】渠道收集的相关资料内容：\n\n` +
      `${content}\n\n` +
      `请根据以上内容，提炼出3~5条具体的员工培训需求。\n` +
      `要求：每条需求用一句完整的话表达，以动词开头（如"掌握"、"了解"、"熟悉"），直接输出编号列表，不要任何解释。`

    setAiLoading(true)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as any).message ?? `HTTP ${res.status}`)
      }
      const data = await res.json()
      const raw = String((data as any).result ?? (data as any).text ?? '')
      // Parse numbered list: accept "1." "1、" "1）" etc.
      const lines = raw
        .split(/\n/)
        .map((l: string) => l.replace(/^\s*\d+[.、）)。]\s*/, '').trim())
        .filter((l: string) => l.length > 4)
      const reqs =
        lines.length > 0
          ? lines.map((t: string) => ({ id: `req-${Date.now()}-${Math.random().toString(36).slice(2)}`, text: t }))
          : mockReqs.slice(0, 3).map((t) => ({ id: `req-${Date.now()}-${Math.random().toString(36).slice(2)}`, text: t }))
      setLocal((prev) => ({ ...prev, trainingRequirements: reqs }))
    } catch (e) {
      setAiError('提炼失败，请检查网络或重试')
      console.error('[handleExtract]', e)
    } finally {
      setAiLoading(false)
    }
  }

  const tabCls = (key: 'db' | 'upload' | 'paste') =>
    `rounded-md px-3 py-1.5 text-sm transition-colors ${local.activeTab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl">
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">{label}</h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-5">
            {/* Tab bar */}
            <div>
              <div className="mb-3 text-sm font-medium text-slate-700">信息来源</div>
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                <button type="button" onClick={() => setLocal((p) => ({ ...p, activeTab: 'db' }))} className={tabCls('db')}>📁 系统数据库</button>
                <button type="button" onClick={() => setLocal((p) => ({ ...p, activeTab: 'upload' }))} className={tabCls('upload')}>⬆ 上传文件</button>
                <button type="button" onClick={() => setLocal((p) => ({ ...p, activeTab: 'paste' }))} className={tabCls('paste')}>📋 粘贴文本</button>
              </div>

              {/* ── Tab 1: 系统数据库 ── */}
              {local.activeTab === 'db' && (
                <div className="mt-3 space-y-3">
                  <select
                    value={local.libraryDb}
                    onChange={(e) => setLocal((p) => ({ ...p, libraryDb: e.target.value, librarySelectedItems: [] }))}
                    className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-300"
                  >
                    <option value="">— 选择数据库 —</option>
                    {LIBRARY_DBS.map((db) => (
                      <option key={db.id} value={db.id}>{db.name}</option>
                    ))}
                  </select>

                  {selectedDb ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="mb-2 text-xs text-slate-500">{selectedDb.name}（{selectedDb.items.length} 条记录）</div>
                      <div className="space-y-1.5">
                        {selectedDb.items.slice(0, 5).map((item) => {
                          const checked = local.librarySelectedItems.includes(item)
                          return (
                            <label key={item} className="flex cursor-pointer items-center gap-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  const next = checked
                                    ? local.librarySelectedItems.filter((x) => x !== item)
                                    : [...local.librarySelectedItems, item]
                                  setLocal((p) => ({ ...p, librarySelectedItems: next }))
                                }}
                                className="accent-blue-600"
                              />
                              <span className="text-sm text-slate-700">{item}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}

                  {local.librarySelectedItems.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-xs text-slate-500 self-center">已选 {local.librarySelectedItems.length} 条：</span>
                      {local.librarySelectedItems.map((item) => (
                        <span key={item} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700">
                          {item}
                          <button type="button" onClick={() => setLocal((p) => ({ ...p, librarySelectedItems: p.librarySelectedItems.filter((x) => x !== item) }))} className="hover:text-blue-900">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={aiLoading}
                      onClick={handleExtract}
                      className={`inline-flex items-center gap-1.5 rounded px-3 py-2 text-sm ${aiLoading ? 'cursor-not-allowed bg-slate-100 text-slate-400' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                    >
                      {aiLoading ? '⏳ 分析中...' : '✨ 提取培训需求'}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Tab 2: 上传文件 ── */}
              {local.activeTab === 'upload' && (
                <div className="mt-3 space-y-2">
                  {local.uploadedFiles.length > 0 && (
                    <div className="space-y-1.5">
                      {local.uploadedFiles.map((f) => (
                        <div key={f.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-700">{f.name}</p>
                              <p className="text-xs text-slate-400">{(f.size / 1024).toFixed(1)} KB</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setLocal((p) => ({ ...p, uploadedFiles: p.uploadedFiles.filter((x) => x.id !== f.id) }))}
                            className="ml-2 shrink-0 rounded border border-slate-200 p-1 text-slate-400 hover:bg-white hover:text-slate-700"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 py-6 text-sm text-slate-500 hover:border-blue-300 hover:bg-blue-50"
                  >
                    <Upload className="h-5 w-5" />
                    <span>点击或拖拽文件到此处</span>
                    <span className="text-xs text-slate-400">支持多选 · .pdf .docx .xlsx .txt · 每个最大 10MB</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.xlsx,.txt"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? [])
                      const valid = files.filter((f) => f.size <= 10 * 1024 * 1024)
                      const entries = valid.map((f) => ({ id: `file-${Date.now()}-${Math.random().toString(36).slice(2)}`, name: f.name, size: f.size }))
                      if (entries.length > 0) setLocal((p) => ({ ...p, uploadedFiles: [...p.uploadedFiles, ...entries] }))
                      e.target.value = ''
                    }}
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={aiLoading}
                      onClick={handleExtract}
                      className={`inline-flex items-center gap-1.5 rounded px-3 py-2 text-sm ${aiLoading ? 'cursor-not-allowed bg-slate-100 text-slate-400' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                    >
                      {aiLoading ? '⏳ 分析中...' : '✨ 提取培训需求'}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Tab 3: 粘贴文本 ── */}
              {local.activeTab === 'paste' && (
                <div className="mt-3 space-y-2">
                  {local.pastedTexts.length > 0 && (
                    <div className="space-y-2">
                      {local.pastedTexts.map((card) => (
                        <div key={card.id} className="relative rounded-lg border border-slate-200 bg-slate-50 p-3 pr-8">
                          <p className="whitespace-pre-wrap text-sm text-slate-700">{card.text.length > 120 ? card.text.slice(0, 120) + '…' : card.text}</p>
                          <button
                            type="button"
                            onClick={() => setLocal((p) => ({ ...p, pastedTexts: p.pastedTexts.filter((x) => x.id !== card.id) }))}
                            className="absolute right-2 top-2 text-slate-400 hover:text-slate-700"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <textarea
                    value={pasteInput}
                    onChange={(e) => setPasteInput(e.target.value)}
                    rows={4}
                    placeholder="请粘贴相关文字内容…"
                    className="w-full resize-none rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const text = pasteInput.trim()
                        if (!text) return
                        setLocal((p) => ({ ...p, pastedTexts: [...p.pastedTexts, { id: `paste-${Date.now()}`, text }] }))
                        setPasteInput('')
                      }}
                      className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      追加
                    </button>
                    <button
                      type="button"
                      disabled={aiLoading}
                      onClick={handleExtract}
                      className={`inline-flex items-center gap-1.5 rounded px-3 py-2 text-sm ${aiLoading ? 'cursor-not-allowed bg-slate-100 text-slate-400' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                    >
                      {aiLoading ? '⏳ 分析中...' : '✨ 提取培训需求'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Divider ── */}
            <div className="border-t border-slate-200" />

            {/* ── 培训需求 ── */}
            <div className="space-y-3">
              <div className="text-sm font-medium text-slate-700">培训需求</div>
              {aiLoading ? (
                <div className="rounded border border-slate-200 bg-slate-50 py-4 text-center text-sm text-slate-400">AI 分析中，请稍候...</div>
              ) : aiError ? (
                <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{aiError}</div>
              ) : null}
              {!aiLoading && local.trainingRequirements.length === 0 ? (
                <div className="rounded border border-dashed border-slate-200 bg-slate-50 py-4 text-center text-sm text-slate-400">
                  暂无需求，可点击上方「✨ 提取培训需求」自动生成
                </div>
              ) : !aiLoading ? (
                <div className="space-y-2">
                  {local.trainingRequirements.map((req, idx) => (
                    <div key={req.id} className="flex items-start gap-2">
                      <span className="mt-2.5 w-5 shrink-0 text-center text-xs text-slate-400">{idx + 1}</span>
                      <p className="flex-1 rounded border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700 leading-relaxed">{req.text}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
          <button type="button" onClick={onClose} className="rounded border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
            取消
          </button>
          <button type="button" onClick={() => onSave(local)} className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
            保存
          </button>
        </div>
      </div>
    </div>
  )
}


export default function TrainingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialTab = String(searchParams.get('tab') ?? '').trim()

  const [workUnit, setWorkUnit] = useState<NotionWorkUnitRow | null>(null)
  const [workUnitLoading, setWorkUnitLoading] = useState(false)
  const [workUnitError, setWorkUnitError] = useState<string | null>(null)

  const [nodes, setNodes] = useState<NotionNodeRow[]>([])
  const [nodesLoading, setNodesLoading] = useState(false)
  const [nodesError, setNodesError] = useState<string | null>(null)

  const tabAlias = (tab: string) => {
    const t = String(tab ?? '').trim()
    if (t === 'tasks') return '任务清单'
    if (t === 'materials') return '课件材料'
    if (t === 'participants') return '参训人员'
    if (t === 'records') return '数据记录'
    if (t === 'review') return '效果评估'
    return t
  }
  const [activeTab, setActiveTab] = useState<string>(tabAlias(initialTab) || '')

  const [aiOpen, setAiOpen] = useState(false)
  const [aiInput, setAiInput] = useState('')
  const [stageUpdating, setStageUpdating] = useState(false)
  const [stageUpdateError, setStageUpdateError] = useState<string | null>(null)
  const [stageConfirmOpen, setStageConfirmOpen] = useState(false)
  const [stageConfirmMessage, setStageConfirmMessage] = useState('')
  const [stageConfirmTarget, setStageConfirmTarget] = useState<StageKey>('需求立项')
  const [creatingTask, setCreatingTask] = useState(false)
  const [createTaskError, setCreateTaskError] = useState<string | null>(null)

  const [localTasks, setLocalTasks] = useState<Array<{ id: string; title: string; done: boolean }>>([])
  const [newTaskTitle, setNewTaskTitle] = useState('')

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [localMaterials, setLocalMaterials] = useState<Array<{ id: string; name: string; uploadedAt: string }>>([])
  const toastTimerRef = useRef<number | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (message: string) => {
    setToastMessage(message)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToastMessage(null), 1500)
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    }
  }, [])

  const [demandOptions] = useState<DemandOption[]>([
    { id: 'policy', label: '政策规则', kind: '政策', recommended: true },
    { id: 'directive', label: '专项指令', kind: '指令', recommended: true },
    { id: 'role', label: '岗位职责', kind: '岗位' },
    { id: 'plan', label: '工作计划', kind: '计划' },
    { id: 'daily', label: '日常沟通', kind: '日常' },
    { id: 'questionnaire', label: '问卷调查', kind: '问卷' },
    { id: 'interview', label: '人员访谈', kind: '访谈' },
    { id: 'symposium', label: '专题座谈', kind: '座谈' },
    { id: 'review', label: '项目复盘', kind: '复盘' },
  ])
  const [selectedDemandOptionIds, setSelectedDemandOptionIds] = useState<string[]>([])
  const [demandMatrix, setDemandMatrix] = useState<Record<string, DemandMatrixRow>>({})
  const [progressPopoverId, setProgressPopoverId] = useState<string | null>(null)
  const [unifiedDialogOptId, setUnifiedDialogOptId] = useState<string | null>(null)

  type ReqItem = {
    id: number; title: string; desc: string; keywords: string[];
    sources: string[]; priority: string; status: string; expanded: boolean;
    trainingSubject: string[]; scenario: string; requirementType: string; relatedAction: string;
    expandDetail: boolean;
  }
  const MOCK_REQ_LIST: ReqItem[] = [
    { id: 1, title: '掌握反洗钱交易识别方法', desc: '员工需能识别日常业务中的洗钱风险信号并及时上报',
      keywords: ['反洗钱', '合规义务'], sources: ['政策规则'], priority: '高', status: '已纳入计划', expanded: false,
      trainingSubject: ['合规岗', '客户经理'], scenario: '日常业务审核中发现异常交易',
      requirementType: '实操类', relatedAction: '识别 → 记录 → 上报', expandDetail: false },
    { id: 2, title: '了解监管合规基本框架', desc: '员工需理解公司合规体系的层级结构和基本要求',
      keywords: ['合规框架', '监管要求'], sources: ['专项指令'], priority: '中', status: '待转化', expanded: false,
      trainingSubject: ['全员'], scenario: '', requirementType: '理念类', relatedAction: '', expandDetail: false },
    { id: 3, title: '熟悉客户风险分级操作规程', desc: '客户经理需掌握 KYC 流程中的风险评级方法',
      keywords: ['KYC', '风险分级'], sources: ['岗位职责'], priority: '高', status: '暂不处理', expanded: false,
      trainingSubject: [], scenario: '', requirementType: '', relatedAction: '', expandDetail: false },
  ]
  const [reqList, setReqList] = useState<ReqItem[]>(MOCK_REQ_LIST)
  const [sourceDropdownRowId, setSourceDropdownRowId] = useState<number | null>(null)
  const [ideaText, setIdeaText] = useState('')
  const [ideaLogs, setIdeaLogs] = useState<Array<{id:number;seq:number;time:string;text:string;aiSources:string[]|null;selectedSources:string[]}>>([])  
  const [ideaCollapsed, setIdeaCollapsed] = useState(false)
  const [ideaSuggestionVisible, setIdeaSuggestionVisible] = useState(false)
  const [ideaSuggestionCollapsed, setIdeaSuggestionCollapsed] = useState(false)
  const [ideaLogsCollapsed, setIdeaLogsCollapsed] = useState(true)
  const [ideaSuggestionLoading, setIdeaSuggestionLoading] = useState(false)
  const [ideaSuggestionError, setIdeaSuggestionError] = useState<string | null>(null)
  const [ideaSuggestions, setIdeaSuggestions] = useState<Array<{ label: string; reason: string }>>([])

  const refreshWorkUnit = async (workUnitId: string) => {
    const res = await fetch('/api/workunit/list?type=%E5%9F%B9%E8%AE%AD')
    if (!res.ok) throw new Error(String(res.status))
    const data = await res.json()
    const list = (Array.isArray(data) ? data : Array.isArray((data as any)?.results) ? (data as any).results : []) as NotionWorkUnitRow[]
    const found = list.find((r) => safeText(r.id) === workUnitId) ?? null
    setWorkUnit(found)
  }

  useEffect(() => {
    const workUnitId = safeText(id)
    if (!workUnitId) return
    const load = async () => {
      setWorkUnitLoading(true)
      setWorkUnitError(null)
      try {
        await refreshWorkUnit(workUnitId)
      } catch (e) {
        setWorkUnitError(e instanceof Error ? e.message : String(e))
      } finally {
        setWorkUnitLoading(false)
      }
    }
    load()
  }, [id])

  useEffect(() => {
    const workUnitId = safeText(id)
    if (!workUnitId) return
    const load = async () => {
      setNodesLoading(true)
      setNodesError(null)
      try {
        const res = await fetch(`/api/nodes/list?workUnitId=${encodeURIComponent(workUnitId)}`)
        if (!res.ok) throw new Error(String(res.status))
        const data = await res.json()
        setNodes((Array.isArray(data) ? data : []) as NotionNodeRow[])
      } catch (e) {
        setNodesError(e instanceof Error ? e.message : String(e))
      } finally {
        setNodesLoading(false)
      }
    }
    load()
  }, [id])

  useEffect(() => {
    const mapped = nodes.slice(0, 50).map((n, idx) => {
      const status = safeText((n as any).status)
      const done = /完成/.test(status) || status.toLowerCase() === 'done'
      return {
        id: safeText(n.id) || `node-${idx}`,
        title: safeText((n as any).name) || `任务 ${idx + 1}`,
        done,
      }
    })
    setLocalTasks(mapped)
  }, [nodes])

  const title = getWorkUnitName(workUnit)
  const type = getWorkUnitType(workUnit)
  const stage = getWorkUnitStage(workUnit)
  const owner = getWorkUnitOwner(workUnit)
  const planDate = getWorkUnitPlanDate(workUnit)
  const status = safeText((workUnit as any)?.status) || safeText((workUnit as any)?.状态)
  const department = safeText((workUnit as any)?.department) || safeText((workUnit as any)?.牵头部门)
  const planStartDate = safeText((workUnit as any)?.planStartDate) || planDate
  const planEndDate = safeText((workUnit as any)?.planEndDate)
  const summary = safeText((workUnit as any)?.summary)
  const planRange = buildPlanRange(planStartDate, planEndDate)

  const stageTabs = useMemo(() => {
    if (stage === '需求立项') return ['信息收集', '需求清单']
    if (stage === '计划设计') return ['方案设计', '资源计划', '需求回顾']
    if (stage === '材料准备') return ['任务清单', '课件材料', '审核状态']
    if (stage === '培训实施') return ['任务清单', '参训人员', '签到记录']
    if (stage === '归档评估') return ['效果评估', '数据记录', '证据归档']
    return ['任务清单']
  }, [stage])

  useEffect(() => {
    if (stageTabs.length === 0) return
    setActiveTab((prev) => (stageTabs.includes(prev) ? prev : stageTabs[0]))
  }, [stageTabs])

  const stageIdx = useMemo(() => stageIndex(stage), [stage])

  const updateStage = async (nextStage: StageKey) => {
    const workUnitId = safeText(id)
    if (!workUnitId) return
    setStageUpdating(true)
    setStageUpdateError(null)
    try {
      const res = await fetch(`/api/workunit/${encodeURIComponent(workUnitId)}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: nextStage }),
      })
      if (!res.ok) throw new Error(String(res.status))
      setWorkUnitLoading(true)
      setWorkUnitError(null)
      try {
        await refreshWorkUnit(workUnitId)
      } catch (e) {
        setWorkUnitError(e instanceof Error ? e.message : String(e))
      } finally {
        setWorkUnitLoading(false)
      }
    } catch (e) {
      setStageUpdateError(e instanceof Error ? e.message : String(e))
    } finally {
      setStageUpdating(false)
    }
  }

  const onClickStage = (nextStage: StageKey) => {
    const currentIndex = stageIdx
    const nextIndex = stageIndex(nextStage)
    if (nextIndex === -1 || currentIndex === -1) return
    if (nextIndex === currentIndex) return
    if (nextIndex < currentIndex) {
      updateStage(nextStage)
      return
    }
    if (nextIndex === currentIndex + 1) {
      setStageConfirmTarget(nextStage)
      setStageConfirmMessage(`当前阶段内容将标记为完成，是否进入【${nextStage}】？进入后仍可返回本阶段。`)
      setStageConfirmOpen(true)
      return
    }
    setStageConfirmTarget(nextStage)
    setStageConfirmMessage('将跳过中间阶段，确认继续？')
    setStageConfirmOpen(true)
  }

  return (
    <section className="space-y-4">
      {toastMessage ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toastMessage}
        </div>
      ) : null}
      {stageConfirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => (stageUpdating ? null : setStageConfirmOpen(false))}>
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-semibold text-slate-900">确认进入阶段</div>
            <div className="mt-2 text-sm text-slate-700">{stageConfirmMessage}</div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={stageUpdating}
                onClick={() => setStageConfirmOpen(false)}
                className="rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="button"
                disabled={stageUpdating}
                onClick={async () => {
                  const targetStage = stageConfirmTarget
                  setStageConfirmOpen(false)
                  await updateStage(targetStage)
                }}
                className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <button type="button" onClick={() => navigate('/org/training')} className="hover:text-slate-900">
            组织类
          </button>
          <ChevronRight className="h-4 w-4" />
          <button type="button" onClick={() => navigate('/org/training')} className="hover:text-slate-900">
            培训管理
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="min-w-0 truncate text-xl font-semibold text-slate-900">{title}</h2>
          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700">{type || '—'}</span>
          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">{stage || '—'}</span>
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700">{status || '—'}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
          <span>负责人：{owner || '—'}</span>
          <span>牵头部门：{department || '—'}</span>
          <span>计划：{planRange || '—'}</span>
          <span className="min-w-0 flex-1 truncate">摘要：{summary || '—'}</span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex items-center">
          {STAGES.map((s, idx) => {
            const done = idx < stageIdx
            const current = idx === stageIdx
            return (
              <React.Fragment key={s}>
                <button
                  type="button"
                  disabled={stageUpdating}
                  onClick={() => onClickStage(s)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition-all disabled:opacity-70 ${
                    done
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : current
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    done ? 'bg-emerald-700 text-white' : current ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-400'
                  }`}>
                    {done ? <Check className="h-2.5 w-2.5" /> : idx + 1}
                  </span>
                  <span className="truncate">{s}</span>
                </button>
                {idx < STAGES.length - 1 && (
                  <span className={`mx-1 shrink-0 text-xs ${done ? 'text-emerald-400' : current ? 'text-blue-400' : 'text-slate-300'}`}>→</span>
                )}
              </React.Fragment>
            )
          })}
        </div>
        {stageUpdateError ? <div className="mt-3 text-sm text-red-700">阶段切换失败：{stageUpdateError}</div> : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex flex-wrap border-b-2 border-transparent">
          {stageTabs.map((tab, tabIdx) => {
            const selected = activeTab === tab
            const seq = '①②③④⑤⑥⑦⑧⑨'[tabIdx] ?? ''
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`relative px-4 pb-2 pt-2 text-sm transition-colors duration-100 ${
                  selected ? 'font-semibold text-blue-700' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <span className="mr-1 text-xs text-slate-400">{seq}</span>
                {tab}
                {selected && <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-t bg-blue-600" />}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAiOpen((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            🤖 人工智能助手
          </button>
        </div>
      </div>

      {workUnitLoading ? <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">加载中...</div> : null}
      {workUnitError ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{workUnitError}</div> : null}

      {aiOpen ? (
        <div className="fixed bottom-6 right-4 top-24 z-40 w-[300px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div className="text-sm font-semibold text-slate-900">AI助手 · 当前阶段：【{stage}】</div>
            <button type="button" onClick={() => setAiOpen(false)} className="text-sm text-slate-500 hover:text-slate-900">
              ×
            </button>
          </div>

          <div className="space-y-2 p-3">
            {['生成本阶段任务建议', '查找历史同类项目', '起草工作通知'].map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => showToast('AI功能即将上线，敬请期待')}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
              >
                {label}
              </button>
            ))}
          </div>

          <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200 bg-white p-3">
            <div className="flex gap-2">
              <input
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="输入问题..."
                className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
              />
              <button
                type="button"
                onClick={() => {
                  setAiInput('')
                  showToast('AI功能即将上线，敬请期待')
                }}
                className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
              >
                发送
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="min-w-0">
        {activeTab === '任务清单' ? (
          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">任务清单</h3>
              <span className="text-xs text-slate-500">
                {localTasks.filter((t) => t.done).length}/{localTasks.length}
              </span>
            </div>
            {nodesLoading ? <div className="mt-3 text-sm text-slate-500">加载任务中...</div> : null}
            {nodesError ? <div className="mt-3 text-sm text-red-700">任务加载失败：{nodesError}</div> : null}
            <div className="mt-3 space-y-2">
              {localTasks.length === 0 ? (
                <div className="rounded border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">暂无任务</div>
              ) : (
                localTasks.map((t) => (
                  <label key={t.id} className="flex items-start gap-2 rounded border border-slate-200 bg-white p-3 text-sm">
                    <input
                      type="checkbox"
                      checked={t.done}
                      onChange={() => setLocalTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))}
                      className="mt-1"
                    />
                    <span className={`flex-1 ${t.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{t.title}</span>
                  </label>
                ))
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="添加任务..."
                className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
              />
              <button
                type="button"
                onClick={() => {
                  console.log('add task clicked')
                  const run = async () => {
                    const v = newTaskTitle.trim()
                    const workUnitId = safeText((workUnit as any)?.id) || safeText(id)
                    if (!v || !workUnitId) return
                    setCreatingTask(true)
                    setCreateTaskError(null)
                    try {
                      const res = await fetch('/api/nodes/create', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title: v, workUnitId, stage }),
                      })
                      if (!res.ok) throw new Error(String(res.status))
                      setNewTaskTitle('')

                      setNodesLoading(true)
                      setNodesError(null)
                      try {
                        const listRes = await fetch(`/api/nodes/list?workUnitId=${encodeURIComponent(workUnitId)}`)
                        if (!listRes.ok) throw new Error(String(listRes.status))
                        const data = await listRes.json()
                        setNodes((Array.isArray(data) ? data : []) as NotionNodeRow[])
                      } catch (e) {
                        setNodesError(e instanceof Error ? e.message : String(e))
                      } finally {
                        setNodesLoading(false)
                      }
                    } catch (e) {
                      setCreateTaskError(e instanceof Error ? e.message : String(e))
                    } finally {
                      setCreatingTask(false)
                    }
                  }
                  run()
                }}
                disabled={creatingTask}
                className={`inline-flex items-center gap-2 rounded px-3 py-2 text-sm text-white ${
                  creatingTask ? 'bg-slate-400' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                <Plus className="h-4 w-4" />
                添加
              </button>
              {createTaskError ? <span className="self-center text-xs text-red-700">{createTaskError}</span> : null}
            </div>
          </article>
        ) : activeTab === '课件材料' ? (
          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">课件材料</h3>
              <span className="text-xs text-slate-500">{localMaterials.length} 份</span>
            </div>
            <div className="mt-3 space-y-2">
              {localMaterials.length === 0 ? (
                <div className="rounded border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">暂无材料</div>
              ) : (
                localMaterials.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded border border-slate-200 bg-white p-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">{m.name}</p>
                      <p className="mt-1 text-xs text-slate-500">上传时间：{m.uploadedAt}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => window.alert('Mock：查看材料')}
                      className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      查看
                    </button>
                  </div>
                ))
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (!f) return
                setLocalMaterials((prev) => [
                  { id: `file-${Date.now()}`, name: f.name, uploadedAt: new Date().toISOString().slice(0, 16).replace('T', ' ') },
                  ...prev,
                ])
                e.target.value = ''
              }}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <Upload className="h-4 w-4" />
                上传新材料
              </button>
              <button
                type="button"
                onClick={() => window.alert('Mock：从材料仓库选取')}
                className="inline-flex items-center gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <FileText className="h-4 w-4" />
                从材料仓库选取
              </button>
            </div>
          </article>

        ) : stage === '需求立项' && activeTab === '信息收集' ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">需求描述</div>
                <button
                  type="button"
                  onClick={() => setIdeaCollapsed((prev) => !prev)}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
                >
                  {ideaCollapsed ? '展开' : '收起'}
                  <ChevronRight className={`h-3.5 w-3.5 transition-transform ${ideaCollapsed ? '' : 'rotate-90'}`} />
                </button>
              </div>
              {!ideaCollapsed && (
                <div className="mt-3 space-y-3">
                  {/* 1. Textarea */}
                  <div className="relative">
                    <textarea
                      value={ideaText}
                      onChange={(e) => setIdeaText(e.target.value)}
                      rows={3}
                      placeholder="用自己的话描述这次培训的初始想法，方向对了就行。例如：今年监管对反洗钱培训有新要求，需要覆盖全员，重点是识别可疑交易…"
                      className="w-full resize-none rounded border border-slate-200 bg-white px-3 py-2 pb-7 text-sm outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-100"
                    />
                    <div className="absolute bottom-2 right-3 text-xs text-slate-400 select-none">{ideaText.length} 字</div>
                  </div>
                  {/* 2. Button row: voice | record */}
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      disabled
                      className="inline-flex cursor-not-allowed items-center gap-1.5 rounded border border-slate-200 px-3 py-1.5 text-xs text-slate-400"
                    >
                      🎤 语音输入（即将上线）
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!ideaText.trim()) return
                        const now = new Date()
                        const hhmm = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0')
                        const selectedLabels = demandOptions
                          .filter((o) => selectedDemandOptionIds.includes(o.id))
                          .map((o) => o.label)
                        setIdeaLogs((prev) => [{
                          id: Date.now(),
                          seq: prev.length + 1,
                          time: hhmm,
                          text: ideaText.trim(),
                          aiSources: ideaSuggestions.length > 0 ? ideaSuggestions.map((s) => s.label) : null,
                          selectedSources: selectedLabels,
                        }, ...prev])
                        setIdeaText('')
                      }}
                      className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      📝 记录本次想法
                    </button>
                  </div>
                  {/* 3. Thought logs – collapsible */}
                  {ideaLogs.length > 0 && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setIdeaLogsCollapsed((p) => !p)}
                        className="flex w-full items-center justify-between text-xs font-medium text-slate-400 hover:text-slate-600"
                      >
                        <span>思考记录</span>
                        <span>{ideaLogsCollapsed ? `▼ 展开（共 ${ideaLogs.length} 条）` : '▲ 收起'}</span>
                      </button>
                      {!ideaLogsCollapsed && (
                        <div className="mt-2 space-y-2">
                          {ideaLogs.map((log) => (
                            <div key={log.id} className="relative rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                              <button
                                type="button"
                                onClick={() => setIdeaLogs((prev) => prev.filter((l) => l.id !== log.id))}
                                className="absolute right-2 top-2 inline-flex h-4 w-4 items-center justify-center rounded text-slate-300 hover:bg-slate-200 hover:text-slate-600"
                              >
                                <X className="h-3 w-3" />
                              </button>
                              <div className="mb-1.5 text-xs font-medium text-slate-500">第 {log.seq} 次 · {log.time}</div>
                              <p className="mb-2 rounded bg-white px-2 py-1.5 text-xs leading-relaxed text-slate-700">{log.text}</p>
                              <div className="flex gap-4 text-xs text-slate-500">
                                <span>AI 建议来源：{log.aiSources ? log.aiSources.join(' / ') : '—'}</span>
                                <span>最终选择：{log.selectedSources.length > 0 ? log.selectedSources.join(' / ') : '—'}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {/* 4. Get AI suggestion button */}
                  <div className="flex justify-end border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      disabled={ideaSuggestionLoading}
                      onClick={async () => {
                        setIdeaSuggestionError(null)
                        const textParts: string[] = []
                        if (ideaText.trim()) textParts.push('需求描述：\n' + ideaText.trim())
                        if (ideaLogs.length > 0) {
                          textParts.push('思考记录：\n' + ideaLogs.map((l) => `- ${l.text}`).join('\n'))
                        }
                        if (textParts.length === 0) {
                          setIdeaSuggestionError('请先填写需求描述或记录想法')
                          return
                        }
                        const VALID_LABELS = ['政策规则', '专项指令', '岗位职责', '工作计划', '日常沟通', '问卷调查', '人员访谈', '专题座谈', '项目复盘']
                        const prompt =
                          `以下是一名培训负责人关于本次培训的需求描述和思考记录：\n\n` +
                          `${textParts.join('\n\n')}\n\n` +
                          `请根据以上内容，推荐3~5种最合适的培训需求信息收集方式。\n` +
                          `可选的方式有：${VALID_LABELS.join('、')}。\n` +
                          `输出格式：每行一种方式，格式为「方式名：推荐理由（一句话）」`
                        setIdeaSuggestionLoading(true)
                        try {
                          const res = await fetch('/api/ai', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ prompt }),
                          })
                          if (!res.ok) throw new Error(`HTTP ${res.status}`)
                          const data = await res.json()
                          const raw = String((data as any).result ?? (data as any).text ?? '')
                          const parsed = raw
                            .split('\n')
                            .map((l: string) => {
                              const m = l.match(/[：:]\s*(.+)$/)
                              const namePart = l.replace(/[：:].*$/, '').replace(/^[·\-\*\d.、）)\s]+/, '').trim()
                              return m && VALID_LABELS.includes(namePart) ? { label: namePart, reason: m[1].trim() } : null
                            })
                            .filter((x: unknown): x is { label: string; reason: string } => x !== null)
                          const suggestions = parsed.length > 0
                            ? parsed
                            : VALID_LABELS.slice(0, 3).map((l: string) => ({ label: l, reason: '根据您的描述综合推荐' }))
                          setIdeaSuggestions(suggestions)
                          const matchedIds = demandOptions
                            .filter((o) => suggestions.some((s) => s.label === o.label))
                            .map((o) => o.id)
                          setSelectedDemandOptionIds((prev) => {
                            const next = [...prev]
                            matchedIds.forEach((id) => { if (!next.includes(id)) next.push(id) })
                            return next
                          })
                          setDemandMatrix((prev) => {
                            const next = { ...prev }
                            demandOptions
                              .filter((o) => matchedIds.includes(o.id) && !next[o.id])
                              .forEach((o) => { next[o.id] = createDemandMatrixRow(o) })
                            return next
                          })
                          setIdeaSuggestionVisible(true)
                          setIdeaSuggestionCollapsed(false)
                        } catch (e) {
                          setIdeaSuggestionError('建议获取失败，请重试')
                          console.error('[getIdeaSuggestion]', e)
                        } finally {
                          setIdeaSuggestionLoading(false)
                        }
                      }}
                      className={`rounded px-3 py-1.5 text-xs font-medium text-white ${ideaSuggestionLoading ? 'cursor-not-allowed bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                      {ideaSuggestionLoading ? '✨ 分析中...' : '✨ 获取信息来源建议'}
                    </button>
                  </div>
                  {/* 5. Suggestion card – persistent, collapsible */}
                  {ideaSuggestionError && (
                    <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{ideaSuggestionError}</div>
                  )}
                  {ideaSuggestionVisible && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                      <div className="flex items-center justify-between">
                        {ideaSuggestionCollapsed
                          ? <span className="text-xs text-blue-600">AI 信息来源建议（点击展开）</span>
                          : <span className="text-xs font-medium text-blue-800">AI 建议通过以下方式收集信息：</span>}
                        <button
                          type="button"
                          onClick={() => setIdeaSuggestionCollapsed((prev) => !prev)}
                          className="text-xs text-blue-500 hover:text-blue-700"
                        >
                          {ideaSuggestionCollapsed ? '▼ 展开' : '▲ 收起'}
                        </button>
                      </div>
                      {!ideaSuggestionCollapsed && (
                        <>
                          <ul className="mt-2 space-y-1 text-xs text-blue-700">
                            {ideaSuggestions.map((s) => (
                              <li key={s.label}>· {s.label} — {s.reason}</li>
                            ))}
                          </ul>
                          <div className="mt-2 text-xs text-blue-500">已为您自动选中以上来源，可手动调整 ↓</div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <hr className="border-slate-100" />
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">信息来源</div>
              <div className="mt-3 flex items-center gap-2 overflow-x-auto">
                {demandOptions.map((opt) => {
                  const selected = selectedDemandOptionIds.includes(opt.id)
                  const base = opt.recommended ? 'border-orange-300 text-orange-700' : 'border-slate-200 text-slate-700'
                  const cls = selected ? 'border-blue-600 bg-blue-600 text-white' : `bg-white hover:bg-slate-50 ${base}`
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        const isSelected = selectedDemandOptionIds.includes(opt.id)
                        if (isSelected) {
                          const ok = window.confirm('确定移除该收集方式？')
                          if (!ok) return
                          setSelectedDemandOptionIds((prev) => prev.filter((x) => x !== opt.id))
                          setDemandMatrix((prev) => {
                            const next = { ...prev }
                            delete next[opt.id]
                            return next
                          })
                          return
                        }
                        setSelectedDemandOptionIds((prev) => (prev.includes(opt.id) ? prev : [...prev, opt.id]))
                        setDemandMatrix((prev) => (prev[opt.id] ? prev : { ...prev, [opt.id]: createDemandMatrixRow(opt) }))
                      }}
                      className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${cls}`}
                    >
                      {opt.label}
                    </button>
                  )
                })}

              </div>
              <div className="mt-3 text-xs text-slate-500">提示：政策 / 指令 为建议优先选择项</div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
              <table className="w-full min-w-[540px] border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-200 px-3 py-3 text-center font-semibold text-slate-600" style={{width:'40px'}}>序号</th>
                    <th className="border border-gray-200 px-3 py-3 font-semibold text-slate-600">来源</th>
                    <th className="border border-gray-200 px-3 py-3 font-semibold text-slate-600" style={{width:'64px'}}>需求数</th>
                    <th className="border border-gray-200 px-3 py-3 font-semibold text-slate-600">关键词</th>
                    <th className="border border-gray-200 px-3 py-3 font-semibold text-slate-600">转化进度</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDemandOptionIds.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-500">
                        暂无数据
                      </td>
                    </tr>
                  ) : (
                    demandOptions
                      .filter((o) => selectedDemandOptionIds.includes(o.id))
                      .map((opt, idx) => {
                        const row = demandMatrix[opt.id]
                        if (!row) return null
                        const reqs = getTrainingReqs(row.detail)
                        const reqCount = reqs.length
                        const keywords = extractKeywords(reqs, 3)
                        const converted = row.convertedCount
                        const pct = reqCount > 0 ? Math.round((converted / reqCount) * 100) : 0
                        const showPopover = progressPopoverId === opt.id
                        return (
                          <tr key={opt.id} className={`hover:bg-blue-50/50 ${idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'}`} style={{height:'48px'}}>
                            <td className="border border-gray-200 px-3 py-2.5 text-center text-slate-500">{idx + 1}</td>
                            <td className="border border-gray-200 px-3 py-2.5">
                              <button
                                type="button"
                                onClick={() => {
                                  const current = demandMatrix[opt.id]
                                  if (!current) return
                                  setUnifiedDialogOptId(opt.id)
                                }}
                                className="cursor-pointer text-sm text-slate-800 underline decoration-slate-300 hover:text-blue-600 hover:decoration-blue-400"
                              >
                                {row.label}
                              </button>
                            </td>
                            <td className="border border-gray-200 px-3 py-2.5 text-slate-600">
                              {reqCount > 0 ? `${reqCount} 条` : '—'}
                            </td>
                            <td className="border border-gray-200 px-3 py-2.5">
                              {keywords.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {keywords.map((kw) => (
                                    <span key={kw} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                      {kw}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="border border-gray-200 px-3 py-2.5">
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => setProgressPopoverId(showPopover ? null : opt.id)}
                                  className="flex items-center gap-2"
                                >
                                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                                    <div
                                      className={`h-full rounded-full transition-all ${
                                        pct === 0 ? 'bg-slate-300' : pct === 100 ? 'bg-emerald-500' : 'bg-blue-500'
                                      }`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span
                                    className={`text-xs ${
                                      reqCount === 0
                                        ? 'text-slate-400'
                                        : pct === 100
                                          ? 'text-emerald-600'
                                          : pct === 0
                                            ? 'text-slate-400'
                                            : 'text-blue-600'
                                    }`}
                                  >
                                    {reqCount > 0 ? `已转化 ${converted}/${reqCount} · ${pct}%` : '—'}
                                  </span>
                                </button>
                                {showPopover && reqCount > 0 ? (
                                  <div className="absolute left-0 top-full z-30 mt-1 min-w-[220px] rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
                                    <div className="mb-2 text-xs font-medium text-slate-700">需求转化情况</div>
                                    <div className="space-y-1.5">
                                      {reqs.map((req, i) => (
                                        <label key={req.id} className="flex items-start gap-2">
                                          <input
                                            type="checkbox"
                                            readOnly
                                            checked={i < converted}
                                            className="mt-0.5 accent-blue-600"
                                          />
                                          <span className="text-xs text-slate-600">{req.text || `需求 ${i + 1}`}</span>
                                        </label>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        )
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : stage === '需求立项' && activeTab === '需求清单' ? (
          <div className="space-y-4">
            {/* table card */}
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
              {/* header row */}
              <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">需求清单</div>
                  <div className="mt-0.5 text-xs text-slate-400">已自动汇入来自各信息来源的需求条目，可手动新增或调整</div>
                </div>
                <button
                  type="button"
                  onClick={() => setReqList((prev) => [...prev, { id: Date.now(), title: '', desc: '', keywords: [], sources: [], priority: '中', status: '待转化', expanded: false, trainingSubject: [], scenario: '', requirementType: '', relatedAction: '', expandDetail: false }])}
                  className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                >
                  + 新增需求
                </button>
              </div>
              {reqList.length === 0 ? (
                <div className="px-4 py-10 text-center text-xs text-slate-400">
                  暂无需求条目，可点击右上角「+ 新增需求」手动添加，或从信息来源中提炼后自动汇总
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="border-collapse text-xs" style={{tableLayout:'fixed',width:'1220px'}}>
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-200 px-3 py-3 text-center font-semibold text-slate-600" style={{width:'40px'}}>序号</th>
                        <th className="border border-gray-200 px-3 py-3 text-left font-semibold text-slate-600" style={{width:'120px'}}>需求名称</th>
                        <th className="border border-gray-200 px-3 py-3 text-left font-semibold text-slate-600" style={{width:'180px'}}>需求描述</th>
                        <th className="border border-gray-200 px-3 py-3 text-left font-semibold text-slate-600" style={{width:'120px'}}>培训主体</th>
                        <th className="border border-gray-200 px-3 py-3 text-left font-semibold text-slate-600" style={{width:'150px'}}>对应场景</th>
                        <th className="border border-gray-200 px-3 py-3 text-left font-semibold text-slate-600" style={{width:'90px'}}>需求属性</th>
                        <th className="border border-gray-200 px-3 py-3 text-left font-semibold text-slate-600" style={{width:'150px'}}>关联操作</th>
                        <th className="border border-gray-200 px-3 py-3 text-left font-semibold text-slate-600" style={{width:'130px'}}>来源关键词</th>
                        <th className="border border-gray-200 px-3 py-3 text-left font-semibold text-slate-600" style={{width:'80px'}}>优先级</th>
                        <th className="border border-gray-200 px-3 py-3 text-left font-semibold text-slate-600" style={{width:'100px'}}>状态</th>
                        <th className="border border-gray-200 px-3 py-3 text-center font-semibold text-slate-600" style={{width:'60px'}}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reqList.map((row, idx) => {
                        const isComplete = row.trainingSubject.length > 0 && !!row.scenario && !!row.requirementType && !!row.relatedAction
                        return (
                          <React.Fragment key={row.id}>
                            {/* Main data row */}
                            <tr className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} style={{height:'48px'}}>
                              {/* 序号 */}
                              <td className="border border-gray-200 px-3 py-2 text-center text-slate-400">{idx + 1}</td>

                              {/* 需求名称 */}
                              <td className="border border-gray-200 px-3 py-2">
                                <input
                                  value={row.title}
                                  onChange={(e) => setReqList((prev) => prev.map((r) => r.id === row.id ? { ...r, title: e.target.value } : r))}
                                  placeholder="输入需求名称…"
                                  className="w-full rounded border-0 bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-300 focus:ring-0"
                                />
                              </td>

                              {/* 需求描述 */}
                              <td className="border border-gray-200 px-3 py-2 align-middle">
                                {row.expanded ? (
                                  <textarea
                                    autoFocus
                                    value={row.desc}
                                    onChange={(e) => setReqList((prev) => prev.map((r) => r.id === row.id ? { ...r, desc: e.target.value } : r))}
                                    onBlur={() => setReqList((prev) => prev.map((r) => r.id === row.id ? { ...r, expanded: false } : r))}
                                    onKeyDown={(e) => { if (e.key === 'Escape') setReqList((prev) => prev.map((r) => r.id === row.id ? { ...r, expanded: false } : r)) }}
                                    rows={2}
                                    className="w-full resize-none rounded border border-blue-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:ring-1 focus:ring-blue-100"
                                  />
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setReqList((prev) => prev.map((r) => r.id === row.id ? { ...r, expanded: true } : r))}
                                    className="w-full text-left text-xs text-slate-600 hover:text-blue-600"
                                  >
                                    {row.desc || <span className="text-slate-300">点击添加描述…</span>}
                                  </button>
                                )}
                              </td>

                              {/* 培训主体 */}
                              <td className="border border-gray-200 px-3 py-2">
                                {row.trainingSubject.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {row.trainingSubject.map((s) => (
                                      <span key={s} className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-600">{s}</span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-300">—</span>
                                )}
                              </td>

                              {/* 对应场景 */}
                              <td className="border border-gray-200 px-3 py-2">
                                <span className="text-xs text-slate-600">{row.scenario || <span className="text-slate-300">—</span>}</span>
                              </td>

                              {/* 需求属性 */}
                              <td className="border border-gray-200 px-3 py-2">
                                {row.requirementType ? (
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                    row.requirementType === '实操类' ? 'bg-blue-50 text-blue-600' :
                                    row.requirementType === '理念类' ? 'bg-purple-50 text-purple-600' :
                                    row.requirementType === '技术类' ? 'bg-teal-50 text-teal-600' :
                                    'bg-orange-50 text-orange-600'
                                  }`}>{row.requirementType}</span>
                                ) : (
                                  <span className="text-xs text-slate-300">—</span>
                                )}
                              </td>

                              {/* 关联操作 */}
                              <td className="border border-gray-200 px-3 py-2">
                                <span className="text-xs text-slate-600">{row.relatedAction || <span className="text-slate-300">—</span>}</span>
                              </td>

                              {/* 来源关键词 */}
                              <td className="border border-gray-200 px-3 py-2">
                                <div className="relative flex flex-wrap items-center gap-1">
                                  {row.keywords.length === 0 && row.sources.length === 0 && (
                                    <span className="text-xs text-slate-300">—</span>
                                  )}
                                  {row.keywords.map((kw) => (
                                    <span key={kw} className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                      {kw}
                                      <button type="button" onClick={() => setReqList((prev) => prev.map((r) => r.id === row.id ? { ...r, keywords: r.keywords.filter((k) => k !== kw) } : r))} className="ml-0.5 text-slate-400 hover:text-slate-700">×</button>
                                    </span>
                                  ))}
                                  {row.sources.map((src) => (
                                    <span key={src} className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
                                      {src}
                                      {row.sources.length > 1 && (
                                        <button type="button" onClick={() => setReqList((prev) => prev.map((r) => r.id === row.id ? { ...r, sources: r.sources.filter((s) => s !== src) } : r))} className="ml-0.5 text-blue-400 hover:text-blue-700">×</button>
                                      )}
                                    </span>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setSourceDropdownRowId(sourceDropdownRowId === row.id ? null : row.id) }}
                                    className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-slate-300 text-xs text-slate-400 hover:border-blue-400 hover:text-blue-500"
                                  >＋</button>
                                  {sourceDropdownRowId === row.id && (
                                    <div className="absolute left-0 top-7 z-30 min-w-[160px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                                      {['政策规则','专项指令','岗位职责','工作计划','日常沟通','问卷调查','人员访谈','专题座谈','项目复盘'].map((label) => {
                                        const checked = row.sources.includes(label)
                                        return (
                                          <button key={label} type="button"
                                            onClick={() => setReqList((prev) => prev.map((r) => r.id === row.id ? { ...r, sources: checked ? r.sources.filter((s) => s !== label) : [...r.sources, label] } : r))}
                                            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-50"
                                          >
                                            <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${checked ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-300'}`}>
                                              {checked && <Check className="h-2.5 w-2.5" />}
                                            </span>
                                            {label}
                                          </button>
                                        )
                                      })}
                                      <div className="border-t border-slate-100 px-3 pt-1 pb-1">
                                        <button type="button" onClick={() => setSourceDropdownRowId(null)} className="text-xs text-slate-400 hover:text-slate-600">完成</button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* 优先级 */}
                              <td className="border border-gray-200 px-3 py-2">
                                <select
                                  value={row.priority}
                                  onChange={(e) => setReqList((prev) => prev.map((r) => r.id === row.id ? { ...r, priority: e.target.value } : r))}
                                  className={`rounded px-2 py-1 text-xs font-medium outline-none border ${
                                    row.priority === '高'
                                      ? 'border-red-200 bg-red-50 text-red-600'
                                      : row.priority === '中'
                                        ? 'border-orange-200 bg-orange-50 text-orange-600'
                                        : 'border-slate-200 bg-slate-50 text-slate-500'
                                  }`}
                                >
                                  <option value="高">高</option>
                                  <option value="中">中</option>
                                  <option value="低">低</option>
                                </select>
                              </td>

                              {/* 状态 */}
                              <td className="border border-gray-200 px-3 py-2">
                                {row.status === '待转化' ? (
                                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-500">待转化</span>
                                ) : row.status === '已纳入计划' ? (
                                  <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-600">已纳入计划</span>
                                ) : (
                                  <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs text-orange-600">暂不处理</span>
                                )}
                                {row.status !== '暂不处理' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (window.confirm('确定标记为暂不处理？')) {
                                        setReqList((prev) => prev.map((r) => r.id === row.id ? { ...r, status: '暂不处理' } : r))
                                      }
                                    }}
                                    className="ml-1 text-xs text-slate-300 hover:text-orange-500"
                                    title="标记为暂不处理"
                                  >⊘</button>
                                )}
                              </td>

                              {/* 操作列：完整/待完善 badge + 删除 */}
                              <td className="border border-gray-200 px-2 py-2 text-center">
                                <div className="flex flex-col items-center gap-1">
                                  {isComplete ? (
                                    <span className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs text-green-600">✓ 完整</span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setReqList((prev) => prev.map((r) => r.id === row.id ? { ...r, expandDetail: !r.expandDetail } : r))}
                                      className="inline-flex items-center rounded-full border border-yellow-300 bg-yellow-50 px-2 py-0.5 text-xs text-yellow-700 hover:bg-yellow-100"
                                    >待完善</button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setReqList((prev) => prev.filter((r) => r.id !== row.id))}
                                    className="inline-flex h-5 w-5 items-center justify-center rounded text-slate-300 hover:bg-red-50 hover:text-red-500"
                                  ><X className="h-3 w-3" /></button>
                                </div>
                              </td>
                            </tr>

                            {/* Inline detail form row */}
                            {row.expandDetail && (
                              <tr className="bg-amber-50/40">
                                <td colSpan={11} className="border border-gray-200 px-4 py-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    {/* 培训主体 multi-select */}
                                    <div>
                                      <div className="mb-1.5 text-xs font-medium text-slate-600">培训主体 <span className="text-slate-400 font-normal">（多选）</span></div>
                                      <div className="flex flex-wrap gap-1.5">
                                        {['合规岗','客户经理','运营岗','管理层','全员'].map((opt) => {
                                          const selected = row.trainingSubject.includes(opt)
                                          return (
                                            <button
                                              key={opt}
                                              type="button"
                                              onClick={() => setReqList((prev) => prev.map((r) => r.id === row.id ? {
                                                ...r, trainingSubject: selected
                                                  ? r.trainingSubject.filter((s) => s !== opt)
                                                  : [...r.trainingSubject, opt]
                                              } : r))}
                                              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${selected ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-500 hover:border-indigo-300'}`}
                                            >{opt}</button>
                                          )
                                        })}
                                      </div>
                                    </div>

                                    {/* 需求属性 single-select */}
                                    <div>
                                      <div className="mb-1.5 text-xs font-medium text-slate-600">需求属性</div>
                                      <div className="flex flex-wrap gap-1.5">
                                        {['理念类','实操类','技术类','合规类'].map((opt) => {
                                          const selected = row.requirementType === opt
                                          return (
                                            <button
                                              key={opt}
                                              type="button"
                                              onClick={() => setReqList((prev) => prev.map((r) => r.id === row.id ? { ...r, requirementType: selected ? '' : opt } : r))}
                                              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${selected ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500 hover:border-blue-300'}`}
                                            >{opt}</button>
                                          )
                                        })}
                                      </div>
                                    </div>

                                    {/* 对应场景 */}
                                    <div>
                                      <div className="mb-1.5 text-xs font-medium text-slate-600">对应场景</div>
                                      <input
                                        value={row.scenario}
                                        onChange={(e) => setReqList((prev) => prev.map((r) => r.id === row.id ? { ...r, scenario: e.target.value } : r))}
                                        placeholder="描述触发该需求的工作场景"
                                        className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-100"
                                      />
                                    </div>

                                    {/* 关联操作 */}
                                    <div>
                                      <div className="mb-1.5 text-xs font-medium text-slate-600">关联操作</div>
                                      <input
                                        value={row.relatedAction}
                                        onChange={(e) => setReqList((prev) => prev.map((r) => r.id === row.id ? { ...r, relatedAction: e.target.value } : r))}
                                        placeholder="如：识别→记录→上报"
                                        className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-100"
                                      />
                                    </div>
                                  </div>
                                  <div className="mt-3 flex justify-end">
                                    <button
                                      type="button"
                                      onClick={() => setReqList((prev) => prev.map((r) => r.id === row.id ? { ...r, expandDetail: false } : r))}
                                      className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                                    >保存</button>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            {/* bottom actions */}
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-sm">
              {/* stats summary */}
              {reqList.length > 0 && (() => {
                const totalCount = reqList.length
                const completeCount = reqList.filter((r) => r.trainingSubject.length > 0 && !!r.scenario && !!r.requirementType && !!r.relatedAction).length
                const pendingCount = totalCount - completeCount
                return (
                  <div className="mb-3 text-xs text-slate-500">
                    共 <span className="font-medium text-slate-700">{totalCount}</span> 条需求，
                    <span className="font-medium text-green-600">{completeCount}</span> 条已完整，
                    <span className="font-medium text-orange-500">{pendingCount}</span> 条待完善
                  </div>
                )
              })()}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  disabled
                  className="inline-flex cursor-not-allowed items-center gap-1.5 rounded border border-slate-200 px-3 py-1.5 text-xs text-slate-400"
                >
                  📄 导出需求清单
                </button>
                <button
                  type="button"
                  onClick={() => alert('报告生成功能即将上线')}
                  className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-600 hover:border-blue-400 hover:text-blue-600"
                >
                  📄 生成需求立项报告
                </button>
              </div>
              <p className="mt-3 text-center text-xs text-slate-400">
                需求立项报告将包含：需求描述记录 + 各信息来源摘要 + 完整需求清单，可导出为 Word / PDF
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">该视图正在建设中</div>
        )}
      </div>


      {/* ── UnifiedSourcePanel ── */}
      {unifiedDialogOptId !== null && demandMatrix[unifiedDialogOptId] ? (
        <UnifiedSourcePanel
          label={demandMatrix[unifiedDialogOptId].label}
          draft={demandMatrix[unifiedDialogOptId].detail}
          onClose={() => setUnifiedDialogOptId(null)}
          onSave={(d) => {
            const optId = unifiedDialogOptId
            setDemandMatrix((prev) => ({
              ...prev,
              [optId]: { ...prev[optId], detail: d },
            }))
            const srcLabel = demandMatrix[optId]?.label ?? d.kind
            setReqList((prev) => {
              const filtered = prev.filter((r) => !r.sources.includes(srcLabel))
              const newRows = d.trainingRequirements
                .filter((r) => r.text.trim())
                .map((r) => ({
                  id: Date.now() + Math.random(),
                  title: r.text.trim(),
                  desc: '',
                  keywords: [],
                  sources: [srcLabel],
                  priority: '中',
                  status: '待转化',
                  expanded: false,
                  trainingSubject: [],
                  scenario: '',
                  requirementType: '',
                  relatedAction: '',
                  expandDetail: false,
                }))
              return [...filtered, ...newRows]
            })
            setUnifiedDialogOptId(null)
          }}
        />
      ) : null}

    </section>
  )
}
