import {
  Check,
  ChevronRight,
  FileText,
  Plus,
  Upload,
  X,
} from 'lucide-react'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
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

type DocSourceTab = '资料库' | '上传文件' | '粘贴文本'

type DocSourceEntry = {
  sourceTab: DocSourceTab
  libraryDb: string
  librarySelectedItems: string[]
  uploadedFiles: { id: string; name: string; size: number }[]
  pastedTexts: { id: string; text: string }[]
  trainingRequirements: { id: string; text: string }[]
  remark: string
}

type DocSourceKind = '政策' | '指令' | '岗位' | '日常'

type SurveyKind = '问卷' | '访谈' | '座谈'

type SurveyEntry = {
  topic: string
  items: { id: string; text: string }[]
  targetScope: string
  planDate: string
  responsible: string
  execution: string
  findings: string
  trainingRequirements: { id: string; text: string }[]
  remark: string
}

type ScheduleItem = { id: string; topic: string; date: string; format: string }

type PlanEntry = {
  planName: string
  periodStart: string
  periodEnd: string
  scope: string
  scheduleItems: ScheduleItem[]
  trainingRequirements: { id: string; text: string }[]
  remark: string
}

type ReviewEntry = {
  selectedHistory: string
  completion: string
  problems: string
  suggestions: string
  trainingRequirements: { id: string; text: string }[]
  remark: string
}

type CustomEntry = {
  name: string
  sourceDesc: string
  trainingRequirements: { id: string; text: string }[]
  remark: string
}

type DemandDetail =
  | ({ kind: '政策' } & DocSourceEntry)
  | ({ kind: '指令' } & DocSourceEntry)
  | ({ kind: '岗位' } & DocSourceEntry)
  | ({ kind: '计划' } & PlanEntry)
  | ({ kind: '日常' } & DocSourceEntry)
  | ({ kind: '问卷' } & SurveyEntry)
  | ({ kind: '访谈' } & SurveyEntry)
  | ({ kind: '座谈' } & SurveyEntry)
  | ({ kind: '复盘' } & ReviewEntry)
  | ({ kind: '自定义' } & CustomEntry)

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

function createEmptyDemandDetail(kind: DemandMethodKind, label: string): DemandDetail {
  if (kind === '政策' || kind === '指令' || kind === '岗位' || kind === '日常') {
    return {
      kind,
      sourceTab: '资料库' as const,
      libraryDb: '',
      librarySelectedItems: [],
      uploadedFiles: [],
      pastedTexts: [],
      trainingRequirements: [],
      remark: '',
    }
  }
  if (kind === '计划') {
    return {
      kind,
      planName: '',
      periodStart: '',
      periodEnd: '',
      scope: '',
      scheduleItems: [
        { id: 'si-mock-1', topic: '年度反洗钱基础知识培训', date: '', format: '集中培训' },
        { id: 'si-mock-2', topic: '合规操作规程考核测评', date: '', format: '考试测评' },
      ],
      trainingRequirements: [],
      remark: '',
    }
  }
  if (kind === '问卷' || kind === '访谈' || kind === '座谈') {
    return {
      kind,
      topic: '',
      items: [],
      targetScope: '',
      planDate: '',
      responsible: '',
      execution: '',
      findings: '',
      trainingRequirements: [],
      remark: '',
    }
  }
  if (kind === '复盘') {
    return {
      kind,
      selectedHistory: '',
      completion: '',
      problems: '',
      suggestions: '',
      trainingRequirements: [],
      remark: '',
    }
  }
  return {
    kind: '自定义',
    name: label,
    sourceDesc: '',
    trainingRequirements: [{ id: `req-${Date.now()}`, text: '' }],
    remark: '',
  }
}

const MOCK_CONVERTED_COUNT: Record<string, number> = {
  policy: 2,
  directive: 0,
  role: 1,
  daily: 0,
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

const DOC_SOURCE_MOCK_REQS: Record<DocSourceKind, string[]> = {
  政策: ['了解反洗钱法最新修订内容', '掌握客户身份识别流程', '熟悉可疑交易报告规范'],
  指令: ['理解监管指令核心要求', '落实合规整改具体事项', '建立合规跟踪与反馈机制'],
  岗位: ['识别本岗位主要合规风险点', '掌握岗位日常操作规范', '了解违规行为处理流程'],
  日常: ['熟悉日常合规操作要点', '掌握问题发现与上报流程', '了解违规案例与警示教训'],
}

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
  if ('trainingRequirements' in detail) return (detail as any).trainingRequirements as { id: string; text: string }[]
  return []
}

// ── Plan / Review / Custom mock data ─────────────────────────────────────────

const PLAN_MOCK_REQS = ['梳理全年合规培训重点方向', '建立分层分类培训体系', '制定各阶段考核标准']

