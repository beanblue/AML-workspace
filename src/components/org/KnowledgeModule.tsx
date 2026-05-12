import { Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAMLData } from '../../hooks/useAMLData'
import type { ReferenceKnowledgeItem } from '../../types'
import { Modal } from '../shared/Modal'

type Category = '全部' | '法规解读' | '监管动态' | '问答FAQ' | '学习资料'

const CATEGORY_OPTIONS: Category[] = ['全部', '法规解读', '监管动态', '问答FAQ', '学习资料']

const TOPIC_OPTIONS = ['风险评级', 'CDD', 'STR', '国际标准', 'FATF', '大额交易', '制裁筛查'] as const

const MATERIAL_TYPE_CLASS: Record<ReferenceKnowledgeItem['materialType'], string> = {
  图书: 'bg-blue-100 text-blue-700',
  论文: 'bg-violet-100 text-violet-700',
  监管报告: 'bg-orange-100 text-orange-700',
  新闻资讯: 'bg-emerald-100 text-emerald-700',
  观点文章: 'bg-slate-100 text-slate-700',
  其他: 'bg-slate-100 text-slate-700',
}

type KnowledgeFormState = Pick<
  ReferenceKnowledgeItem,
  'materialType' | 'title' | 'sourceOrg' | 'publishDate' | 'summary' | 'tags' | 'originLink' | 'personalNote'
>

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

function buildMockKnowledge(): ReferenceKnowledgeItem[] {
  const now = new Date().toISOString()
  return [
    {
      id: 'mock-1',
      createdAt: now,
      updatedAt: now,
      materialType: '图书',
      title: '金融机构反洗钱合规研究',
      sourceOrg: '中国人民银行',
      publishDate: '2024-06-01',
      summary: '围绕金融机构反洗钱合规体系建设，讨论风险评级与国际标准在制度、流程与审查中的落地要点。',
      tags: ['风险评级', '国际标准'],
      personalNote: '',
    },
    {
      id: 'mock-2',
      createdAt: now,
      updatedAt: now,
      materialType: '监管报告',
      title: 'FATF 40项建议',
      sourceOrg: 'FATF',
      publishDate: '2023-10-01',
      summary: '对 FATF 40 项建议的核心框架与实施要点进行梳理，聚焦风险为本方法与跨境协作机制。',
      tags: ['FATF', '国际标准'],
      personalNote: '',
    },
    {
      id: 'mock-3',
      createdAt: now,
      updatedAt: now,
      materialType: '监管报告',
      title: '关于加强反洗钱工作的指导意见',
      sourceOrg: '银保监会',
      publishDate: '2022-08-18',
      summary: '从客户尽职调查与可疑交易报告两个维度提出合规要求与组织保障建议，强调制度与流程闭环。',
      tags: ['CDD', 'STR'],
      personalNote: '',
    },
    {
      id: 'mock-4',
      createdAt: now,
      updatedAt: now,
      materialType: '论文',
      title: '洗钱风险评估方法研究',
      sourceOrg: '某高校',
      publishDate: '2023-04-10',
      summary: '提出面向机构的洗钱风险评估框架与指标体系，并对样本数据进行建模验证与敏感性分析。',
      tags: ['风险评级'],
      personalNote: '',
    },
  ]
}

