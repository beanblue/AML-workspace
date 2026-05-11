interface KanbanItem {
  id: string
  title: string
  description?: string
}

interface KanbanColumn {
  key: string
  title: string
  colorClass?: string
  items: KanbanItem[]
}

interface KanbanBoardProps {
  columns: KanbanColumn[]
  loading: boolean
  error: string | null
}

export function KanbanBoard({ columns, loading, error }: KanbanBoardProps) {
  if (loading) {
    return <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-500">看板加载中...</div>
  }

  if (error) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">看板加载失败：{error}</div>
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      {columns.map((column) => (
        <article key={column.key} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <h4 className={`text-sm font-semibold ${column.colorClass ?? 'text-slate-700'}`}>
            {column.title}
            <span className="ml-2 rounded bg-white px-1.5 py-0.5 text-xs text-slate-500">
              {column.items.length}
            </span>
          </h4>

          <div className="mt-3 space-y-2">
            {column.items.length === 0 ? (
              <div className="rounded border border-dashed border-slate-300 bg-white p-3 text-xs text-slate-400">
                暂无任务
              </div>
            ) : (
              column.items.map((item) => (
                <div key={item.id} className="rounded border border-slate-200 bg-white p-3">
                  <p className="text-sm font-medium text-slate-800">{item.title}</p>
                  {item.description ? <p className="mt-1 text-xs text-slate-500">{item.description}</p> : null}
                </div>
              ))
            )}
          </div>
        </article>
      ))}
    </div>
  )
}
