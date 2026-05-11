import { useState } from 'react'
import { useAMLData } from '../../hooks/useAMLData'
import { DataTable, type TableColumn } from '../shared/DataTable'
import { ModuleWorkspace } from '../shared/ModuleWorkspace'

type CDDRow = {
  id: string
  customerName: string
  customerType: string
  level: string
  status: string
}

export function CDDModule() {
  const [tab, setTab] = useState<'流程视图' | '内容视图'>('流程视图')
  const { data, loading, error } = useAMLData<CDDRow[]>('cdd', 'query')
  const rows = data ?? []

  const columns: Array<TableColumn<CDDRow>> = [
    { key: 'customerName', title: '客户名称' },
    { key: 'customerType', title: '客户类型' },
    { key: 'level', title: '尽调等级' },
    { key: 'status', title: '状态' },
  ]

  return (
    <ModuleWorkspace
      title="客户身份识别 CDD/EDD"
      description="标准尽调、增强尽调、黑名单管理的流程与内容双视图。"
      metrics={[
        { label: '本月尽调', value: '126 次' },
        { label: 'EDD 占比', value: '18%' },
        { label: '黑名单命中', value: '2 条' },
        { label: '待复核', value: '5 条' },
      ]}
      alerts={['有 1 条黑名单命中待人工复核']}
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
          标准尽调 → 增强尽调 → 黑名单比对 → 预警处置（流程骨架）
        </div>
      ) : (
        <DataTable columns={columns} data={rows} rowKey={(row) => row.id} loading={loading} error={error} />
      )}
    </ModuleWorkspace>
  )
}
