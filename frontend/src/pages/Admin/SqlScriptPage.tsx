import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { dataApi } from '../../api/data'
import type { SqlScriptDetail, ScriptParam, ScriptRunResult } from '../../types'
import {
  Plus, Save, Trash2, Play, Code2, CheckCircle, XCircle,
  Clock, ChevronRight, Filter, RefreshCw,
} from 'lucide-react'

const PARAM_TYPES = ['text', 'date', 'month', 'year', 'number']

// ── Param input (matches FilterInput in ReportRunPage) ───────────────────────
function ParamInput({ p, value, onChange }: {
  p: ScriptParam; value: string; onChange: (v: string) => void
}) {
  const cls = 'input text-sm py-1.5'
  if (p.paramType === 'month')
    return <input type="month" className={cls} value={value} onChange={e => onChange(e.target.value)} />
  if (p.paramType === 'date')
    return <input type="date" className={cls} value={value} onChange={e => onChange(e.target.value)} />
  if (p.paramType === 'year')
    return <input type="number" className={cls} placeholder="VD: 2025" min={2020} max={2099}
      value={value} onChange={e => onChange(e.target.value)} />
  return <input type="text" className={cls} placeholder={`${p.displayName}...`}
    value={value} onChange={e => onChange(e.target.value)} />
}

