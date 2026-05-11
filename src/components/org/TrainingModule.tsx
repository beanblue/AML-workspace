import { useAMLData } from '../../hooks/useAMLData'
import { KanbanBoard } from '../shared/KanbanBoard'

export function TrainingModule() {
  const { data, loading, error } = useAMLData('training', 'query')
  const list = Array.isArray(data) ? data : []

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-slate-900">培训管理</h2>
        <p className="mt-1 text-sm text-slate-500">需求收集到闭环改进的全流程看板与文档列表。</p>
      </header>

      <KanbanBoard
        loading={loading}
        error={error}
        columns={[
          {
            key: 'plan',
            title: '规划阶段',
            colorClass: 'text-blue-700',
            items: list.slice(0, 2).map((item, index) => ({
              id: item.id ?? `plan-${index}`,
              title: item.title ?? `培训规划任务 ${index + 1}`,
              description: item.owner ?? '合规培训岗',
            })),
          },
          {
            key: 'execute',
            title: '执行阶段',
            colorClass: 'text-emerald-700',
            items: list.slice(2, 4).map((item, index) => ({
              id: item.id ?? `exec-${index}`,
              title: item.title ?? `培训执行任务 ${index + 1}`,
              description: item.owner ?? '业务支持岗',
            })),
          },
          {
            key: 'archive',
            title: '归档与改进',
            colorClass: 'text-orange-700',
            items: list.slice(4, 6).map((item, index) => ({
              id: item.id ?? `archive-${index}`,
              title: item.title ?? `留痕改进任务 ${index + 1}`,
              description: item.owner ?? '审计复盘岗',
            })),
          },
        ]}
      />
    </section>
  )
}
