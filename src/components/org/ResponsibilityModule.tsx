import { useAMLData } from '../../hooks/useAMLData'

export function ResponsibilityModule() {
  const { data, loading, error } = useAMLData('responsibility', 'query')
  const rows = Array.isArray(data) ? data : []

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-slate-900">反洗钱工作职责管理</h2>
        <p className="mt-1 text-sm text-slate-500">岗位职责、工作标准、自评估与行政处罚风险提示。</p>
      </header>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <p>数据状态：{loading ? '加载中' : error ? '加载失败' : `已加载 ${rows.length} 条`}</p>
        <p className="mt-1">骨架展示：后续可扩展为角色卡片 + 可展开详情面板。</p>
      </div>
    </section>
  )
}
