import {
  Check,
  ChevronRight,
  FileText,
  Plus,
  Upload,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Modal } from '../shared/Modal'

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

type DemandMethodKind = '政策' | '指令' | '岗位' | '计划' | '日常' | '问卷' | '访谈' | '座谈' | '复盘' | '自定义'

type DemandOption = {
  id: string
  label: string
  kind: DemandMethodKind
  recommended?: boolean
}

type DemandDetail =
  | {
      kind: '政策'
      fileName: string
      issuer: string
      issueDate: string
      keyRequirements: string
      remark: string
    }
  | {
      kind: '指令'
      sourceType: '监管机构' | '总公司' | '省公司' | '其他'
      fileName: string
      contentTab: '资料库' | '上传文件' | '粘贴文本'
      libraryItem: string
      uploadedFile: { name: string; size: number } | null
      pastedText: string
      trainingRequirements: { id: string; text: string }[]
      remark: string
    }
  | {
      kind: '岗位'
      scope: string
      dimensions: string
      conclusion: string
      remark: string
    }
  | {
      kind: '计划'
      planFileName: string
      relatedRequirements: string
      direction: string
      remark: string
    }
  | {
      kind: '日常'
      description: string
      source: string
      priority: '高' | '中' | '低'
      remark: string
    }
  | {
      kind: '问卷'
      title: string
      target: string
      toolLink: string
      dueDate: string
      collectedCount: string
      conclusion: string
      remark: string
    }
  | {
      kind: '访谈'
      interviewee: string
      interviewTime: string
      outlineItems: string[]
      record: string
      remark: string
    }
  | {
      kind: '座谈'
      departments: string[]
      meetingTime: string
      topics: string[]
      minutes: string
      remark: string
    }
  | {
      kind: '复盘'
      projectName: string
      dimensions: string
      conclusion: string
      remark: string
    }
  | {
      kind: '自定义'
      name: string
      description: string
      remark: string
    }

