import { Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAMLData } from '../../hooks/useAMLData'
import type { ReferenceKnowledgeItem } from '../../types'
import { DataTable, type TableColumn } from '../shared/DataTable'
import { Modal } from '../shared/Modal'
import { ModuleWorkspace } from '../shared/ModuleWorkspace'

type KnowledgeFormState = Pick<
  ReferenceKnowledgeItem,
  'materialType' | 'title' | 'sourceOrg' | 'publishDate' | 'summary' | 'tags' | 'originLink' | 'personalNote'
>

const TAG_OPTIONS = ['法规解读', '监管动态', '问答FAQ', '学习资料']

const defaultKnowledgeForm: KnowledgeFormState = {
  materialType: '监管报告',
  title: '',
  sourceOrg: '',
  publishDate: '',
  summary: '',
  tags: [],
  originLink: '',
  personalNote: '',
}

export function KnowledgeModule() {
  const { data, loading, error, setData } = useAMLData<ReferenceKnowledgeItem[]>('policyKnowledge', 'query')
  const rows = data ?? []
  const [search, setSearch] = useState('')
  const [tag, setTag] = useState<'all' | string>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<KnowledgeFormState>(defaultKnowledgeForm)

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return rows.filter((item) => {
      const tagMatch = tag === 'all' || item.tags.includes(tag)
      const searchMatch =
        keyword === '' || [item.title, item.summary, item.personalNote].join(' ').toLowerCase().includes(keyword)
      return tagMatch && searchMatch
    })
  }, [rows, search, tag])

  const columns: Array<TableColumn<ReferenceKnowledgeItem>> = [
    {
      key: 'materialType',
      title: '类型',
      render: (v) => <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{String(v)}</span>,
    },
    { key: 'title', title: '标题' },
    { key: 'sourceOrg', title: '来源' },
    { key: 'publishDate', title: '发布日期' },
    {
      key: 'tags',
      title: '标签',
      render: (value) => (
        <div className="flex flex-wrap gap-1">
          {(value as string[]).map((t) => (
            <span key={t} className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">
              {t}
            </span>
          ))}
        </div>
      ),
    },
  ]

  return (
    <ModuleWorkspace
      title="知识库"
      description="法规解读 / 监管动态 / 问答FAQ / 学习资料"
      metrics={[
        { label: '资料总数', value: String(rows.length) },
        { label: '法规解读', value: String(rows.filter((item) => item.tags.includes('法规解读')).length) },
        { label: '监管动态', value: String(rows.filter((item) => item.tags.includes('监管动态')).length) },
        { label: '问答FAQ', value: String(rows.filter((item) => item.tags.includes('问答FAQ')).length) },
      ]}
      alerts={[]}
      actions={
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-2 text-sm text-white"
        >
          <Plus className="h-4 w-4" />
          新建资料
        </button>
      }
    >
      <div className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 lg:grid-cols-6">
        <label className="lg:col-span-3">
          <div className="flex items-center rounded border border-slate-200 bg-white px-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="全文搜索"
              className="w-full border-none px-2 py-2 text-sm outline-none"
            />
          </div>
        </label>
        <select
          value={tag}
          onChange={(event) => setTag(event.target.value)}
          className="rounded border border-slate-200 bg-white px-3 py-2 text-sm lg:col-span-2"
        >
          <option value="all">按标签筛选</option>
          {TAG_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <DataTable columns={columns} data={filtered} rowKey={(row) => row.id} loading={loading} error={error} />

      <Modal
        open={modalOpen}
        title="新增资料"
        onClose={() => setModalOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded border border-slate-200 px-3 py-1.5 text-sm">
              取消
            </button>
            <button
              type="button"
              onClick={() => {
                if (!form.title.trim()) return
                const now = new Date().toISOString()
                setData([
                  {
                    id: `ref-${Date.now()}`,
                    createdAt: now,
                    updatedAt: now,
                    ...form,
                    personalNote: form.personalNote ?? '',
                    tags: form.tags ?? [],
                  },
                  ...rows,
                ])
                setForm(defaultKnowledgeForm)
                setModalOpen(false)
              }}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white"
            >
              保存
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <select
            value={form.materialType}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, materialType: event.target.value as ReferenceKnowledgeItem['materialType'] }))
            }
            className="rounded border border-slate-200 px-3 py-2 text-sm"
          >
            {(['图书', '论文', '监管报告', '新闻资讯', '观点文章', '其他'] as const).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <input
            placeholder="来源机构/作者"
            value={form.sourceOrg}
            onChange={(event) => setForm((prev) => ({ ...prev, sourceOrg: event.target.value }))}
            className="rounded border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            placeholder="标题"
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            className="rounded border border-slate-200 px-3 py-2 text-sm md:col-span-2"
          />
          <input
            type="date"
            value={form.publishDate}
            onChange={(event) => setForm((prev) => ({ ...prev, publishDate: event.target.value }))}
            className="rounded border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            placeholder="原文链接"
            value={form.originLink ?? ''}
            onChange={(event) => setForm((prev) => ({ ...prev, originLink: event.target.value }))}
            className="rounded border border-slate-200 px-3 py-2 text-sm"
          />
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs text-slate-600">标签（多选）</span>
            <div className="flex flex-wrap gap-2 rounded border border-slate-200 p-2 text-sm">
              {TAG_OPTIONS.map((t) => (
                <label key={t} className="inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={form.tags.includes(t)}
                    onChange={() =>
                      setForm((prev) => ({
                        ...prev,
                        tags: prev.tags.includes(t) ? prev.tags.filter((x) => x !== t) : [...prev.tags, t],
                      }))
                    }
                  />
                  {t}
                </label>
              ))}
            </div>
          </label>
          <textarea
            placeholder="摘要"
            value={form.summary}
            onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))}
            className="h-20 rounded border border-slate-200 px-3 py-2 text-sm md:col-span-2"
          />
          <textarea
            placeholder="个人笔记"
            value={form.personalNote}
            onChange={(event) => setForm((prev) => ({ ...prev, personalNote: event.target.value }))}
            className="h-24 rounded border border-slate-200 px-3 py-2 text-sm md:col-span-2"
          />
        </div>
      </Modal>
    </ModuleWorkspace>
  )
}

