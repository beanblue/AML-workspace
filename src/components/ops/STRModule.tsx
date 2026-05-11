import { useState } from 'react'
import { useAMLData } from '../../hooks/useAMLData'
import { DataTable, type TableColumn } from '../shared/DataTable'

type STRRow = {
  id: string
  reportNo: string
  customerName: string
  submissionDate: string
  status: string
}

export function STRModule() {
  const [tab, setTab] = useState<'流程视图' | '内容视图'>('流程视图')
  const { data, loading, error } = useAMLData<STRRow[]>('str', 'query')
  const rows = data ?? []

  const columns: Array<TableColumn<STRRow>> = [
    { key: 'reportNo', title: '报告编号' },
    { key: 'customerName', title: '客户名称' },
    { key: 'submissionDate', title: '提交日期' },
    { key: 'status', title: '状态' },
  ]

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">STR 可疑交易报告</h2>
      <div className="inline-flex rounded-lg border border-slate-200 p-1">
        {(['流程视图', '内容视图'] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`rounded px-3 py-1.5 text-sm ${
              tab === item ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {item}
          </button>
        ))}
      </div>
      {tab === '流程视图' ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          线索识别 → 报告编制 → 合规复核 → 对外报送（流程骨架）
        </div>
      ) : (
        <DataTable columns={columns} data={rows} rowKey={(row) => row.id} loading={loading} error={error} />
      )}
    </section>
  )
}
