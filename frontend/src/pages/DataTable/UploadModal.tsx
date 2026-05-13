import { useState, useCallback, useRef, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { useNavigate } from 'react-router-dom'
import * as signalR from '@microsoft/signalr'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { uploadApi } from '../../api/upload'
import { dataApi } from '../../api/data'
import {
  Upload, FileSpreadsheet, X, CheckCircle, XCircle, RefreshCw,
} from 'lucide-react'
import type { DatasetField, UploadSession } from '../../types'

// ── Single declared DatasetField renderer ─────────────────────────────────
function DeclaredField({ field, value, error, onChange }: {
  field: DatasetField; value: string; error?: boolean; onChange: (v: string) => void
}) {
  const label = (
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {field.displayName}
      {field.isRequired
        ? <span className="text-red-500 ml-1">*</span>
        : <span className="text-gray-400 font-normal ml-1">(tùy chọn)</span>}
    </label>
  )
  const cls = `input text-sm${error ? ' border-red-400' : ''}`
  const err = error && <p className="text-red-500 text-xs mt-1">Vui lòng điền trường này</p>

  if (field.fieldType === 'dropdown') return (
    <div>
      {label}
      <select className={cls} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">-- Chọn --</option>
        {(field.dropdownOptions ?? []).map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      {err}
    </div>
  )

  if (field.fieldType === 'textarea') return (
    <div>
      {label}
      <textarea className={`${cls} resize-none h-20`} value={value} onChange={e => onChange(e.target.value)} />
      {err}
    </div>
  )

  if (field.fieldType === 'month') return (
    <div>
      {label}
      <input type="month" className={cls} value={value} onChange={e => onChange(e.target.value)} />
      {err}
    </div>
  )

  if (field.fieldType === 'date') return (
    <div>
      {label}
      <input type="date" className={cls} value={value} onChange={e => onChange(e.target.value)} />
      {err}
    </div>
  )

  if (field.fieldType === 'quarter') {
    const m = value?.match(/^Q(\d)\/(\d{4})$/)
    const [q, y] = m ? [m[1], m[2]] : ['', String(new Date().getFullYear())]
    const set = (qv: string, yv: string) => onChange(qv && yv ? `Q${qv}/${yv}` : '')
    return (
      <div>
        {label}
        <div className="flex gap-2">
          <select className={cls} style={{ flex: '0 0 auto', width: 110 }} value={q}
            onChange={e => set(e.target.value, y)}>
            <option value="">-- Quý --</option>
            {['1', '2', '3', '4'].map(n => <option key={n} value={n}>Quý {n}</option>)}
          </select>
          <input type="number" className={cls} style={{ flex: 1 }} placeholder="Năm"
            value={y} min={2020} max={2099} onChange={e => set(q, e.target.value)} />
        </div>
        {err}
      </div>
    )
  }

  if (field.fieldType === 'year') return (
    <div>
      {label}
      <input type="number" className={cls} placeholder="VD: 2026" min={2020} max={2099}
        value={value} onChange={e => onChange(e.target.value)} />
      {err}
    </div>
  )

  if (field.fieldType === 'number') return (
    <div>
      {label}
      <input type="number" className={cls} value={value} onChange={e => onChange(e.target.value)} />
      {err}
    </div>
  )

  return (
    <div>
      {label}
      <input type="text" className={cls} value={value} onChange={e => onChange(e.target.value)} />
      {err}
    </div>
  )
}

// ── UploadModal ─────────────────────────────────────────────────────────────
type Stage = 'form' | 'uploading' | 'processing' | 'done'

interface Props {
  mappingId: string
  dept: string
  table: string
  sheetName: string
  onClose: () => void
}

export default function UploadModal({ mappingId, dept, table, sheetName, onClose }: Props) {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [stage, setStage] = useState<Stage>('form')
  const [file, setFile] = useState<File | null>(null)
  const [batchName, setBatchName] = useState('')
  const [dataMonth, setDataMonth] = useState('')
  const [notes, setNotes] = useState('')
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({})
  const [uploadPct, setUploadPct] = useState(0)
  const [processPct, setProcessPct] = useState(0)
  const [processMsg, setProcessMsg] = useState('')
  const [session, setSession] = useState<UploadSession | null>(null)
  const [error, setError] = useState('')
  const [processingSecs, setProcessingSecs] = useState(0)

  const hubRef = useRef<signalR.HubConnection | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Dataset declared fields
  const { data: datasetFields } = useQuery({
    queryKey: ['dataset-fields-upload', mappingId],
    queryFn: () => dataApi.getDatasetFields(mappingId).then(r => r.data),
    enabled: !!mappingId,
    staleTime: 60_000,
  })
  const activeFields = (datasetFields ?? [])
    .filter((f: DatasetField) => f.isActive)
    .sort((a: DatasetField, b: DatasetField) => a.orderIndex - b.orderIndex)

  // ── Helpers ──────────────────────────────────────────────────────────────
  const stopPolling = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }
  const stopTimer  = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null } }

  const finishSession = useCallback((s: UploadSession) => {
    setSession(s)
    setStage('done')
    stopPolling()
    stopTimer()
    hubRef.current?.stop()
    if (s.status === 'Success') {
      qc.invalidateQueries({ queryKey: ['batches', dept, table] })
    }
  }, [dept, table, qc])

  const startPolling = useCallback((sessionId: string) => {
    stopPolling()
    pollRef.current = setInterval(async () => {
      try {
        const res = await uploadApi.getStatus(sessionId)
        if (res.data.status === 'Success' || res.data.status === 'Failed') finishSession(res.data)
      } catch { /* ignore */ }
    }, 3000)
  }, [finishSession])

  const startTimer = useCallback(() => {
    setProcessingSecs(0)
    timerRef.current = setInterval(() => setProcessingSecs(s => s + 1), 1000)
  }, [])

  const connectSignalR = useCallback((sessionId: string) => {
    const token = localStorage.getItem('lvb_token')
    const hub = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/upload-progress', { accessTokenFactory: () => token ?? '' })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build()
    hub.on('UploadProgress', (data: { status: string; progress: number; message: string }) => {
      setProcessPct(data.progress)
      setProcessMsg(data.message)
      if (data.status === 'success' || data.status === 'failed') {
        uploadApi.getStatus(sessionId).then(r => finishSession(r.data))
        hub.stop()
      }
    })
    hub.start().then(() => hub.invoke('JoinSession', sessionId)).catch(() => { })
    hubRef.current = hub
  }, [finishSession])

  useEffect(() => () => { stopPolling(); stopTimer(); hubRef.current?.stop() }, [])

  // ── Dropzone ──────────────────────────────────────────────────────────────
  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) { setFile(accepted[0]); setError('') }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
    disabled: stage !== 'form',
  })

  // ── Upload handler ────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!batchName.trim()) { setError('Vui lòng nhập tên lô'); return }
    if (!dataMonth)        { setError('Vui lòng chọn tháng dữ liệu'); return }
    if (!file)             { setError('Vui lòng chọn file dữ liệu'); return }

    const errors: Record<string, boolean> = {}
    for (const f of activeFields) {
      if (f.isRequired && !fieldValues[f.fieldName]?.trim()) errors[f.fieldName] = true
    }
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return }

    setFieldErrors({})
    setError('')
    setStage('uploading')

    try {
      const dmFormatted = dataMonth.replace(/^(\d{4})-(\d{2})$/, '$2/$1')
      const metadataJson = activeFields.length > 0
        ? JSON.stringify(Object.fromEntries(activeFields.map(f => [f.fieldName, fieldValues[f.fieldName] ?? ''])))
        : undefined
      const res = await uploadApi.upload(
        file, mappingId || undefined,
        batchName, dmFormatted, notes || undefined,
        setUploadPct, metadataJson,
      )
      const newSession = res.data
      setSession(newSession)
      setStage('processing')
      startTimer()
      startPolling(newSession.id)
      connectSignalR(newSession.id)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg || 'Upload thất bại')
      setStage('form')
    }
  }

  const handleCheckNow = async () => {
    if (!session) return
    try {
      const res = await uploadApi.getStatus(session.id)
      if (res.data.status === 'Success' || res.data.status === 'Failed') finishSession(res.data)
    } catch { }
  }

  const handleReset = () => {
    stopPolling(); stopTimer(); hubRef.current?.stop()
    setFile(null); setBatchName(''); setDataMonth(''); setNotes('')
    setFieldValues({}); setFieldErrors({})
    setStage('form'); setUploadPct(0); setProcessPct(0)
    setProcessingSecs(0); setSession(null); setError('')
  }

  const fmtSecs = (s: number) => s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
  const canClose = stage === 'form' || stage === 'done'

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={canClose ? onClose : undefined}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[520px] flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Tạo lô upload mới</h2>
            <p className="text-xs text-gray-400 mt-0.5">{sheetName}</p>
          </div>
          {canClose && (
            <button onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <X size={18} />
            </button>
          )}
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
              <X size={14} className="shrink-0 mt-0.5 text-red-400" />
              {error}
            </div>
          )}

          {/* ── FORM ─────────────────────────────────────────────── */}
          {stage === 'form' && (
            <>
              {/* Tên lô */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tên lô <span className="text-red-500">*</span>
                </label>
                <input type="text" className="input text-sm"
                  placeholder="VD: TNR DV tháng 4/2026"
                  value={batchName} onChange={e => setBatchName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleUpload()} />
                <p className="text-xs text-gray-400 mt-1">Dùng để tìm kiếm và phân biệt lô sau này</p>
              </div>

              {/* Tháng dữ liệu */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tháng dữ liệu <span className="text-red-500">*</span>
                </label>
                <input type="month" className="input text-sm"
                  value={dataMonth} onChange={e => setDataMonth(e.target.value)} />
                <p className="text-xs text-gray-400 mt-1">
                  Mỗi tháng chỉ được tạo 1 lô. Nếu cần upload lại, vào lô cũ và xóa trước.
                </p>
              </div>

              {/* Dynamic dataset fields */}
              {activeFields.map(f => (
                <DeclaredField
                  key={f.fieldName}
                  field={f}
                  value={fieldValues[f.fieldName] ?? ''}
                  error={fieldErrors[f.fieldName]}
                  onChange={v => {
                    setFieldValues(prev => ({ ...prev, [f.fieldName]: v }))
                    setFieldErrors(prev => ({ ...prev, [f.fieldName]: false }))
                  }}
                />
              ))}

              {/* Ghi chú */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
                <textarea className="input text-sm resize-none h-[72px]"
                  placeholder="Mô tả nguồn dữ liệu, trạng thái đối soát..."
                  value={notes} onChange={e => setNotes(e.target.value)} />
              </div>

              {/* File dropzone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  File dữ liệu <span className="text-red-500">*</span>
                </label>
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
                    isDragActive      ? 'border-blue-500 bg-blue-50'
                    : file            ? 'border-green-400 bg-green-50'
                    : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                  }`}
                >
                  <input {...getInputProps()} />
                  {file ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileSpreadsheet className="text-green-600 shrink-0" size={24} />
                      <div className="text-left min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                        <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      <button type="button"
                        onClick={e => { e.stopPropagation(); setFile(null) }}
                        className="ml-2 text-gray-400 hover:text-red-500 shrink-0">
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload className="mx-auto text-gray-400 mb-2" size={28} />
                      <p className="text-sm text-gray-600 font-medium">
                        {isDragActive ? 'Thả file vào đây...' : 'Click để chọn file (.csv, .xlsx)'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">hoặc kéo thả vào đây</p>
                      <a
                        href={`/api/v1/datasets/template?mappingId=${mappingId}`}
                        onClick={e => e.stopPropagation()}
                        className="mt-1.5 inline-block text-xs text-blue-500 hover:underline"
                      >
                        Tải template mẫu để biết đúng định dạng cột
                      </a>
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ── UPLOADING ────────────────────────────────────────── */}
          {stage === 'uploading' && (
            <div className="py-8 text-center">
              <Upload className="mx-auto text-blue-500 mb-3 animate-bounce" size={36} />
              <p className="text-sm font-medium text-gray-700 mb-4">Đang tải file lên máy chủ...</p>
              <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${uploadPct}%` }} />
              </div>
              <p className="text-sm text-gray-500">{uploadPct}%</p>
            </div>
          )}

          {/* ── PROCESSING ───────────────────────────────────────── */}
          {stage === 'processing' && (
            <div className="py-8">
              <div className="flex items-center gap-3 mb-4">
                <svg className="animate-spin h-5 w-5 text-blue-600 shrink-0" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-sm font-medium text-gray-700 flex-1">
                  {processMsg || 'Đang phân tích file Excel...'}
                </p>
                <span className="text-xs text-gray-400 shrink-0">{fmtSecs(processingSecs)}</span>
              </div>
              {processPct > 0 && (
                <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                  <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${processPct}%` }} />
                </div>
              )}
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>Đang kiểm tra trạng thái mỗi 3 giây...</span>
                <button onClick={handleCheckNow}
                  className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium">
                  <RefreshCw size={11} /> Kiểm tra ngay
                </button>
              </div>
              {processingSecs > 120 && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700">
                  Xử lý đã mất hơn 2 phút. File có thể rất lớn hoặc có lỗi.
                </div>
              )}
            </div>
          )}

          {/* ── DONE ─────────────────────────────────────────────── */}
          {stage === 'done' && session && (
            <div className="py-4">
              <div className="flex items-start gap-4">
                {session.status === 'Success'
                  ? <CheckCircle className="text-green-500 shrink-0 mt-0.5" size={32} />
                  : <XCircle className="text-red-500 shrink-0 mt-0.5" size={32} />}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">
                    {session.status === 'Success' ? 'Upload thành công!' : 'Upload thất bại'}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5 truncate">{session.fileName}</p>
                  {session.totalRows > 0 && (
                    <p className="text-sm text-gray-600 mt-1 font-medium">
                      {session.totalRows.toLocaleString()} dòng đã được nhập
                    </p>
                  )}
                  {session.errorDetail && (
                    <p className="text-sm text-red-600 mt-1">{session.errorDetail}</p>
                  )}
                </div>
              </div>

              {/* Sheet results */}
              {session.sheetResults.length > 0 && (
                <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
                  {session.sheetResults.map((r, i) => (
                    <div key={i}
                      className="flex items-center justify-between px-4 py-2.5 text-xs border-b border-gray-100 last:border-0">
                      <div className="min-w-0">
                        <span className="font-medium text-gray-700">{r.sheetName}</span>
                        {r.mappedTableName && (
                          <span className="text-gray-400 ml-2 font-mono">→ {r.mappedTableName}</span>
                        )}
                        {r.errorDetail && r.status !== 'Success' && (
                          <p className="text-red-500 mt-0.5">{r.errorDetail}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 ml-3 shrink-0">
                        {r.insertedRows > 0 && <span className="text-gray-500">{r.insertedRows} dòng</span>}
                        <span className={r.status === 'Success' ? 'badge-success' : 'badge-warning'}>
                          {r.status === 'Success' ? 'OK' : 'Bỏ qua'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2 flex-shrink-0">
          {stage === 'form' && (
            <>
              <button onClick={onClose} className="btn-secondary">Hủy</button>
              <button onClick={handleUpload}
                className="btn-primary flex items-center gap-2">
                <Upload size={15} /> Upload
              </button>
            </>
          )}

          {stage === 'done' && session && (
            session.status === 'Success' ? (
              <>
                <button onClick={handleReset} className="btn-secondary">Upload lô khác</button>
                <button
                  onClick={() => navigate(`/data/${dept}/${table}/${session.id}`)}
                  className="btn-primary">
                  Xem chi tiết lô →
                </button>
              </>
            ) : (
              <>
                <button onClick={onClose} className="btn-secondary">Đóng</button>
                <button onClick={handleReset} className="btn-primary">Thử lại</button>
              </>
            )
          )}
        </div>
      </div>
    </div>
  )
}
