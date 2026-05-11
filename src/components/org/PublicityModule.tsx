import { useAMLData } from '../../hooks/useAMLData'
import { KanbanBoard } from '../shared/KanbanBoard'

export function PublicityModule() {
  const { data, loading, error } = useAMLData('publicity', 'query')
  const list = Array.isArray(data) ? data : []

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-slate-900">宣传管理</h2>
        <p className="mt-1 text-sm text-slate-500">宣传计划、材料制作、执行记录与效果评估。</p>
      </header>

      <KanbanBoard
        loading={loading}
        error={error}
        columns={[
          {
            key: 'prepare',
            title: '计划与准备',
            colorClass: 'text-blue-700',
            items: list.slice(0, 2).map((item, index) => ({
              id: item.id ?? `prepare-${index}`,
              title: item.planName ?? `宣传计划 ${index + 1}`,
              description: '宣传主题与材料清单',
            })),
          },
          {
            key: 'run',
            title: '执行与留痕',
            colorClass: 'text-emerald-700',
            items: list.slice(2, 4).map((item, index) => ({
              id: item.id ?? `run-${index}`,
              title: item.planName ?? `宣传执行 ${index + 1}`,
              description: '现场记录与流程留痕',
            })),
          },
          {
            key: 'review',
            title: '评估与优化',
            colorClass: 'text-orange-700',
            items: list.slice(4, 6).map((item, index) => ({
              id: item.id ?? `review-${index}`,
              title: item.planName ?? `效果复盘 ${index + 1}`,
              description: '效果评分与优化建议',
            })),
          },
        ]}
      />
    </section>
  )
}
