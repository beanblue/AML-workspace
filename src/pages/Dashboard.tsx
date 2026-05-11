import { ArrowRight, Bot, Search } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface FocusItem {
  text: string
  target: string
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [command, setCommand] = useState('')
  const [agentReply, setAgentReply] = useState('')
  const [todos, setTodos] = useState([
    { id: 'todo-1', text: '复核高风险客户名单更新记录', done: false },
    { id: 'todo-2', text: '提交本周可疑交易分析简报', done: false },
    { id: 'todo-3', text: '完成制度修订会议纪要归档', done: true },
  ])

  const focusItems: FocusItem[] = [
    { text: '制度《客户身份识别管理制度》距废止还有 12 天', target: '/org/policy' },
    { text: '整改任务「XX问题整改」截止日期：本周五', target: '/special/rectification' },
    { text: 'STR报告本月尚未提交', target: '/ops/str' },
  ]

  return (
    <section className="space-y-6">
      <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center rounded-lg border border-slate-200 bg-white px-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                const value = command.trim()
                if (!value) return
                if (value.includes('?') || value.includes('？')) {
                  setAgentReply(`[演示模式] Agent 已收到：${value}，接入 DeepSeek 后将自动处理`)
                } else {
                  navigate('/org/policy')
                }
              }}
              placeholder="搜索制度/流程/任务，或直接告诉 AI 助手要做什么..."
              className="w-full border-none px-2 py-3 text-sm outline-none"
            />
          </div>
          <span className="text-xs text-blue-700">🤖 由 DeepSeek Agent 驱动</span>
        </div>
        {agentReply ? (
          <p className="mt-3 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">{agentReply}</p>
        ) : null}
      </article>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article className="rounded-xl border border-orange-200 bg-orange-50 p-4">
          <h3 className="text-base font-semibold text-orange-800">⚠️ 需要关注</h3>
          <div className="mt-3 space-y-2">
            {focusItems.slice(0, 5).map((item) => (
              <div key={item.text} className="flex items-center justify-between gap-3 rounded bg-white px-3 py-2 text-sm text-slate-700">
                <span>{item.text}</span>
                <button
                  type="button"
                  onClick={() => navigate(item.target)}
                  className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-xs text-slate-600"
                >
                  前往
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <h3 className="text-base font-semibold text-blue-900">📋 今日待办</h3>
          <div className="mt-3 space-y-2">
            {todos.slice(0, 5).map((todo) => (
              <label key={todo.id} className="flex items-center gap-2 rounded bg-white px-3 py-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={todo.done}
                  onChange={() =>
                    setTodos((prev) => prev.map((item) => (item.id === todo.id ? { ...item, done: !item.done } : item)))
                  }
                />
                <span className={todo.done ? 'text-slate-400 line-through' : ''}>{todo.text}</span>
              </label>
            ))}
            <button
              type="button"
              onClick={() => {
                const text = window.prompt('请输入待办内容')
                if (!text?.trim()) return
                setTodos((prev) => [...prev, { id: `todo-${Date.now()}`, text: text.trim(), done: false }])
              }}
              className="rounded border border-blue-200 bg-white px-2 py-1 text-xs text-blue-700"
            >
              + 新增待办
            </button>
            <p className="text-xs text-blue-700">待办由 Agent 自动生成，也可手动添加</p>
          </div>
        </article>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {[
          {
            title: '🟦 组织类工作',
            desc: '制度/流程/职责/培训/宣传/考核',
            count: '8 项待办',
            target: '/org/policy',
            style: 'border-blue-200 bg-blue-50 text-blue-900',
          },
          {
            title: '🟩 操作类工作',
            desc: 'CDD/黑名单/风险/STR/大额',
            count: '11 项待办',
            target: '/ops/cdd',
            style: 'border-emerald-200 bg-emerald-50 text-emerald-900',
          },
          {
            title: '🟧 报告与整改',
            desc: '周期报告/触发报告/整改追踪',
            count: '5 项待办',
            target: '/special/report',
            style: 'border-orange-200 bg-orange-50 text-orange-900',
          },
        ].map((item) => (
          <button
            key={item.title}
            type="button"
            onClick={() => navigate(item.target)}
            className={`rounded-xl border p-4 text-left ${item.style}`}
          >
            <div className="inline-flex items-center gap-2 text-base font-semibold">
              <Bot className="h-4 w-4" />
              {item.title}
            </div>
            <p className="mt-2 text-sm">{item.desc}</p>
            <p className="mt-3 text-xs font-medium">{item.count}</p>
          </button>
        ))}
      </div>
    </section>
  )
}
