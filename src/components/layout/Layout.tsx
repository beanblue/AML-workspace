import { useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { Bot } from 'lucide-react';
import type { AMLModule } from '../../types';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface LayoutProps extends PropsWithChildren {
  activeModule: AMLModule;
  onSelectModule: (module: AMLModule) => void;
}

const BREADCRUMB_MAP: Record<AMLModule, string[]> = {
  dashboard: ['总览 Dashboard', '全景总览'],
  policy: ['资料库'],
  policyProcess: ['资料库'],
  policyKnowledge: ['资料库'],
  responsibility: ['组织类', '反洗钱工作职责管理'],
  committee: ['组织类', '反洗钱工作组织活动管理'],
  training: ['组织类', '培训管理'],
  publicity: ['组织类', '宣传管理'],
  assessment: ['组织类', '评估考核管理'],
  cdd: ['操作类', '客户身份识别 CDD/EDD'],
  risk: ['操作类', '洗钱风险管理'],
  str: ['操作类', 'STR 可疑交易报告'],
  largeTransaction: ['操作类', '大额交易管理'],
  otherOps: ['操作类', '其他操作类'],
  report: ['专项类', '报告报表'],
  rectification: ['专项类', '整改管理'],
};

export function Layout({ activeModule, onSelectModule, children }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<{ id: string; role: 'user' | 'agent'; content: string }>>([
    { id: 'ai-1', role: 'user', content: '请总结本周整改重点。' },
    { id: 'ai-2', role: 'agent', content: '[演示模式] 已收到指令，接入后将自动执行' },
    { id: 'ai-3', role: 'user', content: '帮我生成制度修订清单。' },
  ]);

  const breadcrumb = useMemo(() => BREADCRUMB_MAP[activeModule], [activeModule]);

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar
        collapsed={collapsed}
        activeModule={activeModule}
        onToggle={() => setCollapsed((prev) => !prev)}
        onSelectModule={onSelectModule}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          breadcrumb={activeModule === 'dashboard' ? undefined : breadcrumb}
          title={activeModule === 'dashboard' ? '全景总览' : undefined}
          onQuickAction={(action) => {
            if (action === 'ai') setAiOpen(true);
          }}
        />
        <main className="flex-1 p-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">{children}</div>
        </main>
      </div>

      {aiOpen ? (
        <aside className="fixed right-0 top-0 z-40 h-screen w-[360px] border-l border-slate-200 bg-white shadow-xl">
          <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
            <div className="inline-flex items-center gap-2 text-sm font-medium text-slate-800">
              <Bot className="h-4 w-4 text-blue-600" />
              DeepSeek Agent · 当前演示模式
            </div>
            <button
              type="button"
              onClick={() => setAiOpen(false)}
              className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600"
            >
              关闭
            </button>
          </div>

          <div className="h-[calc(100vh-9rem)] space-y-2 overflow-y-auto p-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`rounded-lg px-3 py-2 text-sm ${
                  msg.role === 'user' ? 'bg-blue-50 text-blue-800' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {msg.content}
              </div>
            ))}
          </div>

          <div className="border-t border-slate-200 p-3">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="输入指令..."
                className="min-w-0 flex-1 rounded border border-slate-200 px-3 py-2 text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  if (!input.trim()) return;
                  const value = input.trim();
                  setMessages((prev) => [
                    ...prev,
                    { id: `u-${Date.now()}`, role: 'user', content: value },
                    {
                      id: `a-${Date.now() + 1}`,
                      role: 'agent',
                      content: '[演示模式] 已收到指令，接入后将自动执行',
                    },
                  ]);
                  setInput('');
                }}
                className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
              >
                发送
              </button>
            </div>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
