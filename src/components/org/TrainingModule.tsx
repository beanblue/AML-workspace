import { useAMLData } from '../../hooks/useAMLData'
import { KanbanBoard } from '../shared/KanbanBoard'
import { ModuleWorkspace } from '../shared/ModuleWorkspace'

export function TrainingModule() {
  const { data, loading, error } = useAMLData('training', 'query')
  const list = Array.isArray(data) ? data : []

  return (
    <ModuleWorkspace
      title="培训管理"
      description="需求收集到闭环改进的全流程看板与文档列表。"
      metrics={[
        { label: '本月计划', value: '6 场' },
        { label: '完成率', value: '78%' },
        { label: '待归档课件', value: '3 份' },
        { label: '改进项', value: '2 项' },
      ]}
      alerts={['1 场培训未完成签到留痕']}
    >
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
    </ModuleWorkspace>
  )
}
