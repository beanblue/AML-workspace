import type { ReactNode } from 'react'

export interface TableColumn<T> {
  key: string
  title: string
  className?: string
  render?: (value: unknown, row: T) => ReactNode
}

interface DataTableProps<T> {
  columns: Array<TableColumn<T>>
  data: T[]
  rowKey: (row: T) => string
  loading: boolean
  error: string | null
  emptyText?: string
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  loading,
  error,
  emptyText = '暂无数据',
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 p-6 text-center text-sm text-slate-500">
        正在加载数据...
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        数据加载失败：{error}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 p-6 text-center text-sm text-slate-500">
        {emptyText}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={`px-4 py-3 font-semibold ${column.className ?? ''}`}>
                {column.title}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
          {data.map((row) => (
            <tr key={rowKey(row)} className="hover:bg-slate-50">
              {columns.map((column) => {
                const value = (row as Record<string, unknown>)[column.key]
                return (
                  <td key={column.key} className={`px-4 py-3 align-top ${column.className ?? ''}`}>
                    {column.render ? column.render(value, row) : String(value ?? '-')}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
