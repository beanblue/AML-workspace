import { ArrowLeft, ChevronRight, ExternalLink, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { queryDatabase } from '../api/notion'

type DocumentStatus = '有效' | '拟稿草案' | '已废止' | '仅参考' | string

type NotionDocumentRow = {
  id: string
  标题?: string
  Name?: string
  类型?: string
  状态?: DocumentStatus
  文档类型?: string
  反洗钱识别标签?: string
  适用范围?: string
  来源?: string
  '生效/发布日期'?: string
  摘要?: string
  '关键要点/适用情景'?: string
  主题标签?: string[] | string
}

const STATUS_CLASS: Record<string, string> = {
  有效: 'bg-emerald-100 text-emerald-700',
  拟稿: 'bg-blue-100 text-blue-700',
  拟稿草案: 'bg-blue-100 text-blue-700',
  已废止: 'bg-slate-100 text-slate-700',
  仅参考: 'bg-yellow-100 text-yellow-800',
}

const TYPE_CLASS = 'bg-slate-100 text-slate-700'

const TOPIC_CLASS_POOL = [
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-orange-100 text-orange-700',
  'bg-slate-100 text-slate-700',
]

function normalizeTopics(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).map((v) => v.trim()).filter(Boolean)
  if (typeof raw === 'string') {
    const v = raw.trim()
    if (!v) return []
    if (v.includes(',') || v.includes('，')) return v.split(/[,，]/).map((x) => x.trim()).filter(Boolean)
    return [v]
  }
  return []
}

