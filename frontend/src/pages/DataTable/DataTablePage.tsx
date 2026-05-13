import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { dataApi } from '../../api/data'
import { Search, Download, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'

export default function DataTablePage() {
  const { dept, table } = useParams<{ dept: string; table: string }>()

  // Get Vietnamese name from departments cache
  const { data: depts } = useQuery({
    queryKey: ['departments'],
    queryFn: () => dataApi.getDepartments().then(r => r.data),
    staleTime: 60_000,
  })
  const sheetName = depts
    ?.flatMap(d => d.tables ?? [])
    .find(t => t.tableName === table)
    ?.sheetName ?? table?.replace(/_/g, ' ')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const pageSize = 50

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['table-data', dept, table, page, search],
    queryFn: () => dataApi.getData(dept!, table!, page, pageSize, search || undefined).then(r => r.data),
    enabled: !!dept && !!table,
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const handleExport = async () => {
    if (!data) return
    const headers = data.columns.join(',') + '\n'
    const rows = data.rows.map(row =>
      data.columns.map(col => {
        const v = row[col]
        return typeof v === 'string' && v.includes(',') ? `"${v}"` : v ?? ''
      }).join(',')
    ).join('\n')
    const blob = new Blob(['﻿' + headers + rows], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${table}_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalPages = data ? Math.ceil(data.totalRows / pageSize) : 0

  return (
    <div className="p-6 max-w-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {sheetName}
          </h1>
          <p className="text-gray-500 mt-1">
            Phòng: <span className="font-medium">{dept === '_all' ? 'Tất cả phòng ban' : dept}</span>
            {data && <span className="ml-3">• {data.totalRows.toLocaleString()} bản ghi</span>}
            {data?.lastUpdated && (
              <span className="ml-3">• Cập nhật: {new Date(data.lastUpdated).toLocaleDateString('vi-VN')}</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="btn-secondary flex items-center gap-2">
            <RefreshCw size={16} /> Làm mới
          </button>
          <button onClick={handleExport} className="btn-secondary flex items-center gap-2" disabled={!data}>
            <Download size={16} /> Xuất CSV
          </button>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
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

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <svg className="animate-spin h-6 w-6 text-blue-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          </div>
        ) : data ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {data.columns.map(col => (
                      <th key={col} className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap uppercase text-xs tracking-wider">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.rows.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      {data.columns.map(col => (
                        <td key={col} className="px-4 py-2.5 text-gray-700 whitespace-nowrap max-w-xs truncate">
                          {row[col] != null ? String(row[col]) : <span className="text-gray-300">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {data.rows.length === 0 && (
                    <tr>
                      <td colSpan={data.columns.length} className="text-center py-12 text-gray-400">
                        Không có dữ liệu
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
                  Trang {page}/{totalPages} — {data.totalRows.toLocaleString()} bản ghi
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
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg mb-1">Chưa có dữ liệu</p>
            <p className="text-sm">Dataset này chưa có lần upload nào thành công. Vui lòng đẩy file Excel.</p>
          </div>
        )}
      </div>
    </div>
  )
}