type DemandMatrixRow = {
  optionId: string
  label: string
  kind: DemandMethodKind
  status: DemandStatus
  owner: string
  dueDate: string
  detail: DemandDetail
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

function createEmptyDemandDetail(kind: DemandMethodKind, label: string): DemandDetail {
  if (kind === '政策') {
    return { kind, fileName: '', issuer: '', issueDate: '', keyRequirements: '', remark: '' }
  }
  if (kind === '指令') {
    return {
      kind,
      sourceType: '监管机构',
      fileName: '',
      contentTab: '资料库' as const,
      libraryItem: '',
      uploadedFile: null,
      pastedText: '',
      trainingRequirements: [{ id: `req-${Date.now()}`, text: '' }],
      remark: '',
    }
  }
  if (kind === '岗位') {
    return { kind, scope: '', dimensions: '', conclusion: '', remark: '' }
  }
  if (kind === '计划') {
    return { kind, planFileName: '', relatedRequirements: '', direction: '', remark: '' }
  }
  if (kind === '日常') {
    return { kind, description: '', source: '', priority: '中', remark: '' }
  }
  if (kind === '问卷') {
    return { kind, title: '', target: '', toolLink: '', dueDate: '', collectedCount: '', conclusion: '', remark: '' }
  }
  if (kind === '访谈') {
    return { kind, interviewee: '', interviewTime: '', outlineItems: [], record: '', remark: '' }
  }
  if (kind === '座谈') {
    return { kind, departments: [], meetingTime: '', topics: [], minutes: '', remark: '' }
  }
  if (kind === '复盘') {
    return { kind, projectName: '', dimensions: '', conclusion: '', remark: '' }
  }
  return { kind: '自定义', name: label, description: '', remark: '' }
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

function StringListEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
}) {
  const [input, setInput] = useState('')
  return (
    <div className="space-y-2">
      <div className="space-y-2">
        {value.length === 0 ? <div className="text-sm text-slate-500">暂无条目</div> : null}
        <div className="space-y-2">
          {value.map((item, idx) => (
            <div key={`${item}-${idx}`} className="flex items-center gap-2">
              <div className="flex-1 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">{item}</div>
              <button
                type="button"
                onClick={() => onChange(value.filter((_, i) => i !== idx))}
                className="inline-flex h-9 w-9 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder || '输入后添加'}
          className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
        />
        <button
          type="button"
          onClick={() => {
            const v = input.trim()
            if (!v) return
            onChange([...value, v])
            setInput('')
          }}
          className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
        >
          添加
        </button>
      </div>
    </div>
  )
}

function TagEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
}) {
  const [input, setInput] = useState('')
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
            {t}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} className="text-slate-500 hover:text-slate-900">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            const v = input.trim()
            if (!v) return
            onChange(value.includes(v) ? value : [...value, v])
            setInput('')
          }}
          placeholder={placeholder || '输入后回车'}
          className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
        />
        <button
          type="button"
          onClick={() => {
            const v = input.trim()
            if (!v) return
            onChange(value.includes(v) ? value : [...value, v])
            setInput('')
          }}
          className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
        >
          添加
        </button>
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
  const directiveFileInputRef = useRef<HTMLInputElement | null>(null)
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

  const [demandOptions, setDemandOptions] = useState<DemandOption[]>([
    { id: 'policy', label: '政策', kind: '政策', recommended: true },
    { id: 'directive', label: '指令', kind: '指令', recommended: true },
    { id: 'role', label: '岗位', kind: '岗位' },
    { id: 'plan', label: '计划', kind: '计划' },
    { id: 'daily', label: '日常', kind: '日常' },
    { id: 'questionnaire', label: '问卷', kind: '问卷' },
    { id: 'interview', label: '访谈', kind: '访谈' },
    { id: 'symposium', label: '座谈', kind: '座谈' },
    { id: 'review', label: '复盘', kind: '复盘' },
  ])
  const [selectedDemandOptionIds, setSelectedDemandOptionIds] = useState<string[]>([])
  const [demandMatrix, setDemandMatrix] = useState<Record<string, DemandMatrixRow>>({})
  const [customMethodOpen, setCustomMethodOpen] = useState(false)
  const [customMethodName, setCustomMethodName] = useState('')
  const [demandDetailOpen, setDemandDetailOpen] = useState(false)
  const [demandDetailOptionId, setDemandDetailOptionId] = useState<string | null>(null)
  const [demandDetailDraft, setDemandDetailDraft] = useState<DemandDetail | null>(null)

  const [summaryGoal, setSummaryGoal] = useState('')
  const [summaryTarget, setSummaryTarget] = useState('')
  const [summaryParticipants, setSummaryParticipants] = useState<string>('')
  const [summaryTopics, setSummaryTopics] = useState<string[]>([])
  const [summaryTopicInput, setSummaryTopicInput] = useState('')
  const [summaryRemark, setSummaryRemark] = useState('')

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
    if (stage === '需求立项') return ['需求收集', '需求汇总', '参考历史']
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

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          {STAGES.map((s, idx) => {
            const done = idx < stageIdx
            const current = idx === stageIdx
            return (
              <button
                key={s}
                type="button"
                disabled={stageUpdating}
                onClick={() => onClickStage(s)}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50 disabled:opacity-70"
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                    done ? 'bg-emerald-600 text-white' : current ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {done ? <Check className="h-4 w-4" /> : idx + 1}
                </div>
                <div
                  className={`min-w-0 truncate text-sm ${
                    done ? 'text-emerald-700' : current ? 'font-semibold text-blue-700' : 'text-slate-600'
                  }`}
                >
                  {s}
                </div>
                {idx < STAGES.length - 1 ? <div className="h-[2px] flex-1 bg-slate-200" /> : null}
              </button>
            )
          })}
        </div>
        {stageUpdateError ? <div className="mt-3 text-sm text-red-700">阶段切换失败：{stageUpdateError}</div> : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex flex-wrap rounded-xl border border-slate-200 bg-white p-1">
          {stageTabs.map((tab) => {
            const selected = activeTab === tab
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`rounded-lg px-3 py-2 text-sm ${selected ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                {tab}
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
        ) : stage === '需求立项' && activeTab === '需求收集' ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">收集方式</div>
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
                <button
                  type="button"
                  onClick={() => {
                    setCustomMethodName('')
                    setCustomMethodOpen(true)
                  }}
                  className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  自定义
                </button>
              </div>
              <div className="mt-3 text-xs text-slate-500">提示：政策 / 指令 为建议优先选择项</div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-medium">序号</th>
                    <th className="px-3 py-2 font-medium">收集方式</th>
                    <th className="px-3 py-2 font-medium">状态</th>
                    <th className="px-3 py-2 font-medium">负责人</th>
                    <th className="px-3 py-2 font-medium">截止日期</th>
                    <th className="px-3 py-2 font-medium">详情</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {selectedDemandOptionIds.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-500">
                        暂无数据
                      </td>
                    </tr>
                  ) : (
                    demandOptions
                      .filter((o) => selectedDemandOptionIds.includes(o.id))
                      .map((opt, idx) => {
                        const row = demandMatrix[opt.id]
                        if (!row) return null
                        return (
                          <tr key={opt.id}>
                            <td className="px-3 py-2 text-slate-600">{idx + 1}</td>
                            <td className="px-3 py-2 text-slate-900">{row.label}</td>
                            <td className="px-3 py-2">
                              <select
                                value={row.status}
                                onChange={(e) => {
                                  const v = e.target.value as DemandStatus
                                  setDemandMatrix((prev) => ({ ...prev, [opt.id]: { ...prev[opt.id], status: v } }))
                                }}
                                className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-blue-300"
                              >
                                <option value="待开始">待开始</option>
                                <option value="进行中">进行中</option>
                                <option value="已完成">已完成</option>
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                value={row.owner}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setDemandMatrix((prev) => ({ ...prev, [opt.id]: { ...prev[opt.id], owner: v } }))
                                }}
                                className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-300"
                                placeholder="负责人"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="date"
                                value={row.dueDate}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setDemandMatrix((prev) => ({ ...prev, [opt.id]: { ...prev[opt.id], dueDate: v } }))
                                }}
                                className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-300"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const current = demandMatrix[opt.id]
                                  if (!current) return
                                  setDemandDetailOptionId(opt.id)
                                  setDemandDetailDraft(JSON.parse(JSON.stringify(current.detail)) as DemandDetail)
                                  setDemandDetailOpen(true)
                                }}
                                className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                              >
                                详情
                              </button>
                            </td>
                          </tr>
                        )
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : stage === '需求立项' && activeTab === '需求汇总' ? (
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-sm font-medium text-slate-700">培训目标</div>
                <input
                  value={summaryGoal}
                  onChange={(e) => setSummaryGoal(e.target.value)}
                  className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-slate-700">目标对象</div>
                <input
                  value={summaryTarget}
                  onChange={(e) => setSummaryTarget(e.target.value)}
                  className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-slate-700">预计参训人数</div>
                <input
                  type="number"
                  value={summaryParticipants}
                  onChange={(e) => setSummaryParticipants(e.target.value)}
                  className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-slate-700">核心培训主题</div>
                <div className="flex flex-wrap gap-2">
                  {summaryTopics.map((t) => (
                    <span key={t} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                      {t}
                      <button type="button" onClick={() => setSummaryTopics((prev) => prev.filter((x) => x !== t))} className="text-slate-500 hover:text-slate-900">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={summaryTopicInput}
                    onChange={(e) => setSummaryTopicInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return
                      e.preventDefault()
                      const v = summaryTopicInput.trim()
                      if (!v) return
                      setSummaryTopics((prev) => (prev.includes(v) ? prev : [...prev, v]))
                      setSummaryTopicInput('')
                    }}
                    className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                    placeholder="输入主题后回车"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const v = summaryTopicInput.trim()
                      if (!v) return
                      setSummaryTopics((prev) => (prev.includes(v) ? prev : [...prev, v]))
                      setSummaryTopicInput('')
                    }}
                    className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
                  >
                    添加
                  </button>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-700">备注</div>
              <textarea
                value={summaryRemark}
                onChange={(e) => setSummaryRemark(e.target.value)}
                className="h-24 w-full resize-none rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
              />
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={() => showToast('已保存汇总')} className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
                保存汇总
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">该视图正在建设中</div>
        )}
      </div>

      <Modal
        open={customMethodOpen}
        title="新增自定义收集方式"
        onClose={() => setCustomMethodOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCustomMethodOpen(false)}
              className="rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => {
                const v = customMethodName.trim()
                if (!v) return
                const id = `custom-${Date.now()}`
                const option: DemandOption = { id, label: v, kind: '自定义' }
                setDemandOptions((prev) => [...prev, option])
                setSelectedDemandOptionIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
                setDemandMatrix((prev) => ({ ...prev, [id]: createDemandMatrixRow(option) }))
                setCustomMethodOpen(false)
              }}
              className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
            >
              确认
            </button>
          </div>
        }
      >
        <div className="space-y-2">
          <div className="text-sm text-slate-700">方式名称</div>
          <input
            value={customMethodName}
            onChange={(e) => setCustomMethodName(e.target.value)}
            className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
            placeholder="例如：专项调研"
          />
        </div>
      </Modal>

      <Modal
        open={demandDetailOpen}
        title={
          demandDetailDraft
            ? `${demandDetailDraft.kind}详情`
            : demandDetailOptionId
              ? `${demandMatrix[demandDetailOptionId]?.kind || '详情'}详情`
              : '详情'
        }
        onClose={() => {
          setDemandDetailOpen(false)
          setDemandDetailOptionId(null)
          setDemandDetailDraft(null)
        }}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setDemandDetailOpen(false)
                setDemandDetailOptionId(null)
                setDemandDetailDraft(null)
              }}
              className="rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => {
                const optionId = demandDetailOptionId
                const draft = demandDetailDraft
                if (!optionId || !draft) return
                setDemandMatrix((prev) => {
                  const current = prev[optionId]
                  if (!current) return prev
                  const nextLabel = draft.kind === '自定义' ? safeText(draft.name) || current.label : current.label
                  return { ...prev, [optionId]: { ...current, label: nextLabel, detail: draft } }
                })
                if (demandDetailDraft.kind === '自定义') {
                  const nextLabel = safeText(demandDetailDraft.name)
                  if (nextLabel) {
                    setDemandOptions((prev) => prev.map((o) => (o.id === optionId ? { ...o, label: nextLabel } : o)))
                  }
                }
                setDemandDetailOpen(false)
                setDemandDetailOptionId(null)
                setDemandDetailDraft(null)
              }}
              className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
            >
              保存
            </button>
          </div>
        }
      >
        {demandDetailDraft ? (
          <div className="space-y-4">
            {demandDetailDraft.kind === '政策' ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-sm text-slate-700">文件名称</div>
                  <input
                    value={demandDetailDraft.fileName}
                    onChange={(e) => setDemandDetailDraft({ ...demandDetailDraft, fileName: e.target.value })}
                    className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-slate-700">发文机关</div>
                  <input
                    value={demandDetailDraft.issuer}
                    onChange={(e) => setDemandDetailDraft({ ...demandDetailDraft, issuer: e.target.value })}
                    className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-slate-700">发文日期</div>
                  <input
                    type="date"
                    value={demandDetailDraft.issueDate}
                    onChange={(e) => setDemandDetailDraft({ ...demandDetailDraft, issueDate: e.target.value })}
                    className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <div className="text-sm text-slate-700">关键要求提取</div>
                  <textarea
                    value={demandDetailDraft.keyRequirements}
                    onChange={(e) => setDemandDetailDraft({ ...demandDetailDraft, keyRequirements: e.target.value })}
                    className="h-24 w-full resize-none rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <div className="text-sm text-slate-700">备注</div>
                  <textarea
                    value={demandDetailDraft.remark}
                    onChange={(e) => setDemandDetailDraft({ ...demandDetailDraft, remark: e.target.value })}
                    className="h-20 w-full resize-none rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                  />
                </div>
              </div>
            ) : null}

            {demandDetailDraft.kind === '指令' ? (
              <div>
                {/* 区域一：来源标注 */}
                <div className="grid grid-cols-2 gap-3 pb-4">
                  <div className="space-y-1.5">
                    <div className="text-sm font-medium text-slate-700">来源类型</div>
                    <select
                      value={demandDetailDraft.sourceType}
                      onChange={(e) => setDemandDetailDraft({ ...demandDetailDraft, sourceType: e.target.value as any })}
                      className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-300"
                    >
                      <option value="监管机构">监管机构</option>
                      <option value="总公司">总公司</option>
                      <option value="省公司">省公司</option>
                      <option value="其他">其他</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <div className="text-sm font-medium text-slate-700">文件/通知名称</div>
                    <input
                      value={demandDetailDraft.fileName}
                      onChange={(e) => setDemandDetailDraft({ ...demandDetailDraft, fileName: e.target.value })}
                      placeholder="可手动填写"
                      className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-100" />

                {/* 区域二：内容输入（三个 Tab） */}
                <div className="space-y-3 py-4">
                  <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                    {(
                      [
                        { key: '资料库' as const, icon: '📂', label: '从资料库选取' },
                        { key: '上传文件' as const, icon: '📎', label: '上传文件' },
                        { key: '粘贴文本' as const, icon: '📝', label: '粘贴文本' },
                      ] as const
                    ).map(({ key, icon, label }) => {
                      const selected = demandDetailDraft.contentTab === key
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setDemandDetailDraft({ ...demandDetailDraft, contentTab: key })}
                          className={`rounded-md px-3 py-1.5 text-sm transition-colors ${selected ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          {icon} {label}
                        </button>
                      )
                    })}
                  </div>

                  {demandDetailDraft.contentTab === '资料库' ? (
                    <select
                      value={demandDetailDraft.libraryItem}
                      onChange={(e) => {
                        const v = e.target.value
                        setDemandDetailDraft({ ...demandDetailDraft, libraryItem: v, fileName: v || demandDetailDraft.fileName })
                      }}
                      className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-300"
                    >
                      <option value="">— 搜索或选择资料库文件 —</option>
                      {[
                        '反洗钱法（2024修订）',
                        '金融机构反洗钱监督管理办法',
                        '关于加强客户身份识别工作的通知',
                        '年度合规培训工作方案',
                      ].map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  ) : demandDetailDraft.contentTab === '上传文件' ? (
                    <div className="space-y-2">
                      {demandDetailDraft.uploadedFile ? (
                        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-700">{demandDetailDraft.uploadedFile.name}</p>
                              <p className="text-xs text-slate-400">{(demandDetailDraft.uploadedFile.size / 1024).toFixed(1)} KB</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setDemandDetailDraft({ ...demandDetailDraft, uploadedFile: null })}
                            className="ml-2 shrink-0 rounded border border-slate-200 p-1 text-slate-400 hover:bg-white hover:text-slate-700"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => directiveFileInputRef.current?.click()}
                          className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 py-6 text-sm text-slate-500 hover:border-blue-300 hover:bg-blue-50"
                        >
                          <Upload className="h-5 w-5" />
                          <span>点击上传文件</span>
                          <span className="text-xs text-slate-400">.pdf .doc .docx .txt，最大 10MB</span>
                        </button>
                      )}
                      <input
                        ref={directiveFileInputRef}
                        type="file"
                        accept=".pdf,.doc,.docx,.txt"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (!f) return
                          if (f.size > 10 * 1024 * 1024) {
                            showToast('文件大小不能超过 10MB')
                            e.target.value = ''
                            return
                          }
                          setDemandDetailDraft({ ...demandDetailDraft, uploadedFile: { name: f.name, size: f.size } })
                          e.target.value = ''
                        }}
                      />
                    </div>
                  ) : (
                    <textarea
                      value={demandDetailDraft.pastedText}
                      onChange={(e) => setDemandDetailDraft({ ...demandDetailDraft, pastedText: e.target.value })}
                      rows={8}
                      placeholder="请粘贴通知原文、领导要求或已转录的会议内容..."
                      className="w-full resize-none rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                    />
                  )}
                </div>

                <div className="border-t border-slate-100" />

                {/* 区域三：培训需求提炼 */}
                <div className="space-y-3 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-800">培训需求</span>
                    <button
                      type="button"
                      disabled
                      className="inline-flex cursor-not-allowed items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-400"
                    >
                      ✨ AI提炼（即将上线）
                    </button>
                  </div>

                  <div className="space-y-2">
                    {demandDetailDraft.trainingRequirements.map((req, idx) => (
                      <div key={req.id} className="flex items-center gap-2">
                        <span className="w-5 shrink-0 text-center text-xs text-slate-400">{idx + 1}</span>
                        <input
                          value={req.text}
                          onChange={(e) => {
                            const v = e.target.value
                            setDemandDetailDraft({
                              ...demandDetailDraft,
                              trainingRequirements: demandDetailDraft.trainingRequirements.map((r) =>
                                r.id === req.id ? { ...r, text: v } : r,
                              ),
                            })
                          }}
                          placeholder="输入培训需求条目"
                          className="flex-1 rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                        />
                        <button
                          type="button"
                          disabled={demandDetailDraft.trainingRequirements.length <= 1}
                          onClick={() =>
                            setDemandDetailDraft({
                              ...demandDetailDraft,
                              trainingRequirements: demandDetailDraft.trainingRequirements.filter((r) => r.id !== req.id),
                            })
                          }
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-30"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setDemandDetailDraft({
                        ...demandDetailDraft,
                        trainingRequirements: [...demandDetailDraft.trainingRequirements, { id: `req-${Date.now()}`, text: '' }],
                      })
                    }
                    className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    新增需求
                  </button>

                  <div className="space-y-1.5">
                    <div className="text-sm text-slate-600">备注</div>
                    <input
                      value={demandDetailDraft.remark}
                      onChange={(e) => setDemandDetailDraft({ ...demandDetailDraft, remark: e.target.value })}
                      placeholder="备注信息（选填）"
                      className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {demandDetailDraft.kind === '岗位' ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="text-sm text-slate-700">分析岗位范围</div>
                  <input
                    value={demandDetailDraft.scope}
                    onChange={(e) => setDemandDetailDraft({ ...demandDetailDraft, scope: e.target.value })}
                    className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-slate-700">分析维度</div>
                  <input
                    value={demandDetailDraft.dimensions}
                    onChange={(e) => setDemandDetailDraft({ ...demandDetailDraft, dimensions: e.target.value })}
                    className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-slate-700">分析结论</div>
                  <textarea
                    value={demandDetailDraft.conclusion}
                    onChange={(e) => setDemandDetailDraft({ ...demandDetailDraft, conclusion: e.target.value })}
                    className="h-24 w-full resize-none rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-slate-700">备注</div>
                  <textarea
                    value={demandDetailDraft.remark}
                    onChange={(e) => setDemandDetailDraft({ ...demandDetailDraft, remark: e.target.value })}
                    className="h-20 w-full resize-none rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                  />
                </div>
              </div>
            ) : null}

            {demandDetailDraft.kind === '计划' ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="text-sm text-slate-700">计划文件名</div>
                  <input
                    value={demandDetailDraft.planFileName}
                    onChange={(e) => setDemandDetailDraft({ ...demandDetailDraft, planFileName: e.target.value })}
                    className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-slate-700">关联要求</div>
                  <textarea
                    value={demandDetailDraft.relatedRequirements}
                    onChange={(e) => setDemandDetailDraft({ ...demandDetailDraft, relatedRequirements: e.target.value })}
                    className="h-20 w-full resize-none rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-slate-700">培训方向提取</div>
                  <textarea
                    value={demandDetailDraft.direction}
                    onChange={(e) => setDemandDetailDraft({ ...demandDetailDraft, direction: e.target.value })}
                    className="h-20 w-full resize-none rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-slate-700">备注</div>
                  <textarea
                    value={demandDetailDraft.remark}
                    onChange={(e) => setDemandDetailDraft({ ...demandDetailDraft, remark: e.target.value })}
                    className="h-20 w-full resize-none rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                  />
                </div>
              </div>
            ) : null}

            {demandDetailDraft.kind === '日常' ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <div className="text-sm text-slate-700">反映问题/需求描述</div>
                  <textarea
                    value={demandDetailDraft.description}
                    onChange={(e) => setDemandDetailDraft({ ...demandDetailDraft, description: e.target.value })}
                    className="h-24 w-full resize-none rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-slate-700">来源部门/人员</div>
                  <input
                    value={demandDetailDraft.source}
                    onChange={(e) => setDemandDetailDraft({ ...demandDetailDraft, source: e.target.value })}
                    className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-slate-700">优先级</div>
                  <select
                    value={demandDetailDraft.priority}
                    onChange={(e) => setDemandDetailDraft({ ...demandDetailDraft, priority: e.target.value as any })}
                    className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-300"
                  >
                    <option value="高">高</option>
                    <option value="中">中</option>
                    <option value="低">低</option>
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <div className="text-sm text-slate-700">备注</div>
                  <textarea
                    value={demandDetailDraft.remark}
                    onChange={(e) => setDemandDetailDraft({ ...demandDetailDraft, remark: e.target.value })}
                    className="h-20 w-full resize-none rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                  />
                </div>
              </div>
            ) : null}

            {demandDetailDraft.kind === '问卷' ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-sm text-slate-700">问卷标题</div>
                  <input
                    value={demandDetailDraft.title}
                    onChange={(e) => setDemandDetailDraft({ ...demandDetailDraft, title: e.target.value })}
                    className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-slate-700">发放对象</div>
                  <input
                    value={demandDetailDraft.target}
                    onChange={(e) => setDemandDetailDraft({ ...demandDetailDraft, target: e.target.value })}
                    className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <div className="text-sm text-slate-700">使用工具/链接</div>
                  <input
                    value={demandDetailDraft.toolLink}
                    onChange={(e) => setDemandDetailDraft({ ...demandDetailDraft, toolLink: e.target.value })}
                    className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-slate-700">截止日期</div>
                  <input
                    type="date"
                    value={demandDetailDraft.dueDate}
                    onChange={(e) => setDemandDetailDraft({ ...demandDetailDraft, dueDate: e.target.value })}
                    className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-slate-700">回收数量</div>
                  <input
                    type="number"
                    value={demandDetailDraft.collectedCount}
                    onChange={(e) => setDemandDetailDraft({ ...demandDetailDraft, collectedCount: e.target.value })}
                    className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                    min={0}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <div className="text-sm text-slate-700">结论摘要</div>
                  <textarea
                    value={demandDetailDraft.conclusion}
                    onChange={(e) => setDemandDetailDraft({ ...demandDetailDraft, conclusion: e.target.value })}
                    className="h-24 w-full resize-none rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <div className="text-sm text-slate-700">备注</div>
                  <textarea
                    value={demandDetailDraft.remark}
                    onChange={(e) => setDemandDetailDraft({ ...demandDetailDraft, remark: e.target.value })}
                    className="h-20 w-full resize-none rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                  />
                </div>
              </div>
            ) : null}

            {demandDetailDraft.kind === '访谈' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-sm text-slate-700">访谈对象姓名/部门</div>
                    <input
                      value={demandDetailDraft.interviewee}
                      onChange={(e) => setDemandDetailDraft({ ...demandDetailDraft, interviewee: e.target.value })}
                      className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm text-slate-700">访谈时间</div>
                    <input
                      type="datetime-local"
                      value={demandDetailDraft.interviewTime}
                      onChange={(e) => setDemandDetailDraft({ ...demandDetailDraft, interviewTime: e.target.value })}
                      className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-slate-700">访谈提纲</div>
                  <StringListEditor
                    value={demandDetailDraft.outlineItems}
                    onChange={(next) => setDemandDetailDraft({ ...demandDetailDraft, outlineItems: next })}
                    placeholder="输入提纲条目"
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-slate-700">访谈记录</div>
                  <textarea
                    value={demandDetailDraft.record}
                    onChange={(e) => setDemandDetailDraft({ ...demandDetailDraft, record: e.target.value })}
                    className="h-28 w-full resize-none rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-slate-700">备注</div>
                  <textarea
                    value={demandDetailDraft.remark}
                    onChange={(e) => setDemandDetailDraft({ ...demandDetailDraft, remark: e.target.value })}
                    className="h-20 w-full resize-none rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                  />
                </div>
              </div>
            ) : null}

            {demandDetailDraft.kind === '座谈' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-sm text-slate-700">召开时间</div>
                    <input
                      type="datetime-local"
                      value={demandDetailDraft.meetingTime}
                      onChange={(e) => setDemandDetailDraft({ ...demandDetailDraft, meetingTime: e.target.value })}
                      className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-slate-700">参与部门</div>
                  <TagEditor
                    value={demandDetailDraft.departments}
                    onChange={(next) => setDemandDetailDraft({ ...demandDetailDraft, departments: next })}
                    placeholder="输入部门后回车"
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-slate-700">议题列表</div>
                  <StringListEditor
                    value={demandDetailDraft.topics}
                    onChange={(next) => setDemandDetailDraft({ ...demandDetailDraft, topics: next })}
                    placeholder="输入议题后添加"
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-slate-700">会议纪要</div>
                  <textarea
                    value={demandDetailDraft.minutes}
                    onChange={(e) => setDemandDetailDraft({ ...demandDetailDraft, minutes: e.target.value })}
                    className="h-28 w-full resize-none rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-slate-700">备注</div>
                  <textarea
                    value={demandDetailDraft.remark}
                    onChange={(e) => setDemandDetailDraft({ ...demandDetailDraft, remark: e.target.value })}
                    className="h-20 w-full resize-none rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                  />
                </div>
              </div>
            ) : null}

            {demandDetailDraft.kind === '复盘' ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="text-sm text-slate-700">项目名称</div>
                  <input
                    value={demandDetailDraft.projectName}
                    onChange={(e) => setDemandDetailDraft({ ...demandDetailDraft, projectName: e.target.value })}
                    className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-slate-700">分析维度</div>
                  <input
                    value={demandDetailDraft.dimensions}
                    onChange={(e) => setDemandDetailDraft({ ...demandDetailDraft, dimensions: e.target.value })}
                    className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-slate-700">参考结论</div>
                  <textarea
                    value={demandDetailDraft.conclusion}
                    onChange={(e) => setDemandDetailDraft({ ...demandDetailDraft, conclusion: e.target.value })}
                    className="h-24 w-full resize-none rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-slate-700">备注</div>
                  <textarea
                    value={demandDetailDraft.remark}
                    onChange={(e) => setDemandDetailDraft({ ...demandDetailDraft, remark: e.target.value })}
                    className="h-20 w-full resize-none rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                  />
                </div>
              </div>
            ) : null}

            {demandDetailDraft.kind === '自定义' ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="text-sm text-slate-700">方式名称</div>
                  <input
                    value={demandDetailDraft.name}
                    onChange={(e) => setDemandDetailDraft({ ...demandDetailDraft, name: e.target.value })}
                    className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-slate-700">说明</div>
                  <textarea
                    value={demandDetailDraft.description}
                    onChange={(e) => setDemandDetailDraft({ ...demandDetailDraft, description: e.target.value })}
                    className="h-24 w-full resize-none rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-slate-700">备注</div>
                  <textarea
                    value={demandDetailDraft.remark}
                    onChange={(e) => setDemandDetailDraft({ ...demandDetailDraft, remark: e.target.value })}
                    className="h-20 w-full resize-none rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </section>
  )
}
