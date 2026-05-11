import { useState } from 'react'
import type { PropsWithChildren, ReactNode } from 'react'

interface ModuleMetric {
  label: string
  value: string
}

interface ModuleWorkspaceProps extends PropsWithChildren {
  title: string
  description: string
  metrics: ModuleMetric[]
  alerts: string[]
  actions?: ReactNode
}

export function ModuleWorkspace({
  title,
  description,
  metrics,
  alerts,
  actions,
  children,
}: ModuleWorkspaceProps) {
  const [expanded, setExpanded] = useState(true)

  return (
    <section className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        {actions ?? null}
      </header>

      <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">概况看板</h3>
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
          >
            {expanded ? '收起' : '展开'}
          </button>
        </div>
        {expanded ? (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {metrics.map((item) => (
                <div key={item.label} className="rounded border border-slate-200 bg-white p-2">
                  <p className="text-xs text-slate-500">{item.label}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="space-y-1 text-xs">
              {alerts.length > 0 ? (
                alerts.map((alert) => (
                  <p key={alert} className="rounded border border-orange-200 bg-orange-50 px-2 py-1 text-orange-700">
                    ⚠️ {alert}
                  </p>
                ))
              ) : (
                <p className="rounded border border-slate-200 bg-white px-2 py-1 text-slate-500">暂无预警信息</p>
              )}
            </div>
          </div>
        ) : null}
      </article>

      <article className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">功能区</h3>
        {children}
      </article>
    </section>
  )
}
