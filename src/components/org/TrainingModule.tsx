import { ChevronRight, Download, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '../shared/Modal'

export function TrainingModule() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([])

  const [view, setView] = useState<'kanban' | 'list' | 'calendar' | 'materials'>('kanban')
  const [typeFilter, setTypeFilter] = useState<string>('全部')
  const [ownerFilter, setOwnerFilter] = useState<string>('全部')
  const [createOpen, setCreateOpen] = useState(false)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [createName, setCreateName] = useState('')
  const [createOwner, setCreateOwner] = useState('')
  const [createPlanDate, setCreatePlanDate] = useState('')
  const [createTarget, setCreateTarget] = useState('')
  const [createSource, setCreateSource] = useState<'年度计划' | '临时触发'>('年度计划')

  const year = new Date().getFullYear()

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/workunit/list?type=%E5%9F%B9%E8%AE%AD')
        if (!res.ok) throw new Error(String(res.status))
        const data = await res.json()
        setRows((Array.isArray(data) ? data : Array.isArray((data as any)?.results) ? (data as any).results : []) as Array<Record<string, unknown>>)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const safeText = (value: unknown) => String(value ?? '').trim()
  const safeNumber = (value: unknown) => {
    const n = Number(value)
    return Number.isFinite(n) ? n : 0
  }
  const normalizeStage = (value: string) => {
    if (value === '课件制作') return '材料准备'
    if (value === '归档闭环') return '归档评估'
    return value
  }

  const trainingRows = useMemo(
    () =>
      rows
        .map((r) => ({
          id: safeText(r.id),
          name: safeText((r as any).name) || '未命名培训',
          type: safeText((r as any).type) || '培训',
          stage: normalizeStage(safeText((r as any).stage) || '需求立项'),
          source: safeText((r as any).source) || safeText((r as any).项目来源) || '',
          owner: safeText((r as any).owner) || '未指定',
          target: safeText((r as any).target) || '',
          progress: safeNumber((r as any).阶段完成度) || safeNumber((r as any).进度) || 0,
          planDate: safeText((r as any).planDate) || safeText((r as any).计划日期) || '',
          participants: safeNumber((r as any).participants) || 0,
          coverage: safeNumber((r as any).人员覆盖率) || safeNumber((r as any).覆盖率) || 0,
          satisfaction: safeNumber((r as any).satisfaction) || 0,
          status: safeText((r as any).status) || '',
        })),
    [rows],
  )

  const typeOptions = useMemo(() => {
    const set = new Set(trainingRows.map((r) => r.type).filter(Boolean))
    return ['全部', ...Array.from(set)]
  }, [trainingRows])

  const ownerOptions = useMemo(() => {
    const set = new Set(trainingRows.map((r) => r.owner).filter(Boolean))
    return ['全部', ...Array.from(set)]
  }, [trainingRows])

  const filteredRows = useMemo(
    () =>
      trainingRows
        .filter((r) => (typeFilter === '全部' ? true : r.type === typeFilter))
        .filter((r) => (ownerFilter === '全部' ? true : r.owner === ownerFilter)),
    [ownerFilter, trainingRows, typeFilter],
  )

  const stages = ['需求立项', '计划设计', '材料准备', '培训实施', '归档评估'] as const
  const stageCounts = useMemo(() => {
    const map = new Map<string, number>()
    stages.forEach((s) => map.set(s, 0))
    filteredRows.forEach((r) => map.set(r.stage, (map.get(r.stage) ?? 0) + 1))
    return map
  }, [filteredRows])

  const completed = useMemo(() => filteredRows.filter((r) => r.stage === '归档评估').length, [filteredRows])
  const inProgress = useMemo(() => filteredRows.filter((r) => r.stage !== '归档评估').length, [filteredRows])
  const planCount = filteredRows.length
  const completionRate = planCount === 0 ? 0 : Math.round((completed / planCount) * 100)
  const totalParticipants = useMemo(() => filteredRows.reduce((sum, r) => sum + r.participants, 0), [filteredRows])
  const avgCoverage = useMemo(() => {
    const list = filteredRows.map((r) => r.coverage).filter((n) => n > 0)
    if (list.length === 0) return 0
    return Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 100) / 100
  }, [filteredRows])
  const avgSatisfaction = useMemo(() => {
    const list = filteredRows.map((r) => r.satisfaction).filter((n) => n > 0)
    if (list.length === 0) return 0
    return Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 100) / 100
  }, [filteredRows])

  const reloadRows = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/workunit/list?type=%E5%9F%B9%E8%AE%AD')
      if (!res.ok) throw new Error(String(res.status))
      const data = await res.json()
      setRows((Array.isArray(data) ? data : Array.isArray((data as any)?.results) ? (data as any).results : []) as Array<Record<string, unknown>>)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span>组织类</span>
            <ChevronRight className="h-4 w-4" />
            <span>培训管理</span>
          </div>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">{year} 年度培训工作台</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => window.alert('Mock：导出报告')}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            导出报告
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            <Plus className="h-4 w-4" /> 发起培训
          </button>
        </div>
      </header>

      {loading ? <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">加载中...</div> : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">年度计划数</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{planCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">已完成数 / 完成率</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">
            {completed} <span className="text-sm text-slate-500">({completionRate}%)</span>
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">进行中数</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{inProgress}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">累计参训人次</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{totalParticipants}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">人员覆盖率</p>
          <div className="mt-2 h-2 w-full rounded bg-slate-100">
            <div className="h-2 rounded bg-blue-600" style={{ width: `${Math.min(100, Math.max(0, avgCoverage * 100))}%` }} />
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-900">{Math.round(avgCoverage * 100)}%</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">平均满意度评分</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{avgSatisfaction || '—'}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
          {([
            { key: 'kanban', label: '流水看板' },
            { key: 'list', label: '项目视图' },
            { key: 'calendar', label: '日历视图' },
            { key: 'materials', label: '材料仓库' },
          ] as const).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setView(item.key)}
              className={`rounded-lg px-3 py-2 text-sm ${
                view === item.key ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
          >
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                类型：{t}
              </option>
            ))}
          </select>
          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
          >
            {ownerOptions.map((t) => (
              <option key={t} value={t}>
                负责人：{t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {view === 'kanban' ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          {stages.map((stage) => (
            <article key={stage} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <h4 className="text-sm font-semibold text-slate-800">
                {stage}
                <span className="ml-2 rounded bg-white px-1.5 py-0.5 text-xs text-slate-500">{stageCounts.get(stage) ?? 0}</span>
              </h4>
              <div className="mt-3 space-y-2">
                {filteredRows
                  .filter((r) => r.stage === stage)
                  .map((r) => {
                    const active = r.status.includes('进行中') || stage === '培训实施'
                    return (
                      <div
                        key={r.id}
                        onClick={() => navigate(`/training/${r.id}`)}
                        className={`cursor-pointer rounded-lg border bg-white p-3 transition-shadow hover:shadow-sm ${
                          active ? 'border-blue-500' : 'border-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700">{r.type}</span>
                              {r.source ? (
                                <span
                                  className={`rounded-full px-2 py-0.5 text-xs ${
                                    r.source === '临时触发' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                                  }`}
                                >
                                  {r.source}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 truncate text-sm font-semibold text-slate-900">{r.name}</p>
                            {r.target ? <p className="mt-1 text-xs text-slate-500">目标对象：{r.target}</p> : null}
                          </div>
                        </div>

                        <div className="mt-2">
                          <div className="h-2 w-full rounded bg-slate-100">
                            <div
                              className="h-2 rounded bg-orange-500"
                              style={{ width: `${Math.min(100, Math.max(0, r.progress * 100 || 30))}%` }}
                            />
                          </div>
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                            <span>{r.planDate ? `计划日期：${r.planDate}` : '计划日期：—'}</span>
                            <span>负责人：{r.owner}</span>
                          </div>
                        </div>

                        {active ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                navigate(`/training/${r.id}`)
                              }}
                              className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
                            >
                              进入工作台 →
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                navigate(`/training/${r.id}?tab=materials`)
                              }}
                              className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                            >
                              查看材料
                            </button>
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                {filteredRows.filter((r) => r.stage === stage).length === 0 ? (
                  <div className="rounded border border-dashed border-slate-300 bg-white p-3 text-xs text-slate-400">暂无项目</div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">该视图正在建设中</div>
      )}

      <Modal
        open={createOpen}
        title="发起培训"
        onClose={() => (createSubmitting ? null : setCreateOpen(false))}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              disabled={createSubmitting}
            >
              取消
            </button>
            <button
              type="button"
              onClick={async () => {
                const name = createName.trim()
                if (!name) return
                setCreateSubmitting(true)
                setCreateError(null)
                try {
                  const res = await fetch('/api/workunit/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      name,
                      owner: createOwner.trim(),
                      target: createTarget.trim(),
                      planEndDate: createPlanDate || '',
                      source: createSource,
                    }),
                  })
                  if (!res.ok) throw new Error(String(res.status))
                  setCreateOpen(false)
                  setCreateName('')
                  setCreateOwner('')
                  setCreatePlanDate('')
                  setCreateTarget('')
                  setCreateSource('年度计划')
                  await reloadRows()
                } catch (e) {
                  setCreateError(e instanceof Error ? e.message : String(e))
                } finally {
                  setCreateSubmitting(false)
                }
              }}
              className={`rounded px-4 py-2 text-sm text-white ${createName.trim() ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-300'} ${
                createSubmitting ? 'cursor-not-allowed opacity-80' : ''
              }`}
              disabled={!createName.trim() || createSubmitting}
            >
              {createSubmitting ? '提交中...' : '确认发起'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium text-slate-700">项目名称</div>
            <input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
              placeholder="输入培训项目名称"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-700">负责人</div>
              <input
                value={createOwner}
                onChange={(e) => setCreateOwner(e.target.value)}
                className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                placeholder="输入负责人"
              />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-700">计划完成日期</div>
              <input
                type="date"
                value={createPlanDate}
                onChange={(e) => setCreatePlanDate(e.target.value)}
                className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium text-slate-700">项目来源</div>
            <select
              value={createSource}
              onChange={(e) => setCreateSource(e.target.value as any)}
              className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-300"
            >
              <option value="年度计划">年度计划</option>
              <option value="临时触发">临时触发</option>
            </select>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium text-slate-700">目标对象/参与范围</div>
            <textarea
              value={createTarget}
              onChange={(e) => setCreateTarget(e.target.value)}
              className="h-24 w-full resize-none rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
              placeholder="选填"
            />
          </div>
          {createError ? <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">发起失败：{createError}</div> : null}
        </div>
      </Modal>
    </section>
  )
}
