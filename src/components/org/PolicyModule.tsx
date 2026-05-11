import { Plus, RefreshCcw, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAMLData } from '../../hooks/useAMLData'
import { notionService } from '../../services/notionService'
import type { PolicyProcessItem } from '../../types'
import { DataTable, type TableColumn } from '../shared/DataTable'
import { Modal } from '../shared/Modal'
import { StatusBadge } from '../shared/StatusBadge'

type FormState = Pick<
  PolicyProcessItem,
  'category' | 'code' | 'name' | 'ownerDepartment' | 'version' | 'effectiveDate' | 'status' | 'description'
>

const defaultForm: FormState = {
  category: '制度',
  code: '',
  name: '',
  ownerDepartment: '',
  version: 'V1.0',
  effectiveDate: '',
  status: 'draft',
  description: '',
}

export function PolicyModule() {
  const [keyword, setKeyword] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'all' | '制度' | '流程'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | PolicyProcessItem['status']>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(defaultForm)

  const queryParams = useMemo(
    () => ({
      keyword,
      category: categoryFilter,
      status: statusFilter,
    }),
    [categoryFilter, keyword, statusFilter],
  )

  const { data, loading, error, setData, refetch } = useAMLData<PolicyProcessItem[]>(
    'policy',
    'query',
    queryParams,
  )

  const rows = useMemo(() => data ?? [], [data])

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const keywordMatch =
        keyword.trim() === '' ||
        row.name.includes(keyword) ||
        row.code.includes(keyword) ||
        row.ownerDepartment.includes(keyword)
      const categoryMatch = categoryFilter === 'all' || row.category === categoryFilter
      const statusMatch = statusFilter === 'all' || row.status === statusFilter
      return keywordMatch && categoryMatch && statusMatch
    })
  }, [categoryFilter, keyword, rows, statusFilter])

  const openCreateModal = () => {
    setEditingId(null)
    setForm(defaultForm)
    setModalOpen(true)
  }

  const openEditModal = (row: PolicyProcessItem) => {
    setEditingId(row.id)
    setForm({
      category: row.category,
      code: row.code,
      name: row.name,
      ownerDepartment: row.ownerDepartment,
      version: row.version,
      effectiveDate: row.effectiveDate,
      status: row.status,
      description: row.description ?? '',
    })
    setModalOpen(true)
  }

  const applyStatusChange = async (id: string, status: PolicyProcessItem['status']) => {
    await notionService.savePolicy({ id, status })
    const nextRows = rows.map((row) =>
      row.id === id ? { ...row, status, updatedAt: new Date().toISOString() } : row,
    )
    setData(nextRows)
  }

  const submitForm = async () => {
    if (!form.code.trim() || !form.name.trim() || !form.ownerDepartment.trim() || !form.effectiveDate) {
      window.alert('请完整填写制度/流程编码、名称、归属部门、生效日期')
      return
    }

    if (editingId) {
      await notionService.savePolicy({ id: editingId, ...form })
      const nextRows = rows.map((row) =>
        row.id === editingId ? { ...row, ...form, updatedAt: new Date().toISOString() } : row,
      )
      setData(nextRows)
    } else {
      const saveResult = await notionService.savePolicy(form)
      const newRecord: PolicyProcessItem = {
        id: saveResult.data.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        abolishedDate: undefined,
        ...form,
      }
      setData([newRecord, ...rows])
    }

    setModalOpen(false)
  }

  const columns: Array<TableColumn<PolicyProcessItem>> = [
    { key: 'code', title: '制度/流程编码' },
    { key: 'name', title: '名称' },
    { key: 'category', title: '类型' },
    { key: 'ownerDepartment', title: '归属部门' },
    { key: 'version', title: '版本' },
    { key: 'effectiveDate', title: '生效日期' },
    {
      key: 'status',
      title: '状态',
      render: (value) => <StatusBadge status={(value as PolicyProcessItem['status']) ?? 'draft'} />,
    },
    {
      key: 'id',
      title: '操作',
      className: 'whitespace-nowrap',
      render: (_value, row) => (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50"
            onClick={() => openEditModal(row)}
          >
            编辑
          </button>
          {row.status !== 'active' ? (
            <button
              type="button"
              className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700"
              onClick={() => void applyStatusChange(row.id, 'active')}
            >
              生效
            </button>
          ) : (
            <button
              type="button"
              className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700"
              onClick={() => void applyStatusChange(row.id, 'inactive')}
            >
              停用
            </button>
          )}
          {row.status !== 'archived' ? (
            <button
              type="button"
              className="rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-700"
              onClick={() => void applyStatusChange(row.id, 'archived')}
            >
              废止归档
            </button>
          ) : null}
        </div>
      ),
    },
  ]

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">制度与流程管理</h2>
          <p className="mt-1 text-sm text-slate-500">
            支持制度和流程的新增、修改、废止与查询。数据通过统一异步 hook 获取。
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 lg:grid-cols-4">
        <label className="space-y-1">
          <span className="text-xs font-medium text-slate-600">关键字</span>
          <div className="flex items-center rounded border border-slate-200 bg-white px-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="名称/编码/部门"
              className="w-full border-none px-2 py-2 text-sm outline-none"
            />
          </div>
        </label>

        <label className="space-y-1">
          <span className="text-xs font-medium text-slate-600">类型筛选</span>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value as typeof categoryFilter)}
            className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="all">全部类型</option>
            <option value="制度">制度</option>
            <option value="流程">流程</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs font-medium text-slate-600">状态筛选</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="all">全部状态</option>
            <option value="draft">草稿</option>
            <option value="active">生效</option>
            <option value="inactive">停用</option>
            <option value="archived">已归档</option>
          </select>
        </label>

        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => void refetch()}
            className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
          >
            <RefreshCcw className="h-4 w-4" />
            刷新
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            新建
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        rowKey={(row) => row.id}
        data={filteredRows}
        loading={loading}
        error={error}
        emptyText="未找到匹配的制度或流程记录"
      />

      <Modal
        open={modalOpen}
        title={editingId ? '编辑制度/流程' : '新建制度/流程'}
        onClose={() => setModalOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => setModalOpen(false)}
            >
              取消
            </button>
            <button
              type="button"
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              onClick={() => void submitForm()}
            >
              保存
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-600">类型</span>
            <select
              value={form.category}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  category: event.target.value as FormState['category'],
                }))
              }
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="制度">制度</option>
              <option value="流程">流程</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-600">制度/流程编码</span>
            <input
              value={form.code}
              onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              placeholder="例如 AML-ZD-2026-003"
            />
          </label>

          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-medium text-slate-600">名称</span>
            <input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-600">归属部门</span>
            <input
              value={form.ownerDepartment}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  ownerDepartment: event.target.value,
                }))
              }
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-600">版本</span>
            <input
              value={form.version}
              onChange={(event) => setForm((prev) => ({ ...prev, version: event.target.value }))}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-600">生效日期</span>
            <input
              type="date"
              value={form.effectiveDate}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  effectiveDate: event.target.value,
                }))
              }
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-600">状态</span>
            <select
              value={form.status}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  status: event.target.value as FormState['status'],
                }))
              }
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="draft">草稿</option>
              <option value="active">生效</option>
              <option value="inactive">停用</option>
              <option value="archived">已归档</option>
            </select>
          </label>

          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-medium text-slate-600">说明</span>
            <textarea
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              className="h-24 w-full rounded border border-slate-200 px-3 py-2 text-sm"
              placeholder="填写制度或流程的适用范围、关键控制点等"
            />
          </label>
        </div>
      </Modal>
    </section>
  )
}
