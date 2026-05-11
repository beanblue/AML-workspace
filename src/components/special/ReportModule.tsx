import { useAMLData } from '../../hooks/useAMLData'
import { DataTable, type TableColumn } from '../shared/DataTable'

type ReportRow = {
  id: string
  reportName: string
  reportType: string
  dimension: string
  status: string
}

export function ReportModule() {
  const { data, loading, error } = useAMLData<ReportRow[]>('report', 'query')
  const rows = data ?? []

  const columns: Array<TableColumn<ReportRow>> = [
    { key: 'reportName', title: '报告名称' },
    { key: 'reportType', title: '类型' },
    { key: 'dimension', title: '维度' },
    { key: 'status', title: '状态' },
  ]

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">报告报表</h2>
      <p className="text-sm text-slate-500">周期性/触发性报告，支持信息留存与证据留存双维度。</p>
      <DataTable columns={columns} data={rows} rowKey={(row) => row.id} loading={loading} error={error} />
    </section>
  )
}
