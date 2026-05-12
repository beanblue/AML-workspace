import { useState } from 'react'
import { useAMLData } from '../../hooks/useAMLData'
import { DataTable, type TableColumn } from '../shared/DataTable'
import { ModuleWorkspace } from '../shared/ModuleWorkspace'

type LargeTxnRow = {
  id: string
  transactionNo: string
  customerName: string
  amount: number
  transactionDate: string
}

export function LargeTransactionModule() {
  const [tab, setTab] = useState<'流程视图' | '内容视图'>('流程视图')
  const { data, loading, error } = useAMLData<LargeTxnRow[]>('largeTransaction', 'query')
  const rows = data ?? []

  const columns: Array<TableColumn<LargeTxnRow>> = [
    { key: 'transactionNo', title: '交易编号' },
    { key: 'customerName', title: '客户名称' },
    { key: 'amount', title: '交易金额' },
    { key: 'transactionDate', title: '交易日期' },
  ]

  return (
    <ModuleWorkspace
      title="大额交易管理"
      description="阈值预警、交易记录与归档全流程管理。"
      metrics={[
        { label: '本周预警', value: '17 条' },
        { label: '已复核', value: '13 条' },
        { label: '待归档', value: '4 条' },
        { label: '超阈值金额', value: '¥ 920 万' },
      ]}
      alerts={['4 条大额交易仍待完成归档']}
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
          阈值识别 → 预警触发 → 复核处置 → 归档留痕（流程骨架）
        </div>
      ) : (
        <DataTable columns={columns} data={rows} rowKey={(row) => row.id} loading={loading} error={error} />
      )}
    </ModuleWorkspace>
  )
}
