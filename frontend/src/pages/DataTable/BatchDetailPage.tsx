import { useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { dataApi } from '../../api/data'
import { uploadApi } from '../../api/upload'
import { useAuth } from '../../contexts/AuthContext'
import {
  ArrowLeft, Download, Trash2, Edit2, Check, X,
  Search, ChevronLeft, ChevronRight, Filter
} from 'lucide-react'

function StatusBadge({ status }: { status: string }) {
  if (status === 'Success')
    return <span className="flex items-center gap-1 text-green-700 text-xs font-semibold bg-green-50 border border-green-200 px-2 py-0.5 rounded-full"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />HOÀN TẤT</span>
  if (status === 'Processing')
    return <span className="flex items-center gap-1 text-yellow-700 text-xs font-semibold bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full"><span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" />ĐANG XỬ LÝ</span>
  if (status === 'Failed')
    return <span className="flex items-center gap-1 text-red-700 text-xs font-semibold bg-red-50 border border-red-200 px-2 py-0.5 rounded-full"><span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />THẤT BẠI</span>
  return <span className="text-gray-400 text-xs">{status}</span>
}

export default function BatchDetailPage() {
  const { dept, table, sessionId } = useParams<{ dept: string; table: string; sessionId: string }>()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const qc = useQueryClient()

  // Dataset display name
  const { data: depts } = useQuery({
    queryKey: ['departments'],
    queryFn: () => dataApi.getDepartments().then(r => r.data),
    staleTime: 60_000,
  })
  const sheetName = depts?.flatMap(d => d.tables ?? []).find(t => t.tableName === table)?.sheetName
    ?? table?.replace(/_/g, ' ')

  // Batch metadata from batch list
  const { data: batchesData } = useQuery({
    queryKey: ['batches', dept, table, 1, 200],
    queryFn: () => dataApi.getBatches(dept!, table!, 1, 200).then(r => r.data),
    enabled: !!dept && !!table,
  })
  const batch = batchesData?.items?.find(b => b.id === sessionId)

  // Upload session (for fileName, etc.)
  const { data: session } = useQuery({
    queryKey: ['upload-session', sessionId],
    queryFn: () => uploadApi.getStatus(sessionId!).then(r => r.data),
    enabled: !!sessionId,
  })

  // Edit states
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesInput, setNotesInput] = useState('')

  // Data table states
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
  const [columnFilterInputs, setColumnFilterInputs] = useState<Record<string, string>>({})

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const applyColumnFilter = useCallback((col: string, val: string) => {
    setColumnFilterInputs(prev => ({ ...prev, [col]: val }))
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setColumnFilters(prev => {
        const next = { ...prev }
        if (val.trim()) next[col] = val.trim()
        else delete next[col]
        return next
      })
      setPage(1)
    }, 400)
  }, [])

  const updateBatch = useMutation({
    mutationFn: (data: { batchName?: string; notes?: string }) =>
      dataApi.updateBatch(dept!, table!, sessionId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['batches'] })
      setEditingName(false)
      setEditingNotes(false)
    },
  })

  const deleteBatch = useMutation({
    mutationFn: () => dataApi.deleteBatch(sessionId!),
    onSuccess: () => navigate(`/data/${dept}/${table}`),
  })

  const { data: tableData, isLoading: tableLoading } = useQuery({
    queryKey: ['batch-data', dept, table, sessionId, page, pageSize, search, columnFilters],
    queryFn: () => dataApi.getData(
      dept!, table!, page, pageSize,
      search || undefined, sessionId,
      Object.keys(columnFilters).length > 0 ? columnFilters : undefined
    ).then(r => r.data),
    enabled: !!dept && !!table && !!sessionId,
  })

  const handleDownload = async () => {
    const res = await uploadApi.download(sessionId!)
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = session?.fileName ?? 'export.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportCSV = () => {
    if (!tableData) return
    const headers = tableData.columns.join(',') + '\n'
    const rows = tableData.rows.map(row =>
      tableData.columns.map(col => {
        const v = row[col]
        if (v == null) return ''
        const s = String(v)
        return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s
      }).join(',')
    ).join('\n')
    const blob = new Blob(['﻿' + headers + rows], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${batch?.batchName ?? table}_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const displayName = batch?.batchName ?? session?.fileName ?? '...'
  const totalPages = tableData ? Math.ceil(tableData.totalRows / pageSize) : 0
  const hasFilters = !!search || Object.keys(columnFilters).length > 0

  return (
    <div className="p-6 flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      {/* Breadcrumb */}
      <div className="text-xs text-gray-400 mb-2 flex items-center gap-1 flex-shrink-0">
        <button onClick={() => navigate(`/data/${dept}/${table}`)}
          className="hover:text-blue-600 transition-colors font-medium">{sheetName}</button>
        <span>/</span>
        <span className="text-gray-600">CHI TIẾT LÔ</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-5 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{displayName}</h1>
          <div className="flex items-center gap-3 mt-2">
            {batch?.dataMonth && (
              <span className="bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full text-xs font-bold">
                Tháng {batch.dataMonth}
              </span>
            )}
            {batch && (
              <span className="text-sm text-gray-500">{batch.rowCount.toLocaleString()} bản ghi</span>
            )}
            {batch && <StatusBadge status={batch.status} />}
          </div>
        </div>
        <button onClick={() => navigate(`/data/${dept}/${table}`)}
          className="btn-secondary flex items-center gap-2 flex-shrink-0">
          <ArrowLeft size={16} /> Quay lại
        </button>
      </div>

      {/* Body: left panel + right panel */}
      <div className="flex gap-5 flex-1 min-h-0">

        {/* ── Left panel: metadata ── */}
        <div className="w-64 flex-shrink-0 overflow-y-auto">
          <div className="card">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center justify-between">
              Thông tin lô
            </h3>

            <dl className="space-y-4 text-sm">
              {/* Batch name */}
              <div>
                <dt className="text-xs text-gray-400 mb-0.5">Tên lô</dt>
                {editingName ? (
                  <div className="flex gap-1 mt-1">
                    <input autoFocus className="input text-sm flex-1 py-1"
                      value={nameInput} onChange={e => setNameInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && updateBatch.mutate({ batchName: nameInput })} />
                    <button onClick={() => updateBatch.mutate({ batchName: nameInput })}
                      className="p-1 text-green-600 hover:bg-green-50 rounded" title="Lưu">
                      <Check size={14} />
                    </button>
                    <button onClick={() => setEditingName(false)}
                      className="p-1 text-gray-400 hover:bg-gray-50 rounded" title="Hủy">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <dd className="font-semibold text-gray-800 flex items-center justify-between group">
                    <span className="truncate pr-1">{displayName}</span>
                    <button onClick={() => { setNameInput(displayName); setEditingName(true) }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-blue-600 flex-shrink-0 transition-opacity">
                      <Edit2 size={12} />
                    </button>
                  </dd>
                )}
              </div>

              <div>
                <dt className="text-xs text-gray-400">Tháng dữ liệu</dt>
                <dd className="font-medium text-gray-800 mt-0.5">{batch?.dataMonth || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">Người c.t.n</dt>
                <dd className="font-medium text-gray-800 mt-0.5">{batch?.uploaderName || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">Ngày upload</dt>
                <dd className="font-medium text-gray-800 mt-0.5 text-xs">
                  {batch ? new Date(batch.uploadedAt).toLocaleString('vi-VN', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  }) : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">File gốc</dt>
                <dd className="font-medium text-gray-800 mt-0.5 text-xs break-all">{session?.fileName || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">Số bản ghi</dt>
                <dd className="font-bold text-gray-900 text-xl mt-0.5">{batch?.rowCount?.toLocaleString()}</dd>
              </div>

              {/* Notes */}
              <div>
                <dt className="text-xs text-gray-400 mb-0.5">Ghi chú</dt>
                {editingNotes ? (
                  <div className="mt-1">
                    <textarea autoFocus className="input text-sm w-full py-1 resize-none" rows={3}
                      value={notesInput} onChange={e => setNotesInput(e.target.value)} />
                    <div className="flex gap-1 mt-1">
                      <button onClick={() => updateBatch.mutate({ notes: notesInput })}
                        className="btn-primary text-xs py-1 px-2 flex items-center gap-1">
                        <Check size={12} /> Lưu
                      </button>
                      <button onClick={() => setEditingNotes(false)} className="btn-secondary text-xs py-1 px-2">Hủy</button>
                    </div>
                  </div>
                ) : (
                  <dd className="text-gray-700 flex items-start justify-between group">
                    <span className="text-sm">{batch?.notes || <span className="text-gray-300 italic">Chưa có ghi chú</span>}</span>
                    <button onClick={() => { setNotesInput(batch?.notes ?? ''); setEditingNotes(true) }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-blue-600 flex-shrink-0 transition-opacity ml-1">
                      <Edit2 size={12} />
                    </button>
                  </dd>
                )}
              </div>
            </dl>

            {/* Actions */}
            <div className="mt-5 pt-4 border-t border-gray-100 space-y-2">
              <button onClick={handleDownload}
                className="btn-secondary w-full text-sm flex items-center justify-center gap-2">
                <Download size={14} /> Tải file gốc
              </button>
              <button onClick={handleExportCSV} disabled={!tableData}
                className="btn-secondary w-full text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                <Download size={14} /> Xuất CSV
              </button>
              {isAdmin && (
                <button
                  onClick={() => {
                    if (confirm(`Xóa lô "${displayName}" sẽ xóa vĩnh viễn toàn bộ ${batch?.rowCount?.toLocaleString()} bản ghi. Tiếp tục?`))
                      deleteBatch.mutate()
                  }}
                  className="w-full text-sm flex items-center justify-center gap-2 px-3 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={14} /> Xóa lô
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Right panel: data table ── */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="card p-0 overflow-hidden flex flex-col flex-1 min-h-0">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Dữ liệu chi tiết
              </h3>
              <div className="flex gap-2 items-center">
                {hasFilters && (
                  <button
                    onClick={() => { setSearch(''); setSearchInput(''); setColumnFilters({}); setColumnFilterInputs({}); setPage(1) }}
                    className="flex items-center gap-1 text-xs text-red-600 border border-red-200 px-2 py-1 rounded hover:bg-red-50"
                  >
                    <X size={11} /> Xóa lọc
                  </button>
                )}
                <form onSubmit={e => { e.preventDefault(); setSearch(searchInput); setPage(1) }}>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1.5 text-gray-400" size={13} />
                    <input type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)}
                      placeholder="Tìm kiếm..."
                      className="input pl-8 py-1.5 text-xs w-44" />
                  </div>
                </form>
                <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
                  className="input text-xs py-1.5" style={{ width: 'auto' }}>
                  {[10, 25, 50, 100].map(s => <option key={s} value={s}>{s} dòng</option>)}
                </select>
              </div>
            </div>

            {/* Scrollable table */}
            <div className="overflow-auto flex-1 min-h-0">
              {tableLoading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin h-5 w-5 rounded-full border-2 border-blue-600 border-t-transparent" />
                </div>
              ) : tableData && tableData.columns.length > 0 ? (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm">
                    <tr className="border-b border-gray-200">
                      {tableData.columns.map(col => (
                        <th key={col} className="text-left px-3 py-2.5 font-semibold text-gray-500 whitespace-nowrap uppercase tracking-wider text-xs bg-gray-50">
                          {col}
                        </th>
                      ))}
                    </tr>
                    {/* Column filter row */}
                    <tr className="border-b border-gray-200">
                      {tableData.columns.map(col => (
                        <th key={col} className="px-2 py-1 bg-blue-50/50">
                          <div className="relative">
                            <Filter className="absolute left-1.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" size={9} />
                            <input
                              type="text"
                              value={columnFilterInputs[col] ?? ''}
                              onChange={e => applyColumnFilter(col, e.target.value)}
                              placeholder="Lọc..."
                              className="w-full pl-5 pr-4 py-0.5 text-xs border border-gray-200 rounded bg-white focus:outline-none focus:border-blue-400 min-w-[60px]"
                            />
                            {columnFilterInputs[col] && (
                              <button onClick={() => applyColumnFilter(col, '')}
                                className="absolute right-0.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                                <X size={8} />
                              </button>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {tableData.rows.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        {tableData.columns.map(col => (
                          <td key={col} className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-[200px] truncate">
                            {row[col] != null ? String(row[col]) : <span className="text-gray-300">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {tableData.rows.length === 0 && (
                      <tr>
                        <td colSpan={tableData.columns.length} className="text-center py-10 text-gray-400 text-sm">
                          {hasFilters ? 'Không tìm thấy kết quả' : 'Không có dữ liệu'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-12 text-gray-400 text-sm">Không có dữ liệu</div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 0 && (
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-200 bg-white flex-shrink-0 text-xs text-gray-500">
                <span>
                  {tableData && tableData.totalRows > 0
                    ? `${((page - 1) * pageSize + 1).toLocaleString()}–${Math.min(page * pageSize, tableData.totalRows).toLocaleString()} / ${tableData.totalRows.toLocaleString()} bản ghi`
                    : 'Không có bản ghi'}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="btn-secondary py-0.5 px-1.5 disabled:opacity-40"><ChevronLeft size={13} /></button>
                  <span className="px-2 font-semibold text-blue-600">{page} / {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="btn-secondary py-0.5 px-1.5 disabled:opacity-40"><ChevronRight size={13} /></button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
