import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { dataApi } from '../../api/data'
import { Search, X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react'

// ── Action metadata ──────────────────────────────────────────────────────────

const ACTION_META: Record<string, { label: string; color: string }> = {
  BATCH_CREATED:   { label: 'Tạo lô',              color: 'bg-green-100 text-green-700' },
  BATCH_UPDATED:   { label: 'Cập nhật lô',          color: 'bg-blue-100 text-blue-700' },
  BATCH_DELETED:   { label: 'Xóa lô',               color: 'bg-red-100 text-red-700' },
  USER_CREATED:    { label: 'Tạo người dùng',        color: 'bg-green-100 text-green-700' },
  USER_UPDATED:    { label: 'Cập nhật người dùng',   color: 'bg-blue-100 text-blue-700' },
  USER_DELETED:    { label: 'Xóa người dùng',        color: 'bg-red-100 text-red-700' },
  PASSWORD_RESET:  { label: 'Đặt lại mật khẩu',     color: 'bg-orange-100 text-orange-700' },
  DATASET_CREATED: { label: 'Tạo dataset',           color: 'bg-green-100 text-green-700' },
  DATASET_UPDATED: { label: 'Cập nhật dataset',      color: 'bg-blue-100 text-blue-700' },
  DATASET_DELETED: { label: 'Xóa dataset',           color: 'bg-red-100 text-red-700' },
  FIELD_CREATED:   { label: 'Thêm trường',           color: 'bg-green-100 text-green-700' },
  FIELD_UPDATED:   { label: 'Cập nhật trường',       color: 'bg-blue-100 text-blue-700' },
  FIELD_DELETED:   { label: 'Xóa trường',            color: 'bg-red-100 text-red-700' },
}

const ENTITY_TYPES = [
  { value: '', label: 'Tất cả đối tượng' },
  { value: 'Batch', label: 'Lô dữ liệu' },
  { value: 'User', label: 'Người dùng' },
  { value: 'Dataset', label: 'Dataset' },
  { value: 'DatasetField', label: 'Trường dữ liệu' },
]

function ActionBadge({ action }: { action: string }) {
  const meta = ACTION_META[action] ?? { label: action, color: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${meta.color}`}>
      {meta.label}
    </span>
  )
}

function DetailsCell({ details }: { details?: string }) {
  const [open, setOpen] = useState(false)
  if (!details || details === '{}' || details === 'null') return <span className="text-gray-300">—</span>

  let parsed: Record<string, unknown>
  try { parsed = JSON.parse(details) } catch { return <span className="text-xs text-gray-500 font-mono truncate max-w-[160px]">{details}</span> }

  const entries = Object.entries(parsed).filter(([, v]) => v !== null && v !== '' && v !== undefined)
  if (entries.length === 0) return <span className="text-gray-300">—</span>

  return (
    <div>
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
        {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        {entries.length} mục
      </button>
      {open && (
        <div className="mt-1 bg-gray-50 border border-gray-200 rounded p-2 text-xs space-y-0.5 min-w-[180px]">
          {entries.map(([k, v]) => (
            <div key={k} className="flex gap-1">
              <span className="text-gray-400 shrink-0">{k}:</span>
              <span className="text-gray-700 break-all">{String(v)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main tab ─────────────────────────────────────────────────────────────────

export default function AuditLogsTab() {
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  const [filterAction, setFilterAction] = useState('')
  const [filterEntityType, setFilterEntityType] = useState('')
  const [filterUsername, setFilterUsername] = useState('')
  const [filterUsernameInput, setFilterUsernameInput] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, pageSize, filterAction, filterEntityType, filterUsername, filterFrom, filterTo],
    queryFn: () => dataApi.getAuditLogs({
      page, pageSize,
      action: filterAction || undefined,
      entityType: filterEntityType || undefined,
      username: filterUsername || undefined,
      from: filterFrom || undefined,
      to: filterTo || undefined,
    }).then(r => r.data),
  })

  const totalPages = data ? Math.ceil(data.totalCount / pageSize) : 0

  const hasFilter = filterAction || filterEntityType || filterUsername || filterFrom || filterTo
  const clearFilters = () => {
    setFilterAction(''); setFilterEntityType('')
    setFilterUsername(''); setFilterUsernameInput('')
    setFilterFrom(''); setFilterTo(''); setPage(1)
  }

  const applyUsername = (e: React.FormEvent) => {
    e.preventDefault()
    setFilterUsername(filterUsernameInput)
    setPage(1)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-700">
          Nhật ký hoạt động
          {data && <span className="ml-2 text-sm font-normal text-gray-400">({data.totalCount.toLocaleString()} bản ghi)</span>}
        </h2>
        {hasFilter && (
          <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-red-600 border border-red-200 px-2 py-1 rounded hover:bg-red-50">
            <X size={11} /> Xóa bộ lọc
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Hành động</label>
          <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(1) }}
            className="input text-sm py-1.5" style={{ width: 'auto' }}>
            <option value="">Tất cả hành động</option>
            {Object.entries(ACTION_META).map(([v, m]) => (
              <option key={v} value={v}>{m.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Đối tượng</label>
          <select value={filterEntityType} onChange={e => { setFilterEntityType(e.target.value); setPage(1) }}
            className="input text-sm py-1.5" style={{ width: 'auto' }}>
            {ENTITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <form onSubmit={applyUsername}>
          <label className="block text-xs text-gray-500 mb-1">Người dùng</label>
          <div className="flex gap-1">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 text-gray-400" size={13} />
              <input type="text" value={filterUsernameInput}
                onChange={e => setFilterUsernameInput(e.target.value)}
                placeholder="Tên đăng nhập..."
                className="input pl-8 text-sm py-1.5 w-44" />
            </div>
            <button type="submit" className="btn-secondary text-sm px-3 py-1.5">Tìm</button>
            {filterUsername && (
              <button type="button" onClick={() => { setFilterUsername(''); setFilterUsernameInput(''); setPage(1) }}
                className="btn-secondary px-2 py-1.5"><X size={13} /></button>
            )}
          </div>
        </form>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Từ ngày</label>
          <input type="date" value={filterFrom}
            onChange={e => { setFilterFrom(e.target.value); setPage(1) }}
            className="input text-sm py-1.5" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Đến ngày</label>
          <input type="date" value={filterTo}
            onChange={e => { setFilterTo(e.target.value); setPage(1) }}
            className="input text-sm py-1.5" />
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-5 w-5 rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider whitespace-nowrap">Thời gian</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Hành động</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Đối tượng</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Tên</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Người thực hiện</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Chi tiết</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data?.items?.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('vi-VN', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit', second: '2-digit'
                        })}
                      </td>
                      <td className="px-4 py-2.5">
                        <ActionBadge action={log.action} />
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">
                        {ENTITY_TYPES.find(t => t.value === log.entityType)?.label ?? log.entityType}
                      </td>
                      <td className="px-4 py-2.5 text-sm font-medium text-gray-700 max-w-[200px] truncate">
                        {log.entityName || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="text-sm font-medium text-gray-700">{log.username || '—'}</div>
                        {log.departmentCode && (
                          <div className="text-xs text-gray-400">{log.departmentCode}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <DetailsCell details={log.details} />
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-400 font-mono">
                        {log.ipAddress || '—'}
                      </td>
                    </tr>
                  ))}
                  {(!data?.items || data.items.length === 0) && (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-gray-400">
                        Không có bản ghi nhật ký nào
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                <p className="text-sm text-gray-500">
                  {((page - 1) * pageSize + 1)}–{Math.min(page * pageSize, data?.totalCount ?? 0)} / {data?.totalCount} bản ghi
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="btn-secondary py-1 px-2 disabled:opacity-40"><ChevronLeft size={14} /></button>
                  <span className="px-3 py-1 text-sm font-semibold text-blue-600">{page} / {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="btn-secondary py-1 px-2 disabled:opacity-40"><ChevronRight size={14} /></button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
