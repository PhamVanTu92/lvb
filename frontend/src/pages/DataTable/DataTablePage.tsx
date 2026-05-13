import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { dataApi } from '../../api/data'
import { Search, Download, RefreshCw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X, Filter } from 'lucide-react'

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200]

export default function DataTablePage() {
  const { dept, table } = useParams<{ dept: string; table: string }>()

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
  const [pageSize, setPageSize] = useState(50)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
  const [columnFilterInputs, setColumnFilterInputs] = useState<Record<string, string>>({})

  // Debounce column filter changes
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
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

  // Reset page when filters change
  useEffect(() => { setPage(1) }, [search])

  const hasFilters = !!search || Object.values(columnFilters).some(v => v)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['table-data', dept, table, page, pageSize, search, columnFilters],
    queryFn: () =>
      dataApi.getData(
        dept!, table!, page, pageSize,
        search || undefined,
        undefined,
        Object.keys(columnFilters).length > 0 ? columnFilters : undefined
      ).then(r => r.data),
    enabled: !!dept && !!table,
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const clearAllFilters = () => {
    setSearch('')
    setSearchInput('')
    setColumnFilters({})
    setColumnFilterInputs({})
    setPage(1)
  }

  const handleExport = async () => {
    if (!data) return
    const headers = data.columns.join(',') + '\n'
    const rows = data.rows.map(row =>
      data.columns.map(col => {
        const v = row[col]
        if (v == null) return ''
        const s = String(v)
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
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

  const pageNumbers = (() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1) as (number | '...')[]
    const pages: (number | '...')[] = [1]
    if (page > 3) pages.push('...')
    for (let p = Math.max(2, page - 1); p <= Math.min(totalPages - 1, page + 1); p++) pages.push(p)
    if (page < totalPages - 2) pages.push('...')
    pages.push(totalPages)
    return pages
  })()

  return (
    <div className="p-6 max-w-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{sheetName}</h1>
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

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-0">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Tìm kiếm toàn bộ..."
              className="input pl-9 w-full"
            />
          </div>
          <button type="submit" className="btn-primary">Tìm</button>
          {search && (
            <button type="button" onClick={() => { setSearch(''); setSearchInput(''); setPage(1) }} className="btn-secondary">
              <X size={14} />
            </button>
          )}
        </form>

        {hasFilters && (
          <button
            onClick={clearAllFilters}
            className="flex items-center gap-1 text-sm px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
          >
            <X size={14} /> Xóa tất cả bộ lọc
          </button>
        )}

        {/* Page size */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm text-gray-500 whitespace-nowrap">Số dòng / trang:</span>
          <select
            value={pageSize}
            onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
            className="input py-1.5 text-sm"
            style={{ width: 'auto' }}
          >
            {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <svg className="animate-spin h-6 w-6 text-blue-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : data ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  {/* Column names */}
                  <tr>
                    {data.columns.map(col => (
                      <th key={col} className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap uppercase text-xs tracking-wider">
                        {col}
                      </th>
                    ))}
                  </tr>
                  {/* Column filter row */}
                  <tr className="bg-blue-50/60 border-b border-gray-200">
                    {data.columns.map(col => (
                      <th key={col} className="px-2 py-1.5">
                        <div className="relative">
                          <Filter className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" size={11} />
                          <input
                            type="text"
                            value={columnFilterInputs[col] ?? ''}
                            onChange={e => applyColumnFilter(col, e.target.value)}
                            placeholder="Lọc..."
                            className="w-full pl-6 pr-5 py-1 text-xs border border-gray-200 rounded bg-white focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 min-w-[80px]"
                          />
                          {columnFilterInputs[col] && (
                            <button
                              onClick={() => applyColumnFilter(col, '')}
                              className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                            >
                              <X size={10} />
                            </button>
                          )}
                        </div>
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
                        {hasFilters ? 'Không tìm thấy kết quả phù hợp với bộ lọc hiện tại' : 'Không có dữ liệu'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 flex-wrap gap-2">
                <p className="text-sm text-gray-500">
                  {data.totalRows > 0
                    ? `${((page - 1) * pageSize + 1).toLocaleString()}–${Math.min(page * pageSize, data.totalRows).toLocaleString()} / ${data.totalRows.toLocaleString()} bản ghi`
                    : 'Không có bản ghi'}
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(1)} disabled={page === 1} className="btn-secondary py-1 px-2 disabled:opacity-40">
                    <ChevronsLeft size={15} />
                  </button>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary py-1 px-2 disabled:opacity-40">
                    <ChevronLeft size={15} />
                  </button>
                  {pageNumbers.map((p, i) =>
                    p === '...'
                      ? <span key={`e${i}`} className="px-1 text-gray-400 text-sm select-none">…</span>
                      : <button
                          key={p}
                          onClick={() => setPage(p as number)}
                          className={`py-1 px-3 rounded text-sm font-medium transition-colors ${page === p ? 'bg-blue-600 text-white' : 'btn-secondary'}`}
                        >{p}</button>
                  )}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary py-1 px-2 disabled:opacity-40">
                    <ChevronRight size={15} />
                  </button>
                  <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="btn-secondary py-1 px-2 disabled:opacity-40">
                    <ChevronsRight size={15} />
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
