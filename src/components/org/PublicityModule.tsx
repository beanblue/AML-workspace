import { useAMLData } from '../../hooks/useAMLData'
import { KanbanBoard } from '../shared/KanbanBoard'
import { ModuleWorkspace } from '../shared/ModuleWorkspace'

export function PublicityModule() {
  const { data, loading, error } = useAMLData('publicity', 'query')
  const list = Array.isArray(data) ? data : []

  return (
    <ModuleWorkspace
      title="宣传管理"
      description="宣传计划、材料制作、执行记录与效果评估。"
      metrics={[
        { label: '宣传计划', value: '5 个' },
        { label: '材料库存', value: '21 份' },
        { label: '执行记录', value: '14 条' },
        { label: '待评估', value: '2 项' },
      ]}
      alerts={['本周宣传活动效果评估尚未提交']}
    >
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
    </ModuleWorkspace>
  )
}