const REVIEW_HISTORY_OPTIONS = [
  '2024年反洗钱合规培训（已归档）',
  '2024年新员工入职培训（已归档）',
  '2023年操作规程专项培训（已归档）',
  '2023年年度综合培训（已归档）',
]

type HistoryCard = { date: string; count: number; rate: number; issues: string[] }
const REVIEW_HISTORY_CARDS: Record<string, HistoryCard> = {
  '2024年反洗钱合规培训（已归档）': { date: '2024-09', count: 186, rate: 94, issues: ['部分员工对可疑交易判断标准理解不清', '线上学习平台操作不熟练'] },
  '2024年新员工入职培训（已归档）': { date: '2024-03', count: 42, rate: 100, issues: ['新员工对内控流程掌握程度有限', '实操演练时间不足'] },
  '2023年操作规程专项培训（已归档）': { date: '2023-11', count: 210, rate: 88, issues: ['操作规程记忆效果一般，需反复复习', '考核通过率偏低，需加强辅导'] },
  '2023年年度综合培训（已归档）': { date: '2023-06', count: 230, rate: 92, issues: ['培训时间过于集中，学员吸收效果有限', '考试题库未能覆盖新法规内容'] },
}

const REVIEW_MOCK_REQS = ['针对上次薄弱环节加强专项培训', '优化培训形式提升参与度', '建立培训效果跟踪机制']

const SCHEDULE_FORMATS = ['集中培训', '在线学习', '考试测评', '其他'] as const

// ── Shared inner component: requirement list block ────────────────────────────