// ── Script list item ──────────────────────────────────────────────────────────
function ScriptItem({ id, name, description, selected, onClick }: {
  id: string; name: string; description?: string
  selected: boolean; onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
        selected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'
      }`}>
      <div className="flex items-center gap-2">
        <Code2 size={13} className={selected ? 'text-blue-600' : 'text-gray-400'} />
        <span className={`text-sm font-medium truncate ${selected ? 'text-blue-700' : 'text-gray-700'}`}>{name}</span>
        {selected && <ChevronRight size={12} className="text-blue-400 ml-auto shrink-0" />}
      </div>
      {description && (
        <p className="text-xs text-gray-400 mt-0.5 ml-5 truncate">{description}</p>
      )}
    </button>
  )
}

// ── Empty script template ─────────────────────────────────────────────────────
const EMPTY: Omit<SqlScriptDetail, 'id' | 'isActive' | 'orderIndex' | 'createdByName' | 'createdAt' | 'updatedAt'> = {
  name: '',
  description: '',
  scriptSql: '',
  paramsJson: '[]',
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SqlScriptPage() {
  const qc = useQueryClient()

  // ── State ────────────────────────────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isNew, setIsNew] = useState(false)

  // Editor fields
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [scriptSql, setScriptSql] = useState('')
  const [paramsConfig, setParamsConfig] = useState<ScriptParam[]>([])

  // Run state
  const [runParams, setRunParams] = useState<Record<string, string>>({})
  const [runResult, setRunResult] = useState<ScriptRunResult | null>(null)
  const [running, setRunning] = useState(false)

  const [error, setError] = useState('')

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: scripts = [], refetch } = useQuery({
    queryKey: ['sql-scripts'],
    queryFn: () => dataApi.getScripts().then(r => r.data),
  })

  // ── Load script into editor ───────────────────────────────────────────────────
  const loadScript = (s: SqlScriptDetail) => {
    setIsNew(false)
    setSelectedId(s.id)
    setName(s.name)
    setDescription(s.description ?? '')
    setScriptSql(s.scriptSql)
    setRunResult(null)
    setError('')
    try {
      setParamsConfig(JSON.parse(s.paramsJson) as ScriptParam[])
    } catch {
      setParamsConfig([])
    }
  }

  const handleSelectScript = async (id: string) => {
    const res = await dataApi.getScript(id)
    loadScript(res.data)
  }

  const handleNewScript = () => {
    setIsNew(true)
    setSelectedId(null)
    setName('')
    setDescription('')
    setScriptSql('')
    setParamsConfig([])
    setRunResult(null)
    setError('')
  }

  // ── Save ──────────────────────────────────────────────────────────────────────
  const saveMut = useMutation({
    mutationFn: () => {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        scriptSql,
        paramsJson: JSON.stringify(paramsConfig),
        orderIndex: 0,
      }
      return isNew
        ? dataApi.createScript(payload)
        : dataApi.updateScript(selectedId!, payload)
    },
    onSuccess: async (res) => {
      qc.invalidateQueries({ queryKey: ['sql-scripts'] })
      if (isNew) {
        const detail = await dataApi.getScript(res.data.id)
        loadScript(detail.data)
      }
    },
    onError: () => setError('Lưu thất bại.'),
  })

  const handleSave = () => {
    setError('')
    if (!name.trim()) { setError('Vui lòng nhập tên script'); return }
    if (!scriptSql.trim()) { setError('Vui lòng nhập SQL'); return }
    saveMut.mutate()
  }

  // ── Delete ────────────────────────────────────────────────────────────────────
  const deleteMut = useMutation({
    mutationFn: () => dataApi.deleteScript(selectedId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sql-scripts'] })
      setSelectedId(null); setIsNew(false)
      setName(''); setScriptSql(''); setParamsConfig([]); setRunResult(null)
    },
  })

  // ── Run ───────────────────────────────────────────────────────────────────────
  const handleRun = async () => {
    setRunning(true)
    setRunResult(null)
    try {
      const sql = scriptSql.trim()
      let res: ScriptRunResult
      if (selectedId && !isNew) {
        res = (await dataApi.runScript(selectedId, runParams)).data
      } else {
        res = (await dataApi.runAdhocScript(sql, runParams)).data
      }
      setRunResult(res)
    } catch (e: unknown) {
      setRunResult({
        success: false,
        rowsAffected: 0,
        error: (e as Error).message ?? 'Unknown error',
        durationMs: 0,
      })
    } finally {
      setRunning(false)
    }
  }

  const inp = 'input text-sm py-1.5'
  const hasEditor = isNew || selectedId !== null

  return (
    <div className="flex gap-4 h-full min-h-0" style={{ minHeight: '70vh' }}>

      {/* ── Left sidebar: script list ─────────────────────────────────────── */}
      <div className="w-56 shrink-0 flex flex-col gap-2">
        <button
          type="button"
          onClick={handleNewScript}
          className="btn-primary flex items-center justify-center gap-2 text-sm py-2">
          <Plus size={14} /> Script mới
        </button>

        <div className="flex-1 space-y-0.5 overflow-y-auto">
          {scripts.map(s => (
            <ScriptItem
              key={s.id}
              id={s.id}
              name={s.name}
              description={s.description}
              selected={selectedId === s.id}
              onClick={() => handleSelectScript(s.id)}
            />
          ))}
          {scripts.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-6">Chưa có script nào</p>
          )}
        </div>
      </div>

      {/* ── Right: editor + run ───────────────────────────────────────────── */}
      {!hasEditor ? (
        <div className="flex-1 flex items-center justify-center text-gray-300">
          <div className="text-center">
            <Code2 size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Chọn script hoặc tạo mới</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-4 min-w-0">

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}

          {/* Name + buttons */}
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <input type="text" className={`${inp} font-semibold text-base`}
                placeholder="Tên script..."
                value={name} onChange={e => setName(e.target.value)} />
            </div>
            <input type="text" className={`${inp} w-64 text-gray-500`}
              placeholder="Mô tả (không bắt buộc)"
              value={description} onChange={e => setDescription(e.target.value)} />
            <button onClick={handleSave} disabled={saveMut.isPending}
              className="btn-primary flex items-center gap-2 text-sm shrink-0 disabled:opacity-50">
              <Save size={14} /> {saveMut.isPending ? 'Đang lưu...' : 'Lưu'}
            </button>
            {!isNew && (
              <button
                onClick={() => { if (window.confirm('Xóa script này?')) deleteMut.mutate() }}
                className="btn-secondary text-sm flex items-center gap-1.5 text-red-600 shrink-0">
                <Trash2 size={13} /> Xóa
              </button>
            )}
          </div>

          {/* Two-column layout: SQL editor | Params */}
          <div className="grid grid-cols-[1fr_260px] gap-4 items-start">

            {/* SQL Editor */}
            <div className="border border-gray-700 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-900">
                <Code2 size={13} className="text-purple-400" />
                <span className="text-white text-sm font-medium flex-1">SQL Editor (PostgreSQL)</span>
                <span className="text-xs text-gray-500">
                  dùng <code className="text-yellow-300">:param_name</code> cho tham số
                </span>
              </div>
              <textarea
                className="w-full font-mono text-sm bg-gray-950 text-gray-100 p-4 min-h-[320px] resize-y focus:outline-none leading-relaxed"
                placeholder={
`-- Ví dụ: Tính KPI cá nhân\nDELETE FROM kpi_cn_bp\nWHERE ngay_so_lieu BETWEEN :from_date AND :to_date;\n\nWITH NgayTinh AS (\n    SELECT DISTINCT ngay_so_lieu\n    FROM kpi_tong_hop_chi_tieu\n    WHERE ngay_so_lieu BETWEEN :from_date AND :to_date\n)\nINSERT INTO kpi_cn_bp (...)\nSELECT ... FROM NgayTinh ...;`}
                value={scriptSql}
                onChange={e => setScriptSql(e.target.value)}
                spellCheck={false}
              />
              <div className="px-4 py-1.5 bg-gray-800 text-xs text-gray-500 flex gap-4">
                <span>CTE (<code className="text-green-300">WITH ... AS</code>) ✓</span>
                <span>Multi-statement ✓</span>
                <span>Transaction tự động ✓ (rollback nếu lỗi)</span>
              </div>
            </div>

            {/* Params panel */}
            <div className="space-y-4">
              {/* Declare params */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50">
                  <Filter size={13} className="text-gray-500" />
                  <span className="text-sm font-semibold text-gray-700 flex-1">Tham số</span>
                </div>
                <div className="p-3 space-y-2">
                  {paramsConfig.length === 0 && (
                    <p className="text-xs text-gray-400 italic">Chưa có tham số. Thêm để hiện ô nhập khi chạy.</p>
                  )}
                  {paramsConfig.map((p, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex gap-1.5 items-center">
                        <input type="text" className={`${inp} flex-1 font-mono text-xs`}
                          placeholder=":param_name"
                          value={p.paramName}
                          onChange={e => setParamsConfig(prev => prev.map((x, j) => j === i ? { ...x, paramName: e.target.value } : x))} />
                        <select className={`${inp} w-20 text-xs`} value={p.paramType}
                          onChange={e => setParamsConfig(prev => prev.map((x, j) => j === i ? { ...x, paramType: e.target.value } : x))}>
                          {PARAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <button type="button" onClick={() => setParamsConfig(prev => prev.filter((_, j) => j !== i))}
                          className="text-gray-300 hover:text-red-500 p-0.5">
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <input type="text" className={`${inp} text-xs`}
                        placeholder="Nhãn hiển thị..."
                        value={p.displayName}
                        onChange={e => setParamsConfig(prev => prev.map((x, j) => j === i ? { ...x, displayName: e.target.value } : x))} />
                    </div>
                  ))}
                  <button type="button"
                    onClick={() => setParamsConfig(prev => [...prev, { paramName: '', displayName: '', paramType: 'date' }])}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium mt-1">
                    <Plus size={11} /> Thêm tham số
                  </button>
                </div>
              </div>

              {/* Run params + execute */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50">
                  <Play size={13} className="text-gray-500" />
                  <span className="text-sm font-semibold text-gray-700 flex-1">Chạy thử</span>
                </div>
                <div className="p-3 space-y-2">
                  {paramsConfig.map(p => (
                    <div key={p.paramName}>
                      <label className="block text-xs text-gray-500 mb-1">{p.displayName || p.paramName}</label>
                      <ParamInput
                        p={p}
                        value={runParams[p.paramName] ?? ''}
                        onChange={v => setRunParams(prev => ({ ...prev, [p.paramName]: v }))}
                      />
                    </div>
                  ))}
                  <button
                    onClick={handleRun}
                    disabled={running || !scriptSql.trim()}
                    className="w-full btn-primary flex items-center justify-center gap-2 text-sm py-2 mt-1 disabled:opacity-50">
                    {running
                      ? <><RefreshCw size={13} className="animate-spin" /> Đang chạy...</>
                      : <><Play size={13} /> Thực thi</>}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── Execution result ───────────────────────────────────────────── */}
          {runResult && (
            <div className={`rounded-xl border overflow-hidden ${runResult.success ? 'border-green-200' : 'border-red-200'}`}>
              {/* Status bar */}
              <div className={`flex items-center gap-3 px-4 py-2.5 ${runResult.success ? 'bg-green-50' : 'bg-red-50'}`}>
                {runResult.success
                  ? <CheckCircle size={16} className="text-green-600 shrink-0" />
                  : <XCircle size={16} className="text-red-600 shrink-0" />}
                <span className={`font-semibold text-sm ${runResult.success ? 'text-green-700' : 'text-red-700'}`}>
                  {runResult.success ? 'Thực thi thành công' : 'Thực thi thất bại'}
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-500 ml-auto">
                  <Clock size={11} /> {runResult.durationMs.toFixed(0)} ms
                </span>
                {runResult.success && (
                  <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                    {runResult.rowsAffected} dòng bị ảnh hưởng
                  </span>
                )}
              </div>

              {/* Error detail */}
              {runResult.error && (
                <div className="px-4 py-3 bg-red-50 border-t border-red-100">
                  <pre className="text-xs text-red-700 whitespace-pre-wrap font-mono">{runResult.error}</pre>
                </div>
              )}

              {/* SELECT result table */}
              {runResult.columns && runResult.rows && runResult.rows.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {runResult.columns.map(col => (
                          <th key={col} className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {runResult.rows.slice(0, 200).map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          {runResult.columns!.map(col => (
                            <td key={col} className="px-3 py-1.5 text-gray-700 whitespace-nowrap text-xs">
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
                  {runResult.rows.length > 200 && (
                    <p className="text-xs text-gray-400 px-4 py-2">
                      Hiển thị 200 / {runResult.rows.length} dòng
                    </p>
                  )}
                </div>
              )}

              {runResult.success && (!runResult.columns || runResult.rows?.length === 0) && (
                <div className="px-4 py-3 text-xs text-gray-500">
                  Script đã chạy thành công. Không có dữ liệu trả về (không phải câu SELECT).
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
