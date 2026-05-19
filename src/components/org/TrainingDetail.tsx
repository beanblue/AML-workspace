import {
  Check,
  ChevronRight,
  FileText,
  Plus,
  Upload,
  X,
} from 'lucide-react'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'

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

type StageKey = '需求立项' | '计划设计' | '材料准备' | '培训实施' | '评估归档'

const STAGES: StageKey[] = ['需求立项', '计划设计', '材料准备', '培训实施', '评估归档']

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
  if (value === '归档闭环') return '评估归档'
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
                      className={`inline-flex items-center gap-1.5 rounded px-3 py-2 text-sm ${aiLoading ? 'cursor-not-allowed bg-slate-100 text-slate-400' : 'bg-[#b85c3a] text-white shadow-[0_2px_0_#8c3e24] hover:-translate-y-px hover:bg-[#a04f30]'}`}
                    >
                      {aiLoading ? '⏳ 分析中...' : '✨ 提取需求'}
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
                      className={`inline-flex items-center gap-1.5 rounded px-3 py-2 text-sm ${aiLoading ? 'cursor-not-allowed bg-slate-100 text-slate-400' : 'bg-[#b85c3a] text-white shadow-[0_2px_0_#8c3e24] hover:-translate-y-px hover:bg-[#a04f30]'}`}
                    >
                      {aiLoading ? '⏳ 分析中...' : '✨ 提取需求'}
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
                      className={`inline-flex items-center gap-1.5 rounded px-3 py-2 text-sm ${aiLoading ? 'cursor-not-allowed bg-slate-100 text-slate-400' : 'bg-[#b85c3a] text-white shadow-[0_2px_0_#8c3e24] hover:-translate-y-px hover:bg-[#a04f30]'}`}
                    >
                      {aiLoading ? '⏳ 分析中...' : '✨ 提取需求'}
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
                  暂无需求，可点击上方「✨ 提取需求」自动生成
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
          <button type="button" onClick={() => onSave(local)} className="rounded-lg bg-[#b85c3a] px-[18px] py-2 text-sm font-semibold text-white shadow-[0_2px_0_#8c3e24] transition-transform hover:-translate-y-px active:translate-y-px active:shadow-[0_1px_0_#8c3e24]">
            保存
          </button>
        </div>
      </div>
    </div>
  )
}


