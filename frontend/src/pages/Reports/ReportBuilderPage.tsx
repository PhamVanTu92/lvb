import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { dataApi } from '../../api/data'
import type { ReportConfig, RTable, RJoin, RSelect, RFilter, ROrderBy } from '../../types'
import {
  ArrowLeft, Plus, Trash2, Save, ChevronDown, ChevronUp,
  Database, Link2, Columns, Filter, ArrowUpDown, BarChart2,
  Code2, BookOpen, Copy, CheckCircle,
} from 'lucide-react'

const JOIN_TYPES = ['LEFT', 'INNER', 'RIGHT', 'FULL']
const AGG_OPTIONS = ['', 'SUM', 'AVG', 'COUNT', 'MIN', 'MAX']
const OPERATORS   = ['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'ILIKE']
const PARAM_TYPES = ['text', 'month', 'date', 'year', 'number']
const CHART_TYPES = ['bar', 'line']

// ── Collapsible section ───────────────────────────────────────────────────────
function Section({ icon, title, count, children }: {
  icon: React.ReactNode; title: string; count?: number; children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left">
        <span className="text-gray-500">{icon}</span>
        <span className="font-semibold text-gray-700 text-sm flex-1">{title}</span>
        {count !== undefined && (
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{count}</span>
        )}
        <span className="text-gray-400">{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
      </button>
      {open && <div className="p-4 space-y-3">{children}</div>}
    </div>
  )
}

// ── SQL Table Reference panel ─────────────────────────────────────────────────
function TableReference({ mappings, tableColumns, onLoadColumns }: {
  mappings: { id: string; tableName: string; sheetName: string }[]
  tableColumns: Record<string, string[]>
  onLoadColumns: (tn: string) => void
}) {
  const [selected, setSelected] = useState('')
  const [copied, setCopied] = useState('')

  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(text)
    setTimeout(() => setCopied(''), 1500)
  }

  const cols = selected ? (tableColumns[selected] ?? null) : null

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden h-fit">
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-800">
        <BookOpen size={14} className="text-gray-400" />
        <span className="font-semibold text-white text-sm">Tham khảo bảng</span>
      </div>
      <div className="p-3 space-y-3 bg-gray-900">
        <div className="flex gap-2">
          <select
            className="flex-1 text-xs bg-gray-800 border border-gray-600 text-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-purple-500"
            value={selected}
            onChange={e => { setSelected(e.target.value); onLoadColumns(e.target.value) }}>
            <option value="">-- Chọn bảng --</option>
            {mappings.map(m => (
              <option key={m.id} value={m.tableName}>{m.sheetName}</option>
            ))}
          </select>
        </div>

        {selected && (
          <div>
            <p className="text-xs text-gray-400 mb-1">Tên bảng:</p>
            <button type="button" onClick={() => copy(selected)}
              className="flex items-center gap-1.5 text-xs font-mono bg-gray-800 text-yellow-300 px-2 py-1 rounded hover:bg-gray-700 w-full text-left">
              {copied === selected ? <CheckCircle size={10} className="text-green-400 shrink-0" /> : <Copy size={10} className="shrink-0" />}
              {selected}
            </button>
          </div>
        )}

        {cols === null && selected && (
          <p className="text-xs text-gray-500 italic">Đang tải cột...</p>
        )}

        {cols !== null && cols.length > 0 && (
          <div>
            <p className="text-xs text-gray-400 mb-1.5">Các cột ({cols.length}):</p>
            <div className="max-h-56 overflow-y-auto space-y-0.5">
              {cols.map(col => (
                <button key={col} type="button" onClick={() => copy(col)}
                  className="flex items-center gap-1.5 text-xs font-mono text-gray-300 hover:bg-gray-800 px-2 py-0.5 rounded w-full text-left">
                  {copied === col
                    ? <CheckCircle size={9} className="text-green-400 shrink-0" />
                    : <Copy size={9} className="text-gray-600 shrink-0" />}
                  {col}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-gray-700 pt-2 space-y-1">
          <p className="text-xs text-gray-500 font-medium">Chuyển đổi SQL Server → PostgreSQL:</p>
          {[
            ['ISNULL(a,b)', 'COALESCE(a,b)'],
            ['GETDATE()', 'NOW()'],
            ['TOP n', 'LIMIT n'],
            ['DATEPART(m,d)', "DATE_PART('month',d)"],
            ['CONVERT(type,val)', 'CAST(val AS type)'],
            ['NVARCHAR(n)', 'TEXT'],
            ['DECIMAL(p,s)', 'NUMERIC(p,s)'],
          ].map(([from, to]) => (
            <div key={from} className="flex items-center gap-1 text-xs">
              <code className="text-red-400 font-mono text-[10px]">{from}</code>
              <span className="text-gray-600">→</span>
              <code className="text-green-400 font-mono text-[10px]">{to}</code>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main builder page ─────────────────────────────────────────────────────────
export default function ReportBuilderPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = id === 'new'
  const navigate = useNavigate()
  const qc = useQueryClient()

  // ── Mode ─────────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<'visual' | 'sql'>('visual')
  const [rawSql, setRawSql] = useState('')

  // ── Shared form state ─────────────────────────────────────────────────────────
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [deptCode, setDeptCode] = useState('')
  const [orderIndex, setOrderIndex] = useState(0)
  const [filters, setFilters] = useState<RFilter[]>([])
  const [chartEnabled, setChartEnabled] = useState(false)
  const [chartType, setChartType] = useState('bar')
  const [chartX, setChartX] = useState('')
  const [chartY, setChartY] = useState<string[]>([])
  const [error, setError] = useState('')

  // ── Visual builder state ──────────────────────────────────────────────────────
  const [tables, setTables] = useState<RTable[]>([{ alias: 't1', tableName: '' }])
  const [joins, setJoins] = useState<RJoin[]>([])
  const [selects, setSelects] = useState<RSelect[]>([{ ref: '', displayName: '', agg: '' }])
  const [groupBy, setGroupBy] = useState<string[]>([])
  const [orderBy, setOrderBy] = useState<ROrderBy[]>([])

  // ── Column caching ────────────────────────────────────────────────────────────
  const [tableColumns, setTableColumns] = useState<Record<string, string[]>>({})

  const loadColumns = async (tableName: string) => {
    if (!tableName || tableColumns[tableName]) return
    try {
      const res = await dataApi.getTableColumns(tableName)
      setTableColumns(prev => ({ ...prev, [tableName]: res.data ?? [] }))
    } catch { /* ignore */ }
  }

  const allRefOptions = tables.flatMap(t =>
    (tableColumns[t.tableName] ?? []).map(col => `${t.alias}.${col}`)
  )

  // ── Load existing report ──────────────────────────────────────────────────────
  const { data: existing } = useQuery({
    queryKey: ['report', id],
    queryFn: () => dataApi.getReport(id!).then(r => r.data),
    enabled: !isNew && !!id,
  })

  useEffect(() => {
    if (!existing) return
    setName(existing.name)
    setDescription(existing.description ?? '')
    setDeptCode(existing.departmentCode ?? '')
    setOrderIndex(existing.orderIndex)
    try {
      const c: ReportConfig = JSON.parse(existing.configJson)
      if (c.rawSql) {
        setMode('sql')
        setRawSql(c.rawSql)
      } else {
        if (c.tables?.length)  { setTables(c.tables); c.tables.forEach(t => loadColumns(t.tableName)) }
        if (c.joins?.length)   setJoins(c.joins)
        if (c.select?.length)  setSelects(c.select)
        if (c.groupBy?.length) setGroupBy(c.groupBy)
        if (c.orderBy?.length) setOrderBy(c.orderBy)
      }
      if (c.filters?.length) setFilters(c.filters)
      if (c.chart) {
        setChartEnabled(true)
        setChartType(c.chart.type)
        setChartX(c.chart.xField)
        setChartY(c.chart.yFields)
      }
    } catch { /* bad JSON */ }
  }, [existing])

  // ── Data queries ──────────────────────────────────────────────────────────────
  const { data: mappings } = useQuery({
    queryKey: ['sheet-mappings-upload'],
    queryFn: () => dataApi.getSheetMappings().then(r => r.data),
    staleTime: 60_000,
  })
  const { data: depts } = useQuery({
    queryKey: ['departments'],
    queryFn: () => dataApi.getDepartments().then(r => r.data),
    staleTime: 60_000,
  })

  // ── Save ──────────────────────────────────────────────────────────────────────
  const save = useMutation({
    mutationFn: (payload: { name: string; description?: string; departmentCode?: string; configJson: string; orderIndex: number }) =>
      isNew
        ? dataApi.createReport(payload)
        : dataApi.updateReport(id!, payload),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['reports'] })
      navigate(`/reports/${isNew ? res.data.id : id}`)
    },
    onError: () => setError('Lưu báo cáo thất bại. Vui lòng kiểm tra lại.'),
  })

  const handleSave = () => {
    setError('')
    if (!name.trim()) { setError('Vui lòng nhập tên báo cáo'); return }

    const chartConfig = chartEnabled && chartX && chartY.length
      ? { type: chartType, xField: chartX, yFields: chartY }
      : undefined

    let config: ReportConfig

    if (mode === 'sql') {
      if (!rawSql.trim()) { setError('Vui lòng nhập câu SQL'); return }
      config = {
        rawSql: rawSql.trim(),
        filters: filters.length ? filters : undefined,
        chart: chartConfig,
      }
    } else {
      if (!tables[0]?.tableName) { setError('Vui lòng chọn ít nhất một bảng dữ liệu'); return }
      if (!selects.some(s => s.ref)) { setError('Vui lòng chọn ít nhất một cột hiển thị'); return }
      config = {
        tables,
        joins: joins.length ? joins : undefined,
        select: selects.filter(s => s.ref),
        groupBy: groupBy.length ? groupBy : undefined,
        filters: filters.length ? filters : undefined,
        orderBy: orderBy.length ? orderBy : undefined,
        chart: chartConfig,
      }
    }

    save.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      departmentCode: deptCode || undefined,
      configJson: JSON.stringify(config),
      orderIndex,
    })
  }

  const inp = 'input text-sm py-1.5'

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isNew ? 'Tạo báo cáo mới' : 'Chỉnh sửa báo cáo'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">Xây dựng báo cáo từ các bảng dữ liệu đã khai báo</p>
        </div>
        <button onClick={() => navigate('/reports')} className="btn-secondary flex items-center gap-2">
          <ArrowLeft size={16} /> Quay lại
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      <div className="space-y-4">

        {/* ── Thông tin cơ bản ────────────────────────────────────────────── */}
        <Section icon={<BarChart2 size={15} />} title="Thông tin báo cáo">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tên báo cáo <span className="text-red-500">*</span>
              </label>
              <input type="text" className={inp} placeholder="VD: KPI cá nhân - bộ phận"
                value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
              <textarea className={`${inp} resize-none h-16 w-full`}
                placeholder="Mô tả mục đích của báo cáo..."
                value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phòng ban</label>
              <select className={inp} value={deptCode} onChange={e => setDeptCode(e.target.value)}>
                <option value="">Tất cả phòng ban</option>
                {depts?.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Thứ tự hiển thị</label>
              <input type="number" className={inp} value={orderIndex} min={0}
                onChange={e => setOrderIndex(Number(e.target.value))} />
            </div>
          </div>
        </Section>

        {/* ── Mode toggle ───────────────────────────────────────────────────── */}
        <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-gray-50 p-1 gap-1">
          <button type="button"
            onClick={() => setMode('visual')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === 'visual'
                ? 'bg-white shadow text-blue-700 border border-blue-100'
                : 'text-gray-500 hover:text-gray-700'
            }`}>
            <Database size={15} /> Visual Builder
          </button>
          <button type="button"
            onClick={() => setMode('sql')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === 'sql'
                ? 'bg-white shadow text-purple-700 border border-purple-100'
                : 'text-gray-500 hover:text-gray-700'
            }`}>
            <Code2 size={15} /> SQL Thuần
          </button>
        </div>

        {/* ══════════════ VISUAL MODE ══════════════ */}
        {mode === 'visual' && (
          <>
            {/* Bảng dữ liệu */}
            <Section icon={<Database size={15} />} title="Bảng dữ liệu" count={tables.length}>
              {tables.map((t, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="w-20 shrink-0">
                    <label className="block text-xs text-gray-500 mb-1">Alias</label>
                    <input type="text" className={inp} value={t.alias} placeholder="t1"
                      onChange={e => setTables(prev => prev.map((x, j) => j === i ? { ...x, alias: e.target.value } : x))} />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Dataset <span className="text-red-500">*</span></label>
                    <select className={inp} value={t.tableName}
                      onChange={e => {
                        const tn = e.target.value
                        setTables(prev => prev.map((x, j) => j === i ? { ...x, tableName: tn } : x))
                        loadColumns(tn)
                      }}>
                      <option value="">-- Chọn dataset --</option>
                      {mappings?.map(m => (
                        <option key={m.id} value={m.tableName}>{m.sheetName} ({m.tableName})</option>
                      ))}
                    </select>
                  </div>
                  {tables.length > 1 && (
                    <button type="button" onClick={() => setTables(prev => prev.filter((_, j) => j !== i))}
                      className="mt-5 p-1.5 text-gray-400 hover:text-red-500 rounded">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button type="button"
                onClick={() => setTables(prev => [...prev, { alias: `t${prev.length + 1}`, tableName: '' }])}
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium">
                <Plus size={12} /> Thêm bảng
              </button>
            </Section>

            {/* JOIN */}
            {tables.length > 1 && (
              <Section icon={<Link2 size={15} />} title="JOIN giữa các bảng" count={joins.length}>
                {joins.map((j, i) => (
                  <div key={i} className="grid grid-cols-[110px_1fr_auto_1fr_auto] gap-2 items-end">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Kiểu JOIN</label>
                      <select className={inp} value={j.type}
                        onChange={e => setJoins(prev => prev.map((x, k) => k === i ? { ...x, type: e.target.value } : x))}>
                        {JOIN_TYPES.map(t => <option key={t} value={t}>{t} JOIN</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Trường bên trái</label>
                      <select className={inp} value={j.left}
                        onChange={e => setJoins(prev => prev.map((x, k) => k === i ? { ...x, left: e.target.value } : x))}>
                        <option value="">-- Chọn --</option>
                        {allRefOptions.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <span className="text-gray-400 text-sm pb-1.5">=</span>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Trường bên phải</label>
                      <select className={inp} value={j.right}
                        onChange={e => setJoins(prev => prev.map((x, k) => k === i ? { ...x, right: e.target.value } : x))}>
                        <option value="">-- Chọn --</option>
                        {allRefOptions.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <button type="button" onClick={() => setJoins(prev => prev.filter((_, k) => k !== i))}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <button type="button"
                  onClick={() => setJoins(prev => [...prev, { type: 'LEFT', left: '', right: '' }])}
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium">
                  <Plus size={12} /> Thêm điều kiện JOIN
                </button>
              </Section>
            )}

            {/* Cột hiển thị */}
            <Section icon={<Columns size={15} />} title="Cột hiển thị" count={selects.filter(s => s.ref).length}>
              {selects.map((s, i) => (
                <div key={i} className="grid grid-cols-[1fr_120px_1fr_auto] gap-2 items-end">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Cột <span className="text-red-500">*</span></label>
                    <select className={inp} value={s.ref}
                      onChange={e => setSelects(prev => prev.map((x, j) => j === i ? { ...x, ref: e.target.value } : x))}>
                      <option value="">-- Chọn --</option>
                      <option value="*">* (dùng với COUNT)</option>
                      {allRefOptions.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Phép tính</label>
                    <select className={inp} value={s.agg ?? ''}
                      onChange={e => setSelects(prev => prev.map((x, j) => j === i ? { ...x, agg: e.target.value || undefined } : x))}>
                      {AGG_OPTIONS.map(a => <option key={a} value={a}>{a || '— Giá trị gốc —'}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Tên hiển thị <span className="text-red-500">*</span></label>
                    <input type="text" className={inp} placeholder="VD: Tổng thu nhập"
                      value={s.displayName}
                      onChange={e => setSelects(prev => prev.map((x, j) => j === i ? { ...x, displayName: e.target.value } : x))} />
                  </div>
                  {selects.length > 1 && (
                    <button type="button" onClick={() => setSelects(prev => prev.filter((_, j) => j !== i))}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button type="button"
                onClick={() => setSelects(prev => [...prev, { ref: '', displayName: '', agg: '' }])}
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium">
                <Plus size={12} /> Thêm cột
              </button>
              {/* GROUP BY */}
              {selects.some(s => s.agg) && (
                <div className="pt-2 border-t border-gray-100">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">GROUP BY</label>
                  {selects.filter(s => s.ref && !s.agg).map(s => (
                    <label key={s.ref} className="flex items-center gap-2 text-sm mb-1">
                      <input type="checkbox" checked={groupBy.includes(s.ref)}
                        onChange={e => setGroupBy(prev =>
                          e.target.checked ? [...prev, s.ref] : prev.filter(r => r !== s.ref)
                        )} className="rounded border-gray-300" />
                      <span className="font-mono text-gray-600">{s.ref}</span>
                      {s.displayName && <span className="text-gray-400">({s.displayName})</span>}
                    </label>
                  ))}
                </div>
              )}
            </Section>

            {/* Tham số lọc — visual */}
            <Section icon={<Filter size={15} />} title="Tham số lọc (động)" count={filters.length}>
              <p className="text-xs text-gray-400">Khai báo điều kiện WHERE có thể thay đổi mỗi lần chạy báo cáo.</p>
              {filters.map((f, i) => (
                <div key={i} className="grid grid-cols-[1fr_80px_120px_1fr_90px_auto] gap-2 items-end">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Cột lọc</label>
                    <select className={inp} value={f.ref}
                      onChange={e => setFilters(prev => prev.map((x, j) => j === i ? { ...x, ref: e.target.value } : x))}>
                      <option value="">-- Chọn --</option>
                      {allRefOptions.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Toán tử</label>
                    <select className={inp} value={f.op}
                      onChange={e => setFilters(prev => prev.map((x, j) => j === i ? { ...x, op: e.target.value } : x))}>
                      {OPERATORS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Tên param</label>
                    <input type="text" className={inp} placeholder="VD: month"
                      value={f.paramName}
                      onChange={e => setFilters(prev => prev.map((x, j) => j === i ? { ...x, paramName: e.target.value } : x))} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Nhãn</label>
                    <input type="text" className={inp} placeholder="VD: Tháng dữ liệu"
                      value={f.displayName}
                      onChange={e => setFilters(prev => prev.map((x, j) => j === i ? { ...x, displayName: e.target.value } : x))} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Kiểu input</label>
                    <select className={inp} value={f.paramType}
                      onChange={e => setFilters(prev => prev.map((x, j) => j === i ? { ...x, paramType: e.target.value } : x))}>
                      {PARAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <button type="button" onClick={() => setFilters(prev => prev.filter((_, j) => j !== i))}
                    className="p-1.5 text-gray-400 hover:text-red-500 rounded">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button type="button"
                onClick={() => setFilters(prev => [...prev, { ref: '', op: '=', paramName: '', displayName: '', paramType: 'text' }])}
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium">
                <Plus size={12} /> Thêm tham số lọc
              </button>
            </Section>

            {/* Sắp xếp */}
            <Section icon={<ArrowUpDown size={15} />} title="Sắp xếp kết quả" count={orderBy.length}>
              {orderBy.map((o, i) => (
                <div key={i} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Cột</label>
                    <select className={inp} value={o.ref}
                      onChange={e => setOrderBy(prev => prev.map((x, j) => j === i ? { ...x, ref: e.target.value } : x))}>
                      <option value="">-- Chọn --</option>
                      {selects.filter(s => s.ref).map(s => (
                        <option key={s.ref} value={s.ref}>{s.displayName || s.ref}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-28">
                    <label className="block text-xs text-gray-500 mb-1">Phép tính</label>
                    <select className={inp} value={o.agg ?? ''}
                      onChange={e => setOrderBy(prev => prev.map((x, j) => j === i ? { ...x, agg: e.target.value || undefined } : x))}>
                      {AGG_OPTIONS.map(a => <option key={a} value={a}>{a || '— Gốc —'}</option>)}
                    </select>
                  </div>
                  <div className="w-28">
                    <label className="block text-xs text-gray-500 mb-1">Thứ tự</label>
                    <select className={inp} value={o.desc ? 'DESC' : 'ASC'}
                      onChange={e => setOrderBy(prev => prev.map((x, j) => j === i ? { ...x, desc: e.target.value === 'DESC' } : x))}>
                      <option value="ASC">Tăng dần</option>
                      <option value="DESC">Giảm dần</option>
                    </select>
                  </div>
                  <button type="button" onClick={() => setOrderBy(prev => prev.filter((_, j) => j !== i))}
                    className="p-1.5 text-gray-400 hover:text-red-500 rounded">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button type="button"
                onClick={() => setOrderBy(prev => [...prev, { ref: '', desc: false }])}
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium">
                <Plus size={12} /> Thêm cột sắp xếp
              </button>
            </Section>
          </>
        )}

        {/* ══════════════ SQL MODE ══════════════ */}
        {mode === 'sql' && (
          <>
            {/* SQL editor + table reference side by side */}
            <div className="grid grid-cols-[1fr_240px] gap-4 items-start">
              {/* SQL Editor */}
              <div className="border border-gray-700 rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-900">
                  <Code2 size={14} className="text-purple-400" />
                  <span className="font-semibold text-white text-sm flex-1">SQL Editor (PostgreSQL)</span>
                  <span className="text-xs text-gray-500">
                    dùng <code className="text-yellow-300 font-mono">:param_name</code> cho tham số động
                  </span>
                </div>
                <textarea
                  className="w-full font-mono text-sm bg-gray-950 text-gray-100 p-4 min-h-[400px] resize-y focus:outline-none leading-relaxed"
                  placeholder={
`-- Ví dụ: Tổng hợp KPI cá nhân / bộ phận\nSELECT\n    ma_don_vi                            AS "Đơn vị",\n    ho_ten_cbnv                         AS "Họ tên",\n    COALESCE(diem_th_ca_nhan, 0)         AS "Điểm TH CN",\n    COALESCE(diem_kh_ca_nhan, 0)         AS "Điểm KH CN",\n    COALESCE(phan_tram_tong_thuc_hien,0) AS "% Tổng TH",\n    COALESCE(luong_kd_kpis, 0)           AS "Lương KPI"\nFROM ten_bang_dataset\nWHERE ngay_so_lieu BETWEEN :from_date AND :to_date\nORDER BY ma_don_vi, ho_ten_cbnv`}
                  value={rawSql}
                  onChange={e => setRawSql(e.target.value)}
                  spellCheck={false}
                />
                <div className="px-4 py-2 bg-gray-800 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
                  <span>💡 Tham số: <code className="text-yellow-300">:from_date</code> <code className="text-yellow-300">:to_date</code></span>
                  <span>·</span>
                  <span>Kết quả được phân trang tự động</span>
                  <span>·</span>
                  <span>CTE (<code className="text-green-300">WITH ... AS (...)</code>) được hỗ trợ</span>
                </div>
              </div>

              {/* Table Reference */}
              <TableReference
                mappings={mappings ?? []}
                tableColumns={tableColumns}
                onLoadColumns={loadColumns}
              />
            </div>

            {/* Tham số đầu vào — SQL mode (simplified: no ref/op) */}
            <Section icon={<Filter size={15} />} title="Tham số đầu vào" count={filters.length}>
              <p className="text-xs text-gray-400">
                Khai báo các tham số <code className="font-mono text-purple-600 bg-purple-50 px-1 rounded">:param_name</code> trong SQL để UI tự sinh ô nhập liệu tương ứng.
              </p>
              {filters.map((f, i) => (
                <div key={i} className="grid grid-cols-[150px_1fr_110px_auto] gap-2 items-end">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Tên param <span className="text-xs text-gray-400">(khớp trong SQL)</span>
                    </label>
                    <input type="text" className={`${inp} font-mono`} placeholder="from_date"
                      value={f.paramName}
                      onChange={e => setFilters(prev => prev.map((x, j) => j === i ? { ...x, paramName: e.target.value } : x))} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Nhãn hiển thị</label>
                    <input type="text" className={inp} placeholder="VD: Từ ngày"
                      value={f.displayName}
                      onChange={e => setFilters(prev => prev.map((x, j) => j === i ? { ...x, displayName: e.target.value } : x))} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Kiểu input</label>
                    <select className={inp} value={f.paramType}
                      onChange={e => setFilters(prev => prev.map((x, j) => j === i ? { ...x, paramType: e.target.value } : x))}>
                      {PARAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <button type="button" onClick={() => setFilters(prev => prev.filter((_, j) => j !== i))}
                    className="p-1.5 text-gray-400 hover:text-red-500 rounded">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button type="button"
                onClick={() => setFilters(prev => [...prev, { ref: '', op: '=', paramName: '', displayName: '', paramType: 'date' }])}
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium">
                <Plus size={12} /> Thêm tham số
              </button>
            </Section>
          </>
        )}

        {/* ── Biểu đồ (shared) ──────────────────────────────────────────────── */}
        <Section icon={<BarChart2 size={15} />} title="Biểu đồ">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={chartEnabled}
              onChange={e => setChartEnabled(e.target.checked)}
              className="rounded border-gray-300" />
            Hiển thị biểu đồ khi chạy báo cáo
          </label>
          {chartEnabled && (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Loại biểu đồ</label>
                  <select className={inp} value={chartType} onChange={e => setChartType(e.target.value)}>
                    {CHART_TYPES.map(t => <option key={t} value={t}>{t === 'bar' ? 'Cột (Bar)' : 'Đường (Line)'}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Trục X — tên cột kết quả
                    {mode === 'visual' && <span className="text-gray-400"> (DisplayName)</span>}
                  </label>
                  {mode === 'visual' ? (
                    <select className={inp} value={chartX} onChange={e => setChartX(e.target.value)}>
                      <option value="">-- Chọn --</option>
                      {selects.filter(s => s.displayName).map(s => (
                        <option key={s.displayName} value={s.displayName}>{s.displayName}</option>
                      ))}
                    </select>
                  ) : (
                    <input type="text" className={`${inp} font-mono`} placeholder="VD: ma_don_vi"
                      value={chartX} onChange={e => setChartX(e.target.value)} />
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Trục Y — tên cột giá trị
                  {mode === 'sql' && <span className="text-gray-400"> (một cột mỗi dòng)</span>}
                </label>
                {mode === 'visual' ? (
                  <div className="space-y-1 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2">
                    {selects.filter(s => s.displayName && s.displayName !== chartX).map(s => (
                      <label key={s.displayName} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input type="checkbox"
                          checked={chartY.includes(s.displayName)}
                          onChange={e => setChartY(prev =>
                            e.target.checked ? [...prev, s.displayName] : prev.filter(y => y !== s.displayName)
                          )} className="rounded border-gray-300" />
                        {s.displayName}
                      </label>
                    ))}
                  </div>
                ) : (
                  <textarea className={`${inp} font-mono resize-none h-20 w-full`}
                    placeholder={'diem_th_ca_nhan\ndiem_kh_ca_nhan\nluong_kd_kpis'}
                    value={chartY.join('\n')}
                    onChange={e => setChartY(e.target.value.split('\n').map(s => s.trim()).filter(Boolean))} />
                )}
              </div>
            </div>
          )}
        </Section>

      </div>

      {/* Save button */}
      <div className="mt-6 flex justify-end gap-3">
        <button onClick={() => navigate('/reports')} className="btn-secondary">Hủy</button>
        <button
          onClick={handleSave}
          disabled={save.isPending}
          className="btn-primary flex items-center gap-2 disabled:opacity-50">
          <Save size={16} /> {save.isPending ? 'Đang lưu...' : 'Lưu báo cáo'}
        </button>
      </div>
    </div>
  )
}
