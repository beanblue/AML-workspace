import { useAMLData } from '../../hooks/useAMLData'
import { ModuleWorkspace } from '../shared/ModuleWorkspace'

export function OtherOpsModule() {
  const { data, loading, error } = useAMLData('otherOps', 'query')
  const size = Array.isArray(data) ? data.length : 0

  return (
    <ModuleWorkspace
      title="其他操作类（扩展预留）"
      description="扩展场景流程预留，支持后续快速挂载。"
      metrics={[
        { label: '扩展流程', value: '0 个' },
        { label: '预留接口', value: '3 个' },
        { label: '可复用模板', value: '5 套' },
        { label: '当前数据', value: `${size} 条` },
      ]}
      alerts={[]}
    >
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
        <p>当前为扩展预留模块，可按实际业务新增流程。</p>
        <p className="mt-1">数据状态：{loading ? '加载中' : error ? `加载失败：${error}` : `已加载 ${size} 条`}</p>
      </div>
    </ModuleWorkspace>
  )
}