export default function TrainingDetail() {
  const { id } = useParams()
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

  // ── 计划设计 state ──────────────────────────────────────────
  const [planSidebarOpen, setPlanSidebarOpen] = useState(true)
  const [planDesignStatus, setPlanDesignStatus] = useState<'草稿中'|'已完成'>('草稿中')
  const [planGoal, setPlanGoal] = useState('')
  const [planSubjects, setPlanSubjects] = useState<string[]>([])
  const [planParticipantCount, setPlanParticipantCount] = useState('')
  const [planMethods, setPlanMethods] = useState<string[]>([])
  const [planModules, setPlanModules] = useState<Array<{id:number;name:string;reqType:string;duration:string}>>(
    [{id:1,name:'反洗钱基础认知',reqType:'理念类',duration:'30'},
     {id:2,name:'可疑交易识别实操',reqType:'实操类',duration:'60'},
     {id:3,name:'KYC风险评级操作规程',reqType:'技术类',duration:'45'}]
  )
  const [planEffectDesc, setPlanEffectDesc] = useState('')
  const [planCheckMethod, setPlanCheckMethod] = useState('')

  // ── 资源计划 state ──────────────────────────────────────────
  const [resPlanStatus, setResPlanStatus] = useState<'草稿中'|'已完成'>('草稿中')
  const [resSessions, setResSessions] = useState<Array<{id:number;name:string;date:string;startTime:string;endTime:string}>>(
    [{id:1,name:'第一场',date:'2026-06-15',startTime:'09:00',endTime:'12:00'}]
  )
  const [resTeachers, setResTeachers] = useState<Array<{id:number;type:'内部'|'外部';name:string;dept:string}>>(
    [{id:1,type:'内部',name:'张合规',dept:'合规部'}]
  )
  const [resVenue, setResVenue] = useState('')
  const [resCapacity, setResCapacity] = useState('')
  const [resEquipment, setResEquipment] = useState<string[]>(['投影仪','签到平板','问卷系统'])
  const [resEquipmentInput, setResEquipmentInput] = useState('')
  const [resDepts, setResDepts] = useState<string[]>(['人力资源部','IT部'])
  const [resDeptsInput, setResDeptsInput] = useState('')
  const [resBudget, setResBudget] = useState('')
  const [resBudgetNote, setResBudgetNote] = useState('')

  // ── 需求回顾 state ──────────────────────────────────────────
  const [reviewChecks, setReviewChecks] = useState<Array<{id:number;reqTitle:string;reqType:string;coverStatus:string;note:string;conclusion:string}>>(
    [
      {id:1,reqTitle:'掌握反洗钱交易识别方法',reqType:'实操类',coverStatus:'已覆盖',note:'',conclusion:''},
      {id:2,reqTitle:'了解监管合规基本框架',reqType:'理念类',coverStatus:'部分覆盖',note:'场景覆盖不足，需补充线上直播场景',conclusion:'已修正'},
      {id:3,reqTitle:'熟悉客户风险分级操作规程',reqType:'技术类',coverStatus:'已覆盖',note:'',conclusion:''},
    ]
  )
  const [reviewAuditor, setReviewAuditor] = useState('')
  const [reviewOpinion, setReviewOpinion] = useState('')
  const [reviewConclusion, setReviewConclusion] = useState<''|'审核通过'|'需修改'>('审核通过')
  const [showTaskList, setShowTaskList] = useState(false)

  // ── 材料准备 state ────────────────────────────────────────────
  type MatTask = { id:number; name:string; matType:string; owner:string; due:string; status:string; fromPlan:boolean }
  type MatFile = { id:number; fileName:string; fileType:string; version:string; uploadDate:string; uploader:string; reviewStatus:string }
  type MatReview = { id:number; fileName:string; fileType:string; checks:string[]; opinion:string; conclusion:string; auditor:string }
  const [matTasks, setMatTasks] = useState<MatTask[]>([
    {id:1,name:'制作反洗钱识别方法课件',matType:'PPT',owner:'张合规',due:'2026-06-10',status:'进行中',fromPlan:true},
    {id:2,name:'设计可疑交易案例集',matType:'PDF',owner:'李培训',due:'2026-06-10',status:'未开始',fromPlan:true},
    {id:3,name:'预订培训场地',matType:'其他',owner:'王行政',due:'2026-06-05',status:'已完成',fromPlan:true},
    {id:4,name:'发送培训通知',matType:'其他',owner:'王行政',due:'2026-06-08',status:'未开始',fromPlan:true},
    {id:5,name:'准备签到系统',matType:'其他',owner:'IT支持',due:'2026-06-12',status:'未开始',fromPlan:true},
  ])
  const [matFiles, setMatFiles] = useState<MatFile[]>([
    {id:1,fileName:'反洗钱基础认知培训课件v1.pptx',fileType:'PPT',version:'v1.0',uploadDate:'2026-06-08',uploader:'张合规',reviewStatus:'待审核'},
    {id:2,fileName:'可疑交易识别案例集.pdf',fileType:'PDF',version:'v1.0',uploadDate:'2026-06-09',uploader:'李培训',reviewStatus:'草稿'},
  ])
  const [matReviews, setMatReviews] = useState<MatReview[]>([
    {id:1,fileName:'反洗钱基础认知培训课件v1.pptx',fileType:'PPT',checks:['内容准确性','合规性','格式规范','完整性'],opinion:'',conclusion:'通过',auditor:'陈审核'},
    {id:2,fileName:'可疑交易识别案例集.pdf',fileType:'PDF',checks:['内容准确性','格式规范'],opinion:'',conclusion:'',auditor:''},
  ])

  // ── 培训实施 state ────────────────────────────────────────────
  type ImplNotice = { id:number; sendTime:string; scope:string; method:string; sent:boolean }
  type ImplScore  = { id:number; name:string; dept:string; score:number; pass:boolean }
  const [implPrepStatus, setImplPrepStatus] = useState<'草稿中'|'已完成'>('草稿中')
  const [implNotices, setImplNotices] = useState<ImplNotice[]>([
    {id:1,sendTime:'2026-06-08T09:00',scope:'合规岗+客户经理',method:'企业微信',sent:true}
  ])
  const [implPlanCount, setImplPlanCount] = useState('45')
  const [implRegDeadline, setImplRegDeadline] = useState('2026-06-13')
  const [implRegCount, setImplRegCount] = useState('38')
  const [implVenue, setImplVenue] = useState('北京总部3楼培训室A')
  const [implCapacity, setImplCapacity] = useState('50')
  const [implVenueConfirmed, setImplVenueConfirmed] = useState('已确认')
  const [implMaterials, setImplMaterials] = useState<Array<{id:number;name:string;ready:boolean}>>([
    {id:1,name:'反洗钱基础认知培训课件v1.pptx',ready:true},
    {id:2,name:'可疑交易识别案例集.pdf',ready:false},
  ])
  // 现场执行
  const [implSignCount, setImplSignCount] = useState('36')
  const [implSignMethod, setImplSignMethod] = useState('扫码')
  const [implStartTime, setImplStartTime] = useState('2026-06-15T09:05')
  const [implEndTime, setImplEndTime] = useState('2026-06-15T12:10')
  const [implActualVenue, setImplActualVenue] = useState('北京总部3楼培训室A')
  const [implLecturer, setImplLecturer] = useState('张合规')
  const [implProcessNote, setImplProcessNote] = useState('培训按计划进行，参与度较高，互动环节反应积极')
  const [implDeviation, setImplDeviation] = useState('')
  // 考核测试
  const [implExamMethod, setImplExamMethod] = useState('线上答题')
  const [implExamLink, setImplExamLink] = useState('https://exam.company.com/aml2026')
  const [implScores, setImplScores] = useState<ImplScore[]>([
    {id:1,name:'李明',dept:'合规部',score:92,pass:true},
    {id:2,name:'王芳',dept:'客户部',score:78,pass:true},
    {id:3,name:'张伟',dept:'合规部',score:55,pass:false},
    {id:4,name:'刘洋',dept:'运营部',score:88,pass:true},
    {id:5,name:'陈静',dept:'客户部',score:61,pass:true},
  ])
  const [implFailMeasure, setImplFailMeasure] = useState('安排补考，时间2026-06-22，补考前需重新学习录播课程')

  // ── 评估归档 state ────────────────────────────────────────────
  // 效果评估
  const [evalStatus, setEvalStatus] = useState<'草稿中'|'已完成'>('草稿中')
  const [evalSurveyIssued, setEvalSurveyIssued] = useState('已发放')
  const [evalSurveyLink, setEvalSurveyLink] = useState('https://survey.company.com/aml2026')
  const [evalSurveyCount, setEvalSurveyCount] = useState('34')
  const [evalSatisfaction, setEvalSatisfaction] = useState('4.3')
  const [evalFeedback, setEvalFeedback] = useState('学员普遍反映案例贴近实际，希望增加更多互动环节；部分学员建议缩短理论讲解时间')
  const [evalGoals, setEvalGoals] = useState<Array<{id:number;goal:string;status:string;note:string}>>(
    [
      {id:1,goal:'员工掌握反洗钱交易识别方法',status:'已达成',note:'考核通过率80%，达预期'},
      {id:2,goal:'了解合规基本框架',status:'部分达成',note:'理念类内容吸收较弱，需跟进'},
      {id:3,goal:'熟悉KYC风险评级操作规程',status:'已达成',note:'实操演练效果良好'},
    ]
  )
  const [evalWeakPoints, setEvalWeakPoints] = useState('可疑交易金额阈值识别错误率较高，建议在后续培训中重点强化')
  const [evalConclusion, setEvalConclusion] = useState('本次反洗钱合规培训整体达到预期目标，参训学员满意度较高（4.3/5）。考核通过率80%，符合合规部门要求。建议针对理念类内容优化讲解方式，增加互动环节。')
  // 归档打包
  type ArchiveItem = { id:number; name:string; stage:string; status:string }
  const [archiveItems] = useState<ArchiveItem[]>([
    {id:1,name:'需求立项报告',stage:'阶段一',status:'已关联'},
    {id:2,name:'培训方案',stage:'阶段二',status:'已关联'},
    {id:3,name:'需求覆盖确认表',stage:'阶段二',status:'已关联'},
    {id:4,name:'审核通过的课件包',stage:'阶段三',status:'已关联'},
    {id:5,name:'审核记录',stage:'阶段三',status:'已关联'},
    {id:6,name:'培训通知记录',stage:'阶段四',status:'已关联'},
    {id:7,name:'签到表',stage:'阶段四',status:'需手动上传'},
    {id:8,name:'过程记录',stage:'阶段四',status:'已关联'},
    {id:9,name:'考核成绩单',stage:'阶段四',status:'已关联'},
    {id:10,name:'效果评估报告',stage:'阶段五',status:'已关联'},
  ])
  // 改进建议
  const [improveHighlights, setImproveHighlights] = useState<string[]>(['案例贴近实际业务，学员参与度高','讲师表达清晰，重难点突出'])
  const [improveProblems, setImproveProblems] = useState<string[]>(['理念类内容讲解时间偏长，学员注意力下降','签到环节耗时较多，压缩了互动时间'])
  const [improveSuggestions, setImproveSuggestions] = useState<string[]>(['理念模块压缩至20分钟，增加视频案例替代纯讲授','提前发送电子签到表，节省现场签到时间'])
  const [improveNextNote, setImproveNextNote] = useState('建议提前2周发送预习材料；考虑将KYC操作规程单独开设专项培训')
  const [improveCoursewarePolicy, setImproveCoursewarePolicy] = useState('全部纳入')


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
    if (stage === '评估归档') return ['效果评估', '数据记录', '证据归档']
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
    <section className="min-h-screen space-y-4 bg-[#faf8f5] px-6">
      {toastMessage ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toastMessage}
        </div>
      ) : null}
      {stageConfirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => (stageUpdating ? null : setStageConfirmOpen(false))}>
          <div className="w-full max-w-md rounded-[10px] border border-[#ede8df] bg-white px-6 py-4 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)] shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-semibold text-slate-900">确认进入阶段</div>
            <div className="mt-2 text-sm text-slate-700">{stageConfirmMessage}</div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={stageUpdating}
                onClick={() => setStageConfirmOpen(false)}
                className="rounded-lg border border-[#d6cfc4] bg-white px-4 py-2 text-sm text-[#5c4f3d] hover:bg-[#f5f0ea]"
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
                className="rounded-lg bg-[#b85c3a] px-[18px] py-2 text-sm font-semibold text-white shadow-[0_2px_0_#8c3e24] transition-transform hover:-translate-y-px active:translate-y-px active:shadow-[0_1px_0_#8c3e24] disabled:opacity-60"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-[10px] border border-[#ede8df] bg-[#faf8f5] px-6 py-3 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
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

      {/* ── Stage navigation ─────────────────────────────────── */}
      {(() => {
        const SUB_MAP: Record<string, {code:string; label:string}[]> = {
          '需求立项': [{code:'1A',label:'信息收集'},{code:'1B',label:'需求清单'}],
          '计划设计': [{code:'2A',label:'方案设计'},{code:'2B',label:'资源计划'},{code:'2C',label:'需求回顾'}],
          '材料准备': [{code:'3A',label:'任务清单'},{code:'3B',label:'课件材料'},{code:'3C',label:'审核状态'}],
          '培训实施': [{code:'4A',label:'实施准备'},{code:'4B',label:'现场执行'},{code:'4C',label:'考核测试'}],
          '评估归档': [{code:'5A',label:'效果评估'},{code:'5B',label:'归档打包'},{code:'5C',label:'改进建议'}],
        }
        const STEP_LABELS = ['STEP 1','STEP 2','STEP 3','STEP 4','STEP 5']
        return (
          <div style={{background:'#f8f6f2',border:'1px solid #e8e0d4',borderRadius:'12px',padding:'16px',marginBottom:'24px'}}>
            {/* Row 1: parent stage blocks */}
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
                      style={{
                        flex: 1,
                        height: '52px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '3px',
                        transition: 'filter 150ms',
                        position: 'relative',
                        background: done ? '#5a8f70' : current ? '#b85c3a' : '#ede8df',
                        color: done || current ? '#ffffff' : '#1a1208',
                        fontWeight: done ? 600 : current ? 700 : 500,
                        border: done || current ? 'none' : '1px solid #d6cfc4',
                        boxShadow: current ? '0 2px 10px rgba(184,92,58,0.4)' : 'none',
                      }}
                      onMouseEnter={(e) => { if (!current) (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.1)' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.filter = '' }}
                      className="disabled:opacity-70"
                    >
                      <span style={{fontSize:'11px',fontWeight:500,lineHeight:1,color:done||current?'rgba(255,255,255,0.85)':'#3d2e1a'}}>{STEP_LABELS[idx]}</span>
                      <span style={{fontSize:'14px',fontWeight:current?700:600,lineHeight:1}}>
                        {done ? '✓ ' : ''}{s}
                      </span>
                      {current && <span style={{position:'absolute',bottom:0,left:0,right:0,height:'3px',background:'#8c3e24',borderRadius:'0 0 8px 8px'}} />}
                    </button>
                    {idx < STAGES.length - 1 && (
                      <span style={{flexShrink:0,margin:'0 4px',fontSize:'20px',color:'#b8a898',lineHeight:1,userSelect:'none'}}>›</span>
                    )}
                  </React.Fragment>
                )
              })}
            </div>

            {/* Row 2: sub-item blocks */}
            <div className="mt-2 flex">
              {STAGES.map((s, sIdx) => {
                const subs = SUB_MAP[s] ?? []
                const isCurrentStage = sIdx === stageIdx
                return (
                  <React.Fragment key={s}>
                    <div style={{flex:1,display:'flex',gap:'1px'}}>
                      {subs.map((sub) => {
                        const subActive = isCurrentStage && activeTab === sub.label
                        const subDone = sIdx < stageIdx
                        return (
                          <button
                            key={sub.code}
                            type="button"
                            onClick={() => {
                              if (!isCurrentStage) onClickStage(s)
                              setActiveTab(sub.label)
                            }}
                            style={{
                              flex: 1,
                              height: '40px',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '2px',
                              transition: 'filter 150ms',
                              position: 'relative',
                              borderRadius: '0 0 6px 6px',
                              background: subActive ? '#c96a45' : subDone ? '#6fa882' : '#e8e2d8',
                              color: subActive || subDone ? '#ffffff' : '#1a1208',
                              fontWeight: subActive || subDone ? 600 : 500,
                              border: subActive || subDone ? 'none' : '1px solid #d6cfc4',
                            }}
                            onMouseEnter={(e) => { if (!subActive) (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.1)' }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.filter = '' }}
                          >
                            <span style={{fontSize:'10px',fontWeight:500,opacity:0.7,lineHeight:1}}>{sub.code}</span>
                            <span style={{fontSize:'12px',fontWeight:600,lineHeight:1}}>
                              {subDone && !subActive ? '✓ ' : ''}{sub.label}
                            </span>
                            {subActive && <span style={{position:'absolute',bottom:0,left:0,right:0,height:'2px',background:'#8c3e24',borderRadius:'0 0 6px 6px'}} />}
                          </button>
                        )
                      })}
                    </div>
                    {sIdx < STAGES.length - 1 && (
                      <div style={{width:'28px',flexShrink:0}} />
                    )}
                  </React.Fragment>
                )
              })}
            </div>

            {stageUpdateError ? <div className="mt-2 text-xs text-red-600">阶段切换失败：{stageUpdateError}</div> : null}
          </div>
        )
      })()}

      {workUnitLoading ? <div className="rounded-[10px] border border-[#ede8df] bg-white px-6 py-4 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)] text-sm text-slate-500">加载中...</div> : null}
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
                className="rounded-lg bg-[#b85c3a] px-[18px] py-2 text-sm font-semibold text-white shadow-[0_2px_0_#8c3e24] transition-transform hover:-translate-y-px active:translate-y-px active:shadow-[0_1px_0_#8c3e24] disabled:opacity-60"
              >
                发送
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="min-w-0">
        {/* ─── Stage content area ─────────────────────── */}
        {activeTab === '任务清单' ? (
          <article className="rounded-[10px] border border-[#ede8df] bg-white px-6 py-4 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
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
                  creatingTask ? 'bg-slate-400' : 'bg-[#b85c3a] shadow-[0_2px_0_#8c3e24] hover:-translate-y-px hover:bg-[#a04f30]'
                }`}
              >
                <Plus className="h-4 w-4" />
                添加
              </button>
              {createTaskError ? <span className="self-center text-xs text-red-700">{createTaskError}</span> : null}
            </div>
          </article>
        ) : activeTab === '课件材料' ? (
          <article className="rounded-[10px] border border-[#ede8df] bg-white px-6 py-4 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
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
                className="inline-flex items-center gap-2 rounded-lg border border-[#d6cfc4] bg-white px-4 py-2 text-sm text-[#5c4f3d] hover:bg-[#f5f0ea]"
              >
                <Upload className="h-4 w-4" />
                上传新材料
              </button>
              <button
                type="button"
                onClick={() => window.alert('Mock：从材料仓库选取')}
                className="inline-flex items-center gap-2 rounded-lg border border-[#d6cfc4] bg-white px-4 py-2 text-sm text-[#5c4f3d] hover:bg-[#f5f0ea]"
              >
                <FileText className="h-4 w-4" />
                从材料仓库选取
              </button>
            </div>
          </article>

        ) : stage === '需求立项' && activeTab === '信息收集' ? (
          <div className="space-y-4">
            <div className="flex items-start gap-4">
            <div className="min-w-0 flex-[0_0_33%] rounded-[10px] border border-[#ede8df] bg-white px-6 py-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
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
                  {/* Action buttons — single row */}
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button type="button" disabled className="inline-flex items-center gap-1 rounded-lg border border-[#d0c4b8] bg-white px-[14px] py-1.5 text-[13px] font-semibold text-[#5c4f3d] shadow-[0_2px_0_#c4b8ac] transition-transform hover:-translate-y-px active:translate-y-px active:shadow-[0_1px_0_#c4b8ac] disabled:cursor-not-allowed disabled:opacity-50">
                      🎤 语音
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
                      className="inline-flex items-center gap-1 rounded-lg border border-[#d0c4b8] bg-white px-[14px] py-1.5 text-[13px] font-semibold text-[#5c4f3d] shadow-[0_2px_0_#c4b8ac] transition-transform hover:-translate-y-px active:translate-y-px active:shadow-[0_1px_0_#c4b8ac] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      📝 记录想法
                    </button>
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
                      className={`inline-flex items-center gap-1 rounded-lg border-0 bg-[#b85c3a] px-[14px] py-1.5 text-[13px] font-bold text-white shadow-[0_2px_0_#8c3e24] transition-transform hover:-translate-y-px hover:bg-[#a04f30] active:translate-y-px active:shadow-[0_1px_0_#8c3e24] disabled:cursor-not-allowed disabled:opacity-60 ${ideaSuggestionLoading ? 'opacity-70' : ''}`}
                    >
                      {ideaSuggestionLoading ? '✨ 分析中...' : '✨ 来源建议'}
                    </button>
                  </div>
                  {ideaSuggestionError && (
                    <div className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{ideaSuggestionError}</div>
                  )}
                  <div
                    className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${ideaSuggestionVisible ? 'max-h-[480px]' : 'max-h-0'}`}
                  >
                    {ideaSuggestionVisible && (
                      <div className="mt-3 rounded-lg border border-[#e8e0d4] border-l-4 border-l-[#b85c3a] bg-[#fdf8f3] px-4 py-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-[#5c4f3d]">AI 建议通过以下方式收集信息：</span>
                          <button
                            type="button"
                            onClick={() => { setIdeaSuggestionVisible(false); setIdeaSuggestionCollapsed(true) }}
                            className="text-xs font-medium text-[#b85c3a] hover:text-[#8c3e24]"
                          >
                            收起 ∧
                          </button>
                        </div>
                        {!ideaSuggestionCollapsed && (
                          <>
                            <ul className="mt-2 space-y-1 text-xs text-[#5c4f3d]">
                              {ideaSuggestions.map((s) => (
                                <li key={s.label}>· {s.label} — {s.reason}</li>
                              ))}
                            </ul>
                            <div className="mt-2 text-xs text-[#8c3e24]">已为您自动选中以上来源，可手动调整 ↓</div>
                          </>
                        )}
                      </div>
                    )}
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
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 rounded-[10px] border border-[#ede8df] bg-white px-6 py-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              <div className="text-sm font-semibold text-slate-900">信息来源</div>
              <div className="mt-3 flex items-center gap-2 overflow-x-auto">
                {demandOptions.map((opt) => {
                  const selected = selectedDemandOptionIds.includes(opt.id)
                  const base = opt.recommended ? 'border-orange-300 text-orange-700' : 'border-slate-200 text-slate-700'
                  const cls = selected ? 'border-[#b85c3a] bg-[#b85c3a] text-white' : `bg-white hover:bg-[#f5f0ea] ${base}`
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
              <hr className="my-4 border-[#ede8df]" />
              <div className="w-full overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
              <table className="border-collapse text-left text-xs" style={{ tableLayout: 'fixed', width: '100%' }}>
                <colgroup>
                  <col width={40} />
                  <col width={72} />
                  <col width={56} />
                  <col />
                  <col width={110} />
                </colgroup>
                <thead>
                  <tr className="bg-[#faf6f0]">
                    <th className="border border-gray-200 px-2 py-3 text-center font-semibold text-[#5c4f3d] whitespace-nowrap overflow-hidden text-ellipsis">序号</th>
                    <th className="border border-gray-200 px-2 py-3 font-semibold text-[#5c4f3d] whitespace-nowrap overflow-hidden text-ellipsis">来源</th>
                    <th className="border border-gray-200 px-2 py-3 text-center font-semibold text-[#5c4f3d] whitespace-nowrap overflow-hidden text-ellipsis">需求数</th>
                    <th className="border border-gray-200 px-3 py-3 font-semibold text-[#5c4f3d] whitespace-normal break-all">关键词</th>
                    <th className="border border-gray-200 px-2 py-3 font-semibold text-[#5c4f3d] whitespace-nowrap">转化进度</th>
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
                          <tr key={opt.id} className={`hover:bg-blue-50/50 ${idx % 2 === 1 ? 'bg-[#faf6f0]' : 'bg-white'}`} style={{height:'48px'}}>
                            <td className="border border-gray-200 px-2 py-2.5 text-center text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis">{idx + 1}</td>
                            <td className="border border-gray-200 px-2 py-2.5 whitespace-nowrap overflow-hidden text-ellipsis">
                              <button
                                type="button"
                                onClick={() => {
                                  const current = demandMatrix[opt.id]
                                  if (!current) return
                                  setUnifiedDialogOptId(opt.id)
                                }}
                                className="block max-w-full cursor-pointer truncate text-sm text-slate-800 underline decoration-slate-300 hover:text-blue-600 hover:decoration-blue-400"
                              >
                                {row.label}
                              </button>
                            </td>
                            <td className="border border-gray-200 px-2 py-2.5 text-center text-slate-600 whitespace-nowrap overflow-hidden text-ellipsis">
                              {reqCount > 0 ? `${reqCount} 条` : '—'}
                            </td>
                            <td className="border border-gray-200 px-3 py-2.5 whitespace-normal break-all">
                              {keywords.length > 0 ? (
                                <div className="flex flex-wrap gap-1 break-all">
                                  {keywords.map((kw) => (
                                    <span key={kw} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 break-all">
                                      {kw}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="border border-gray-200 px-2 py-2.5 whitespace-nowrap">
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => setProgressPopoverId(showPopover ? null : opt.id)}
                                  className="flex items-center gap-2 whitespace-nowrap"
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
                  className="rounded-lg bg-[#b85c3a] px-[18px] py-2 text-sm font-semibold text-white shadow-[0_2px_0_#8c3e24] transition-transform hover:-translate-y-px active:translate-y-px active:shadow-[0_1px_0_#8c3e24] disabled:opacity-60 text-xs"
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
                  <table className="border-collapse text-xs" style={{tableLayout:'fixed',minWidth:'1400px',width:'100%'}}>
                    <colgroup>
                      <col style={{width:'48px'}} />
                      <col style={{width:'130px'}} />
                      <col style={{width:'180px'}} />
                      <col style={{width:'120px'}} />
                      <col style={{width:'150px'}} />
                      <col style={{width:'90px'}} />
                      <col style={{width:'140px'}} />
                      <col style={{width:'130px'}} />
                      <col style={{width:'80px'}} />
                      <col style={{width:'100px'}} />
                      <col style={{width:'80px'}} />
                    </colgroup>
                    <thead>
                      <tr className="bg-[#faf6f0]">
                        <th className="border border-gray-200 px-2 py-3 text-center font-semibold text-[#5c4f3d]">序号</th>
                        <th className="border border-gray-200 px-3 py-3 text-center font-semibold text-[#5c4f3d]">需求名称</th>
                        <th className="border border-gray-200 px-3 py-3 text-center font-semibold text-[#5c4f3d]">需求描述</th>
                        <th className="border border-gray-200 px-3 py-3 text-center font-semibold text-[#5c4f3d]">培训主体</th>
                        <th className="border border-gray-200 px-3 py-3 text-center font-semibold text-[#5c4f3d]">对应场景</th>
                        <th className="border border-gray-200 px-3 py-3 text-center font-semibold text-[#5c4f3d]">需求属性</th>
                        <th className="border border-gray-200 px-3 py-3 text-center font-semibold text-[#5c4f3d]">关联操作</th>
                        <th className="border border-gray-200 px-3 py-3 text-center font-semibold text-[#5c4f3d]">来源关键词</th>
                        <th className="border border-gray-200 px-3 py-3 text-center font-semibold text-[#5c4f3d]">优先级</th>
                        <th className="border border-gray-200 px-3 py-3 text-center font-semibold text-[#5c4f3d]">状态</th>
                        <th className="border border-gray-200 px-2 py-3 text-center font-semibold text-[#5c4f3d]">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reqList.map((row, idx) => {
                        const isComplete = row.trainingSubject.length > 0 && !!row.scenario && !!row.requirementType && !!row.relatedAction
                        return (
                          <React.Fragment key={row.id}>
                            {/* Main data row */}
                            <tr className={idx % 2 === 0 ? 'bg-white' : 'bg-[#faf6f0]'} style={{height:'48px'}}>
                              {/* 序号 */}
                              <td className="border border-gray-200 px-2 py-2 text-center align-middle text-slate-400">{idx + 1}</td>

                              {/* 需求名称 */}
                              <td className="border border-gray-200 px-3 py-2 align-middle" style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                                <input
                                  value={row.title}
                                  onChange={(e) => setReqList((prev) => prev.map((r) => r.id === row.id ? { ...r, title: e.target.value } : r))}
                                  placeholder="输入需求名称…"
                                  className="w-full rounded border-0 bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-300 focus:ring-0"
                                />
                              </td>

                              {/* 需求描述 */}
                              <td className="border border-gray-200 px-3 py-2 align-middle" style={{overflow:'hidden',whiteSpace:'normal',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>
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
                              <td className="border border-gray-200 px-3 py-2 align-middle">
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
                              <td className="border border-gray-200 px-3 py-2 align-middle" style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                                <span className="text-xs text-slate-600">{row.scenario || <span className="text-slate-300">—</span>}</span>
                              </td>

                              {/* 需求属性 */}
                              <td className="border border-gray-200 px-3 py-2 align-middle">
                                {row.requirementType ? (
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                    row.requirementType === '实操类' ? 'bg-emerald-50 text-emerald-700' :
                                    row.requirementType === '理念类' ? 'bg-violet-50 text-violet-700' :
                                    row.requirementType === '技术类' ? 'bg-blue-50 text-blue-700' :
                                    'bg-amber-50 text-amber-700'
                                  }`}>{row.requirementType}</span>
                                ) : (
                                  <span className="text-xs text-slate-300">—</span>
                                )}
                              </td>

                              {/* 关联操作 */}
                              <td className="border border-gray-200 px-3 py-2 align-middle" style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                                <span className="text-xs text-slate-600">{row.relatedAction || <span className="text-slate-300">—</span>}</span>
                              </td>

                              {/* 来源关键词 */}
                              <td className="border border-gray-200 px-3 py-2 align-middle">
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
                              <td className="border border-gray-200 px-3 py-2 align-middle">
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
                              <td className="border border-gray-200 px-3 py-2 align-middle">
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
                              <td className="border border-gray-200 px-2 py-2 text-center align-middle">
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
                                              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${selected ? 'border-[#b85c3a] bg-[#fdf3ea] text-[#8c3e24]' : 'border-slate-200 bg-white text-slate-500 hover:border-blue-300'}`}
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
                                      className="rounded-lg bg-[#b85c3a] px-[18px] py-2 text-sm font-semibold text-white shadow-[0_2px_0_#8c3e24] transition-transform hover:-translate-y-px active:translate-y-px active:shadow-[0_1px_0_#8c3e24] disabled:opacity-60 text-xs"
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
                  className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-[#d6cfc4] px-3 py-1.5 text-xs text-slate-400"
                >
                  📄 导出需求清单
                </button>
                <button
                  type="button"
                  onClick={() => alert('报告生成功能即将上线')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#d6cfc4] bg-white px-4 py-2 text-sm text-[#5c4f3d] hover:bg-[#f5f0ea] text-xs"
                >
                  📄 生成立项报告
                </button>
              </div>
              <p className="mt-3 text-center text-xs text-slate-400">
                需求立项报告将包含：需求描述记录 + 各信息来源摘要 + 完整需求清单，可导出为 Word / PDF
              </p>
            </div>
          </div>
        ) : stage === '计划设计' && activeTab === '方案设计' ? (
          /* ────── 计划设计 / 方案设计 ────── */
          <div className="space-y-4">
            {/* Sub-stage progress bar */}
            <div className="flex items-center gap-3 rounded-[10px] border border-[#ede8df] bg-white px-6 py-3 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              {(['方案设计','资源计划','需求回顾'] as const).map((sub, idx) => {
                const done = sub === '方案设计' && planDesignStatus === '已完成'
                const current = activeTab === sub
                return (
                  <React.Fragment key={sub}>
                    {idx > 0 && <div className="h-px flex-1 bg-slate-200" />}
                    <div className={`flex items-center gap-1.5 text-xs font-medium ${done ? 'text-green-600' : current ? 'text-blue-600' : 'text-slate-400'}`}>
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${done ? 'bg-green-100' : current ? 'bg-blue-100' : 'bg-slate-100'}`}>
                        {done ? '✓' : idx + 1}
                      </span>
                      {sub}
                      {done && <span className="text-green-500">✓</span>}
                    </div>
                  </React.Fragment>
                )
              })}
              {planDesignStatus === '已完成' && (
                <button type="button" className="ml-auto rounded-lg bg-[#b85c3a] px-[18px] py-2 text-sm font-semibold text-white shadow-[0_2px_0_#8c3e24] transition-transform hover:-translate-y-px active:translate-y-px active:shadow-[0_1px_0_#8c3e24] disabled:opacity-60 text-xs" onClick={() => alert('任务清单生成功能即将上线')}>
                  生成任务清单
                </button>
              )}
            </div>

            {/* Status bar */}
            <div className="flex items-center justify-between rounded-[10px] border border-[#ede8df] bg-white px-6 py-3 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-slate-800">方案设计</span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${planDesignStatus === '已完成' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}>
                  {planDesignStatus}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPlanDesignStatus((p) => p === '已完成' ? '草稿中' : '已完成')}
                className={`rounded border px-3 py-1.5 text-xs ${planDesignStatus === '已完成' ? 'border-slate-200 text-slate-500 hover:text-slate-700' : 'border-[#b85c3a] bg-[#fdf3ea] text-[#8c3e24] hover:bg-[#f5e8dc]'}`}
              >
                {planDesignStatus === '已完成' ? '撤回完成标记' : '标记为已完成'}
              </button>
            </div>

            {/* Main content: form + sidebar */}
            <div className="flex gap-4">
              {/* Form */}
              <div className="min-w-0 flex-1 space-y-4">

                {/* 组1：培训目标与对象 */}
                <div className="rounded-[10px] border border-[#ede8df] bg-white px-6 py-5 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                  <div className="mb-4 border-l-4 border-[#b85c3a] pl-2.5 text-[15px] font-bold text-[#b85c3a]">培训目标与对象</div>
                  <div className="space-y-4">

                    {/* 培训目标 */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-gray-700">培训目标</label>
                      <textarea
                        value={planGoal}
                        onChange={(e) => setPlanGoal(e.target.value)}
                        rows={4}
                        placeholder="基于需求清单，描述本次培训希望达到的核心目标"
                        className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
                      />
                    </div>

                    {/* 培训对象 */}
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <label className="text-xs font-medium text-gray-700">培训对象</label>
                        <button
                          type="button"
                          onClick={() => {
                            const subjects = reqList.flatMap((r) => r.trainingSubject)
                            const unique = Array.from(new Set(subjects))
                            setPlanSubjects(unique)
                          }}
                          className="text-xs text-slate-400 hover:text-slate-600"
                        >从需求清单汇聚</button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 rounded-md border border-gray-300 p-2 min-h-[36px] focus-within:border-blue-500">
                        {planSubjects.map((s) => (
                          <span key={s} className="inline-flex items-center gap-0.5 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs text-indigo-700">
                            {s}
                            <button type="button" onClick={() => setPlanSubjects((p) => p.filter((x) => x !== s))} className="text-indigo-400 hover:text-indigo-700">×</button>
                          </span>
                        ))}
                        {['合规岗','客户经理','运营岗','管理层','全员'].filter((x) => !planSubjects.includes(x)).map((opt) => (
                          <button key={opt} type="button" onClick={() => setPlanSubjects((p) => [...p, opt])}
                            className="rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-xs text-slate-400 hover:border-indigo-300 hover:text-indigo-500">
                            + {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 预计人数 */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-gray-700">预计参训人数</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          value={planParticipantCount}
                          onChange={(e) => setPlanParticipantCount(e.target.value)}
                          placeholder="0"
                          className="w-28 rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
                        />
                        <span className="text-sm text-slate-500">人</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 组2：培训方式与内容 */}
                <div className="rounded-[10px] border border-[#ede8df] bg-white px-6 py-5 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                  <div className="mb-4 border-l-4 border-[#b85c3a] pl-2.5 text-[15px] font-bold text-[#b85c3a]">培训方式与内容</div>
                  <div className="space-y-5">

                    {/* 培训方式 */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-gray-700">培训方式 <span className="font-normal text-slate-400">（可多选）</span></label>
                      <div className="flex flex-wrap gap-2">
                        {['线下集中','线上直播','录播自学','混合'].map((m) => {
                          const active = planMethods.includes(m)
                          return (
                            <button key={m} type="button"
                              onClick={() => setPlanMethods((p) => active ? p.filter((x) => x !== m) : [...p, m])}
                              className={`rounded-full border px-3 py-1 text-xs transition-colors ${active ? 'border-[#b85c3a] bg-[#fdf3ea] text-[#8c3e24]' : 'border-slate-200 text-slate-500 hover:border-blue-200'}`}>
                              {m}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* 内容模块 */}
                    <div>
                      <label className="mb-2 block text-xs font-medium text-gray-700">内容模块</label>
                      <div className="overflow-hidden rounded-lg border border-gray-200">
                        <table className="w-full border-collapse text-xs">
                          <thead className="bg-[#faf6f0]">
                            <tr>
                              <th className="border-b border-gray-200 px-3 py-2 text-center font-medium text-slate-500" style={{width:'36px'}}>序号</th>
                              <th className="border-b border-gray-200 px-3 py-2 text-left font-medium text-slate-500">模块名称</th>
                              <th className="border-b border-gray-200 px-3 py-2 text-left font-medium text-slate-500" style={{width:'110px'}}>需求属性</th>
                              <th className="border-b border-gray-200 px-3 py-2 text-left font-medium text-slate-500" style={{width:'100px'}}>预计时长</th>
                              <th className="border-b border-gray-200 px-3 py-2 text-center font-medium text-slate-500" style={{width:'40px'}}></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {planModules.map((mod, mIdx) => (
                              <tr key={mod.id} className={mIdx % 2 === 0 ? 'bg-white' : 'bg-[#faf6f0]'}>
                                <td className="px-3 py-2 text-center text-slate-400">{mIdx + 1}</td>
                                <td className="px-3 py-2">
                                  <input value={mod.name} onChange={(e) => setPlanModules((p) => p.map((m) => m.id === mod.id ? {...m, name: e.target.value} : m))}
                                    className="w-full rounded border-0 bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-300 focus:ring-0" placeholder="模块名称…" />
                                </td>
                                <td className="px-3 py-2">
                                  <select value={mod.reqType} onChange={(e) => setPlanModules((p) => p.map((m) => m.id === mod.id ? {...m, reqType: e.target.value} : m))}
                                    className="w-full rounded border border-slate-200 bg-white px-2 py-0.5 text-xs outline-none focus:border-blue-300">
                                    <option value="">请选择</option>
                                    <option>理念类</option><option>实操类</option><option>技术类</option><option>合规类</option>
                                  </select>
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-1">
                                    <input type="number" min={0} value={mod.duration} onChange={(e) => setPlanModules((p) => p.map((m) => m.id === mod.id ? {...m, duration: e.target.value} : m))}
                                      className="w-14 rounded border border-slate-200 bg-white px-2 py-0.5 text-xs outline-none focus:border-blue-300" placeholder="0" />
                                    <span className="text-xs text-slate-400">分钟</span>
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <button type="button" onClick={() => setPlanModules((p) => p.filter((m) => m.id !== mod.id))}
                                    className="inline-flex h-5 w-5 items-center justify-center rounded text-slate-300 hover:bg-red-50 hover:text-red-500">
                                    <X className="h-3 w-3" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="border-t border-gray-100 px-3 py-2">
                          <button type="button" onClick={() => setPlanModules((p) => [...p, {id: Date.now(), name: '', reqType: '', duration: ''}])}
                            className="text-xs text-blue-500 hover:text-blue-700">+ 添加内容模块</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 组3：效果预期与检验 */}
                <div className="rounded-[10px] border border-[#ede8df] bg-white px-6 py-5 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                  <div className="mb-4 border-l-4 border-[#b85c3a] pl-2.5 text-[15px] font-bold text-[#b85c3a]">效果预期与检验</div>
                  <div className="space-y-4">

                    {/* 预计总时长 */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-gray-700">预计总时长</label>
                      <div className="flex items-center gap-2">
                        <span className="rounded-md border border-gray-200 bg-[#faf6f0] px-3 py-1.5 text-sm text-slate-600">
                          {planModules.reduce((s, m) => s + (parseInt(m.duration) || 0), 0)}
                        </span>
                        <span className="text-sm text-slate-500">分钟（自动计算）</span>
                      </div>
                    </div>

                    {/* 预期效果 */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-gray-700">预期效果描述</label>
                      <textarea value={planEffectDesc} onChange={(e) => setPlanEffectDesc(e.target.value)} rows={3}
                        placeholder="描述培训结束后，参训人员应具备的能力或达到的标准…"
                        className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100" />
                    </div>

                    {/* 检验方式 */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-gray-700">效果检验方式</label>
                      <div className="flex flex-wrap gap-2">
                        {['考试','问卷调查','现场观察','不做检验'].map((m) => (
                          <button key={m} type="button"
                            onClick={() => setPlanCheckMethod((p) => p === m ? '' : m)}
                            className={`rounded-full border px-3 py-1 text-xs transition-colors ${planCheckMethod === m ? 'border-[#b85c3a] bg-[#fdf3ea] text-[#8c3e24]' : 'border-slate-200 text-slate-500 hover:border-blue-200'}`}>
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 底部交付物确认 */}
                <div className="flex items-center justify-between rounded-[10px] border border-[#ede8df] bg-white px-6 py-3 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="font-medium">交付物：培训方案草稿</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${planDesignStatus === '已完成' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}>{planDesignStatus}</span>
                  </div>
                  <button type="button" onClick={() => alert('导出功能即将上线')}
                    className="rounded-lg border border-[#d6cfc4] bg-white px-4 py-2 text-sm text-[#5c4f3d] hover:bg-[#f5f0ea] text-xs">
                    导出方案
                  </button>
                </div>
              </div>

              {/* Sidebar: 需求清单引用 */}
              {planSidebarOpen ? (
                <div className="flex-shrink-0" style={{width:'280px'}}>
                  <div className="sticky top-4 rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                      <span className="text-xs font-semibold text-slate-700">📋 需求清单（阶段一）</span>
                      <button type="button" onClick={() => setPlanSidebarOpen(false)} className="text-xs text-slate-400 hover:text-slate-600">收起</button>
                    </div>
                    <div className="max-h-[70vh] overflow-y-auto p-3 space-y-2">
                      {reqList.length === 0 ? (
                        <div className="py-6 text-center text-xs text-slate-400">阶段一暂无需求条目</div>
                      ) : reqList.map((r) => {
                        const complete = r.trainingSubject.length > 0 && !!r.scenario && !!r.requirementType && !!r.relatedAction
                        return (
                          <div key={r.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 space-y-1.5">
                            <div className="text-xs font-semibold text-slate-800 leading-tight">{r.title || '（未命名）'}</div>
                            <div className="flex flex-wrap items-center gap-1">
                              {r.requirementType && (
                                <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs ${
                                  r.requirementType === '实操类' ? 'bg-emerald-50 text-emerald-700' :
                                  r.requirementType === '理念类' ? 'bg-violet-50 text-violet-700' :
                                  r.requirementType === '技术类' ? 'bg-blue-50 text-blue-700' :
                                  'bg-amber-50 text-amber-700'
                                }`}>{r.requirementType}</span>
                              )}
                              {r.trainingSubject.map((s) => (
                                <span key={s} className="inline-flex items-center rounded-full bg-indigo-50 px-1.5 py-0.5 text-xs text-indigo-600">{s}</span>
                              ))}
                              <span className={`ml-auto inline-flex items-center rounded-full px-1.5 py-0.5 text-xs ${complete ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}>
                                {complete ? '✓ 完整' : '待完善'}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-shrink-0">
                  <button type="button" onClick={() => setPlanSidebarOpen(true)}
                    className="sticky top-4 flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm text-sm hover:bg-slate-50" title="展开需求清单">
                    📋
                  </button>
                </div>
              )}
            </div>
          </div>

        ) : stage === '计划设计' && activeTab === '资源计划' ? (
          /* ── 计划设计 / 资源计划 ── */
          <div className="space-y-4">
            {/* Sub-stage progress bar */}
            <div className="flex items-center gap-3 rounded-[10px] border border-[#ede8df] bg-white px-6 py-3 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              {(['方案设计','资源计划','需求回顾'] as const).map((sub, idx) => {
                const done = (sub === '方案设计' && planDesignStatus === '已完成') ||
                             (sub === '资源计划' && resPlanStatus === '已完成')
                const current = activeTab === sub
                return (
                  <React.Fragment key={sub}>
                    {idx > 0 && <div className="h-px flex-1 bg-slate-200" />}
                    <div className={`flex items-center gap-1.5 text-xs font-medium ${done ? 'text-green-600' : current ? 'text-blue-600' : 'text-slate-400'}`}>
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${done ? 'bg-green-100' : current ? 'bg-blue-100' : 'bg-slate-100'}`}>
                        {done ? '✓' : idx + 1}
                      </span>
                      {sub}{done && <span className="text-green-500">✓</span>}
                    </div>
                  </React.Fragment>
                )
              })}
            </div>

            {/* Hint */}
            <div className="flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50 px-4 py-2.5 text-xs text-blue-700">
              <span>💡 培训方式会影响场地和设备需求，建议先完成方案设计后填写本项</span>
              <button type="button" onClick={() => setActiveTab('方案设计')} className="ml-4 flex-shrink-0 text-blue-500 underline hover:text-blue-700">前往方案设计</button>
            </div>

            {/* Status bar */}
            <div className="flex items-center justify-between rounded-[10px] border border-[#ede8df] bg-white px-6 py-3 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-slate-800">资源计划</span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${resPlanStatus === '已完成' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}>{resPlanStatus}</span>
              </div>
              <button type="button" onClick={() => setResPlanStatus((p) => p === '已完成' ? '草稿中' : '已完成')}
                className={`rounded border px-3 py-1.5 text-xs ${resPlanStatus === '已完成' ? 'border-slate-200 text-slate-500 hover:text-slate-700' : 'border-[#b85c3a] bg-[#fdf3ea] text-[#8c3e24] hover:bg-[#f5e8dc]'}`}>
                {resPlanStatus === '已完成' ? '撤回完成标记' : '标记为已完成'}
              </button>
            </div>

            {/* 组1: 时间安排 */}
            <div className="rounded-[10px] border border-[#ede8df] bg-white px-6 py-5 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-4">
              <div className="border-l-4 border-[#b85c3a] pl-2.5 text-[15px] font-bold text-[#b85c3a]">时间安排</div>
              <div className="space-y-2">
                {resSessions.map((sess) => (
                  <div key={sess.id} className="flex items-center gap-2">
                    <input value={sess.name} onChange={(e) => setResSessions((p) => p.map((s) => s.id === sess.id ? {...s, name: e.target.value} : s))}
                      placeholder="场次名称" className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-blue-500" />
                    <input type="date" value={sess.date} onChange={(e) => setResSessions((p) => p.map((s) => s.id === sess.id ? {...s, date: e.target.value} : s))}
                      className="rounded-md border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-blue-500" />
                    <input type="time" value={sess.startTime} onChange={(e) => setResSessions((p) => p.map((s) => s.id === sess.id ? {...s, startTime: e.target.value} : s))}
                      className="rounded-md border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-blue-500" />
                    <span className="text-xs text-slate-400">—</span>
                    <input type="time" value={sess.endTime} onChange={(e) => setResSessions((p) => p.map((s) => s.id === sess.id ? {...s, endTime: e.target.value} : s))}
                      className="rounded-md border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-blue-500" />
                    <button type="button" onClick={() => setResSessions((p) => p.filter((s) => s.id !== sess.id))} className="text-slate-300 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
                <button type="button" onClick={() => setResSessions((p) => [...p, {id: Date.now(), name:'', date:'', startTime:'', endTime:''}])}
                  className="text-xs text-blue-500 hover:text-blue-700">+ 添加场次</button>
              </div>
            </div>

            {/* 组2: 人员与场地 */}
            <div className="rounded-[10px] border border-[#ede8df] bg-white px-6 py-5 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-4">
              <div className="border-l-4 border-[#b85c3a] pl-2.5 text-[15px] font-bold text-[#b85c3a]">人员与场地</div>

              {/* 讲师 */}
              <div>
                <label className="mb-2 block text-xs font-medium text-gray-700">讲师安排</label>
                <div className="space-y-2">
                  {resTeachers.map((t) => (
                    <div key={t.id} className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {(['内部','外部'] as const).map((tp) => (
                          <button key={tp} type="button"
                            onClick={() => setResTeachers((p) => p.map((x) => x.id === t.id ? {...x, type: tp} : x))}
                            className={`rounded border px-2 py-1 text-xs ${t.type === tp ? 'border-[#b85c3a] bg-[#fdf3ea] text-[#8c3e24]' : 'border-slate-200 text-slate-500 hover:border-blue-200'}`}>{tp}</button>
                        ))}
                      </div>
                      <input value={t.name} onChange={(e) => setResTeachers((p) => p.map((x) => x.id === t.id ? {...x, name: e.target.value} : x))}
                        placeholder={t.type === '内部' ? '姓名' : '机构名称'} className="w-28 rounded-md border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-blue-500" />
                      {t.type === '内部' && (
                        <input value={t.dept} onChange={(e) => setResTeachers((p) => p.map((x) => x.id === t.id ? {...x, dept: e.target.value} : x))}
                          placeholder="所属部门" className="w-28 rounded-md border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-blue-500" />
                      )}
                      <button type="button" onClick={() => setResTeachers((p) => p.filter((x) => x.id !== t.id))} className="text-slate-300 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setResTeachers((p) => [...p, {id: Date.now(), type:'内部', name:'', dept:''}])}
                    className="text-xs text-blue-500 hover:text-blue-700">+ 添加讲师</button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">场地 / 平台</label>
                  <input value={resVenue} onChange={(e) => setResVenue(e.target.value)} placeholder="线下填具体地点；线上填会议平台及链接"
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">预计容纳人数</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min={0} value={resCapacity} onChange={(e) => setResCapacity(e.target.value)} placeholder="0"
                      className="w-24 rounded-md border border-gray-300 px-3 py-1.5 text-xs outline-none focus:border-blue-500" />
                    <span className="text-xs text-slate-500">人</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 组3: 物资与费用 */}
            <div className="rounded-[10px] border border-[#ede8df] bg-white px-6 py-5 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-4">
              <div className="border-l-4 border-[#b85c3a] pl-2.5 text-[15px] font-bold text-[#b85c3a]">物资与费用</div>

              {/* 设备 tags */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-700">所需设备工具</label>
                <div className="flex flex-wrap gap-1.5 rounded-md border border-gray-300 p-2 min-h-[36px] focus-within:border-blue-500">
                  {resEquipment.map((e) => (
                    <span key={e} className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                      {e}<button type="button" onClick={() => setResEquipment((p) => p.filter((x) => x !== e))} className="text-slate-400 hover:text-slate-700">×</button>
                    </span>
                  ))}
                  <input value={resEquipmentInput} onChange={(e) => setResEquipmentInput(e.target.value)}
                    onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ',') && resEquipmentInput.trim()) { setResEquipment((p) => [...p, resEquipmentInput.trim()]); setResEquipmentInput(''); e.preventDefault() }}}
                    placeholder="输入后回车添加" className="min-w-[80px] flex-1 border-0 bg-transparent text-xs outline-none placeholder:text-slate-300" />
                </div>
              </div>

              {/* 协同部门 tags */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-700">协同部门</label>
                <div className="flex flex-wrap gap-1.5 rounded-md border border-gray-300 p-2 min-h-[36px] focus-within:border-blue-500">
                  {resDepts.map((d) => (
                    <span key={d} className="inline-flex items-center gap-0.5 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs text-indigo-600">
                      {d}<button type="button" onClick={() => setResDepts((p) => p.filter((x) => x !== d))} className="text-indigo-400 hover:text-indigo-700">×</button>
                    </span>
                  ))}
                  <input value={resDeptsInput} onChange={(e) => setResDeptsInput(e.target.value)}
                    onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ',') && resDeptsInput.trim()) { setResDepts((p) => [...p, resDeptsInput.trim()]); setResDeptsInput(''); e.preventDefault() }}}
                    placeholder="输入后回车添加" className="min-w-[80px] flex-1 border-0 bg-transparent text-xs outline-none placeholder:text-slate-300" />
                </div>
              </div>

              {/* 预算 */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-700">预算估算</label>
                <div className="flex items-center gap-2">
                  <input type="number" min={0} value={resBudget} onChange={(e) => setResBudget(e.target.value)} placeholder="0"
                    className="w-28 rounded-md border border-gray-300 px-3 py-1.5 text-xs outline-none focus:border-blue-500" />
                  <span className="text-xs text-slate-500 flex-shrink-0">元</span>
                  <input value={resBudgetNote} onChange={(e) => setResBudgetNote(e.target.value)} placeholder="备注（如：含讲师差旅）"
                    className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs outline-none focus:border-blue-500" />
                </div>
              </div>
            </div>

            {/* 底部交付物 */}
            <div className="flex items-center justify-between rounded-[10px] border border-[#ede8df] bg-white px-6 py-3 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span className="font-medium">交付物：资源需求清单</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${resPlanStatus === '已完成' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}>{resPlanStatus}</span>
              </div>
              <button type="button" onClick={() => alert('导出功能即将上线')}
                className="rounded-lg border border-[#d6cfc4] bg-white px-4 py-2 text-sm text-[#5c4f3d] hover:bg-[#f5f0ea] text-xs">导出清单</button>
            </div>
          </div>

        ) : stage === '计划设计' && activeTab === '需求回顾' ? (
          /* ── 计划设计 / 需求回顾 ── */
          <div className="space-y-4">
            {/* Sub-stage progress bar */}
            <div className="flex items-center gap-3 rounded-[10px] border border-[#ede8df] bg-white px-6 py-3 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              {(['方案设计','资源计划','需求回顾'] as const).map((sub, idx) => {
                const done = (sub === '方案设计' && planDesignStatus === '已完成') ||
                             (sub === '资源计划' && resPlanStatus === '已完成')
                const current = activeTab === sub
                return (
                  <React.Fragment key={sub}>
                    {idx > 0 && <div className="h-px flex-1 bg-slate-200" />}
                    <div className={`flex items-center gap-1.5 text-xs font-medium ${done ? 'text-green-600' : current ? 'text-blue-600' : 'text-slate-400'}`}>
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${done ? 'bg-green-100' : current ? 'bg-blue-100' : 'bg-slate-100'}`}>
                        {done ? '✓' : idx + 1}
                      </span>
                      {sub}{done && <span className="text-green-500">✓</span>}
                    </div>
                  </React.Fragment>
                )
              })}
            </div>

            {/* Hint */}
            <div className="flex items-center gap-3 rounded-lg border border-orange-100 bg-orange-50 px-4 py-2.5 text-xs text-orange-700">
              <span>⚠️ 本环节需确认方案设计和资源计划已完成，再进行需求覆盖核查</span>
            </div>

            {/* Status bar */}
            <div className="flex items-center justify-between rounded-[10px] border border-[#ede8df] bg-white px-6 py-3 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-800">需求回顾</span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${reviewConclusion === '审核通过' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}>
                  {reviewConclusion === '审核通过' ? '审核通过' : '待审核'}
                </span>
                <span className="text-xs text-slate-400">审核通过后方可生成任务清单</span>
              </div>
            </div>

            {/* Main: form + sidebar */}
            <div className="flex gap-4">
              <div className="min-w-0 flex-1 space-y-4">

                {/* 区域1: 需求覆盖检查表 */}
                <div className="rounded-[10px] border border-[#ede8df] bg-white px-6 py-5 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                  <div className="mb-4 border-l-4 border-[#b85c3a] pl-2.5 text-[15px] font-bold text-[#b85c3a]">需求覆盖检查表</div>
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full border-collapse text-xs" style={{tableLayout:'fixed'}}>
                      <colgroup>
                        <col style={{width:'40px'}} /><col style={{width:'160px'}} /><col style={{width:'80px'}} />
                        <col style={{width:'150px'}} /><col /><col style={{width:'110px'}} />
                      </colgroup>
                      <thead className="bg-[#faf6f0]">
                        <tr>
                          {['序号','需求名称','需求属性','覆盖状态','存疑说明','处置结论'].map((h) => (
                            <th key={h} className="border border-gray-200 px-3 py-2.5 text-center font-semibold text-[#5c4f3d]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {reviewChecks.map((chk, ci) => (
                          <tr key={chk.id} className={ci % 2 === 0 ? 'bg-white' : 'bg-[#faf6f0]'}>
                            <td className="border border-gray-200 px-3 py-2.5 text-center text-slate-400">{ci + 1}</td>
                            <td className="border border-gray-200 px-3 py-2.5 text-slate-700">{chk.reqTitle}</td>
                            <td className="border border-gray-200 px-3 py-2.5 text-center">
                              {chk.reqType && (
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${
                                  chk.reqType === '实操类' ? 'bg-emerald-50 text-emerald-700' :
                                  chk.reqType === '理念类' ? 'bg-violet-50 text-violet-700' :
                                  chk.reqType === '技术类' ? 'bg-blue-50 text-blue-700' :
                                  'bg-amber-50 text-amber-700'}`}>{chk.reqType}</span>
                              )}
                            </td>
                            <td className="border border-gray-200 px-3 py-2.5">
                              <div className="flex flex-wrap gap-1">
                                {['已覆盖','部分覆盖','未覆盖'].map((s) => (
                                  <button key={s} type="button"
                                    onClick={() => setReviewChecks((p) => p.map((c) => c.id === chk.id ? {...c, coverStatus: s} : c))}
                                    className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${chk.coverStatus === s
                                      ? (s === '已覆盖' ? 'border-green-400 bg-green-50 text-green-700' : s === '部分覆盖' ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-red-400 bg-red-50 text-red-700')
                                      : 'border-slate-200 text-slate-400 hover:border-slate-300'}`}>{s}</button>
                                ))}
                              </div>
                            </td>
                            <td className="border border-gray-200 px-3 py-2.5">
                              <input value={chk.note}
                                onChange={(e) => setReviewChecks((p) => p.map((c) => c.id === chk.id ? {...c, note: e.target.value} : c))}
                                placeholder={chk.coverStatus !== '已覆盖' ? '请填写存疑说明（必填）' : '—'}
                                className={`w-full rounded border bg-transparent px-2 py-0.5 text-xs outline-none focus:ring-1 ${chk.coverStatus !== '已覆盖' && !chk.note ? 'border-orange-300 focus:ring-orange-100 placeholder:text-orange-300' : 'border-slate-200 focus:ring-blue-100 placeholder:text-slate-300'}`} />
                            </td>
                            <td className="border border-gray-200 px-3 py-2.5">
                              {chk.note ? (
                                <div className="flex flex-wrap gap-1">
                                  {['已修正','保留说明','暂搁置'].map((c) => (
                                    <button key={c} type="button"
                                      onClick={() => setReviewChecks((p) => p.map((x) => x.id === chk.id ? {...x, conclusion: c} : x))}
                                      className={`rounded-full border px-2 py-0.5 text-xs ${chk.conclusion === c ? 'border-[#b85c3a] bg-[#fdf3ea] text-[#8c3e24]' : 'border-slate-200 text-slate-400 hover:border-slate-300'}`}>{c}</button>
                                  ))}
                                </div>
                              ) : <span className="text-xs text-slate-300">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Coverage stats */}
                  {(() => {
                    const covered = reviewChecks.filter((c) => c.coverStatus === '已覆盖').length
                    const partial = reviewChecks.filter((c) => c.coverStatus === '部分覆盖').length
                    const none = reviewChecks.filter((c) => c.coverStatus === '未覆盖').length
                    const total = reviewChecks.length
                    const pct = total > 0 ? Math.round(((covered + partial) / total) * 100) : 0
                    return (
                      <div className="mt-3 flex items-center gap-3 text-xs">
                        <span className="text-slate-500">已覆盖 <span className="font-medium text-green-600">{covered}</span></span>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-500">部分覆盖 <span className="font-medium text-orange-500">{partial}</span></span>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-500">未覆盖 <span className="font-medium text-red-500">{none}</span></span>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-500">覆盖率 <span className="font-medium text-blue-600">{pct}%（含处置）</span></span>
                      </div>
                    )
                  })()}
                </div>

                {/* 区域2: 审核结论 */}
                <div className="rounded-[10px] border border-[#ede8df] bg-white px-6 py-5 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-4">
                  <div className="border-l-4 border-[#b85c3a] pl-2.5 text-[15px] font-bold text-[#b85c3a]">审核结论</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-gray-700">审核人</label>
                      <input value={reviewAuditor} onChange={(e) => setReviewAuditor(e.target.value)} placeholder="填写审核人姓名"
                        className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500" />
                    </div>
                    <div></div>
                    <div className="col-span-2">
                      <label className="mb-1.5 block text-xs font-medium text-gray-700">审核意见</label>
                      <textarea value={reviewOpinion} onChange={(e) => setReviewOpinion(e.target.value)} rows={3}
                        placeholder="填写审核意见…"
                        className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100" />
                    </div>
                    <div className="col-span-2">
                      <label className="mb-2 block text-xs font-medium text-gray-700">审核结论</label>
                      <div className="flex gap-3">
                        {([['审核通过','border-green-400 bg-green-50 text-green-700','border-slate-200 text-slate-500'],
                           ['需修改','border-orange-400 bg-orange-50 text-orange-700','border-slate-200 text-slate-500']] as const).map(([label, activeClass, inactiveClass]) => (
                          <button key={label} type="button"
                            onClick={() => setReviewConclusion(reviewConclusion === label ? '' : label)}
                            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${reviewConclusion === label ? activeClass : inactiveClass + ' hover:border-slate-300'}`}>
                            {label === '审核通过' ? '✅' : '⚠️'} {label}
                          </button>
                        ))}
                      </div>
                      {reviewConclusion === '需修改' && (
                        <div className="mt-2 text-xs text-orange-600">请完善上方存疑项后重新提交</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 生成任务清单 */}
                {reviewConclusion === '审核通过' && (
                  <div className="space-y-3">
                    <button type="button" onClick={() => setShowTaskList((p) => !p)}
                      className="w-full rounded-lg bg-[#b85c3a] px-[18px] py-2 text-sm font-semibold text-white shadow-[0_2px_0_#8c3e24] transition-transform hover:-translate-y-px active:translate-y-px active:shadow-[0_1px_0_#8c3e24] disabled:opacity-60 w-full py-3">
                      🗂️ {showTaskList ? '收起' : '生成'}培训计划任务清单
                    </button>
                    {showTaskList && (
                      <div className="rounded-[10px] border border-[#ede8df] bg-white px-6 py-4 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                        <div className="mb-3 flex items-center justify-between">
                          <div className="border-l-4 border-[#b85c3a] pl-2.5 text-[15px] font-bold text-[#b85c3a]">培训计划任务清单</div>
                          <button type="button" onClick={() => alert('导出功能即将上线')}
                            className="rounded border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:border-blue-300 hover:text-blue-600">📄 导出任务清单</button>
                        </div>
                        <div className="overflow-x-auto rounded-lg border border-gray-200">
                          <table className="w-full border-collapse text-xs">
                            <thead className="bg-[#faf6f0]">
                              <tr>{['序号','任务名称','类别','负责人','截止日期','前置依赖','状态'].map((h) => (
                                <th key={h} className="border border-gray-200 px-3 py-2.5 text-center font-semibold text-[#5c4f3d]">{h}</th>
                              ))}</tr>
                            </thead>
                            <tbody>
                              {[
                                {n:'制作反洗钱识别方法课件',cat:'内容准备',owner:'张合规',due:'2026-06-10',dep:'无'},
                                {n:'设计可疑交易案例集',cat:'内容准备',owner:'李培训',due:'2026-06-10',dep:'任务1'},
                                {n:'预订培训场地',cat:'行政安排',owner:'王行政',due:'2026-06-05',dep:'无'},
                                {n:'发送培训通知',cat:'沟通通知',owner:'王行政',due:'2026-06-08',dep:'任务3'},
                                {n:'准备签到系统',cat:'技术准备',owner:'IT支持',due:'2026-06-12',dep:'无'},
                              ].map((t, ti) => (
                                <tr key={ti} className={ti % 2 === 0 ? 'bg-white' : 'bg-[#faf6f0]'}>
                                  <td className="border border-gray-200 px-3 py-2.5 text-center text-slate-400">{ti + 1}</td>
                                  <td className="border border-gray-200 px-3 py-2.5 text-slate-700">{t.n}</td>
                                  <td className="border border-gray-200 px-3 py-2.5 text-center">
                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{t.cat}</span>
                                  </td>
                                  <td className="border border-gray-200 px-3 py-2.5 text-center text-slate-600">{t.owner}</td>
                                  <td className="border border-gray-200 px-3 py-2.5 text-center text-slate-600">{t.due}</td>
                                  <td className="border border-gray-200 px-3 py-2.5 text-center text-slate-400">{t.dep}</td>
                                  <td className="border border-gray-200 px-3 py-2.5 text-center">
                                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-500">未开始</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Sidebar */}
              {planSidebarOpen ? (
                <div className="flex-shrink-0" style={{width:'280px'}}>
                  <div className="sticky top-4 rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                      <span className="text-xs font-semibold text-slate-700">📋 需求清单（阶段一）</span>
                      <button type="button" onClick={() => setPlanSidebarOpen(false)} className="text-xs text-slate-400 hover:text-slate-600">收起</button>
                    </div>
                    <div className="max-h-[70vh] overflow-y-auto p-3 space-y-2">
                      {reqList.length === 0 ? (
                        <div className="py-6 text-center text-xs text-slate-400">阶段一暂无需求条目</div>
                      ) : reqList.map((r) => {
                        const complete = r.trainingSubject.length > 0 && !!r.scenario && !!r.requirementType && !!r.relatedAction
                        return (
                          <div key={r.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 space-y-1.5">
                            <div className="text-xs font-semibold text-slate-800 leading-tight">{r.title || '（未命名）'}</div>
                            <div className="flex flex-wrap items-center gap-1">
                              {r.requirementType && (
                                <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs ${
                                  r.requirementType === '实操类' ? 'bg-emerald-50 text-emerald-700' :
                                  r.requirementType === '理念类' ? 'bg-violet-50 text-violet-700' :
                                  r.requirementType === '技术类' ? 'bg-blue-50 text-blue-700' :
                                  'bg-amber-50 text-amber-700'
                                }`}>{r.requirementType}</span>
                              )}
                              {r.trainingSubject.map((s) => (
                                <span key={s} className="inline-flex items-center rounded-full bg-indigo-50 px-1.5 py-0.5 text-xs text-indigo-600">{s}</span>
                              ))}
                              <span className={`ml-auto inline-flex items-center rounded-full px-1.5 py-0.5 text-xs ${complete ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}>
                                {complete ? '✓ 完整' : '待完善'}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-shrink-0">
                  <button type="button" onClick={() => setPlanSidebarOpen(true)}
                    className="sticky top-4 flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm text-sm hover:bg-slate-50" title="展开需求清单">
                    📋
                  </button>
                </div>
              )}
            </div>
          </div>

        ) : stage === '材料准备' && activeTab === '任务清单' ? (
          /* ── 材料准备 / 任务清单 ── */
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-[10px] border border-[#ede8df] bg-white px-6 py-3 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              {(['任务清单','课件材料','审核状态'] as const).map((sub, idx) => {
                const matDoneCount = matTasks.filter((t) => t.status === '已完成').length
                const allFilesApproved = matReviews.length > 0 && matReviews.every((r) => r.conclusion === '通过')
                const done = (sub === '任务清单' && matDoneCount === matTasks.length && matTasks.length > 0) ||
                             (sub === '课件材料' && matFiles.length > 0) ||
                             (sub === '审核状态' && allFilesApproved)
                const current = activeTab === sub
                return (
                  <React.Fragment key={sub}>
                    {idx > 0 && <div className="h-px flex-1 bg-slate-200" />}
                    <div className={`flex items-center gap-1.5 text-xs font-medium ${done ? 'text-green-600' : current ? 'text-blue-600' : 'text-slate-400'}`}>
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${done ? 'bg-green-100' : current ? 'bg-blue-100' : 'bg-slate-100'}`}>
                        {done ? '✓' : idx + 1}
                      </span>
                      {sub}{done && <span className="text-green-500 ml-0.5">✓</span>}
                    </div>
                  </React.Fragment>
                )
              })}
            </div>

            {/* Hint */}
            <div className="rounded-lg border border-[#e8e0d4] bg-[#fdf8f3] px-4 py-2.5 text-xs text-[#6b5d4f] border-l-4 border-l-[#b85c3a]">
              📋 本阶段任务清单已从阶段二任务清单自动导入，可在此追踪制作进度
            </div>

            {/* Table card */}
            <div className="rounded-[10px] border border-[#ede8df] bg-white px-6 py-5 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
              {/* header */}
              <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                <div>
                  <span className="text-sm font-semibold text-slate-800">任务清单</span>
                  <span className="ml-2 text-xs text-slate-400">
                    已完成 <span className="font-medium text-green-600">{matTasks.filter((t)=>t.status==='已完成').length}</span> / 共 {matTasks.length} 项
                  </span>
                </div>
                <button type="button"
                  onClick={() => setMatTasks((p) => [...p, {id:Date.now(),name:'',matType:'其他',owner:'',due:'',status:'未开始',fromPlan:false}])}
                  className="rounded border border-dashed border-slate-300 px-3 py-1.5 text-xs text-slate-500 hover:border-blue-400 hover:text-blue-600">
                  + 手动添加任务
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs" style={{tableLayout:'fixed',minWidth:'900px'}}>
                  <colgroup>
                    <col style={{width:'44px'}} /><col /><col style={{width:'90px'}} />
                    <col style={{width:'90px'}} /><col style={{width:'100px'}} /><col style={{width:'90px'}} /><col style={{width:'120px'}} />
                  </colgroup>
                  <thead className="bg-[#faf6f0]">
                    <tr>{['序号','任务名称','材料类型','负责人','截止日期','状态','关联文件'].map((h)=>(
                      <th key={h} className="border border-gray-200 px-3 py-2.5 text-center font-semibold text-[#5c4f3d]">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {matTasks.map((t, ti) => (
                      <tr key={t.id} className={ti % 2 === 0 ? 'bg-white' : 'bg-[#faf6f0]'} style={{height:'44px'}}>
                        <td className="border border-gray-200 px-2 py-2 text-center text-slate-400">{ti+1}</td>
                        <td className="border border-gray-200 px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <input value={t.name} onChange={(e)=>setMatTasks((p)=>p.map((x)=>x.id===t.id?{...x,name:e.target.value}:x))}
                              className="min-w-0 flex-1 rounded border-0 bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-300 focus:ring-0" placeholder="任务名称…"/>
                            {t.fromPlan && <span className="flex-shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-400">来自计划设计</span>}
                          </div>
                        </td>
                        <td className="border border-gray-200 px-2 py-2">
                          <select value={t.matType} onChange={(e)=>setMatTasks((p)=>p.map((x)=>x.id===t.id?{...x,matType:e.target.value}:x))}
                            className="w-full rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs outline-none focus:border-blue-300">
                            {['PPT','PDF','案例集','题库','手册','视频','其他'].map((o)=><option key={o}>{o}</option>)}
                          </select>
                        </td>
                        <td className="border border-gray-200 px-3 py-2">
                          <input value={t.owner} onChange={(e)=>setMatTasks((p)=>p.map((x)=>x.id===t.id?{...x,owner:e.target.value}:x))}
                            className="w-full rounded border-0 bg-transparent text-xs text-slate-600 outline-none focus:ring-0" placeholder="—"/>
                        </td>
                        <td className="border border-gray-200 px-2 py-2 text-center text-slate-500">{t.due||'—'}</td>
                        <td className="border border-gray-200 px-2 py-2">
                          <select value={t.status} onChange={(e)=>setMatTasks((p)=>p.map((x)=>x.id===t.id?{...x,status:e.target.value}:x))}
                            className={`w-full rounded border px-1.5 py-0.5 text-xs outline-none ${t.status==='已完成'?'border-green-200 bg-green-50 text-green-700':t.status==='进行中'?'border-blue-200 bg-blue-50 text-blue-700':'border-slate-200 bg-white text-slate-500'}`}>
                            {['未开始','进行中','已完成'].map((o)=><option key={o}>{o}</option>)}
                          </select>
                        </td>
                        <td className="border border-gray-200 px-2 py-2 text-center text-slate-300 text-xs">—</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Progress bar */}
              <div className="border-t border-gray-100 px-4 py-3">
                {(() => {
                  const done = matTasks.filter((t)=>t.status==='已完成').length
                  const total = matTasks.length
                  const pct = total>0?Math.round((done/total)*100):0
                  return (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 overflow-hidden rounded-full bg-gray-100" style={{height:'6px'}}>
                        <div className={`h-full rounded-full transition-all ${pct===100?'bg-green-500':pct>0?'bg-blue-500':'bg-gray-200'}`} style={{width:`${pct}%`}} />
                      </div>
                      <span className="text-xs text-slate-500">任务完成 {done}/{total}（{pct}%）</span>
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>

        ) : stage === '材料准备' && activeTab === '课件材料' ? (
          /* ── 材料准备 / 课件材料 ── */
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-[10px] border border-[#ede8df] bg-white px-6 py-3 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              {(['任务清单','课件材料','审核状态'] as const).map((sub, idx) => {
                const matDoneCount = matTasks.filter((t) => t.status === '已完成').length
                const allFilesApproved = matReviews.length > 0 && matReviews.every((r) => r.conclusion === '通过')
                const done = (sub === '任务清单' && matDoneCount === matTasks.length && matTasks.length > 0) ||
                             (sub === '课件材料' && matFiles.length > 0) ||
                             (sub === '审核状态' && allFilesApproved)
                const current = activeTab === sub
                return (
                  <React.Fragment key={sub}>
                    {idx > 0 && <div className="h-px flex-1 bg-slate-200" />}
                    <div className={`flex items-center gap-1.5 text-xs font-medium ${done ? 'text-green-600' : current ? 'text-blue-600' : 'text-slate-400'}`}>
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${done ? 'bg-green-100' : current ? 'bg-blue-100' : 'bg-slate-100'}`}>
                        {done ? '✓' : idx + 1}
                      </span>
                      {sub}{done && <span className="text-green-500 ml-0.5">✓</span>}
                    </div>
                  </React.Fragment>
                )
              })}
            </div>

            {/* Op bar */}
            <div className="flex items-center gap-2">
              <button type="button" onClick={()=>alert('上传功能即将接入')}
                className="rounded-lg bg-[#b85c3a] px-[18px] py-2 text-sm font-semibold text-white shadow-[0_2px_0_#8c3e24] transition-transform hover:-translate-y-px active:translate-y-px active:shadow-[0_1px_0_#8c3e24] disabled:opacity-60">📤 上传新材料</button>
              <button type="button" onClick={()=>alert('材料库即将上线')}
                className="rounded border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600 hover:border-blue-300 hover:text-blue-600">📚 从材料库选取</button>
            </div>

            {/* File table */}
            <div className="rounded-[10px] border border-[#ede8df] bg-white px-6 py-5 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs" style={{tableLayout:'fixed',minWidth:'860px'}}>
                  <colgroup>
                    <col style={{width:'44px'}} /><col /><col style={{width:'70px'}} />
                    <col style={{width:'70px'}} /><col style={{width:'100px'}} /><col style={{width:'80px'}} />
                    <col style={{width:'80px'}} /><col style={{width:'90px'}} />
                  </colgroup>
                  <thead className="bg-[#faf6f0]">
                    <tr>{['序号','文件名称','类型','版本','上传时间','上传人','审核状态','操作'].map((h)=>(
                      <th key={h} className="border border-gray-200 px-3 py-2.5 text-center font-semibold text-[#5c4f3d]">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {matFiles.map((f, fi) => (
                      <tr key={f.id} className={fi%2===0?'bg-white':'bg-[#faf6f0]'} style={{height:'44px'}}>
                        <td className="border border-gray-200 px-2 py-2 text-center text-slate-400">{fi+1}</td>
                        <td className="border border-gray-200 px-3 py-2 text-slate-700" style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.fileName}</td>
                        <td className="border border-gray-200 px-2 py-2 text-center">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">{f.fileType}</span>
                        </td>
                        <td className="border border-gray-200 px-2 py-2 text-center text-slate-500">{f.version}</td>
                        <td className="border border-gray-200 px-2 py-2 text-center text-slate-500">{f.uploadDate}</td>
                        <td className="border border-gray-200 px-2 py-2 text-center text-slate-500">{f.uploader}</td>
                        <td className="border border-gray-200 px-2 py-2 text-center">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${
                            f.reviewStatus==='已通过'?'bg-green-50 text-green-600':
                            f.reviewStatus==='待审核'?'bg-blue-50 text-blue-600':
                            f.reviewStatus==='已退回'?'bg-red-50 text-red-600':
                            'bg-slate-100 text-slate-500'}`}>{f.reviewStatus}</span>
                        </td>
                        <td className="border border-gray-200 px-2 py-2">
                          <div className="flex justify-center gap-1">
                            <button type="button" onClick={()=>alert('预览功能即将上线')}
                              className="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-500 hover:border-blue-300 hover:text-blue-600">预览</button>
                            <button type="button" onClick={()=>setMatFiles((p)=>p.filter((x)=>x.id!==f.id))}
                              className="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-500 hover:border-red-300 hover:text-red-500">删除</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* AI entry card */}
            <div className="rounded-[10px] border border-[#ede8df] bg-white px-6 py-5 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)] border-[#e8dff5] bg-[#faf7ff] flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-purple-800">✨ AI 助手</div>
                <div className="text-xs text-purple-600 mt-0.5">基于培训需求和内容模块，自动生成课件大纲建议</div>
              </div>
              <button type="button" onClick={()=>alert('AI课件助手即将上线')}
                className="rounded-lg border border-purple-300 bg-white px-4 py-2 text-xs font-medium text-purple-700 hover:bg-purple-50">
                生成课件大纲建议
              </button>
            </div>
          </div>

        ) : stage === '材料准备' && activeTab === '审核状态' ? (
          /* ── 材料准备 / 审核状态 ── */
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-[10px] border border-[#ede8df] bg-white px-6 py-3 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              {(['任务清单','课件材料','审核状态'] as const).map((sub, idx) => {
                const matDoneCount = matTasks.filter((t) => t.status === '已完成').length
                const allFilesApproved = matReviews.length > 0 && matReviews.every((r) => r.conclusion === '通过')
                const done = (sub === '任务清单' && matDoneCount === matTasks.length && matTasks.length > 0) ||
                             (sub === '课件材料' && matFiles.length > 0) ||
                             (sub === '审核状态' && allFilesApproved)
                const current = activeTab === sub
                return (
                  <React.Fragment key={sub}>
                    {idx > 0 && <div className="h-px flex-1 bg-slate-200" />}
                    <div className={`flex items-center gap-1.5 text-xs font-medium ${done ? 'text-green-600' : current ? 'text-blue-600' : 'text-slate-400'}`}>
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${done ? 'bg-green-100' : current ? 'bg-blue-100' : 'bg-slate-100'}`}>
                        {done ? '✓' : idx + 1}
                      </span>
                      {sub}{done && <span className="text-green-500 ml-0.5">✓</span>}
                    </div>
                  </React.Fragment>
                )
              })}
            </div>

            {/* Hint */}
            <div className="rounded-lg border border-[#f0dcc8] bg-[#fdf6ef] px-4 py-2.5 text-xs text-[#8b5a2b] border-l-4 border-l-[#d4a574]">
              📋 以下材料已自动从课件材料列表导入，请逐项完成审核
            </div>

            {/* Review cards */}
            <div className="space-y-4">
              {matReviews.map((rev) => {
                const DIMS = ['内容准确性','合规性','格式规范','完整性']
                return (
                  <div key={rev.id} className="rounded-[10px] border border-[#ede8df] bg-white px-6 py-5 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                    {/* Card header */}
                    <div className="mb-4 flex items-center gap-2">
                      <span className="font-medium text-slate-800 text-sm truncate">{rev.fileName}</span>
                      <span className="flex-shrink-0 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{rev.fileType}</span>
                      <span className={`flex-shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs ml-auto ${
                        rev.conclusion==='通过'?'bg-green-50 text-green-600 border border-green-200':
                        rev.conclusion==='退回修改'?'bg-red-50 text-red-600 border border-red-200':
                        'bg-slate-50 text-slate-500 border border-slate-200'}`}>
                        {rev.conclusion||'待审核'}
                      </span>
                    </div>

                    {/* Dimension checks */}
                    <div className="mb-4 grid grid-cols-2 gap-2">
                      {DIMS.map((dim) => {
                        const checked = rev.checks.includes(dim)
                        return (
                          <label key={dim} className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                            <input type="checkbox" checked={checked}
                              onChange={() => setMatReviews((p) => p.map((r) => r.id===rev.id ? {...r, checks: checked?r.checks.filter((c)=>c!==dim):[...r.checks,dim]} : r))}
                              className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                            {dim}
                          </label>
                        )
                      })}
                    </div>

                    {/* Opinion */}
                    <input value={rev.opinion}
                      onChange={(e)=>setMatReviews((p)=>p.map((r)=>r.id===rev.id?{...r,opinion:e.target.value}:r))}
                      placeholder="填写审核意见（选填）"
                      className="mb-4 w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs outline-none focus:border-blue-500" />

                    {/* Conclusion */}
                    <div className="mb-3 flex gap-2">
                      {(['通过','退回修改'] as const).map((c) => (
                        <button key={c} type="button"
                          onClick={()=>setMatReviews((p)=>p.map((r)=>r.id===rev.id?{...r,conclusion:r.conclusion===c?'':c}:r))}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${rev.conclusion===c
                            ?(c==='通过'?'border-green-400 bg-green-50 text-green-700':'border-red-400 bg-red-50 text-red-700')
                            :'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                          {c==='通过'?'✅ 通过':'❌ 退回修改'}
                        </button>
                      ))}
                    </div>

                    {/* Auditor */}
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span>审核人：</span>
                      <input value={rev.auditor}
                        onChange={(e)=>setMatReviews((p)=>p.map((r)=>r.id===rev.id?{...r,auditor:e.target.value}:r))}
                        placeholder="填写审核人"
                        className="rounded border border-slate-200 bg-transparent px-2 py-0.5 text-xs outline-none focus:border-blue-300" />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Summary */}
            <div className="rounded-[10px] border border-[#ede8df] bg-white px-6 py-4 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
              {(() => {
                const passed = matReviews.filter((r)=>r.conclusion==='通过').length
                const total = matReviews.length
                const pct = total>0?Math.round((passed/total)*100):0
                const allPassed = passed===total && total>0
                return (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500">整体审核进度：<span className="font-medium text-green-600">{passed}/{total}</span> 已通过</span>
                      <div className="flex-1 overflow-hidden rounded-full bg-gray-100" style={{height:'6px'}}>
                        <div className={`h-full rounded-full transition-all ${pct===100?'bg-green-500':pct>0?'bg-blue-500':'bg-gray-200'}`} style={{width:`${pct}%`}} />
                      </div>
                      <span className="text-xs text-slate-400">{pct}%</span>
                    </div>
                    <button type="button" disabled={!allPassed}
                      onClick={()=>allPassed&&alert('即将进入培训实施阶段')}
                      className={`w-full rounded-xl py-2.5 text-sm font-semibold transition-colors ${allPassed?'bg-green-600 text-white hover:bg-green-700 shadow':'cursor-not-allowed bg-gray-100 text-gray-400'}`}>
                      ✅ 完成材料准备，进入培训实施
                    </button>
                  </>
                )
              })()}
            </div>
          </div>

        ) : stage === '培训实施' && activeTab === '实施准备' ? (
          /* ── 培训实施 / 实施准备 ── */
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-[10px] border border-[#ede8df] bg-white px-6 py-3 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              {(['实施准备','现场执行','考核测试'] as const).map((sub, idx) => {
                const current = activeTab === sub
                const done = sub === '实施准备' && implPrepStatus === '已完成'
                return (
                  <React.Fragment key={sub}>
                    {idx > 0 && <div className="h-px flex-1 bg-slate-200" />}
                    <div className={`flex items-center gap-1.5 text-xs font-medium ${done?'text-green-600':current?'text-blue-600':'text-slate-400'}`}>
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${done?'bg-green-100':current?'bg-blue-100':'bg-slate-100'}`}>
                        {done?'✓':idx+1}
                      </span>
                      {sub}{done&&<span className="text-green-500 ml-0.5">✓</span>}
                    </div>
                  </React.Fragment>
                )
              })}
            </div>
            {/* Status bar */}
            <div className="flex items-center justify-between rounded-[10px] border border-[#ede8df] bg-white px-6 py-3 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-slate-800">实施准备</span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${implPrepStatus==='已完成'?'bg-green-50 text-green-600':'bg-yellow-50 text-yellow-600'}`}>{implPrepStatus}</span>
              </div>
              <button type="button" onClick={()=>setImplPrepStatus(p=>p==='已完成'?'草稿中':'已完成')}
                className={`rounded border px-3 py-1.5 text-xs ${implPrepStatus==='已完成'?'border-slate-200 text-slate-500':'border-[#b85c3a] bg-[#fdf3ea] text-[#8c3e24] hover:bg-[#f5e8dc]'}`}>
                {implPrepStatus==='已完成'?'撤回完成标记':'标记为已完成'}
              </button>
            </div>

            {/* 组1: 通知发送 */}
            <div className="rounded-[10px] border border-[#ede8df] bg-white px-6 py-5 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
              <div className="border-l-4 border-[#b85c3a] pl-2.5 text-[15px] font-bold text-[#b85c3a]">通知发送</div>
              {implNotices.map((n) => (
                <div key={n.id} className="flex flex-wrap items-center gap-2">
                  <input type="datetime-local" value={n.sendTime} onChange={(e)=>setImplNotices(p=>p.map(x=>x.id===n.id?{...x,sendTime:e.target.value}:x))}
                    className="rounded-md border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-blue-500"/>
                  <input value={n.scope} onChange={(e)=>setImplNotices(p=>p.map(x=>x.id===n.id?{...x,scope:e.target.value}:x))}
                    placeholder="发送范围" className="w-36 rounded-md border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-blue-500"/>
                  <div className="flex gap-1">
                    {(['企业微信','邮件','系统通知'] as const).map(m=>(
                      <button key={m} type="button" onClick={()=>setImplNotices(p=>p.map(x=>x.id===n.id?{...x,method:m}:x))}
                        className={`rounded border px-2 py-1 text-xs ${n.method===m?'border-[#b85c3a] bg-[#fdf3ea] text-[#8c3e24]':'border-slate-200 text-slate-400 hover:border-blue-200'}`}>{m}</button>
                    ))}
                  </div>
                  <button type="button" onClick={()=>setImplNotices(p=>p.map(x=>x.id===n.id?{...x,sent:!x.sent}:x))}
                    className={`rounded-full border px-2.5 py-0.5 text-xs ${n.sent?'border-green-200 bg-green-50 text-green-700':'border-slate-200 text-slate-400'}`}>{n.sent?'已发送':'待发送'}</button>
                  <button type="button" onClick={()=>setImplNotices(p=>p.filter(x=>x.id!==n.id))} className="text-slate-300 hover:text-red-500"><X className="h-3.5 w-3.5"/></button>
                </div>
              ))}
              <button type="button" onClick={()=>setImplNotices(p=>[...p,{id:Date.now(),sendTime:'',scope:'',method:'企业微信',sent:false}])}
                className="text-xs text-blue-500 hover:text-blue-700">+ 添加通知记录</button>
            </div>

            {/* 组2: 报名管理 */}
            <div className="rounded-[10px] border border-[#ede8df] bg-white px-6 py-5 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-4">
              <div className="border-l-4 border-[#b85c3a] pl-2.5 text-[15px] font-bold text-[#b85c3a]">报名管理</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">计划参训人数</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min={0} value={implPlanCount} onChange={(e)=>setImplPlanCount(e.target.value)}
                      className="w-24 rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"/>
                    <span className="text-xs text-slate-500">人</span>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">报名截止日期</label>
                  <input type="date" value={implRegDeadline} onChange={(e)=>setImplRegDeadline(e.target.value)}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-xs outline-none focus:border-blue-500"/>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">已报名人数</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min={0} value={implRegCount} onChange={(e)=>setImplRegCount(e.target.value)}
                      className="w-24 rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"/>
                    <span className="text-xs text-slate-500">人</span>
                  </div>
                </div>
                <div className="flex items-end">
                  <button type="button" onClick={()=>alert('即将上线')}
                    className="rounded border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:border-blue-300 hover:text-blue-600">📎 上传名单</button>
                </div>
              </div>
            </div>

            {/* 组3: 场地确认 */}
            <div className="rounded-[10px] border border-[#ede8df] bg-white px-6 py-5 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-4">
              <div className="border-l-4 border-[#b85c3a] pl-2.5 text-[15px] font-bold text-[#b85c3a]">场地确认</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">场地 / 平台
                    <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-400">来自资源计划</span>
                  </label>
                  <input value={implVenue} onChange={(e)=>setImplVenue(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"/>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">座位容量</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min={0} value={implCapacity} onChange={(e)=>setImplCapacity(e.target.value)}
                      className="w-24 rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"/>
                    <span className="text-xs text-slate-500">人</span>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">确认状态</label>
                  <div className="flex gap-2">
                    {(['已确认','待确认'] as const).map(s=>(
                      <button key={s} type="button" onClick={()=>setImplVenueConfirmed(s)}
                        className={`rounded-full border px-3 py-1 text-xs ${implVenueConfirmed===s?(s==='已确认'?'border-green-400 bg-green-50 text-green-700':'border-orange-300 bg-orange-50 text-orange-600'):'border-slate-200 text-slate-400 hover:border-slate-300'}`}>{s}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 组4: 物料就绪确认 */}
            <div className="rounded-[10px] border border-[#ede8df] bg-white px-6 py-5 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
              <div className="border-l-4 border-[#b85c3a] pl-2.5 text-[15px] font-bold text-[#b85c3a]">物料就绪确认</div>
              <div className="text-xs text-slate-400">以下材料已从阶段三课件材料自动导入，请逐项确认已就绪</div>
              <div className="space-y-2">
                {implMaterials.map((m)=>(
                  <label key={m.id} className="flex cursor-pointer items-center gap-2 text-xs text-slate-700">
                    <input type="checkbox" checked={m.ready} onChange={()=>setImplMaterials(p=>p.map(x=>x.id===m.id?{...x,ready:!x.ready}:x))}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600"/>
                    {m.name}
                    <span className={`rounded-full px-1.5 py-0.5 text-xs ${m.ready?'bg-green-50 text-green-600':'bg-slate-100 text-slate-400'}`}>{m.ready?'已就绪':'待确认'}</span>
                  </label>
                ))}
                <button type="button" onClick={()=>setImplMaterials(p=>[...p,{id:Date.now(),name:'',ready:false}])}
                  className="text-xs text-blue-500 hover:text-blue-700">+ 手动添加物料</button>
              </div>
            </div>

            {/* 交付物 */}
            <div className="flex items-center justify-between rounded-[10px] border border-[#ede8df] bg-white px-6 py-3 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span className="font-medium">交付物：培训通知记录 + 报名名单</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${implPrepStatus==='已完成'?'bg-green-50 text-green-600':'bg-yellow-50 text-yellow-600'}`}>{implPrepStatus}</span>
              </div>
            </div>
          </div>

        ) : stage === '培训实施' && activeTab === '现场执行' ? (
          /* ── 培训实施 / 现场执行 ── */
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-[10px] border border-[#ede8df] bg-white px-6 py-3 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              {(['实施准备','现场执行','考核测试'] as const).map((sub, idx) => {
                const current = activeTab === sub
                const done = sub === '实施准备' && implPrepStatus === '已完成'
                return (
                  <React.Fragment key={sub}>
                    {idx > 0 && <div className="h-px flex-1 bg-slate-200" />}
                    <div className={`flex items-center gap-1.5 text-xs font-medium ${done?'text-green-600':current?'text-blue-600':'text-slate-400'}`}>
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${done?'bg-green-100':current?'bg-blue-100':'bg-slate-100'}`}>
                        {done?'✓':idx+1}
                      </span>
                      {sub}{done&&<span className="text-green-500 ml-0.5">✓</span>}
                    </div>
                  </React.Fragment>
                )
              })}
            </div>
            {/* Hint */}
            <div className="rounded-lg border border-[#e8e0d4] bg-[#fdf8f3] px-4 py-2.5 text-xs text-[#6b5d4f] border-l-4 border-l-[#b85c3a]">
              📋 请在培训当天或结束后及时填写本项内容
            </div>

            {/* 组1: 签到记录 */}
            <div className="rounded-[10px] border border-[#ede8df] bg-white px-6 py-5 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-4">
              <div className="border-l-4 border-[#b85c3a] pl-2.5 text-[15px] font-bold text-[#b85c3a]">签到记录</div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">实际签到人数</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min={0} value={implSignCount} onChange={(e)=>setImplSignCount(e.target.value)}
                      className="w-24 rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"/>
                    <span className="text-xs text-slate-500">人</span>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">签到方式</label>
                  <div className="flex flex-wrap gap-1.5">
                    {(['纸质','扫码','系统自动'] as const).map(m=>(
                      <button key={m} type="button" onClick={()=>setImplSignMethod(m)}
                        className={`rounded-full border px-2.5 py-0.5 text-xs ${implSignMethod===m?'border-[#b85c3a] bg-[#fdf3ea] text-[#8c3e24]':'border-slate-200 text-slate-400 hover:border-blue-200'}`}>{m}</button>
                    ))}
                  </div>
                </div>
                <div className="flex items-end">
                  <button type="button" onClick={()=>alert('即将上线')}
                    className="rounded border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:border-blue-300 hover:text-blue-600">📎 上传签到表</button>
                </div>
              </div>
            </div>

            {/* 组2: 实际培训信息 */}
            <div className="rounded-[10px] border border-[#ede8df] bg-white px-6 py-5 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-4">
              <div className="border-l-4 border-[#b85c3a] pl-2.5 text-[15px] font-bold text-[#b85c3a]">实际培训信息</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">实际开始时间</label>
                  <input type="datetime-local" value={implStartTime} onChange={(e)=>setImplStartTime(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs outline-none focus:border-blue-500"/>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">实际结束时间</label>
                  <input type="datetime-local" value={implEndTime} onChange={(e)=>setImplEndTime(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs outline-none focus:border-blue-500"/>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">实际地点 / 平台</label>
                  <input value={implActualVenue} onChange={(e)=>setImplActualVenue(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"/>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">主讲人</label>
                  <input value={implLecturer} onChange={(e)=>setImplLecturer(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"/>
                </div>
              </div>
            </div>

            {/* 组3: 过程记录 */}
            <div className="rounded-[10px] border border-[#ede8df] bg-white px-6 py-5 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-4">
              <div className="border-l-4 border-[#b85c3a] pl-2.5 text-[15px] font-bold text-[#b85c3a]">过程记录</div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-700">过程说明</label>
                <textarea value={implProcessNote} onChange={(e)=>setImplProcessNote(e.target.value)} rows={3}
                  className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"/>
              </div>
              <div className="flex items-end gap-3">
                <button type="button" onClick={()=>alert('即将上线')}
                  className="rounded border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:border-blue-300 hover:text-blue-600">📷 上传照片/截图</button>
                <span className="text-xs text-slate-400">支持多图</span>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-700">偏差记录</label>
                <textarea value={implDeviation} onChange={(e)=>setImplDeviation(e.target.value)} rows={2}
                  placeholder="填写实际与计划的偏差及原因（如无偏差可不填）"
                  className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"/>
              </div>
            </div>

            {/* 交付物 */}
            <div className="flex items-center gap-2 rounded-[10px] border border-[#ede8df] bg-white px-6 py-3 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)] text-xs text-slate-600">
              <span className="font-medium">交付物：签到表 + 过程记录</span>
              <span className="rounded-full bg-yellow-50 px-2 py-0.5 text-yellow-600">草稿中</span>
            </div>
          </div>

        ) : stage === '培训实施' && activeTab === '考核测试' ? (
          /* ── 培训实施 / 考核测试 ── */
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-[10px] border border-[#ede8df] bg-white px-6 py-3 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              {(['实施准备','现场执行','考核测试'] as const).map((sub, idx) => {
                const current = activeTab === sub
                const done = sub === '实施准备' && implPrepStatus === '已完成'
                return (
                  <React.Fragment key={sub}>
                    {idx > 0 && <div className="h-px flex-1 bg-slate-200" />}
                    <div className={`flex items-center gap-1.5 text-xs font-medium ${done?'text-green-600':current?'text-blue-600':'text-slate-400'}`}>
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${done?'bg-green-100':current?'bg-blue-100':'bg-slate-100'}`}>
                        {done?'✓':idx+1}
                      </span>
                      {sub}{done&&<span className="text-green-500 ml-0.5">✓</span>}
                    </div>
                  </React.Fragment>
                )
              })}
            </div>
            {/* Intro */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-500">
              📌 记录参训人员的学习成果，是合规留痕的重要证据
            </div>

            {/* 组1: 考核方式 */}
            <div className="rounded-[10px] border border-[#ede8df] bg-white px-6 py-5 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-4">
              <div className="border-l-4 border-[#b85c3a] pl-2.5 text-[15px] font-bold text-[#b85c3a]">考核方式</div>
              <div>
                <label className="mb-2 block text-xs font-medium text-gray-700">考核方式</label>
                <div className="flex flex-wrap gap-2">
                  {(['笔试','线上答题','口头问答','现场演练','无考核'] as const).map(m=>(
                    <button key={m} type="button" onClick={()=>setImplExamMethod(m)}
                      className={`rounded-full border px-3 py-1 text-xs ${implExamMethod===m?'border-[#b85c3a] bg-[#fdf3ea] text-[#8c3e24]':'border-slate-200 text-slate-500 hover:border-blue-200'}`}>{m}</button>
                  ))}
                </div>
              </div>
              {implExamMethod!=='无考核' && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">题库 / 问卷链接</label>
                  <input value={implExamLink} onChange={(e)=>setImplExamLink(e.target.value)}
                    placeholder="填写线上答题平台链接"
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"/>
                </div>
              )}
            </div>

            {/* 组2: 成绩录入 */}
            <div className="rounded-[10px] border border-[#ede8df] bg-white px-6 py-5 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              <div className="mb-4 border-l-4 border-[#b85c3a] pl-2.5 text-[15px] font-bold text-[#b85c3a]">成绩录入</div>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full border-collapse text-xs" style={{tableLayout:'fixed'}}>
                  <colgroup>
                    <col style={{width:'44px'}}/><col/><col style={{width:'90px'}}/>
                    <col style={{width:'80px'}}/><col style={{width:'90px'}}/>
                  </colgroup>
                  <thead className="bg-[#faf6f0]">
                    <tr>{['序号','姓名','部门','成绩','是否通过'].map(h=>(
                      <th key={h} className="border border-gray-200 px-3 py-2.5 text-center font-semibold text-[#5c4f3d]">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {implScores.map((s,si)=>(
                      <tr key={s.id} className={si%2===0?'bg-white':'bg-[#faf6f0]'} style={{height:'44px'}}>
                        <td className="border border-gray-200 px-2 py-2 text-center text-slate-400">{si+1}</td>
                        <td className="border border-gray-200 px-3 py-2 text-slate-700">{s.name}</td>
                        <td className="border border-gray-200 px-3 py-2 text-center text-slate-500">{s.dept}</td>
                        <td className="border border-gray-200 px-3 py-2 text-center">
                          <input type="number" min={0} max={100} value={s.score}
                            onChange={(e)=>setImplScores(p=>p.map(x=>x.id===s.id?{...x,score:Number(e.target.value),pass:Number(e.target.value)>=60}:x))}
                            className="w-16 rounded border border-slate-200 bg-transparent px-2 py-0.5 text-center text-xs outline-none focus:border-blue-300"/>
                        </td>
                        <td className="border border-gray-200 px-3 py-2 text-center">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${s.pass?'bg-green-50 text-green-600':'bg-red-50 text-red-600'}`}>
                            {s.pass?'✅ 通过':'❌ 未通过'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    {(() => {
                      const avg = implScores.length>0?(implScores.reduce((a,x)=>a+x.score,0)/implScores.length).toFixed(1):'—'
                      const passRate = implScores.length>0?Math.round(implScores.filter(x=>x.pass).length/implScores.length*100):0
                      return (
                        <tr className="bg-[#faf6f0]">
                          <td colSpan={5} className="border border-gray-200 px-3 py-2 text-xs text-slate-500">
                            参测：<span className="font-medium">{implScores.length}</span> 人 &nbsp;·&nbsp;
                            平均分：<span className="font-medium">{avg}</span> &nbsp;·&nbsp;
                            通过率：<span className="font-medium text-green-600">{passRate}%</span>
                          </td>
                        </tr>
                      )
                    })()}
                  </tfoot>
                </table>
              </div>
            </div>

            {/* 组3: 不合格处理 */}
            <div className="rounded-[10px] border border-[#ede8df] bg-white px-6 py-5 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-4">
              <div className="border-l-4 border-[#b85c3a] pl-2.5 text-[15px] font-bold text-[#b85c3a]">不合格处理</div>
              {(() => {
                const failed = implScores.filter(x=>!x.pass)
                return failed.length===0 ? (
                  <div className="rounded-lg bg-green-50 px-4 py-3 text-xs text-green-600">🎉 所有参训人员均已通过考核</div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-gray-700">不合格人员名单
                        <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-400">自动导入</span>
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {failed.map(x=>(
                          <span key={x.id} className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs text-red-600">
                            {x.name}（{x.score}分）
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-gray-700">处理措施</label>
                      <textarea value={implFailMeasure} onChange={(e)=>setImplFailMeasure(e.target.value)} rows={3}
                        placeholder="填写针对不合格人员的处理措施…"
                        className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"/>
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* 交付物 */}
            <div className="flex items-center gap-2 rounded-[10px] border border-[#ede8df] bg-white px-6 py-3 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)] text-xs text-slate-600">
              <span className="font-medium">交付物：考核成绩单 + 通过率统计 + 不合格处理记录</span>
              <span className="rounded-full bg-yellow-50 px-2 py-0.5 text-yellow-600">草稿中</span>
            </div>
          </div>

        ) : stage === '评估归档' && activeTab === '效果评估' ? (
          /* ── 评估归档 / 效果评估 ── */
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-[10px] border border-[#ede8df] bg-white px-6 py-3 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              {(['效果评估','归档打包','改进建议'] as const).map((sub, idx) => {
                const done = sub === '效果评估' && evalStatus === '已完成'
                const current = activeTab === sub
                return (
                  <React.Fragment key={sub}>
                    {idx > 0 && <div className="h-px flex-1 bg-slate-200" />}
                    <div className={`flex items-center gap-1.5 text-xs font-medium ${done?'text-green-600':current?'text-blue-600':'text-slate-400'}`}>
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${done?'bg-green-100':current?'bg-blue-100':'bg-slate-100'}`}>{done?'✓':idx+1}</span>
                      {sub}{done&&<span className="text-green-500 ml-0.5">✓</span>}
                    </div>
                  </React.Fragment>
                )
              })}
            </div>
            {/* Status bar */}
            <div className="flex items-center justify-between rounded-[10px] border border-[#ede8df] bg-white px-6 py-3 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-slate-800">效果评估</span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${evalStatus==='已完成'?'bg-green-50 text-green-600':'bg-yellow-50 text-yellow-600'}`}>{evalStatus}</span>
              </div>
              <button type="button" onClick={()=>setEvalStatus(p=>p==='已完成'?'草稿中':'已完成')}
                className={`rounded border px-3 py-1.5 text-xs ${evalStatus==='已完成'?'border-slate-200 text-slate-500':'border-[#b85c3a] bg-[#fdf3ea] text-[#8c3e24] hover:bg-[#f5e8dc]'}`}>
                {evalStatus==='已完成'?'撤回完成标记':'标记为已完成'}
              </button>
            </div>

            {/* 组1: 满意度调查 */}
            <div className="rounded-[10px] border border-[#ede8df] bg-white px-6 py-5 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-4">
              <div className="border-l-4 border-[#b85c3a] pl-2.5 text-[15px] font-bold text-[#b85c3a]">满意度调查</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">问卷状态</label>
                  <div className="flex gap-2">
                    {(['已发放','未发放'] as const).map(s=>(
                      <button key={s} type="button" onClick={()=>setEvalSurveyIssued(s)}
                        className={`rounded-full border px-3 py-1 text-xs ${evalSurveyIssued===s?(s==='已发放'?'border-green-400 bg-green-50 text-green-700':'border-slate-300 bg-slate-50 text-slate-600'):'border-slate-200 text-slate-400 hover:border-slate-300'}`}>{s}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">问卷链接</label>
                  <input value={evalSurveyLink} onChange={(e)=>setEvalSurveyLink(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs outline-none focus:border-blue-500"/>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">回收数量</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min={0} value={evalSurveyCount} onChange={(e)=>setEvalSurveyCount(e.target.value)}
                      className="w-24 rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"/>
                    <span className="text-xs text-slate-500">份</span>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">总体满意度</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min={0} max={5} step={0.1} value={evalSatisfaction} onChange={(e)=>setEvalSatisfaction(e.target.value)}
                      className="w-20 rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"/>
                    <span className="text-xs text-slate-500">/ 5 分</span>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">关键反馈摘要</label>
                  <textarea value={evalFeedback} onChange={(e)=>setEvalFeedback(e.target.value)} rows={3}
                    className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"/>
                </div>
              </div>
            </div>

            {/* 组2: 培训目标达成 */}
            <div className="rounded-[10px] border border-[#ede8df] bg-white px-6 py-5 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              <div className="mb-1 border-l-4 border-[#b85c3a] pl-2.5 text-[15px] font-bold text-[#b85c3a]">培训目标达成评估</div>
              <div className="mb-3 text-xs text-slate-400">以下目标已从阶段二方案设计自动导入</div>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full border-collapse text-xs" style={{tableLayout:'fixed'}}>
                  <colgroup>
                    <col style={{width:'40px'}}/><col/><col style={{width:'110px'}}/><col style={{width:'200px'}}/>
                  </colgroup>
                  <thead className="bg-[#faf6f0]">
                    <tr>{['序号','预期目标','达成情况','说明'].map(h=>(
                      <th key={h} className="border border-gray-200 px-3 py-2.5 text-center font-semibold text-[#5c4f3d]">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {evalGoals.map((g,gi)=>(
                      <tr key={g.id} className={gi%2===0?'bg-white':'bg-[#faf6f0]'} style={{height:'44px'}}>
                        <td className="border border-gray-200 px-2 py-2 text-center text-slate-400">{gi+1}</td>
                        <td className="border border-gray-200 px-3 py-2 text-slate-700">{g.goal}</td>
                        <td className="border border-gray-200 px-3 py-2 text-center">
                          <select value={g.status} onChange={(e)=>setEvalGoals(p=>p.map(x=>x.id===g.id?{...x,status:e.target.value}:x))}
                            className={`w-full rounded border px-2 py-0.5 text-xs outline-none ${g.status==='已达成'?'border-green-200 bg-green-50 text-green-700':g.status==='部分达成'?'border-orange-200 bg-orange-50 text-orange-600':'border-red-200 bg-red-50 text-red-600'}`}>
                            <option>已达成</option><option>部分达成</option><option>未达成</option>
                          </select>
                        </td>
                        <td className="border border-gray-200 px-3 py-2">
                          <input value={g.note} onChange={(e)=>setEvalGoals(p=>p.map(x=>x.id===g.id?{...x,note:e.target.value}:x))}
                            className="w-full rounded border-0 bg-transparent text-xs text-slate-600 outline-none focus:ring-0" placeholder="补充说明…"/>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 组3: 考核数据分析 */}
            <div className="rounded-[10px] border border-[#ede8df] bg-white px-6 py-5 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-4">
              <div className="border-l-4 border-[#b85c3a] pl-2.5 text-[15px] font-bold text-[#b85c3a]">考核数据分析</div>
              <div className="text-xs text-slate-400">以下数据已从阶段四考核测试自动导入</div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  {label:'参测人数',value:`${implScores.length} 人`},
                  {label:'平均分',value:`${implScores.length>0?(implScores.reduce((a,x)=>a+x.score,0)/implScores.length).toFixed(1):0} 分`},
                  {label:'通过率',value:`${implScores.length>0?Math.round(implScores.filter(x=>x.pass).length/implScores.length*100):0}%`},
                ].map(c=>(
                  <div key={c.label} className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-center">
                    <div className="text-xs text-slate-400">{c.label}</div>
                    <div className="mt-1 text-xl font-semibold text-slate-800">{c.value}</div>
                  </div>
                ))}
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-700">薄弱知识点分析</label>
                <textarea value={evalWeakPoints} onChange={(e)=>setEvalWeakPoints(e.target.value)} rows={2}
                  className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"/>
              </div>
            </div>

            {/* 组4: 综合评估结论 */}
            <div className="rounded-[10px] border border-[#ede8df] bg-white px-6 py-5 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              <div className="mb-3 border-l-4 border-[#b85c3a] pl-2.5 text-[15px] font-bold text-[#b85c3a]">综合评估结论</div>
              <textarea value={evalConclusion} onChange={(e)=>setEvalConclusion(e.target.value)} rows={4}
                className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"/>
            </div>

            {/* 交付物 */}
            <div className="flex items-center justify-between rounded-[10px] border border-[#ede8df] bg-white px-6 py-3 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span className="font-medium">交付物：效果评估报告</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${evalStatus==='已完成'?'bg-green-50 text-green-600':'bg-yellow-50 text-yellow-600'}`}>{evalStatus}</span>
              </div>
              <button type="button" onClick={()=>alert('导出功能即将上线')}
                className="rounded-lg border border-[#d6cfc4] bg-white px-4 py-2 text-sm text-[#5c4f3d] hover:bg-[#f5f0ea] text-xs">导出报告</button>
            </div>
          </div>

        ) : stage === '评估归档' && activeTab === '归档打包' ? (
          /* ── 评估归档 / 归档打包 ── */
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-[10px] border border-[#ede8df] bg-white px-6 py-3 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              {(['效果评估','归档打包','改进建议'] as const).map((sub, idx) => {
                const done = sub === '效果评估' && evalStatus === '已完成'
                const current = activeTab === sub
                return (
                  <React.Fragment key={sub}>
                    {idx > 0 && <div className="h-px flex-1 bg-slate-200" />}
                    <div className={`flex items-center gap-1.5 text-xs font-medium ${done?'text-green-600':current?'text-blue-600':'text-slate-400'}`}>
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${done?'bg-green-100':current?'bg-blue-100':'bg-slate-100'}`}>{done?'✓':idx+1}</span>
                      {sub}{done&&<span className="text-green-500 ml-0.5">✓</span>}
                    </div>
                  </React.Fragment>
                )
              })}
            </div>
            <div className="rounded-lg border border-[#e8e0d4] bg-[#fdf8f3] px-4 py-2.5 text-xs text-[#6b5d4f] border-l-4 border-l-[#b85c3a]">
              📋 以下归档清单已自动从各阶段提取，请确认各项文件就绪
            </div>

            <div className="rounded-[10px] border border-[#ede8df] bg-white px-6 py-5 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs" style={{tableLayout:'fixed',minWidth:'680px'}}>
                  <colgroup>
                    <col style={{width:'44px'}}/><col/><col style={{width:'80px'}}/><col style={{width:'110px'}}/><col style={{width:'70px'}}/>
                  </colgroup>
                  <thead className="bg-[#faf6f0]">
                    <tr>{['序号','归档项名称','对应阶段','状态','操作'].map(h=>(
                      <th key={h} className="border border-gray-200 px-3 py-2.5 text-center font-semibold text-[#5c4f3d]">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {archiveItems.map((item,ii)=>(
                      <tr key={item.id} className={ii%2===0?'bg-white':'bg-[#faf6f0]'} style={{height:'44px'}}>
                        <td className="border border-gray-200 px-2 py-2 text-center text-slate-400">{ii+1}</td>
                        <td className="border border-gray-200 px-3 py-2 text-slate-700">{item.name}</td>
                        <td className="border border-gray-200 px-3 py-2 text-center text-slate-500">{item.stage}</td>
                        <td className="border border-gray-200 px-3 py-2 text-center">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${item.status==='已关联'?'bg-green-50 text-green-600':'bg-orange-50 text-orange-600'}`}>{item.status}</span>
                        </td>
                        <td className="border border-gray-200 px-2 py-2 text-center">
                          <button type="button" onClick={()=>alert('即将上线')}
                            className={`rounded border px-2.5 py-0.5 text-xs ${item.status==='需手动上传'?'border-orange-200 text-orange-600 hover:bg-orange-50':'border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600'}`}>
                            {item.status==='需手动上传'?'上传':'查看'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Archive progress */}
              <div className="border-t border-gray-100 px-4 py-3 space-y-3">
                {(() => {
                  const ready = archiveItems.filter(x=>x.status==='已关联').length
                  const total = archiveItems.length
                  const pct = Math.round(ready/total*100)
                  return (
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500">已就绪 <span className="font-medium text-green-600">{ready}</span> / 共 {total} 项（{pct}%）</span>
                      <div className="flex-1 overflow-hidden rounded-full bg-gray-100" style={{height:'6px'}}>
                        <div className={`h-full rounded-full transition-all ${pct===100?'bg-green-500':'bg-blue-500'}`} style={{width:`${pct}%`}}/>
                      </div>
                    </div>
                  )
                })()}
                <button type="button" onClick={()=>alert('导出功能即将上线')}
                  className="w-full rounded-lg bg-[#b85c3a] px-[18px] py-2 text-sm font-semibold text-white shadow-[0_2px_0_#8c3e24] transition-transform hover:-translate-y-px active:translate-y-px active:shadow-[0_1px_0_#8c3e24] disabled:opacity-60 py-2.5">
                  📦 导出归档包
                </button>
              </div>
            </div>
          </div>

        ) : stage === '评估归档' && activeTab === '改进建议' ? (
          /* ── 评估归档 / 改进建议 ── */
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-[10px] border border-[#ede8df] bg-white px-6 py-3 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              {(['效果评估','归档打包','改进建议'] as const).map((sub, idx) => {
                const done = sub === '效果评估' && evalStatus === '已完成'
                const current = activeTab === sub
                return (
                  <React.Fragment key={sub}>
                    {idx > 0 && <div className="h-px flex-1 bg-slate-200" />}
                    <div className={`flex items-center gap-1.5 text-xs font-medium ${done?'text-green-600':current?'text-blue-600':'text-slate-400'}`}>
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${done?'bg-green-100':current?'bg-blue-100':'bg-slate-100'}`}>{done?'✓':idx+1}</span>
                      {sub}{done&&<span className="text-green-500 ml-0.5">✓</span>}
                    </div>
                  </React.Fragment>
                )
              })}
            </div>
            {/* AI entry */}
            <div className="rounded-[10px] border border-[#ede8df] bg-white px-6 py-5 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)] border-[#e8dff5] bg-[#faf7ff] flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-purple-800">✨ AI 助手</div>
                <div className="text-xs text-purple-600 mt-0.5">基于本次评估数据生成改进建议草稿</div>
              </div>
              <button type="button" onClick={()=>alert('AI改进建议功能即将上线')}
                className="rounded-lg border border-purple-300 bg-white px-4 py-2 text-xs font-medium text-purple-700 hover:bg-purple-50">
                生成改进建议草稿
              </button>
            </div>

            {/* 组1: 本次培训总结 */}
            <div className="rounded-[10px] border border-[#ede8df] bg-white px-6 py-5 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-5">
              <div className="border-l-4 border-[#b85c3a] pl-2.5 text-[15px] font-bold text-[#b85c3a]">本次培训总结</div>
              <div>
                <label className="mb-2 block text-xs font-medium text-gray-700">培训亮点</label>
                <div className="space-y-1.5">
                  {improveHighlights.map((item, ii) => (
                    <div key={ii} className="flex items-center gap-2">
                      <input value={item} onChange={(e)=>setImproveHighlights(p=>p.map((x,xi)=>xi===ii?e.target.value:x))}
                        placeholder="填写亮点…"
                        className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"/>
                      <button type="button" onClick={()=>setImproveHighlights(p=>p.filter((_,xi)=>xi!==ii))} className="text-slate-300 hover:text-red-500"><X className="h-3.5 w-3.5"/></button>
                    </div>
                  ))}
                  <button type="button" onClick={()=>setImproveHighlights(p=>[...p,''])} className="text-xs text-blue-500 hover:text-blue-700">+ 添加亮点</button>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium text-gray-700">问题与不足</label>
                <div className="space-y-1.5">
                  {improveProblems.map((item, ii) => (
                    <div key={ii} className="flex items-center gap-2">
                      <input value={item} onChange={(e)=>setImproveProblems(p=>p.map((x,xi)=>xi===ii?e.target.value:x))}
                        placeholder="填写问题…"
                        className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"/>
                      <button type="button" onClick={()=>setImproveProblems(p=>p.filter((_,xi)=>xi!==ii))} className="text-slate-300 hover:text-red-500"><X className="h-3.5 w-3.5"/></button>
                    </div>
                  ))}
                  <button type="button" onClick={()=>setImproveProblems(p=>[...p,''])} className="text-xs text-blue-500 hover:text-blue-700">+ 添加问题</button>
                </div>
              </div>
            </div>

            {/* 组2: 改进建议 */}
            <div className="rounded-[10px] border border-[#ede8df] bg-white px-6 py-5 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-4">
              <div className="border-l-4 border-[#b85c3a] pl-2.5 text-[15px] font-bold text-[#b85c3a]">改进建议</div>
              <div>
                <label className="mb-2 block text-xs font-medium text-gray-700">改进建议列表</label>
                <div className="space-y-1.5">
                  {improveSuggestions.map((item, ii) => (
                    <div key={ii} className="flex items-center gap-2">
                      <input value={item} onChange={(e)=>setImproveSuggestions(p=>p.map((x,xi)=>xi===ii?e.target.value:x))}
                        placeholder="填写改进建议…"
                        className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"/>
                      <button type="button" onClick={()=>setImproveSuggestions(p=>p.filter((_,xi)=>xi!==ii))} className="text-slate-300 hover:text-red-500"><X className="h-3.5 w-3.5"/></button>
                    </div>
                  ))}
                  <button type="button" onClick={()=>setImproveSuggestions(p=>[...p,''])} className="text-xs text-blue-500 hover:text-blue-700">+ 添加改进建议</button>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-700">下次类似培训建议事项</label>
                <textarea value={improveNextNote} onChange={(e)=>setImproveNextNote(e.target.value)} rows={3}
                  className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"/>
              </div>
            </div>

            {/* 组3: 课件归库 */}
            <div className="rounded-[10px] border border-[#ede8df] bg-white px-6 py-5 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-4">
              <div className="border-l-4 border-[#b85c3a] pl-2.5 text-[15px] font-bold text-[#b85c3a]">课件归库</div>
              <div>
                <label className="mb-2 block text-xs font-medium text-gray-700">课件是否纳入材料库</label>
                <div className="flex gap-2">
                  {(['全部纳入','部分纳入','不纳入'] as const).map(s=>(
                    <button key={s} type="button" onClick={()=>setImproveCoursewarePolicy(s)}
                      className={`rounded-full border px-3 py-1 text-xs ${improveCoursewarePolicy===s?'border-[#b85c3a] bg-[#fdf3ea] text-[#8c3e24]':'border-slate-200 text-slate-500 hover:border-blue-200'}`}>{s}</button>
                  ))}
                </div>
              </div>
              {improveCoursewarePolicy!=='不纳入' && (
                <div className="rounded-lg border border-green-100 bg-green-50 px-4 py-3 text-xs text-green-700">
                  ✅ 课件将在归档完成后自动同步至全局材料库，供后续培训复用
                </div>
              )}
            </div>

            {/* 交付物 */}
            <div className="flex items-center justify-between rounded-[10px] border border-[#ede8df] bg-white px-6 py-3 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span className="font-medium">交付物：改进建议书</span>
                <span className="rounded-full bg-yellow-50 px-2 py-0.5 text-yellow-600">草稿中</span>
              </div>
              <button type="button" onClick={()=>alert('导出功能即将上线')}
                className="rounded-lg border border-[#d6cfc4] bg-white px-4 py-2 text-sm text-[#5c4f3d] hover:bg-[#f5f0ea] text-xs">导出建议书</button>
            </div>

            {/* Completion banner */}
            <div className="rounded-[10px] border border-[#c5dcc8] bg-[#f0f7f2] px-6 py-5 text-center shadow-sm">
              <div className="text-2xl mb-2">🎉</div>
              <div className="text-sm font-semibold text-green-800">本次培训项目全流程已完成！</div>
              <div className="mt-1.5 text-xs text-green-600 leading-relaxed">
                归档包已生成，改进建议已记录，将自动作为下次同类培训的参考输入。
              </div>
            </div>
          </div>

        ) : (
          <div className="rounded-[10px] border border-[#ede8df] bg-white px-6 py-4 mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)] text-sm text-slate-500">该视图正在建设中</div>
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