export default function LibraryDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const relatedRef = useRef<HTMLDivElement | null>(null)

  const [allDocs, setAllDocs] = useState<NotionDocumentRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [activeTopic, setActiveTopic] = useState<string>('')
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const result = await queryDatabase('documents')
        setAllDocs(result.map((item) => item as unknown as NotionDocumentRow))
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    }

    void run()
  }, [])

  const current = useMemo(() => allDocs.find((item) => item.id === id) ?? null, [allDocs, id])
  const title = String(current?.标题 ?? current?.Name ?? '')
  const type = String(current?.类型 ?? '')
  const status = String(current?.状态 ?? '')
  const source = String(current?.来源 ?? '')
  const publishDate = String(current?.['生效/发布日期'] ?? '')
  const docType = String(current?.文档类型 ?? '')
  const amlTag = String(current?.反洗钱识别标签 ?? '')
  const scope = String(current?.适用范围 ?? '')
  const summary = String(current?.摘要 ?? '')
  const keyPoints = String(current?.['关键要点/适用情景'] ?? '')
  const topics = useMemo(() => normalizeTopics(current?.主题标签), [current?.主题标签])

  useEffect(() => {
    if (!activeTopic && topics.length > 0) setActiveTopic(topics[0])
  }, [activeTopic, topics])

  const relatedDocs = useMemo(() => {
    if (!activeTopic) return []
    return allDocs
      .filter((item) => item.id !== id)
      .filter((item) => normalizeTopics(item.主题标签).includes(activeTopic))
      .slice(0, 8)
  }, [activeTopic, allDocs, id])

  const keywordHits = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    if (!kw) return []
    return allDocs
      .filter((item) => item.id !== id)
      .filter((item) => {
        const t = String(item.标题 ?? item.Name ?? '')
        const s = String(item.摘要 ?? '')
        const k = String(item['关键要点/适用情景'] ?? '')
        return [t, s, k].join(' ').toLowerCase().includes(kw)
      })
      .slice(0, 8)
  }, [allDocs, id, keyword])

  const statusClass = STATUS_CLASS[status] ?? 'bg-slate-100 text-slate-700'

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => navigate('/org/library')}
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          返回
        </button>
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
          <ExternalLink className="h-3 w-3" />
          来自 Notion
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <span className="inline-flex items-center gap-1">
          文件库 <ChevronRight className="h-4 w-4" />
        </span>
        <span className="inline-flex items-center gap-1">
          制度与流程 <ChevronRight className="h-4 w-4" />
        </span>
        <span className="text-slate-700">{title || '文档详情'}</span>
      </div>

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">加载中...</div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>
      ) : null}

      {!loading && !error && !current ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">未找到该文档</div>
      ) : null}

      {!loading && !error && current ? (
        <div className="space-y-4">
          <article className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold text-slate-900">{title || '未命名文档'}</h1>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {type ? <span className={`rounded-full px-2 py-0.5 text-xs ${TYPE_CLASS}`}>{type}</span> : null}
                  {status ? (
                    <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass}`}>{status}</span>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-600">
                  {source ? <span>来源：{source}</span> : null}
                  {publishDate ? <span>生效/发布日期：{publishDate}</span> : null}
                </div>
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-900">元信息</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-500">文档类型</p>
                <p className="mt-1 text-sm text-slate-700">{docType || '—'}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-500">反洗钱识别标签</p>
                <p className="mt-1 text-sm text-slate-700">{amlTag || '—'}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-500">适用范围</p>
                <p className="mt-1 text-sm text-slate-700">{scope || '—'}</p>
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">主题标签</h2>
              <button
                type="button"
                onClick={() => {
                  relatedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                className="text-sm text-blue-600"
              >
                查看相关文档 →
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {topics.length === 0 ? (
                <span className="text-sm text-slate-500">—</span>
              ) : (
                topics.map((topic, idx) => (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => {
                      setActiveTopic(topic)
                      relatedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }}
                    className={`rounded-full px-3 py-1 text-sm ${
                      activeTopic === topic ? 'bg-blue-600 text-white' : TOPIC_CLASS_POOL[idx % TOPIC_CLASS_POOL.length]
                    }`}
                  >
                    {topic}
                  </button>
                ))
              )}
            </div>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-900">摘要</h2>
            <p className="mt-3 whitespace-pre-line text-sm text-slate-700">{summary || '—'}</p>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-900">关键要点 / 适用情景</h2>
            <p className="mt-3 whitespace-pre-line text-sm text-slate-700">{keyPoints || '—'}</p>
          </article>

          <article ref={relatedRef} className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-900">相关文档</h2>
            <p className="mt-1 text-sm text-slate-500">{activeTopic ? `主题标签：${activeTopic}` : '请先选择主题标签'}</p>
            <div className="mt-4 space-y-2">
              {activeTopic && relatedDocs.length === 0 ? (
                <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">暂无相关文档</div>
              ) : null}
              {relatedDocs.map((item) => {
                const t = String(item.标题 ?? item.Name ?? '')
                const ty = String(item.类型 ?? '')
                const st = String(item.状态 ?? '')
                const stClass = STATUS_CLASS[st] ?? 'bg-slate-100 text-slate-700'
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(`/library/${item.id}`)}
                    className="flex w-full items-center justify-between gap-3 rounded border border-slate-200 bg-white px-3 py-2 text-left hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{t || '未命名文档'}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        {ty ? <span className={`rounded-full px-2 py-0.5 ${TYPE_CLASS}`}>{ty}</span> : null}
                        {st ? <span className={`rounded-full px-2 py-0.5 ${stClass}`}>{st}</span> : null}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </button>
                )
              })}
            </div>

            <div className="mt-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">关键字搜索</h3>
                <span className="text-xs text-slate-500">在当前库内按标题/摘要/关键要点匹配</span>
              </div>
              <div className="mt-2 flex items-center rounded border border-slate-200 bg-slate-50 px-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="输入关键字..."
                  className="w-full border-none bg-transparent px-2 py-2 text-sm outline-none"
                />
              </div>
              {keyword.trim() ? (
                <div className="mt-3 space-y-2">
                  {keywordHits.length === 0 ? (
                    <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">无匹配结果</div>
                  ) : (
                    keywordHits.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => navigate(`/library/${item.id}`)}
                        className="flex w-full items-center justify-between gap-3 rounded border border-slate-200 bg-white px-3 py-2 text-left hover:bg-slate-50"
                      >
                        <p className="truncate text-sm text-slate-700">{String(item.标题 ?? item.Name ?? '') || '未命名文档'}</p>
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-900">相关案例</h2>
            <div className="mt-3 rounded border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
              暂无案例，功能建设中
            </div>
          </article>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => navigate('/org/library')}
              className="rounded bg-blue-600 px-4 py-2 text-sm text-white"
            >
              返回列表
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}

