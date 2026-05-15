import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { dataApi } from '../../api/data'
import { useAuth } from '../../contexts/AuthContext'
import type { ReportConfig, RFilter } from '../../types'
import {
  ArrowLeft, Play, Download, ChevronLeft, ChevronRight,
  BarChart2, Pencil, RefreshCw,
} from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

// ── Param input per filter type ───────────────────────────────────────────────
function FilterInput({ f, value, onChange }: {
  f: RFilter; value: string; onChange: (v: string) => void
}) {
  const cls = 'input text-sm py-1.5'
  if (f.paramType === 'month')
    return <input type="month" className={cls} value={value} onChange={e => onChange(e.target.value)} />
  if (f.paramType === 'date')
    return <input type="date" className={cls} value={value} onChange={e => onChange(e.target.value)} />
  if (f.paramType === 'year')
    return <input type="number" className={cls} placeholder="VD: 2026" min={2020} max={2099}
      value={value} onChange={e => onChange(e.target.value)} />
  return <input type="text" className={cls} placeholder={`Nhập ${f.displayName}...`}
    value={value} onChange={e => onChange(e.target.value)} />
}

// ── Chart section ─────────────────────────────────────────────────────────────
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

function ReportChart({
  config, rows,
}: {
  config: ReportConfig['chart']
  rows: Record<string, unknown>[]
}) {
  if (!config || rows.length === 0) return null

  const data = rows.map(r => {
    const entry: Record<string, unknown> = { [config.xField]: r[config.xField] }
    config.yFields.forEach(f => { entry[f] = typeof r[f] === 'number' ? r[f] : Number(r[f]) || 0 })
    return entry
  })

  const chart = config.type === 'line' ? (
    <LineChart data={data}>
      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
      <XAxis dataKey={config.xField} tick={{ fontSize: 11 }} />
      <YAxis tick={{ fontSize: 11 }} width={70}
        tickFormatter={v => typeof v === 'number' && v >= 1_000_000
          ? `${(v / 1_000_000).toFixed(1)}M` : String(v)} />
      <Tooltip formatter={(v: number) => v.toLocaleString('vi-VN')} />
      <Legend />
      {config.yFields.map((f, i) => (
        <Line key={f} type="monotone" dataKey={f} stroke={COLORS[i % COLORS.length]}
          strokeWidth={2} dot={false} />
      ))}
    </LineChart>
  ) : (
    <BarChart data={data}>
      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
      <XAxis dataKey={config.xField} tick={{ fontSize: 11 }} />
      <YAxis tick={{ fontSize: 11 }} width={70}
        tickFormatter={v => typeof v === 'number' && v >= 1_000_000
          ? `${(v / 1_000_000).toFixed(1)}M` : String(v)} />
      <Tooltip formatter={(v: number) => v.toLocaleString('vi-VN')} />
      <Legend />
      {config.yFields.map((f, i) => (
        <Bar key={f} dataKey={f} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} />
      ))}
    </BarChart>
  )

  return (
    <div className="card mb-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Biểu đồ</h3>
      <ResponsiveContainer width="100%" height={300}>
        {chart}
      </ResponsiveContainer>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ReportRunPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()

  const [params, setParams] = useState<Record<string, string>>({})
  const [runParams, setRunParams] = useState<Record<string, string>>({})
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  const [hasRun, setHasRun] = useState(false)

  const { data: report } = useQuery({
    queryKey: ['report', id],
    queryFn: () => dataApi.getReport(id!).then(r => r.data),
    enabled: !!id,
  })

  const config: ReportConfig | null = (() => {
    try { return report ? JSON.parse(report.configJson) : null } catch { return null }
  })()
  const filters = config?.filters ?? []

  const { data: result, isLoading, refetch } = useQuery({
    queryKey: ['report-run', id, runParams, page, pageSize],
    queryFn: () => dataApi.runReport(id!, runParams, page, pageSize).then(r => r.data),
    enabled: hasRun && !!id,
  })

  const handleRun = () => {
    setPage(1)
    setRunParams({ ...params })
    setHasRun(true)
  }

  const handleExportCSV = () => {
    if (!result) return
    const headers = result.columns.join(',') + '\n'
    const rows = result.rows.map(row =>
      result.columns.map(col => {
        const v = row[col]; if (v == null) return ''
        const s = String(v)
        return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s
      }).join(',')
    ).join('\n')
    const blob = new Blob(['﻿' + headers + rows], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${report?.name ?? 'report'}_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const totalPages = result ? Math.ceil(result.totalCount / pageSize) : 0

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="text-xs text-gray-400 mb-1 flex items-center gap-1">
            <button onClick={() => navigate('/reports')}
              className="hover:text-blue-600 transition-colors font-medium">Xử lý dữ liệu</button>
            <span>/</span>
            <span className="text-gray-600">{report?.name ?? '...'}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{report?.name ?? '...'}</h1>
          {report?.description && (
            <p className="text-gray-500 text-sm mt-1">{report.description}</p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          {isAdmin && (
            <button onClick={() => navigate(`/reports/builder/${id}`)}
              className="btn-secondary flex items-center gap-2 text-sm">
              <Pencil size={14} /> Chỉnh sửa
            </button>
          )}
          <button onClick={() => navigate('/reports')}
            className="btn-secondary flex items-center gap-2">
            <ArrowLeft size={16} /> Quay lại
          </button>
        </div>
      </div>

      {/* Filter bar */}
      {filters.length > 0 && (
        <div className="card mb-4">
          <div className="flex flex-wrap gap-4 items-end">
            {filters.map(f => (
              <div key={f.paramName}>
                <label className="block text-xs text-gray-500 mb-1">
                  {f.displayName}
                  {f.op !== '~' && <span className="text-red-400 ml-0.5">*</span>}
                </label>
                <FilterInput
                  f={f}
                  value={params[f.paramName] ?? ''}
                  onChange={v => setParams(p => ({ ...p, [f.paramName]: v }))}
                />
              </div>
            ))}
            <button onClick={handleRun}
              className="btn-primary flex items-center gap-2 text-sm py-1.5">
              <Play size={14} /> Chạy báo cáo
            </button>
            {hasRun && (
              <button onClick={() => refetch()}
                className="btn-secondary flex items-center gap-2 text-sm py-1.5">
                <RefreshCw size={14} /> Làm mới
              </button>
            )}
          </div>
        </div>
      )}

      {/* Run button (no filters) */}
      {filters.length === 0 && !hasRun && (
        <div className="text-center py-10">
          <BarChart2 className="mx-auto text-gray-300 mb-3" size={36} />
          <p className="text-gray-400 mb-4">Nhấn nút bên dưới để chạy báo cáo</p>
          <button onClick={handleRun} className="btn-primary flex items-center gap-2 mx-auto">
            <Play size={16} /> Chạy báo cáo
          </button>
        </div>
      )}

      {/* Results */}
      {(hasRun || filters.length === 0) && (
        <>
          {/* Chart */}
          {result && config?.chart && (
            <ReportChart config={config.chart} rows={result.rows} />
          )}

          {/* Table */}
          <div className="card p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Kết quả
                {result && (
                  <span className="ml-2 font-normal text-gray-400 normal-case">
                    ({result.totalCount.toLocaleString()} bản ghi)
                  </span>
                )}
              </h3>
              {result && result.rows.length > 0 && (
                <button onClick={handleExportCSV}
                  className="btn-secondary flex items-center gap-1.5 text-xs py-1">
                  <Download size={13} /> Xuất CSV
                </button>
              )}
            </div>

            {isLoading ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin h-6 w-6 rounded-full border-2 border-blue-600 border-t-transparent" />
              </div>
            ) : !hasRun ? (
              <div className="text-center py-12 text-gray-400">
                <button onClick={handleRun} className="btn-primary flex items-center gap-2 mx-auto">
                  <Play size={16} /> Chạy báo cáo
                </button>
              </div>
            ) : result && result.rows.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {result.columns.map(col => (
                          <th key={col}
                            className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {result.rows.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          {result.columns.map(col => (
                            <td key={col} className="px-4 py-2.5 text-gray-700 whitespace-nowrap">
                              {row[col] != null
                                ? typeof row[col] === 'number'
                                  ? (row[col] as number).toLocaleString('vi-VN')
                                  : String(row[col])
                                : <span className="text-gray-300">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 text-sm text-gray-500">
                    <span>
                      {((page - 1) * pageSize + 1)}–{Math.min(page * pageSize, result.totalCount)} / {result.totalCount.toLocaleString()}
                    </span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                        className="btn-secondary py-1 px-2 disabled:opacity-40"><ChevronLeft size={14} /></button>
                      <span className="px-3 font-semibold text-blue-600">{page} / {totalPages}</span>
                      <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                        className="btn-secondary py-1 px-2 disabled:opacity-40"><ChevronRight size={14} /></button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-gray-400">Không có dữ liệu</div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
