import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAMLData } from '../../hooks/useAMLData'
import type { PolicyProcessItem } from '../../types'

function highlightText(text: string, keyword: string) {
  if (!keyword.trim()) return text
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  const parts = text.split(regex)
  const keywordLower = keyword.toLowerCase()
  return parts.map((part, index) =>
    part.toLowerCase() === keywordLower ? (
      <mark key={`${part}-${index}`} className="rounded bg-yellow-200 px-0.5">
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    ),
  )
}

export default function PolicyDetail() {
  const { policyId } = useParams()
  const navigate = useNavigate()
  const [keyword, setKeyword] = useState('')
  const [noteInput, setNoteInput] = useState('')
  const [annotations, setAnnotations] = useState<Array<{ id: string; createdAt: string; content: string }>>([])
  const [expandHistory, setExpandHistory] = useState(false)

  const { data, loading, error } = useAMLData<PolicyProcessItem[]>('policy', 'query')
  const policy = useMemo(() => (data ?? []).find((item) => item.id === policyId), [data, policyId])

  const mergedNotes = useMemo(() => [...(policy?.annotations ?? []), ...annotations], [annotations, policy])

  if (loading) {
    return <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-500">全文加载中...</div>
  }

  if (error || !policy) {
    return (
      <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-medium text-red-700">未找到制度全文</p>
        <p className="text-xs text-red-600">{error ?? '该制度可能已删除或尚未同步。'}</p>
        <button
          type="button"
          onClick={() => navigate('/org/policy')}
          className="rounded border border-red-200 bg-white px-2 py-1 text-xs text-red-700"
        >
          返回制度库
        </button>
      </div>
    )
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">制度全文详情</h2>
        <button
          type="button"
          onClick={() => navigate('/org/policy')}
          className="rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          返回制度库
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-10">
        <div className="space-y-4 xl:col-span-7">
          <article className="rounded-lg border border-slate-200 p-4">
            <h3 className="text-base font-semibold text-slate-900">元数据卡片</h3>
            <div className="mt-3 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
              <p>标题：{policy.name}</p>
              <p>文号：{policy.documentNo}</p>
              <p>发文单位：{policy.issuingUnit}</p>
              <p>来源层级：{policy.sourceLevel}</p>
              <p>版本：{policy.version}</p>
              <p>生效日期：{policy.effectiveDate}</p>
              <p>废止日期：{policy.abolishedDate ?? '-'}</p>
            </div>
          </article>

          <article className="rounded-lg border border-slate-200 p-4">
            <h3 className="text-base font-semibold text-slate-900">关联岗位</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {policy.relatedRoles.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => window.alert(`Mock 跳转：${role}`)}
                  className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
                >
                  {role}
                </button>
              ))}
            </div>
          </article>

          <article className="rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">历史版本列表</h3>
              <button
                type="button"
                onClick={() => setExpandHistory((prev) => !prev)}
                className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600"
              >
                {expandHistory ? '收起' : '展开'}
              </button>
            </div>
            {expandHistory ? (
              <div className="mt-3 space-y-2">
                {policy.historyVersions.map((item) => (
                  <div key={`${item.version}-${item.updatedAt}`} className="rounded border border-slate-200 bg-slate-50 p-2 text-sm">
                    <p className="font-medium text-slate-800">
                      {item.version} · {item.updatedAt}
                    </p>
                    <p className="mt-1 text-slate-600">更新说明：{item.note}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </article>

          <article className="rounded-lg border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-900">全文展示区</h3>
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="页内关键字搜索"
                className="w-full rounded border border-slate-200 px-3 py-1.5 text-sm md:w-64"
              />
            </div>
            <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3 text-sm leading-7 text-slate-700">
              {policy.fullText.split('\n').map((line, index) => (
                <p key={`${line}-${index}`}>{highlightText(line, keyword)}</p>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => window.alert('Mock：导出 PDF')}
                className="rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-700"
              >
                导出 PDF
              </button>
              <button
                type="button"
                onClick={() => window.alert('Mock：导出含批注版 PDF')}
                className="rounded border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm text-blue-700"
              >
                导出含批注版 PDF
              </button>
            </div>
          </article>

          <article className="rounded-lg border border-slate-200 p-4">
            <h3 className="text-base font-semibold text-slate-900">查阅记录</h3>
            <p className="mt-2 text-sm text-slate-500">暂无记录，接入 API 后自动记录</p>
          </article>

          <article className="rounded-lg border border-slate-200 p-4">
            <h3 className="text-base font-semibold text-slate-900">被引用记录</h3>
            <p className="mt-2 text-sm text-slate-500">暂无记录，接入 API 后自动记录</p>
          </article>
        </div>

        <aside className="space-y-3 xl:col-span-3">
          <article className="rounded-lg border border-slate-200 p-4">
            <h3 className="text-base font-semibold text-slate-900">批注区域</h3>
            <div className="mt-3 space-y-2">
              {mergedNotes.length === 0 ? (
                <p className="text-sm text-slate-500">暂无批注</p>
              ) : (
                mergedNotes.map((item) => (
                  <div key={item.id} className="rounded border border-slate-200 bg-slate-50 p-2 text-sm">
                    <p className="text-xs text-slate-500">{item.createdAt}</p>
                    <p className="mt-1 text-slate-700">{item.content}</p>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="rounded-lg border border-slate-200 p-4">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">新增批注</span>
              <textarea
                value={noteInput}
                onChange={(event) => setNoteInput(event.target.value)}
                className="h-24 w-full rounded border border-slate-200 px-3 py-2 text-sm"
                placeholder="输入批注内容"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                if (!noteInput.trim()) return
                setAnnotations((prev) => [
                  ...prev,
                  { id: `anno-local-${Date.now()}`, createdAt: new Date().toLocaleString(), content: noteInput.trim() },
                ])
                setNoteInput('')
              }}
              className="mt-2 w-full rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              提交批注
            </button>
          </article>
        </aside>
      </div>
    </section>
  )
}
