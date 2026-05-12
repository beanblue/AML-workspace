import { useAMLData } from '../../hooks/useAMLData'
import { KanbanBoard } from '../shared/KanbanBoard'

export function RectificationModule() {
  const { data, loading, error } = useAMLData('rectification', 'query')
  const list = Array.isArray(data) ? data : []

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-slate-900">整改管理</h2>
        <p className="mt-1 text-sm text-slate-500">整改任务列表、进度看板、证据包归档双视图骨架。</p>
      </header>

      <KanbanBoard
        loading={loading}
        error={error}
        columns={[
          {
            key: 'todo',
            title: '待整改',
            colorClass: 'text-orange-700',
            items: list.slice(0, 2).map((item, index) => ({
              id: item.id ?? `todo-${index}`,
              title: item.taskName ?? `整改任务 ${index + 1}`,
              description: item.issueSource ?? '问题来源待补充',
            })),
          },
          {
            key: 'doing',
            title: '整改中',
            colorClass: 'text-blue-700',
            items: list.slice(2, 4).map((item, index) => ({
              id: item.id ?? `doing-${index}`,
              title: item.taskName ?? `执行任务 ${index + 1}`,
              description: `责任人：${item.owner ?? '未分配'}`,
            })),
          },
          {
            key: 'done',
            title: '已闭环',
            colorClass: 'text-emerald-700',
            items: list.slice(4, 6).map((item, index) => ({
              id: item.id ?? `done-${index}`,
              title: item.taskName ?? `闭环任务 ${index + 1}`,
              description: '证据包已归档',
            })),
          },
        ]}
      />
    </section>
  )
}
