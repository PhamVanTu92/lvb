import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../../api/client'
import { dataApi } from '../../api/data'
import { ArrowLeft, CheckCircle, XCircle, Clock, Download, ChevronLeft, ChevronRight, Search } from 'lucide-react'

export default function HistoryDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const pageSize = 50

  // Load session info
  const { data: session } = useQuery({
    queryKey: ['upload-session', sessionId],
    queryFn: () => api.get(`/upload/${sessionId}/status`).then(r => r.data),
    enabled: !!sessionId,
  })

  // Lấy sheet result đầu tiên có dữ liệu
  const sheetResult = session?.sheetResults?.find((r: { mappedTableName: string | null; insertedRows: number }) =>
    r.mappedTableName && r.insertedRows > 0
  )
  const tableName = sheetResult?.mappedTableName
  const deptCode = session?.departmentCode

  // Load dữ liệu lọc theo sessionId
  const { data: tableData, isLoading } = useQuery({
    queryKey: ['session-data', sessionId, tableName, deptCode, page, search],
    queryFn: () => dataApi.getData(deptCode!, tableName!, page, pageSize, search || undefined, sessionId)
      .then(r => r.data),
    enabled: !!tableName && !!deptCode && !!sessionId,
  })

  const totalPages = tableData ? Math.ceil(tableData.totalRows / pageSize) : 0

  const handleExport = () => {
    if (!tableData) return
    const headers = tableData.columns.join(',') + '\n'
    const rows = tableData.rows.map(row =>
      tableData.columns.map(col => {
        const v = row[col]
        return typeof v === 'string' && v.includes(',') ? `"${v}"` : (v ?? '')
      }).join(',')
    ).join('\n')
    const blob = new Blob(['﻿' + headers + rows], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${tableName}_${sessionId?.slice(0, 8)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const statusIcon = (s: string) =>
    s === 'Success' ? <CheckCircle className="text-green-500" size={20} />
    : s === 'Failed' ? <XCircle className="text-red-500" size={20} />
    : <Clock className="text-yellow-500" size={20} />

  return (
    <div className="p-6 max-w-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-4">
          <button
            onClick={() => navigate('/history')}
            className="mt-1 text-gray-400 hover:text-gray-700 p-1"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              {session && statusIcon(session.status)}
              <h1 className="text-xl font-bold text-gray-900">
                {session?.fileName ?? 'Chi tiết upload'}
              </h1>
            </div>
            <div className="flex flex-wrap gap-4 mt-1 text-sm text-gray-500">
              {session?.uploaderName && <span>Người đẩy: <strong>{session.uploaderName}</strong></span>}
              {session?.uploadedAt && (
                <span>Thời gian: <strong>{new Date(session.uploadedAt).toLocaleString('vi-VN')}</strong></span>
              )}
              {session?.departmentCode && <span>Phòng: <strong>{session.departmentCode}</strong></span>}
              {tableData && <span>{tableData.totalRows.toLocaleString()} dòng</span>}
            </div>

            {/* Sheet results summary */}
            {session?.sheetResults?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {session.sheetResults.map((r: { sheetName: string; mappedTableName: string | null; status: string; insertedRows: number; errorDetail?: string }, i: number) => (
                  <span key={i} className={`text-xs px-2 py-0.5 rounded-full border ${
                    r.status === 'Success' ? 'bg-green-50 border-green-200 text-green-700'
                    : 'bg-red-50 border-red-200 text-red-700'
                  }`}>
                    {r.sheetName} {r.insertedRows > 0 ? `(${r.insertedRows} dòng)` : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <button onClick={handleExport} disabled={!tableData} className="btn-secondary flex items-center gap-2">
          <Download size={16} /> Xuất CSV
        </button>
      </div>

      {!tableName ? (
        <div className="text-center py-16 text-gray-400">
          <p>Không có dữ liệu được import trong lần upload này.</p>
          {session?.errorDetail && <p className="text-red-500 text-sm mt-2">{session.errorDetail}</p>}
        </div>
      ) : (
        <>
          {/* Search */}
          <form
            onSubmit={e => { e.preventDefault(); setSearch(searchInput); setPage(1) }}
            className="flex gap-2 mb-4"
          >
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Tìm kiếm..."
                className="input pl-9"
              />
            </div>
            <button type="submit" className="btn-primary">Tìm</button>
            {search && (
              <button type="button" onClick={() => { setSearch(''); setSearchInput('') }} className="btn-secondary">
                Xóa
              </button>
            )}
          </form>

          {/* Data table */}
          <div className="card p-0 overflow-hidden">
            {isLoading ? (
              <div className="flex justify-center py-16">
                <svg className="animate-spin h-6 w-6 text-blue-600" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              </div>
            ) : tableData && tableData.rows.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {tableData.columns.map(col => (
                          <th key={col} className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap uppercase text-xs tracking-wider">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {tableData.rows.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                          {tableData.columns.map(col => (
                            <td key={col} className="px-4 py-2.5 text-gray-700 whitespace-nowrap max-w-xs truncate">
                              {row[col] != null ? String(row[col]) : <span className="text-gray-300">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                    <p className="text-sm text-gray-500">
                      Trang {page}/{totalPages} — {tableData.totalRows.toLocaleString()} dòng
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="btn-secondary py-1 px-2 disabled:opacity-50"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="btn-secondary py-1 px-2 disabled:opacity-50"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-center py-12 text-gray-400">Không có dữ liệu</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
