import { useAMLData } from '../../hooks/useAMLData'

export function OtherOpsModule() {
  const { data, loading, error } = useAMLData('otherOps', 'query')
  const size = Array.isArray(data) ? data.length : 0

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">其他操作类（扩展预留）</h2>
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
        <p>当前为扩展预留模块，可按实际业务新增流程。</p>
        <p className="mt-1">数据状态：{loading ? '加载中' : error ? `加载失败：${error}` : `已加载 ${size} 条`}</p>
      </div>
    </section>
  )
}
