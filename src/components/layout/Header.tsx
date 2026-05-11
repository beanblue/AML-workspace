import { Bell, Search, Sparkles } from 'lucide-react';

interface HeaderProps {
  breadcrumb: string[];
  onQuickAction?: (action: 'new' | 'agent' | 'notice') => void;
}

export function Header({ breadcrumb, onQuickAction }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs text-slate-500">当前位置</p>
          <h1 className="mt-1 text-lg font-semibold text-slate-900">{breadcrumb.join(' / ')}</h1>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 md:flex">
            <Search className="h-4 w-4 text-slate-500" />
            <span className="text-sm text-slate-500">搜索模块、流程或任务</span>
          </div>

          <button
            type="button"
            onClick={() => onQuickAction?.('new')}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            新建事项
          </button>
          <button
            type="button"
            onClick={() => onQuickAction?.('agent')}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <Sparkles className="h-4 w-4 text-amber-500" />
            智能建议
          </button>
          <button
            type="button"
            onClick={() => onQuickAction?.('notice')}
            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
            aria-label="消息通知"
          >
            <Bell className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