export function KnowledgeModule() {
  const { data, loading, error, setData } = useAMLData<ReferenceKnowledgeItem[]>('policyKnowledge', 'query')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<Category>('全部')
  const [topics, setTopics] = useState<Array<(typeof TOPIC_OPTIONS)[number]>>([])

  const [modalOpen, setModalOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailItem, setDetailItem] = useState<ReferenceKnowledgeItem | null>(null)
  const [form, setForm] = useState<KnowledgeFormState>(defaultKnowledgeForm)

  const baseRows = useMemo(() => {
    const rows = data && data.length > 0 ? data : buildMockKnowledge()
    return rows.slice(0, 4)
  }, [data])

  const categorizedRows = useMemo(() => {
    const map: Record<string, Category> = {
      [baseRows[0]?.id ?? '']: '学习资料',
      [baseRows[1]?.id ?? '']: '法规解读',
      [baseRows[2]?.id ?? '']: '监管动态',
      [baseRows[3]?.id ?? '']: '学习资料',
    }
    return baseRows.map((item) => ({ item, category: map[item.id] ?? '学习资料' }))
  }, [baseRows])

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return categorizedRows
      .filter((row) => (category === '全部' ? true : row.category === category))
      .filter((row) => {
        if (topics.length === 0) return true
        return topics.some((t) => row.item.tags.includes(t))
      })
      .filter((row) => {
        if (keyword === '') return true
        return [row.item.title, row.item.summary, row.item.sourceOrg].join(' ').toLowerCase().includes(keyword)
      })
      .map((row) => row.item)
  }, [categorizedRows, category, search, topics])

  const toggleTopic = (topic: (typeof TOPIC_OPTIONS)[number]) => {
    setTopics((prev) => (prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]))
  }

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">知识库</h2>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-2 text-sm text-white"
        >
          <Plus className="h-4 w-4" />
          + 新建资料
        </button>
      </header>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center rounded-lg border border-slate-200 bg-white px-3">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索法规、监管文件、研究资料..."
            className="w-full border-none px-2 py-3 text-sm outline-none"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORY_OPTIONS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              category === c ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {TOPIC_OPTIONS.map((topic) => (
          <button
            key={topic}
            type="button"
            onClick={() => toggleTopic(topic)}
            className={`rounded-full border px-2 py-1 text-xs ${
              topics.includes(topic)
                ? 'border-violet-200 bg-violet-50 text-violet-700'
                : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            {topic}
          </button>
        ))}
      </div>

      {loading ? <div className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-500">加载中...</div> : null}
      {error ? <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {filtered.map((item) => (
          <article
            key={item.id}
            className="group relative rounded-xl border border-slate-200 bg-white p-4 transition hover:border-blue-200"
          >
            <div className="flex items-start justify-between gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs ${MATERIAL_TYPE_CLASS[item.materialType]}`}>
                {item.materialType}
              </span>
              <span className="text-xs text-slate-500">{item.sourceOrg}</span>
            </div>

            <p className="mt-3 line-clamp-2 text-base font-semibold text-slate-900">{item.title}</p>
            <p className="mt-2 text-sm text-slate-500">{item.summary.slice(0, 60)}</p>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {item.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {tag}
                  </span>
                ))}
              </div>
              <span className="text-xs text-slate-500">{item.publishDate}</span>
            </div>

            <button
              type="button"
              onClick={() => {
                setDetailItem(item)
                setDetailOpen(true)
              }}
              className="absolute right-4 top-4 hidden rounded bg-blue-600 px-2 py-1 text-xs text-white group-hover:inline-flex"
            >
              查看详情
            </button>
          </article>
        ))}
      </div>

      <Modal
        open={detailOpen}
        title="资料详情"
        onClose={() => setDetailOpen(false)}
        footer={
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setDetailOpen(false)}
              className="rounded border border-slate-200 px-3 py-1.5 text-sm"
            >
              关闭
            </button>
          </div>
        }
      >
        {detailItem ? (
          <div className="space-y-2 text-sm text-slate-700">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs ${MATERIAL_TYPE_CLASS[detailItem.materialType]}`}>
                {detailItem.materialType}
              </span>
              <span className="text-xs text-slate-500">{detailItem.sourceOrg}</span>
              <span className="text-xs text-slate-500">{detailItem.publishDate}</span>
            </div>
            <p className="text-base font-semibold text-slate-900">{detailItem.title}</p>
            <p className="text-sm text-slate-600">{detailItem.summary}</p>
            <div className="flex flex-wrap gap-2">
              {detailItem.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={modalOpen}
        title="新建资料"
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
                  ...(data ?? []),
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
            <span className="text-xs text-slate-600">主题标签（多选）</span>
            <div className="flex flex-wrap gap-2 rounded border border-slate-200 p-2 text-sm">
              {TOPIC_OPTIONS.map((t) => (
                <label key={t} className="inline-flex items-center gap-1 text-xs">
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
        </div>
      </Modal>
    </section>
  )
}

