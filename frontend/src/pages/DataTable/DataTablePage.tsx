import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { dataApi } from '../../api/data'
import { useAuth } from '../../contexts/AuthContext'
import {
  Plus, RefreshCw, Eye, Trash2, Search, X,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight
} from 'lucide-react'
import type { BatchListItem } from '../../types'
import UploadModal from './UploadModal'

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'Success', label: 'Hoàn tất' },
  { value: 'Processing', label: 'Đang xử lý' },
  { value: 'Failed', label: 'Thất bại' },
]

function StatusBadge({ status }: { status: string }) {
  if (status === 'Success')
    return <span className="flex items-center gap-1 text-green-700 text-xs font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />HOÀN TẤT</span>
  if (status === 'Processing')
    return <span className="flex items-center gap-1 text-yellow-700 text-xs font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" />ĐANG XỬ LÝ</span>
  if (status === 'Failed')
    return <span className="flex items-center gap-1 text-red-700 text-xs font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />THẤT BẠI</span>
  return <span className="text-gray-400 text-xs">{status}</span>
}

export default function DataTablePage() {
  const { dept, table } = useParams<{ dept: string; table: string }>()
  const navigate = useNavigate()
  const { isAdmin, user } = useAuth()
  const qc = useQueryClient()

  const { data: depts } = useQuery({
    queryKey: ['departments'],
    queryFn: () => dataApi.getDepartments().then(r => r.data),
    staleTime: 60_000,
  })

  // Get dataset info for display
  const deptInfo = depts?.find(d => d.code === dept)
  const sheetName = depts?.flatMap(d => d.tables ?? []).find(t => t.tableName === table)?.sheetName
    ?? table?.replace(/_/g, ' ')

  // Get mappingId for "Tạo lô mới" → upload page
  const { data: mappingsData } = useQuery({
    queryKey: ['sheet-mappings-upload'],
    queryFn: () => dataApi.getSheetMappings().then(r => r.data),
    staleTime: 60_000,
  })
  const mappingId = mappingsData?.find(m => m.tableName === table)?.id ?? ''

  const [showUpload, setShowUpload] = useState(false)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['batches', dept, table, page, pageSize, search, filterMonth, filterStatus],
    queryFn: () => dataApi.getBatches(
      dept!, table!, page, pageSize,
      search || undefined, filterMonth || undefined, filterStatus || undefined
    ).then(r => r.data),
    enabled: !!dept && !!table,
  })

  const deleteBatch = useMutation({
    mutationFn: (sessionId: string) => dataApi.deleteBatch(dept!, table!, sessionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['batches', dept, table] }),
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const totalPages = data ? Math.ceil(data.totalCount / pageSize) : 0

  // Distinct months from loaded data for filter dropdown
  const months = Array.from(new Set(data?.items?.map(i => i.dataMonth).filter(Boolean) ?? []))

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
        <span>DỮ LIỆU</span>
        <span>/</span>
        <span className="text-gray-600 font-medium">PHÂN HỆ {dept?.toUpperCase()}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{sheetName}</h1>
          <div className="flex items-center flex-wrap gap-3 mt-2 text-sm text-gray-500">
            <span>
              Phòng <strong className="text-gray-700">{deptInfo?.name ?? dept}</strong>
            </span>
            {data && (
              <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-medium">
                {data.totalCount} lô upload
              </span>
            )}
            {data?.items?.[0] && (
              <span>
                Cập nhật{' '}
                <strong className="text-gray-700">
                  {new Date(data.items[0].uploadedAt).toLocaleDateString('vi-VN')}
                </strong>
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="btn-secondary flex items-center gap-2">
            <RefreshCw size={16} /> Làm mới
          </button>
          <button onClick={() => setShowUpload(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Tạo lô mới
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-0 max-w-lg">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={14} />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Tìm theo tên lô, người tạo, ghi chú..."
              className="input pl-9 w-full text-sm"
            />
          </div>
          <button type="submit" className="btn-secondary text-sm px-3">Tìm</button>
          {search && (
            <button type="button" onClick={() => { setSearch(''); setSearchInput(''); setPage(1) }}
              className="btn-secondary px-2"><X size={14} />
            </button>
          )}
        </form>

        <select value={filterMonth} onChange={e => { setFilterMonth(e.target.value); setPage(1) }}
          className="input text-sm py-1.5" style={{ width: 'auto' }}>
          <option value="">Tất cả tháng</option>
          {months.map(m => <option key={m} value={m!}>{m}</option>)}
        </select>

        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
          className="input text-sm py-1.5" style={{ width: 'auto' }}>
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
          className="input text-sm py-1.5 ml-auto" style={{ width: 'auto' }}>
          {[10, 20, 50].map(s => <option key={s} value={s}>Hiển thị {s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider w-24">Tháng</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Tên lô</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Người C.T.N</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider w-24">Bản ghi</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Ngày upload</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Trạng thái</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Ghi chú</th>
                    <th className="w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data?.items?.map((batch: BatchListItem) => (
                    <tr
                      key={batch.id}
                      className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                      onClick={() => navigate(`/data/${dept}/${table}/${batch.id}`)}
                    >
                      <td className="px-4 py-3">
                        {batch.dataMonth
                          ? <span className="inline-block bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded">{batch.dataMonth}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 font-semibold text-blue-700">{batch.batchName}</td>
                      <td className="px-4 py-3 text-gray-600">{batch.uploaderUsername}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800">{batch.rowCount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(batch.uploadedAt).toLocaleDateString('vi-VN')}{' '}
                        {new Date(batch.uploadedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={batch.status} /></td>
                      <td className="px-4 py-3 text-gray-400 text-xs max-w-[200px] truncate">{batch.notes || '—'}</td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-0.5 justify-end">
                          <button
                            onClick={() => navigate(`/data/${dept}/${table}/${batch.id}`)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors"
                            title="Xem chi tiết"
                          >
                            <Eye size={15} />
                          </button>
                          {(isAdmin || user?.username === batch.uploaderUsername) && (
                            <button
                              onClick={() => {
                                if (confirm(`Xóa lô "${batch.batchName}" sẽ xóa toàn bộ ${batch.rowCount.toLocaleString()} bản ghi. Tiếp tục?`))
                                  deleteBatch.mutate(batch.id)
                              }}
                              className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors"
                              title="Xóa lô"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!data?.items || data.items.length === 0) && (
                    <tr>
                      <td colSpan={8} className="text-center py-16 text-gray-400">
                        <p className="mb-3 text-base">Chưa có lô dữ liệu nào</p>
                        <button onClick={() => setShowUpload(true)} className="btn-primary text-sm flex items-center gap-2 mx-auto">
                          <Plus size={16} /> Tạo lô đầu tiên
                        </button>
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
                  Hiển thị {((page - 1) * pageSize + 1)}–{Math.min(page * pageSize, data?.totalCount ?? 0)} trong tổng {data?.totalCount} lô
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(1)} disabled={page === 1} className="btn-secondary py-1 px-2 disabled:opacity-40"><ChevronsLeft size={14} /></button>
                  <button onClick={() => setPage(p => p - 1)} disabled={page === 1} className="btn-secondary py-1 px-2 disabled:opacity-40"><ChevronLeft size={14} /></button>
                  <span className="px-3 py-1 text-sm font-semibold text-blue-600">{page} / {totalPages}</span>
                  <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages} className="btn-secondary py-1 px-2 disabled:opacity-40"><ChevronRight size={14} /></button>
                  <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="btn-secondary py-1 px-2 disabled:opacity-40"><ChevronsRight size={14} /></button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Upload modal */}
      {showUpload && (
        <UploadModal
          mappingId={mappingId}
          dept={dept!}
          table={table!}
          sheetName={sheetName ?? table ?? ''}
          onClose={() => setShowUpload(false)}
        />
      )}
    </div>
  )
}
