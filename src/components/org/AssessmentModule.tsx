import { useState } from 'react'
import { useAMLData } from '../../hooks/useAMLData'
import { DataTable, type TableColumn } from '../shared/DataTable'

type AssessmentRow = {
  id: string
  targetType: '部门' | '个人'
  targetName: string
  period: string
  score: number
  grade: string
}

export function AssessmentModule() {
  const [tab, setTab] = useState<'部门' | '个人'>('部门')
  const { data, loading, error } = useAMLData<AssessmentRow[]>('assessment', 'query')
  const rows = (data ?? []).filter((row) => row.targetType === tab)

  const columns: Array<TableColumn<AssessmentRow>> = [
    { key: 'targetName', title: tab === '部门' ? '部门名称' : '人员姓名' },
    { key: 'period', title: '考核周期' },
    { key: 'score', title: '评分' },
    { key: 'grade', title: '等级' },
  ]

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-slate-900">评估考核管理</h2>
        <p className="mt-1 text-sm text-slate-500">部门/个人双维度评分表与趋势图骨架。</p>
      </header>

      <div className="inline-flex rounded-lg border border-slate-200 p-1">
        {(['部门', '个人'] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`rounded px-3 py-1.5 text-sm ${
              tab === item ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <DataTable columns={columns} data={rows} rowKey={(row) => row.id} loading={loading} error={error} />
    </section>
  )
}
