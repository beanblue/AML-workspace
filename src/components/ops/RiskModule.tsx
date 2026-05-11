import { useState } from 'react'
import { useAMLData } from '../../hooks/useAMLData'
import { DataTable, type TableColumn } from '../shared/DataTable'

type RiskRow = {
  id: string
  customerName: string
  riskScore: number
  riskLevel: string
}

export function RiskModule() {
  const [tab, setTab] = useState<'流程视图' | '内容视图'>('流程视图')
  const { data, loading, error } = useAMLData<RiskRow[]>('risk', 'query')
  const rows = data ?? []

  const columns: Array<TableColumn<RiskRow>> = [
    { key: 'customerName', title: '客户名称' },
    { key: 'riskScore', title: '风险评分' },
    { key: 'riskLevel', title: '风险等级' },
  ]

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">洗钱风险管理</h2>
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
          评分输入 → 模型计算 → 等级判定 → 复核确认（流程骨架）
        </div>
      ) : (
        <DataTable columns={columns} data={rows} rowKey={(row) => row.id} loading={loading} error={error} />
      )}
    </section>
  )
}
