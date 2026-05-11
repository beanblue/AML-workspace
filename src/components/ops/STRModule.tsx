import { useState } from 'react'
import { useAMLData } from '../../hooks/useAMLData'
import { DataTable, type TableColumn } from '../shared/DataTable'
import { ModuleWorkspace } from '../shared/ModuleWorkspace'

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
    <ModuleWorkspace
      title="STR 可疑交易报告"
      description="报告提交流程、状态追踪和附件管理。"
      metrics={[
        { label: '本月应报', value: '4 份' },
        { label: '已提交', value: '3 份' },
        { label: '待复核', value: '2 份' },
        { label: '退回重报', value: '1 份' },
      ]}
      alerts={['本月仍有 1 份 STR 报告未提交']}
    >
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
    </ModuleWorkspace>
  )
}
