import { useAMLData } from '../../hooks/useAMLData'
import { DataTable, type TableColumn } from '../shared/DataTable'

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
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-slate-900">反洗钱工作组织活动管理</h2>
        <p className="mt-1 text-sm text-slate-500">组织架构、会议议题纪要、行动项与历史活动记录。</p>
      </header>

      <DataTable columns={columns} data={rows} rowKey={(row) => row.id} loading={loading} error={error} />
    </section>
  )
}
