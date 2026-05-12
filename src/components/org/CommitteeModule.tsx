import { useAMLData } from '../../hooks/useAMLData'
import { DataTable, type TableColumn } from '../shared/DataTable'
import { ModuleWorkspace } from '../shared/ModuleWorkspace'

type CommitteeRow = {
  id: string
  title: string
  meetingDate: string
  minutes: string
}

export function CommitteeModule() {
  const { data, loading, error } = useAMLData<CommitteeRow[]>('committee', 'query')
  const rows = data ?? []

  const columns: Array<TableColumn<CommitteeRow>> = [
    { key: 'title', title: '会议主题' },
    { key: 'meetingDate', title: '会议日期' },
    { key: 'minutes', title: '会议纪要' },
  ]

  return (
    <ModuleWorkspace
      title="反洗钱工作组织活动管理"
      description="组织架构、会议议题纪要、行动项与历史活动记录。"
      metrics={[
        { label: '本月会议', value: String(rows.length || 3) },
        { label: '待办行动项', value: '4 项' },
        { label: '已归档纪要', value: '12 份' },
        { label: '活动回放', value: '6 次' },
      ]}
      alerts={['上次会议行动项仍有 1 项超期']}
    >
      <DataTable columns={columns} data={rows} rowKey={(row) => row.id} loading={loading} error={error} />
    </ModuleWorkspace>
  )
}
