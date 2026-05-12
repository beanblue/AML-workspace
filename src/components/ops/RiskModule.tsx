import { useState } from 'react'
import { useAMLData } from '../../hooks/useAMLData'
import { DataTable, type TableColumn } from '../shared/DataTable'
import { ModuleWorkspace } from '../shared/ModuleWorkspace'

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
    <ModuleWorkspace
      title="洗钱风险管理"
      description="风险评级、评分输入输出与等级分布管理。"
      metrics={[
        { label: '高风险客户', value: '23 户' },
        { label: '中风险客户', value: '96 户' },
        { label: '低风险客户', value: '312 户' },
        { label: '本周重评', value: '11 户' },
      ]}
      alerts={['2 户高风险客户超期未重评']}
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
          评分输入 → 模型计算 → 等级判定 → 复核确认（流程骨架）
        </div>
      ) : (
        <DataTable columns={columns} data={rows} rowKey={(row) => row.id} loading={loading} error={error} />
      )}
    </ModuleWorkspace>
  )
}
