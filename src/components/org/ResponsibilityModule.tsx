import { useAMLData } from '../../hooks/useAMLData'
import { ModuleWorkspace } from '../shared/ModuleWorkspace'

export function ResponsibilityModule() {
  const { data, loading, error } = useAMLData('responsibility', 'query')
  const rows = Array.isArray(data) ? data : []

  return (
    <ModuleWorkspace
      title="反洗钱工作职责管理"
      description="岗位职责、工作标准、自评估与行政处罚风险提示。"
      metrics={[
        { label: '岗位数量', value: String(rows.length || 6) },
        { label: '职责清单', value: '28 项' },
        { label: '待确认风险', value: '2 项' },
        { label: '已更新标准', value: '5 项' },
      ]}
      alerts={['两项岗位职责尚未完成年度复核']}
    >
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <p>数据状态：{loading ? '加载中' : error ? '加载失败' : `已加载 ${rows.length} 条`}</p>
        <p className="mt-1">骨架展示：后续可扩展为角色卡片 + 可展开详情面板。</p>
      </div>
    </ModuleWorkspace>
  )
}
