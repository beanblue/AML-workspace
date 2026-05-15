import {
  ChevronRight,
  Download,
  FileText,
  ListChecks,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Sparkles,
  Upload,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { queryDatabase } from '../../api/notion'

type NotionWorkUnitRow = {
  id: string
  [key: string]: unknown
}

type NotionNodeRow = {
  id: string
  [key: string]: unknown
}

type StageKey = '需求立项' | '计划设计' | '课件制作' | '培训实施' | '归档闭环'

const STAGES: StageKey[] = ['需求立项', '计划设计', '课件制作', '培训实施', '归档闭环']

function safeText(value: unknown): string {
  return String(value ?? '').trim()
}

function stageIndex(value: string): number {
  const idx = STAGES.indexOf(value as StageKey)
  return idx === -1 ? 0 : idx
}

function getWorkUnitName(row: NotionWorkUnitRow | null): string {
  return (
    safeText(row?.项目名称) ||
    safeText(row?.名称) ||
    safeText(row?.标题) ||
    safeText((row as any)?.Name) ||
    '未命名培训'
  )
}

function getWorkUnitType(row: NotionWorkUnitRow | null): string {
  return safeText(row?.类型) || safeText(row?.项目类型) || '培训'
}

function getWorkUnitStage(row: NotionWorkUnitRow | null): StageKey {
  const raw = safeText(row?.当前阶段) || safeText(row?.阶段) || '需求立项'
  return (STAGES.includes(raw as StageKey) ? raw : '需求立项') as StageKey
}

function getWorkUnitOwner(row: NotionWorkUnitRow | null): string {
  return safeText(row?.负责人) || safeText(row?.Owner) || safeText(row?.owner) || '未指定'
}

function getWorkUnitPlanDate(row: NotionWorkUnitRow | null): string {
  return safeText(row?.计划日期) || safeText(row?.计划开始) || safeText(row?.开始日期) || ''
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

  const [activeTab, setActiveTab] = useState<
    'tasks' | 'materials' | 'participants' | 'records' | 'review' | 'ai'
  >((initialTab === 'materials' ? 'materials' : 'tasks') as any)

  const [rightCollapsed, setRightCollapsed] = useState(false)

  const [localTasks, setLocalTasks] = useState<Array<{ id: string; title: string; done: boolean }>>([])
  const [newTaskTitle, setNewTaskTitle] = useState('')

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [localMaterials, setLocalMaterials] = useState<Array<{ id: string; name: string; uploadedAt: string }>>([])

  useEffect(() => {
    const workUnitId = safeText(id)
    if (!workUnitId) return
    setWorkUnitLoading(true)
    setWorkUnitError(null)
    fetch('/api/workunit/list?type=%E5%9F%B9%E8%AE%AD')
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status))
        return res.json()
      })
      .then((data) => {
        const list = (Array.isArray(data?.results) ? data.results : []) as NotionWorkUnitRow[]
        const found = list.find((r) => safeText(r.id) === workUnitId) ?? null
        setWorkUnit(found)
      })
      .catch((e) => setWorkUnitError(e instanceof Error ? e.message : String(e)))
      .finally(() => setWorkUnitLoading(false))
  }, [id])

  useEffect(() => {
    const workUnitId = safeText(id)
    if (!workUnitId) return
    setNodesLoading(true)
    setNodesError(null)

    const tryFilters: Array<Record<string, unknown> | undefined> = [
      {
        property: 'WorkUnit',
        relation: { contains: workUnitId },
      },
      {
        property: '工作项目',
        relation: { contains: workUnitId },
      },
      undefined,
    ]

    const run = async () => {
      for (const filter of tryFilters) {
        try {
          const rows = (await queryDatabase('nodes', filter)) as unknown as NotionNodeRow[]
          if (rows.length > 0 || filter === undefined) {
            setNodes(rows)
            return
          }
        } catch (e) {
          if (filter === undefined) throw e
        }
      }
    }

    run()
      .catch((e) => setNodesError(e instanceof Error ? e.message : String(e)))
      .finally(() => setNodesLoading(false))
  }, [id])

  useEffect(() => {
    if (nodes.length === 0) return
    const mapped = nodes.slice(0, 20).map((n, idx) => ({
      id: safeText(n.id) || `node-${idx}`,
      title: safeText((n as any).任务名称 ?? (n as any).标题 ?? (n as any).Name) || `任务 ${idx + 1}`,
      done: Boolean((n as any).完成 ?? (n as any).Done ?? false),
    }))
    setLocalTasks(mapped)
  }, [nodes])

  const title = getWorkUnitName(workUnit)
  const type = getWorkUnitType(workUnit)
  const stage = getWorkUnitStage(workUnit)
  const owner = getWorkUnitOwner(workUnit)
  const planDate = getWorkUnitPlanDate(workUnit)

  const stageIdx = useMemo(() => stageIndex(stage), [stage])

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
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

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h2 className="min-w-0 truncate text-xl font-semibold text-slate-900">{title}</h2>
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700">{type}</span>
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">{stage}</span>
          </div>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
            {owner ? <span>负责人：{owner}</span> : null}
            {planDate ? <span>计划日期：{planDate}</span> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => window.alert('Mock：推进阶段')}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            推进阶段 <ChevronRight className="h-4 w-4 text-slate-400" />
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          {STAGES.map((s, idx) => {
            const done = idx < stageIdx
            const current = idx === stageIdx
            return (
              <div key={s} className="flex min-w-0 flex-1 items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                    done ? 'bg-emerald-600 text-white' : current ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {done ? '✓' : idx + 1}
                </div>
                <div className={`min-w-0 truncate text-sm ${current ? 'font-semibold text-orange-700' : 'text-slate-700'}`}>{s}</div>
                {idx < STAGES.length - 1 ? <div className="h-[2px] flex-1 bg-slate-200" /> : null}
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex flex-wrap rounded-xl border border-slate-200 bg-white p-1">
          {([
            { key: 'tasks', label: '当前任务', icon: ListChecks },
            { key: 'materials', label: '课件材料', icon: FileText },
            { key: 'participants', label: '参训人员', icon: Users },
            { key: 'records', label: '数据记录', icon: Download },
            { key: 'review', label: '评估总结', icon: Download },
            { key: 'ai', label: 'AI助手✦', icon: Sparkles },
          ] as const).map((item) => {
            const selected = activeTab === item.key
            const Icon = item.icon
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.key)}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                  selected ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => setRightCollapsed((prev) => !prev)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          {rightCollapsed ? <PanelRightOpen className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}
          侧栏
        </button>
      </div>

      {workUnitLoading ? <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">加载中...</div> : null}
      {workUnitError ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{workUnitError}</div> : null}

      <div className="flex flex-col gap-3 xl:flex-row">
        <div className="min-w-0 flex-1">
          {activeTab === 'tasks' ? (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
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
                    <div className="rounded border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                      暂无任务
                    </div>
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
                      const v = newTaskTitle.trim()
                      if (!v) return
                      setLocalTasks((prev) => [{ id: `local-${Date.now()}`, title: v, done: false }, ...prev])
                      setNewTaskTitle('')
                    }}
                    className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4" />
                    添加
                  </button>
                </div>
              </article>

              <article className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">课件材料</h3>
                  <span className="text-xs text-slate-500">{localMaterials.length} 份</span>
                </div>
                <div className="mt-3 space-y-2">
                  {localMaterials.length === 0 ? (
                    <div className="rounded border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                      暂无材料
                    </div>
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
                    onClick={() => window.alert('Mock：从材料库选取')}
                    className="inline-flex items-center gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <FileText className="h-4 w-4" />
                    从材料库选取
                  </button>
                </div>

                <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-blue-800">
                    <Sparkles className="h-4 w-4" />
                    AI 助手快捷操作
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => window.alert('Mock：生成测试题库初稿')}
                      className="rounded bg-white px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      生成测试题库初稿（基于课件）
                    </button>
                    <button
                      type="button"
                      onClick={() => window.alert('Mock：起草培训通知邮件')}
                      className="rounded bg-white px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      起草培训通知邮件
                    </button>
                    <button
                      type="button"
                      onClick={() => window.alert('Mock：生成本次培训总结模板')}
                      className="rounded bg-white px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      生成本次培训总结模板
                    </button>
                  </div>
                </div>
              </article>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">该视图正在建设中</div>
          )}
        </div>

        {rightCollapsed ? null : (
          <aside className="w-full shrink-0 xl:w-80">
            <div className="space-y-3">
              <article className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-900">项目概览</h3>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">阶段</span>
                    <span>{stage}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">负责人</span>
                    <span>{owner}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">任务数</span>
                    <span>{localTasks.length}</span>
                  </div>
                </div>
              </article>
            </div>
          </aside>
        )}
      </div>
    </section>
  )
}