function ReqListBlock({
  reqs,
  onChange,
  onExtract,
  extractLabel,
}: {
  reqs: { id: string; text: string }[]
  onChange: (next: { id: string; text: string }[]) => void
  onExtract?: () => void
  extractLabel?: string
}) {
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 p-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-slate-700">培训需求</span>
        {onExtract && (
          <button
            type="button"
            onClick={onExtract}
            className="inline-flex items-center gap-1 rounded bg-blue-600 px-2.5 py-1 text-xs text-white hover:bg-blue-700"
          >
            ✨ {extractLabel ?? '提取培训需求'}
          </button>
        )}
      </div>
      <div className="space-y-2">
        {reqs.map((req, idx) => (
          <div key={req.id} className="flex items-center gap-2">
            <span className="w-5 shrink-0 text-center text-xs text-slate-400">{idx + 1}</span>
            <input
              value={req.text}
              onChange={(e) => {
                const v = e.target.value
                onChange(reqs.map((r) => (r.id === req.id ? { ...r, text: v } : r)))
              }}
              className="flex-1 rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-100"
              placeholder={`需求条目 ${idx + 1}`}
            />
            <button
              type="button"
              onClick={() => onChange(reqs.filter((r) => r.id !== req.id))}
              className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-slate-400 hover:border-red-200 hover:text-red-500"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...reqs, { id: `req-${Date.now()}-${Math.random().toString(36).slice(2)}`, text: '' }])}
        className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700"
      >
        <Plus className="h-3.5 w-3.5" />
        新增需求
      </button>
    </div>
  )
}

// ── Shared overlay wrapper ─────────────────────────────────────────────────────

function DialogOverlay({
  title,
  onClose,
  onSave,
  children,
}: {
  title: string
  onClose: () => void
  onSave: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
      <div className="flex w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl" style={{ maxHeight: '90vh' }}>
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">{children}</div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-200 px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onSave}
            className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

// ── TrainingPlanDialog ────────────────────────────────────────────────────────

type PlanDraft = { kind: '计划' } & PlanEntry

function TrainingPlanDialog({
  draft,
  onClose,
  onSave,
}: {
  draft: PlanDraft
  onClose: () => void
  onSave: (d: PlanDraft) => void
}) {
  const [local, setLocal] = useState<PlanDraft>(draft)
  const inputCls = 'w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-100'
  const labelCls = 'block text-sm font-medium text-slate-700'

  return (
    <DialogOverlay title="年度计划" onClose={onClose} onSave={() => onSave(local)}>
      {/* 基本信息 */}
      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-800">基本信息</h4>
        <div className="space-y-1.5">
          <label className={labelCls}>计划名称</label>
          <input
            value={local.planName}
            onChange={(e) => setLocal({ ...local, planName: e.target.value })}
            placeholder="如：2025年度合规培训计划"
            className={inputCls}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className={labelCls}>开始日期</label>
            <input
              type="date"
              value={local.periodStart}
              onChange={(e) => setLocal({ ...local, periodStart: e.target.value })}
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>结束日期</label>
            <input
              type="date"
              value={local.periodEnd}
              onChange={(e) => setLocal({ ...local, periodEnd: e.target.value })}
              className={inputCls}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>覆盖范围</label>
          <textarea
            value={local.scope}
            onChange={(e) => setLocal({ ...local, scope: e.target.value })}
            rows={2}
            placeholder="如：全员 / 合规部 / 新入职员工…"
            className={`${inputCls} resize-none`}
          />
        </div>
      </section>

      {/* 培训安排 */}
      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-800">培训安排</h4>
        <div className="space-y-2">
          {local.scheduleItems.map((item, idx) => (
            <div key={item.id} className="space-y-2 rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">项目 {idx + 1}</span>
                <button
                  type="button"
                  onClick={() => setLocal({ ...local, scheduleItems: local.scheduleItems.filter((it) => it.id !== item.id) })}
                  className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:text-red-500"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <input
                value={item.topic}
                onChange={(e) => {
                  const v = e.target.value
                  setLocal({ ...local, scheduleItems: local.scheduleItems.map((it) => (it.id === item.id ? { ...it, topic: v } : it)) })
                }}
                placeholder="培训主题"
                className={inputCls}
              />
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <span className="text-xs text-slate-500">预计时间</span>
                  <input
                    type="date"
                    value={item.date}
                    onChange={(e) => {
                      const v = e.target.value
                      setLocal({ ...local, scheduleItems: local.scheduleItems.map((it) => (it.id === item.id ? { ...it, date: v } : it)) })
                    }}
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-slate-500">培训形式</span>
                  <select
                    value={item.format}
                    onChange={(e) => {
                      const v = e.target.value
                      setLocal({ ...local, scheduleItems: local.scheduleItems.map((it) => (it.id === item.id ? { ...it, format: v } : it)) })
                    }}
                    className={inputCls}
                  >
                    {SCHEDULE_FORMATS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            setLocal({
              ...local,
              scheduleItems: [
                ...local.scheduleItems,
                { id: `si-${Date.now()}-${Math.random().toString(36).slice(2)}`, topic: '', date: '', format: '集中培训' },
              ],
            })
          }
          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700"
        >
          <Plus className="h-3.5 w-3.5" />
          添加培训项目
        </button>
      </section>

      {/* 培训需求 */}
      <ReqListBlock
        reqs={local.trainingRequirements}
        onChange={(next) => setLocal({ ...local, trainingRequirements: next })}
        onExtract={() => {
          const count = 2 + Math.floor(Math.random() * 2)
          setLocal({
            ...local,
            trainingRequirements: PLAN_MOCK_REQS.slice(0, count).map((t) => ({
              id: `req-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              text: t,
            })),
          })
        }}
      />

      {/* 备注 */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-slate-700">备注（选填）</label>
        <textarea
          value={local.remark}
          onChange={(e) => setLocal({ ...local, remark: e.target.value })}
          rows={2}
          placeholder="补充说明…"
          className={`${inputCls} resize-none`}
        />
      </div>
    </DialogOverlay>
  )
}

// ── TrainingReviewDialog ──────────────────────────────────────────────────────

type ReviewDraft = { kind: '复盘' } & ReviewEntry

function TrainingReviewDialog({
  draft,
  onClose,
  onSave,
}: {
  draft: ReviewDraft
  onClose: () => void
  onSave: (d: ReviewDraft) => void
}) {
  const [local, setLocal] = useState<ReviewDraft>(draft)
  const inputCls = 'w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-100'
  const textareaCls = `${inputCls} resize-none`
  const labelCls = 'block text-sm font-medium text-slate-700'
  const card = local.selectedHistory ? REVIEW_HISTORY_CARDS[local.selectedHistory] : null

  return (
    <DialogOverlay title="复盘参考" onClose={onClose} onSave={() => onSave(local)}>
      {/* 关联历史培训 */}
      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-800">关联历史培训</h4>
        <p className="text-xs text-slate-500">选择同类型历史培训作为复盘参考</p>
        <select
          value={local.selectedHistory}
          onChange={(e) => setLocal({ ...local, selectedHistory: e.target.value })}
          className={inputCls}
        >
          <option value="">-- 请选择历史培训 --</option>
          {REVIEW_HISTORY_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        {card ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <span className="text-xs text-slate-500">培训时间</span>
                <div className="font-medium text-slate-800">{card.date}</div>
              </div>
              <div>
                <span className="text-xs text-slate-500">参与人数</span>
                <div className="font-medium text-slate-800">{card.count} 人</div>
              </div>
              <div>
                <span className="text-xs text-slate-500">完成率</span>
                <div className="font-medium text-slate-800">{card.rate}%</div>
              </div>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full ${card.rate === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                style={{ width: `${card.rate}%` }}
              />
            </div>
            <div>
              <span className="text-xs text-slate-500">主要问题</span>
              <ul className="mt-1 space-y-1">
                {card.issues.map((issue, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-sm text-slate-700">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </section>

      {/* 复盘分析 */}
      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-800">复盘分析</h4>
        <div className="space-y-1.5">
          <label className={labelCls}>完成情况评估</label>
          <textarea value={local.completion} onChange={(e) => setLocal({ ...local, completion: e.target.value })} rows={3} placeholder="上次培训的整体完成情况…" className={textareaCls} />
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>存在问题</label>
          <textarea value={local.problems} onChange={(e) => setLocal({ ...local, problems: e.target.value })} rows={3} placeholder="上次培训发现的主要问题…" className={textareaCls} />
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>改进建议</label>
          <textarea value={local.suggestions} onChange={(e) => setLocal({ ...local, suggestions: e.target.value })} rows={3} placeholder="针对问题提出的改进方向…" className={textareaCls} />
        </div>
      </section>

      {/* 培训需求 */}
      <ReqListBlock
        reqs={local.trainingRequirements}
        onChange={(next) => setLocal({ ...local, trainingRequirements: next })}
        onExtract={() => {
          const count = 2 + Math.floor(Math.random() * 2)
          setLocal({
            ...local,
            trainingRequirements: REVIEW_MOCK_REQS.slice(0, count).map((t) => ({
              id: `req-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              text: t,
            })),
          })
        }}
        extractLabel="根据复盘提取需求"
      />

      {/* 备注 */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-slate-700">备注（选填）</label>
        <textarea value={local.remark} onChange={(e) => setLocal({ ...local, remark: e.target.value })} rows={2} placeholder="补充说明…" className={textareaCls} />
      </div>
    </DialogOverlay>
  )
}

// ── CustomDemandDialog ────────────────────────────────────────────────────────

type CustomDraft = { kind: '自定义' } & CustomEntry

function CustomDemandDialog({
  draft,
  onClose,
  onSave,
}: {
  draft: CustomDraft
  onClose: () => void
  onSave: (d: CustomDraft) => void
}) {
  const [local, setLocal] = useState<CustomDraft>(draft)
  const inputCls = 'w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-100'

  return (
    <DialogOverlay title="自定义需求" onClose={onClose} onSave={() => onSave(local)}>
      {/* 来源说明 */}
      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-800">来源说明</h4>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700">来源描述</label>
          <input
            value={local.sourceDesc}
            onChange={(e) => setLocal({ ...local, sourceDesc: e.target.value })}
            placeholder="简述该需求的来源背景…"
            className={inputCls}
          />
        </div>
      </section>

      {/* 培训需求 */}
      <ReqListBlock reqs={local.trainingRequirements} onChange={(next) => setLocal({ ...local, trainingRequirements: next })} />

      {/* 备注 */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-slate-700">备注（选填）</label>
        <textarea
          value={local.remark}
          onChange={(e) => setLocal({ ...local, remark: e.target.value })}
          rows={2}
          placeholder="补充说明…"
          className={`${inputCls} resize-none`}
        />
      </div>
    </DialogOverlay>
  )
}


// ── Survey mock data ──────────────────────────────────────────────────────────

const SURVEY_STEPS: Record<SurveyKind, [string, string, string]> = {
  问卷: ['设计问卷', '发放安排', '回收总结'],
  访谈: ['访谈提纲', '访谈安排', '访谈总结'],
  座谈: ['议题设置', '会议安排', '会议总结'],
}

const SURVEY_ITEM_LABELS: Record<SurveyKind, string> = {
  问卷: '问题列表',
  访谈: '访谈问题/提纲',
  座谈: '议题列表',
}

const SURVEY_TARGET_LABELS: Record<SurveyKind, string> = {
  问卷: '发放范围',
  访谈: '访谈对象',
  座谈: '参与人员',
}

const SURVEY_TARGET_PLACEHOLDERS: Record<SurveyKind, string> = {
  问卷: '如：全体员工 / 合规部门 / 指定名单…',
  访谈: '如：各部门负责人、新入职员工…',
  座谈: '如：部门代表、管理层…',
}

const SURVEY_MOCK_REQS: Record<SurveyKind, string[]> = {
  问卷: ['员工对合规流程理解存在偏差', '需加强反洗钱实操培训', '新员工入职培训需系统化'],
  访谈: ['中层管理者需提升合规意识', '部门间协作流程不清晰', '需针对岗位设计差异化课程'],
  座谈: ['现有培训形式参与度低', '建议增加案例讨论环节', '需定期复盘培训效果'],
}

type SurveyDraft = { kind: SurveyKind } & SurveyEntry

function SurveyActivityDialog({
  draft,
  onClose,
  onSave,
}: {
  draft: SurveyDraft
  onClose: () => void
  onSave: (d: SurveyDraft) => void
}) {
  const kind = draft.kind
  const [step, setStep] = useState(1)
  const [local, setLocal] = useState<SurveyDraft>(draft)
  const steps = SURVEY_STEPS[kind]
  const mockReqs = SURVEY_MOCK_REQS[kind]

  const inputCls = 'w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-100'
  const textareaCls = `${inputCls} resize-none`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
      <div className="flex w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl" style={{ maxHeight: '90vh' }}>
        {/* Title row */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">{kind}详情</h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step bar */}
        <div className="flex shrink-0 items-center border-b border-slate-100 px-5 py-3">
          {steps.map((label, i) => {
            const num = i + 1
            const done = num < step
            const current = num === step
            return (
              <div key={num} className="flex items-center">
                <div className="flex items-center gap-1.5">
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                      done
                        ? 'bg-emerald-500 text-white'
                        : current
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-200 text-slate-400'
                    }`}
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : num}
                  </div>
                  <span
                    className={`text-sm transition-colors ${
                      current ? 'font-medium text-slate-900' : done ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  >
                    {label}
                  </span>
                </div>
                {i < 2 && <ChevronRight className="mx-2 h-3.5 w-3.5 shrink-0 text-slate-300" />}
              </div>
            )
          })}
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* ── Step 1: Topic + items ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">主题</label>
                <input
                  value={local.topic}
                  onChange={(e) => setLocal({ ...local, topic: e.target.value })}
                  placeholder={`请输入本次${kind}的主题…`}
                  className={inputCls}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">{SURVEY_ITEM_LABELS[kind]}</label>
                <div className="space-y-2">
                  {local.items.map((item, idx) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <span className="w-5 shrink-0 text-center text-xs text-slate-400">{idx + 1}</span>
                      <input
                        value={item.text}
                        onChange={(e) => {
                          const v = e.target.value
                          setLocal({ ...local, items: local.items.map((it) => (it.id === item.id ? { ...it, text: v } : it)) })
                        }}
                        className="flex-1 rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-100"
                        placeholder={`条目 ${idx + 1}`}
                      />
                      <button
                        type="button"
                        onClick={() => setLocal({ ...local, items: local.items.filter((it) => it.id !== item.id) })}
                        className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-slate-400 hover:border-red-200 hover:text-red-500"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      setLocal({
                        ...local,
                        items: [...local.items, { id: `item-${Date.now()}-${Math.random().toString(36).slice(2)}`, text: '' }],
                      })
                    }
                    className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {kind === '问卷' ? '添加问题' : kind === '访谈' ? '添加条目' : '添加议题'}
                  </button>
                  <button
                    type="button"
                    disabled
                    className="inline-flex cursor-not-allowed items-center gap-1.5 rounded border border-slate-200 px-3 py-1.5 text-xs text-slate-400"
                  >
                    ✨ AI辅助生成（即将上线）
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Target + date + owner ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">{SURVEY_TARGET_LABELS[kind]}</label>
                <textarea
                  value={local.targetScope}
                  onChange={(e) => setLocal({ ...local, targetScope: e.target.value })}
                  rows={3}
                  placeholder={SURVEY_TARGET_PLACEHOLDERS[kind]}
                  className={textareaCls}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">计划时间</label>
                  <input
                    type="date"
                    value={local.planDate}
                    onChange={(e) => setLocal({ ...local, planDate: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">负责人</label>
                  <input
                    value={local.responsible}
                    onChange={(e) => setLocal({ ...local, responsible: e.target.value })}
                    placeholder="请填写负责人姓名"
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Execution + findings + requirements ── */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">执行情况</label>
                <textarea
                  value={local.execution}
                  onChange={(e) => setLocal({ ...local, execution: e.target.value })}
                  rows={3}
                  placeholder="简述执行过程、参与情况…"
                  className={textareaCls}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">关键发现</label>
                <textarea
                  value={local.findings}
                  onChange={(e) => setLocal({ ...local, findings: e.target.value })}
                  rows={3}
                  placeholder="记录重要反馈和发现…"
                  className={textareaCls}
                />
              </div>

              {/* Training requirements */}
              <div className="space-y-3 rounded-lg border border-slate-200 p-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-700">培训需求</span>
                  <button
                    type="button"
                    onClick={() => {
                      const count = 2 + Math.floor(Math.random() * 2)
                      const reqs = mockReqs.slice(0, count).map((t) => ({
                        id: `req-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                        text: t,
                      }))
                      setLocal({ ...local, trainingRequirements: reqs })
                    }}
                    className="inline-flex items-center gap-1 rounded bg-blue-600 px-2.5 py-1 text-xs text-white hover:bg-blue-700"
                  >
                    ✨ 提取培训需求
                  </button>
                </div>
                <div className="space-y-2">
                  {local.trainingRequirements.map((req, idx) => (
                    <div key={req.id} className="flex items-center gap-2">
                      <span className="w-5 shrink-0 text-center text-xs text-slate-400">{idx + 1}</span>
                      <input
                        value={req.text}
                        onChange={(e) => {
                          const v = e.target.value
                          setLocal({
                            ...local,
                            trainingRequirements: local.trainingRequirements.map((r) => (r.id === req.id ? { ...r, text: v } : r)),
                          })
                        }}
                        className="flex-1 rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-100"
                        placeholder={`需求条目 ${idx + 1}`}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setLocal({
                            ...local,
                            trainingRequirements: local.trainingRequirements.filter((r) => r.id !== req.id),
                          })
                        }
                        className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-slate-400 hover:border-red-200 hover:text-red-500"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setLocal({
                      ...local,
                      trainingRequirements: [
                        ...local.trainingRequirements,
                        { id: `req-${Date.now()}-${Math.random().toString(36).slice(2)}`, text: '' },
                      ],
                    })
                  }
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  新增需求
                </button>
              </div>

              {/* Remark */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">备注（选填）</label>
                <textarea
                  value={local.remark}
                  onChange={(e) => setLocal({ ...local, remark: e.target.value })}
                  rows={2}
                  placeholder="补充说明…"
                  className={textareaCls}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-slate-200 px-5 py-3">
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                上一步
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              取消
            </button>
            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                下一步
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onSave(local)}
                className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
              >
                完成
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


function DocumentSourcePanel({
  draft,
  onChange,
  fileInputRef,
  onToast,
}: {
  draft: DocSourceEntry & { kind: DocSourceKind }
  onChange: (d: DocSourceEntry & { kind: DocSourceKind }) => void
  fileInputRef: MutableRefObject<HTMLInputElement | null>
  onToast: (msg: string) => void
}) {
  const [pasteInput, setPasteInput] = useState('')
  const mockReqs = DOC_SOURCE_MOCK_REQS[draft.kind] ?? []
  const selectedDb = LIBRARY_DBS.find((db) => db.id === draft.libraryDb)

  return (
    <div className="space-y-5">
      {/* 信息来源 */}
      <div className="space-y-3">
        <div className="text-sm font-medium text-slate-700">信息来源</div>
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          {(
            [
              { key: '资料库' as const, icon: '📁', label: '系统资料库' },
              { key: '上传文件' as const, icon: '⬆', label: '上传文件' },
              { key: '粘贴文本' as const, icon: '📋', label: '粘贴文本' },
            ] as const
          ).map(({ key, icon, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => onChange({ ...draft, sourceTab: key })}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                draft.sourceTab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {/* ── Tab 1: 系统资料库（两步选择） ── */}
        {draft.sourceTab === '资料库' ? (
          <div className="space-y-3">
            <select
              value={draft.libraryDb}
              onChange={(e) => onChange({ ...draft, libraryDb: e.target.value, librarySelectedItems: [] })}
              className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-300"
            >
              <option value="">— 选择数据库 —</option>
              {LIBRARY_DBS.map((db) => (
                <option key={db.id} value={db.id}>
                  {db.name}
                </option>
              ))}
            </select>

            {selectedDb ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 text-xs text-slate-500">
                  {selectedDb.name}（{selectedDb.items.length} 条记录）
                </div>
                <div className="space-y-1.5">
                  {selectedDb.items.map((item) => {
                    const checked = draft.librarySelectedItems.includes(item)
                    return (
                      <label key={item} className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const next = checked
                              ? draft.librarySelectedItems.filter((x) => x !== item)
                              : [...draft.librarySelectedItems, item]
                            onChange({ ...draft, librarySelectedItems: next })
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

            {draft.librarySelectedItems.length > 0 ? (
              <div className="space-y-1.5">
                <div className="text-xs text-slate-500">已选 {draft.librarySelectedItems.length} 条</div>
                <div className="flex flex-wrap gap-1.5">
                  {draft.librarySelectedItems.map((item) => (
                    <span key={item} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700">
                      {item}
                      <button
                        type="button"
                        onClick={() => onChange({ ...draft, librarySelectedItems: draft.librarySelectedItems.filter((x) => x !== item) })}
                        className="hover:text-blue-900"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : /* ── Tab 2: 上传文件（多文件） ── */ draft.sourceTab === '上传文件' ? (
          <div className="space-y-2">
            {draft.uploadedFiles.length > 0 ? (
              <div className="space-y-1.5">
                {draft.uploadedFiles.map((f) => (
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
                      onClick={() => onChange({ ...draft, uploadedFiles: draft.uploadedFiles.filter((x) => x.id !== f.id) })}
                      className="ml-2 shrink-0 rounded border border-slate-200 p-1 text-slate-400 hover:bg-white hover:text-slate-700"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 py-6 text-sm text-slate-500 hover:border-blue-300 hover:bg-blue-50"
            >
              <Upload className="h-5 w-5" />
              <span>点击或拖拽文件到此处</span>
              <span className="text-xs text-slate-400">支持多选 · .pdf .doc .docx .txt · 每个最大 10MB</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? [])
                const valid = files.filter((f) => f.size <= 10 * 1024 * 1024)
                if (valid.length < files.length) onToast('部分文件超过 10MB，已忽略')
                if (valid.length === 0) { e.target.value = ''; return }
                const entries = valid.map((f) => ({ id: `file-${Date.now()}-${Math.random().toString(36).slice(2)}`, name: f.name, size: f.size }))
                onChange({ ...draft, uploadedFiles: [...draft.uploadedFiles, ...entries] })
                e.target.value = ''
              }}
            />
          </div>
        ) : (
          /* ── Tab 3: 粘贴文本（多卡片） ── */
          <div className="space-y-2">
            {draft.pastedTexts.length > 0 ? (
              <div className="space-y-2">
                {draft.pastedTexts.map((card) => (
                  <div key={card.id} className="relative rounded-lg border border-slate-200 bg-slate-50 p-3 pr-8">
                    <p className="whitespace-pre-wrap text-sm text-slate-700">{card.text}</p>
                    <button
                      type="button"
                      onClick={() => onChange({ ...draft, pastedTexts: draft.pastedTexts.filter((x) => x.id !== card.id) })}
                      className="absolute right-2 top-2 text-slate-400 hover:text-slate-700"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <textarea
              value={pasteInput}
              onChange={(e) => setPasteInput(e.target.value)}
              rows={5}
              placeholder="请粘贴相关文字内容…"
              className="w-full resize-none rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
            />
            <button
              type="button"
              onClick={() => {
                const text = pasteInput.trim()
                if (!text) return
                onChange({ ...draft, pastedTexts: [...draft.pastedTexts, { id: `paste-${Date.now()}`, text }] })
                setPasteInput('')
              }}
              className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              添加这段文本
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            const count = 2 + Math.floor(Math.random() * 2)
            const reqs = mockReqs.slice(0, count).map((t) => ({ id: `req-${Date.now()}-${Math.random().toString(36).slice(2)}`, text: t }))
            onChange({ ...draft, trainingRequirements: reqs })
          }}
          className="inline-flex items-center gap-1.5 rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
        >
          ✨ 提取培训需求
        </button>
      </div>

      <div className="border-t border-slate-100" />

      {/* 培训需求 */}
      <div className="space-y-3">
        <div className="text-sm font-medium text-slate-700">培训需求</div>
        <div className="space-y-2">
          {draft.trainingRequirements.length === 0 ? (
            <div className="rounded border border-dashed border-slate-200 bg-slate-50 py-3 text-center text-sm text-slate-400">
              暂无需求，可点击「提取培训需求」自动生成或手动新增
            </div>
          ) : (
            draft.trainingRequirements.map((req, idx) => (
              <div key={req.id} className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-center text-xs text-slate-400">{idx + 1}</span>
                <input
                  value={req.text}
                  onChange={(e) => {
                    const v = e.target.value
                    onChange({
                      ...draft,
                      trainingRequirements: draft.trainingRequirements.map((r) => (r.id === req.id ? { ...r, text: v } : r)),
                    })
                  }}
                  placeholder="输入培训需求条目"
                  className="flex-1 rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                />
                <button
                  type="button"
                  onClick={() => onChange({ ...draft, trainingRequirements: draft.trainingRequirements.filter((r) => r.id !== req.id) })}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
        <button
          type="button"
          onClick={() =>
            onChange({ ...draft, trainingRequirements: [...draft.trainingRequirements, { id: `req-${Date.now()}`, text: '' }] })
          }
          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700"
        >
          <Plus className="h-3.5 w-3.5" />
          新增需求
        </button>
      </div>

      <div className="border-t border-slate-100" />

      {/* 备注 */}
      <div className="space-y-1.5">
        <div className="text-sm font-medium text-slate-700">备注（选填）</div>
        <textarea
          value={draft.remark}
          onChange={(e) => onChange({ ...draft, remark: e.target.value })}
          rows={2}
          placeholder="补充说明…"
          className="w-full resize-none rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
        />
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
  const docSourceFileInputRef = useRef<HTMLInputElement | null>(null)
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
  const [progressPopoverId, setProgressPopoverId] = useState<string | null>(null)
  const [surveyDialogOptId, setSurveyDialogOptId] = useState<string | null>(null)
  const [planDialogOptId, setPlanDialogOptId] = useState<string | null>(null)
  const [reviewDialogOptId, setReviewDialogOptId] = useState<string | null>(null)
  const [customDialogOptId, setCustomDialogOptId] = useState<string | null>(null)
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
              <div className="text-sm font-semibold text-slate-900">需求来源</div>
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
              <table className="w-full min-w-[540px] text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-600">
                  <tr>
                    <th className="w-10 px-3 py-2 font-medium">序号</th>
                    <th className="px-3 py-2 font-medium">来源</th>
                    <th className="w-16 px-3 py-2 font-medium">需求数</th>
                    <th className="px-3 py-2 font-medium">关键词</th>
                    <th className="px-3 py-2 font-medium">转化进度</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
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
                          <tr key={opt.id} className="hover:bg-slate-50/50">
                            <td className="px-3 py-2.5 text-slate-500">{idx + 1}</td>
                            <td className="px-3 py-2.5">
                              <button
                                type="button"
                                onClick={() => {
                                  const current = demandMatrix[opt.id]
                                  if (!current) return
                                  if (row.kind === '问卷' || row.kind === '访谈' || row.kind === '座谈') {
                                    setSurveyDialogOptId(opt.id)
                                  } else if (row.kind === '计划') {
                                    setPlanDialogOptId(opt.id)
                                  } else if (row.kind === '复盘') {
                                    setReviewDialogOptId(opt.id)
                                  } else if (row.kind === '自定义') {
                                    setCustomDialogOptId(opt.id)
                                  } else {
                                    setDemandDetailOptionId(opt.id)
                                    setDemandDetailDraft(JSON.parse(JSON.stringify(current.detail)) as DemandDetail)
                                    setDemandDetailOpen(true)
                                  }
                                }}
                                className="cursor-pointer text-sm text-slate-800 underline decoration-slate-300 hover:text-blue-600 hover:decoration-blue-400"
                              >
                                {row.label}
                              </button>
                            </td>
                            <td className="px-3 py-2.5 text-slate-600">
                              {reqCount > 0 ? `${reqCount} 条` : '—'}
                            </td>
                            <td className="px-3 py-2.5">
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
                            <td className="px-3 py-2.5">
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
            {(demandDetailDraft.kind === '政策' ||
              demandDetailDraft.kind === '指令' ||
              demandDetailDraft.kind === '岗位' ||
              demandDetailDraft.kind === '日常') ? (
              <DocumentSourcePanel
                draft={demandDetailDraft}
                onChange={(d) => setDemandDetailDraft(d as DemandDetail)}
                fileInputRef={docSourceFileInputRef}
                onToast={showToast}
              />
            ) : null}

          </div>
        ) : null}
      </Modal>

      {/* ── SurveyActivityDialog for B-type tags ── */}
      {surveyDialogOptId !== null && demandMatrix[surveyDialogOptId] ? (
        <SurveyActivityDialog
          draft={demandMatrix[surveyDialogOptId].detail as SurveyDraft}
          onClose={() => setSurveyDialogOptId(null)}
          onSave={(d) => {
            const optId = surveyDialogOptId
            setDemandMatrix((prev) => ({
              ...prev,
              [optId]: { ...prev[optId], detail: d },
            }))
            setSurveyDialogOptId(null)
          }}
        />
      ) : null}

      {/* ── TrainingPlanDialog for 计划 ── */}
      {planDialogOptId !== null && demandMatrix[planDialogOptId] ? (
        <TrainingPlanDialog
          draft={demandMatrix[planDialogOptId].detail as PlanDraft}
          onClose={() => setPlanDialogOptId(null)}
          onSave={(d) => {
            const optId = planDialogOptId
            setDemandMatrix((prev) => ({
              ...prev,
              [optId]: { ...prev[optId], detail: d },
            }))
            setPlanDialogOptId(null)
          }}
        />
      ) : null}

      {/* ── TrainingReviewDialog for 复盘 ── */}
      {reviewDialogOptId !== null && demandMatrix[reviewDialogOptId] ? (
        <TrainingReviewDialog
          draft={demandMatrix[reviewDialogOptId].detail as ReviewDraft}
          onClose={() => setReviewDialogOptId(null)}
          onSave={(d) => {
            const optId = reviewDialogOptId
            setDemandMatrix((prev) => ({
              ...prev,
              [optId]: { ...prev[optId], detail: d },
            }))
            setReviewDialogOptId(null)
          }}
        />
      ) : null}

      {/* ── CustomDemandDialog for 自定义 ── */}
      {customDialogOptId !== null && demandMatrix[customDialogOptId] ? (
        <CustomDemandDialog
          draft={demandMatrix[customDialogOptId].detail as CustomDraft}
          onClose={() => setCustomDialogOptId(null)}
          onSave={(d) => {
            const optId = customDialogOptId
            setDemandMatrix((prev) => ({
              ...prev,
              [optId]: { ...prev[optId], detail: d },
            }))
            setCustomDialogOptId(null)
          }}
        />
      ) : null}
    </section>
  )
}
