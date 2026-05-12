import { ArrowRight, Search, Send } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Dashboard() {
  const navigate = useNavigate()
  const [command, setCommand] = useState('')
  const [agentReply, setAgentReply] = useState('')
  const [assistantInput, setAssistantInput] = useState('')
  const [assistantMessages, setAssistantMessages] = useState<
    Array<{ id: string; role: 'ai' | 'user'; content: string; actionLabel?: string; actionTarget?: string }>
  >([
    {
      id: 'ai-1',
      role: 'ai',
      content:
        '早上好，张合规官。今日有 3 项紧急事项，\n包括 1 个制度即将到期、1 个整改本周截止、\n1 份 STR 报告未提交。高风险客户当前 8 人，\n较上月增加 2 人，建议优先复核。',
    },
    { id: 'user-1', role: 'user', content: '帮我分析本月可疑交易趋势' },
    {
      id: 'ai-2',
      role: 'ai',
      content:
        '本月共识别 3 笔可疑交易，总金额约 464.8 万元，\n较上月（2 笔）增加 50%。主要集中在\n「资金来源不明」和「跨境转账」两类。\n建议优先排查某科技有限公司（2.5M，高风险）。',
      actionLabel: '查看完整分析 →',
      actionTarget: '/ops/str',
    },
  ])

  const chips = [
    { label: '🕐 今日到期文件', reply: '今日到期文件：制度《客户身份识别管理制度》距到期 12 天，建议立即发起续期/修订流程。' },
    { label: '📊 生成STR周报', reply: '已生成 STR 周报草稿（mock）：本周命中 3 笔可疑交易，建议补充证据并提交复核。' },
    { label: '👤 高风险客户清单', reply: '高风险客户清单（mock）：共 8 人，建议优先复核新增 2 人的风险评分变动原因。' },
    { label: '✓ 整改进度追踪', reply: '整改进度追踪（mock）：本周截止整改 1 项，当前 60%，仍需上传 2 份证据材料。' },
    { label: '↗ 本月风险趋势', reply: '本月风险趋势（mock）：可疑交易识别笔数较上月 +50%，跨境转账占比提升。' },
  ] as const

  const urgentCards = useMemo(
    () => [
      {
        id: 'urgent-1',
        border: 'border-red-200',
        badges: [
          { text: '即将到期', className: 'bg-red-100 text-red-700' },
          { text: '制度文件', className: 'bg-slate-100 text-slate-700' },
        ],
        title: '《客户身份识别管理制度》',
        context: '🕐 距到期还有 12 天 · 需提交续期或修订申请',
        contextClass: 'text-red-700',
        actionLabel: '立即查看 →',
        actionTarget: '/org/library',
      },
      {
        id: 'urgent-2',
        border: 'border-orange-200',
        badges: [
          { text: '本周截止', className: 'bg-orange-100 text-orange-700' },
          { text: '整改任务 · 监管检查', className: 'bg-slate-100 text-slate-700' },
        ],
        title: '客户身份识别流程执行不规范整改',
        context: '🔒 截止：周五 · 进度 60% · 待上传 2 份证据材料',
        contextClass: 'text-orange-700',
        actionLabel: '查看详情 →',
        actionTarget: '/special/rectification',
      },
      {
        id: 'urgent-3',
        border: 'border-blue-200',
        badges: [
          { text: '本月未提交', className: 'bg-blue-100 text-blue-700' },
          { text: 'STR 报告', className: 'bg-slate-100 text-slate-700' },
        ],
        title: '可疑交易分析简报（2024 年 6 月）',
        context: '📄 本月已识别 3 笔可疑交易 · 报告草稿待完成并提交',
        contextClass: 'text-blue-700',
        actionLabel: '去填写 →',
        actionTarget: '/ops/str',
      },
    ],
    [],
  )

  const weekTasks: Array<{ id: string; text: string; done: boolean; urgent?: boolean }> = [
    { id: 'week-1', text: '完成制度修订会议纪要归档', done: true },
    { id: 'week-2', text: '更新高风险客户名单', done: true },
    { id: 'week-3', text: '复核高风险客户名单更新记录', done: false },
    { id: 'week-4', text: '提交本周可疑交易分析简报', done: false },
    { id: 'week-5', text: '整改证据上传（截止周五 — 紧急）', done: false, urgent: true },
  ]
  const weekDoneCount = weekTasks.filter((item) => item.done).length
  const weekProgress = 62

  return (
    <section className="space-y-6">
      <section className="space-y-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex min-w-0 flex-1 items-center rounded-lg border border-slate-200 bg-white px-3">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return
                  const value = command.trim()
                  if (!value) return
                  setAgentReply(`已收到指令（mock）：${value}\n建议先查看制度到期清单与 STR 草稿状态。`)
                }}
                placeholder="搜索制度/流程/任务，或直接告诉 AI 助手要做什么..."
                className="w-full border-none px-2 py-3 text-sm outline-none"
              />
            </div>
            <span className="shrink-0 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 px-3 py-1 text-xs font-medium text-white">
              ✦ DeepSeek Agent
            </span>
          </div>
          {agentReply ? (
            <pre className="mt-3 whitespace-pre-wrap rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
              {agentReply}
            </pre>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => setAgentReply(chip.reply)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              {chip.label}
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <section className="space-y-4 xl:col-span-3">
          <header className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">🔔 今日必须处理</h2>
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
              {urgentCards.length} 项紧急
            </span>
          </header>

          <div className="space-y-3">
            {urgentCards.map((card) => (
              <article key={card.id} className={`rounded-xl border bg-white p-4 ${card.border}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {card.badges.map((badge) => (
                        <span key={badge.text} className={`rounded-full px-2 py-0.5 text-xs ${badge.className}`}>
                          {badge.text}
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 text-base font-semibold text-slate-900">{card.title}</p>
                    <p className={`mt-1 text-sm ${card.contextClass}`}>{card.context}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(card.actionTarget)}
                    className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 hover:bg-white"
                  >
                    {card.actionLabel}
                  </button>
                </div>
              </article>
            ))}
          </div>

          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <header className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">✓ 本周工作进度</h3>
              <span className="text-sm text-slate-600">
                {weekDoneCount}/8 项已完成
              </span>
            </header>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-emerald-600" style={{ width: `${weekProgress}%` }} />
            </div>
            <div className="mt-4 space-y-2">
              {weekTasks.map((item) => (
                <div key={item.id} className="flex items-center gap-2 text-sm">
                  <span className={item.done ? 'text-emerald-700' : item.urgent ? 'text-red-600' : 'text-slate-500'}>
                    {item.done ? '✅' : item.urgent ? '🔴' : '○'}
                  </span>
                  <span className={item.done ? 'text-slate-400 line-through' : item.urgent ? 'text-red-700' : 'text-slate-700'}>
                    {item.text}
                  </span>
                </div>
              ))}
            </div>
          </article>
        </section>

        <aside className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 xl:col-span-2">
          <header className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">☆ AI 合规助手</h2>
              <p className="mt-1 text-xs text-slate-500">DeepSeek Agent · 实时</p>
            </div>
          </header>

          <div className="mt-4 flex-1 space-y-2 overflow-y-auto">
            {assistantMessages.map((msg) => (
              <div
                key={msg.id}
                className={`rounded-lg px-3 py-2 text-sm ${
                  msg.role === 'user' ? 'bg-blue-50 text-blue-800' : 'bg-slate-100 text-slate-700'
                }`}
              >
                <p className="whitespace-pre-line">{msg.content}</p>
                {msg.actionLabel && msg.actionTarget ? (
                  <button
                    type="button"
                    onClick={() => navigate(msg.actionTarget!)}
                    className="mt-2 text-sm text-blue-700 underline"
                  >
                    {msg.actionLabel}
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-2">
            {[
              { label: '📄 起草可疑交易分析简报 ↗', target: '/ops/str' },
              { label: '👤 列出需要 EDD 复核的客户 ↗', target: '/ops/risk' },
              { label: '📅 查看未来 30 天到期制度 ↗', target: '/org/library' },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => navigate(item.target)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-700 hover:bg-white"
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-2 border-t border-slate-200 pt-3">
            <input
              value={assistantInput}
              onChange={(event) => setAssistantInput(event.target.value)}
              placeholder="问 AI 任何合规问题..."
              className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none"
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                const value = assistantInput.trim()
                if (!value) return
                setAssistantMessages((prev) => [
                  ...prev,
                  { id: `user-${Date.now()}`, role: 'user', content: value },
                  {
                    id: `ai-${Date.now() + 1}`,
                    role: 'ai',
                    content: `已收到问题（mock）：${value}\n建议先核对制度到期清单、整改证据与 STR 草稿状态。`,
                  },
                ])
                setAssistantInput('')
              }}
            />
            <button
              type="button"
              onClick={() => {
                const value = assistantInput.trim()
                if (!value) return
                setAssistantMessages((prev) => [
                  ...prev,
                  { id: `user-${Date.now()}`, role: 'user', content: value },
                  {
                    id: `ai-${Date.now() + 1}`,
                    role: 'ai',
                    content: `已收到问题（mock）：${value}\n建议先核对制度到期清单、整改证据与 STR 草稿状态。`,
                  },
                ])
                setAssistantInput('')
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
            >
              <Send className="h-4 w-4" />
              发送
            </button>
          </div>
        </aside>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {[
          { icon: '🔴', value: '8', meta: '较上月 +2', label: '高风险客户', color: 'text-red-600', target: '/ops/risk' },
          { icon: '🚩', value: '3', meta: '已提交', label: '本月STR报告', color: 'text-blue-600', target: '/ops/str' },
          { icon: '↗', value: '2', meta: '本月识别', label: '大额待上报', color: 'text-orange-600', target: '/ops/large-transaction' },
          { icon: '🔄', value: '3', meta: '截止本周', label: '未完成整改', color: 'text-orange-600', target: '/special/rectification' },
        ].map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={() => navigate(card.target)}
            className="rounded-xl border border-slate-200 bg-white p-4 text-left hover:bg-slate-50"
          >
            <div className="flex items-center justify-between">
              <span className="text-lg">{card.icon}</span>
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </div>
            <p className={`mt-2 text-3xl font-semibold ${card.color}`}>{card.value}</p>
            <p className="mt-1 text-sm font-medium text-slate-800">{card.label}</p>
            <p className="mt-1 text-xs text-slate-500">{card.meta}</p>
          </button>
        ))}
      </section>
    </section>
  )
}
