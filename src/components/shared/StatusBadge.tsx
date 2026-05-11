import type { EntityStatus } from '../../types'

interface StatusBadgeProps {
  status: EntityStatus
}

const STATUS_LABEL_MAP: Record<EntityStatus, string> = {
  draft: '草稿',
  active: '生效',
  inactive: '停用',
  archived: '已归档',
  pending: '待处理',
  completed: '已完成',
  overdue: '已逾期',
}

const STATUS_CLASS_MAP: Record<EntityStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  active: 'bg-emerald-100 text-emerald-700',
  inactive: 'bg-amber-100 text-amber-700',
  archived: 'bg-zinc-100 text-zinc-700',
  pending: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS_MAP[status]}`}>
      {STATUS_LABEL_MAP[status]}
    </span>
  )
}
