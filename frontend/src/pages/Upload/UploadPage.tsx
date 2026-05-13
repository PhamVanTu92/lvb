import { useState, useCallback, useEffect, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { useSearchParams } from 'react-router-dom'
import * as signalR from '@microsoft/signalr'
import { useQuery } from '@tanstack/react-query'
import { uploadApi } from '../../api/upload'
import { dataApi } from '../../api/data'
import { Upload, FileSpreadsheet, X, CheckCircle, XCircle, Clock, Download, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import type { UploadSession } from '../../types'

type Stage = 'idle' | 'selected' | 'uploading' | 'processing' | 'done'

export default function UploadPage() {
  const [searchParams] = useSearchParams()
  const [stage, setStage] = useState<Stage>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [mappingId, setMappingId] = useState('')
  const [uploadPct, setUploadPct] = useState(0)
  const [processPct, setProcessPct] = useState(0)
  const [processMsg, setProcessMsg] = useState('')
  const [session, setSession] = useState<UploadSession | null>(null)
  const [error, setError] = useState('')
  const [expandedSheets, setExpandedSheets] = useState(true)
  const [processingSecs, setProcessingSecs] = useState(0)
  const hubRef = useRef<signalR.HubConnection | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Danh sách dataset để chọn
  const { data: depts } = useQuery({
    queryKey: ['departments'],
    queryFn: () => dataApi.getDepartments().then(r => r.data),
    staleTime: 60_000,
  })
  // Lấy mapping IDs từ admin API
  const { data: mappingsData } = useQuery({
    queryKey: ['sheet-mappings-upload'],
    queryFn: () => dataApi.getSheetMappings().then(r => r.data),
    staleTime: 60_000,
  })

  // Load existing session from query param
  useEffect(() => {
    const sid = searchParams.get('session')
    if (sid) {
      uploadApi.getStatus(sid).then(r => {
        setSession(r.data)
        setStage('done')
      }).catch(() => {})
    }
  }, [searchParams])

  // ── POLLING: reliable fallback, runs every 3s during processing ──────────
  const startPolling = useCallback((sessionId: string) => {
    stopPolling()
    pollRef.current = setInterval(async () => {
      try {
        const res = await uploadApi.getStatus(sessionId)
        const s = res.data
        if (s.status === 'Success' || s.status === 'Failed') {
          setSession(s)
          setStage('done')
          stopPolling()
          stopTimer()
          hubRef.current?.stop()
        }
      } catch { /* ignore network blip */ }
    }, 3000)
  }, [])

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  // Processing elapsed timer — shows how long we've been waiting
  const startTimer = useCallback(() => {
    setProcessingSecs(0)
    timerRef.current = setInterval(() => setProcessingSecs(s => s + 1), 1000)
  }, [])
  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

  // Cleanup on unmount
  useEffect(() => () => { stopPolling(); stopTimer(); hubRef.current?.stop() }, [])

  // ── SIGNALR: real-time progress (nice-to-have; polling is the safety net) ─
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
      // SignalR also finalises — but polling is the real gatekeeper
      if (data.status === 'success' || data.status === 'failed') {
        uploadApi.getStatus(sessionId).then(r => {
          setSession(r.data)
          setStage('done')
          stopPolling()
          stopTimer()
        })
        hub.stop()
      }
    })

    hub.start()
      .then(() => hub.invoke('JoinSession', sessionId))
      .catch(() => { /* SignalR failed — polling will handle it */ })

    hubRef.current = hub
  }, [])

  // ── FILE DROP ────────────────────────────────────────────────────────────
  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) {
      setFile(accepted[0])
      setStage('selected')
      setError('')
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
    disabled: stage !== 'idle',
  })

  // ── UPLOAD ───────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!file) return
    setStage('uploading')
    setError('')
    try {
      const res = await uploadApi.upload(file, mappingId || undefined, setUploadPct)
      const newSession = res.data
      setSession(newSession)
      setStage('processing')
      startTimer()
      startPolling(newSession.id)  // ← primary completion mechanism
      connectSignalR(newSession.id) // ← real-time progress (optional)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg || 'Upload thất bại')
      setStage('selected')
    }
  }

  // Manual status check (emergency button)
  const handleCheckNow = async () => {
    if (!session) return
    try {
      const res = await uploadApi.getStatus(session.id)
      const s = res.data
      setSession(s)
      if (s.status === 'Success' || s.status === 'Failed') {
        setStage('done')
        stopPolling()
        stopTimer()
      }
    } catch {}
  }

  const handleReset = () => {
    hubRef.current?.stop()
    stopPolling()
    stopTimer()
    setFile(null)
    setMappingId('')
    setStage('idle')
    setUploadPct(0)
    setProcessPct(0)
    setProcessingSecs(0)
    setSession(null)
    setError('')
  }

  const handleDownload = async () => {
    if (!session) return
    const res = await uploadApi.download(session.id)
    const url = URL.createObjectURL(new Blob([res.data]))
    const a = document.createElement('a')
    a.href = url
    a.download = session.fileName
    a.click()
    URL.revokeObjectURL(url)
  }

  const fmtSecs = (s: number) =>
    s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Đẩy Tài Liệu</h1>
        <p className="text-gray-500 mt-1">Upload file Excel (.xlsx, .xls) — tối đa 50MB</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Drop zone */}
      {stage === 'idle' && (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto text-gray-400 mb-4" size={48} />
          <p className="text-lg font-medium text-gray-700">
            {isDragActive ? 'Thả file vào đây...' : 'Kéo & thả file Excel vào đây'}
          </p>
          <p className="text-gray-500 mt-2">hoặc</p>
          <button className="btn-primary mt-3">Chọn file từ máy tính</button>
          <p className="text-xs text-gray-400 mt-4">Hỗ trợ .xlsx, .xls — Tối đa 50MB</p>
        </div>
      )}

      {/* File selected */}
      {stage === 'selected' && file && (
        <div className="card">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-green-100 rounded-xl">
              <FileSpreadsheet className="text-green-600" size={28} />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-800">{file.name}</p>
              <p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            <button onClick={handleReset} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>

          {/* Chọn dataset */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Đẩy vào dataset <span className="text-red-500">*</span>
            </label>
            {mappingsData && mappingsData.length > 0 ? (
              <select
                className={`input ${!mappingId ? 'border-orange-300' : 'border-green-400'}`}
                value={mappingId}
                onChange={e => setMappingId(e.target.value)}
              >
                <option value="">-- Chọn loại dữ liệu --</option>
                {mappingsData.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.sheetName}
                    {m.departmentCode ? ` (${m.departmentCode})` : ' (Tất cả phòng ban)'}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-orange-600 bg-orange-50 border border-orange-200 rounded-lg p-2">
                Chưa có dataset nào được khai báo. Vui lòng vào <strong>Admin → Khai báo Dataset</strong> trước.
              </p>
            )}
            {!mappingId && mappingsData && mappingsData.length > 0 && (
              <p className="text-xs text-orange-500 mt-1">Vui lòng chọn loại dữ liệu để hệ thống biết lưu vào đâu</p>
            )}
          </div>

          <div className="mt-4 flex gap-3">
            <button
              onClick={handleUpload}
              disabled={!mappingId}
              className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload size={16} /> Xác nhận đẩy dữ liệu
            </button>
            <button onClick={handleReset} className="btn-secondary">Hủy</button>
          </div>
        </div>
      )}

      {/* Uploading to MinIO */}
      {stage === 'uploading' && (
        <div className="card">
          <p className="font-medium text-gray-700 mb-3">Đang tải file lên máy chủ...</p>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div className="bg-blue-600 h-2.5 rounded-full transition-all" style={{ width: `${uploadPct}%` }} />
          </div>
          <p className="text-sm text-gray-500 mt-2">{uploadPct}%</p>
        </div>
      )}

      {/* Processing */}
      {stage === 'processing' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <svg className="animate-spin h-5 w-5 text-blue-600 shrink-0" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              <p className="font-medium text-gray-700">
                {processMsg || 'Đang phân tích file Excel...'}
              </p>
            </div>
            <span className="text-xs text-gray-400 shrink-0">{fmtSecs(processingSecs)}</span>
          </div>

          {processPct > 0 && (
            <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
              <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${processPct}%` }} />
            </div>
          )}

          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-gray-400">Đang kiểm tra trạng thái mỗi 3 giây...</p>
            <button
              onClick={handleCheckNow}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
            >
              <RefreshCw size={12} /> Kiểm tra ngay
            </button>
          </div>

          {processingSecs > 120 && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
              Xử lý đã mất hơn 2 phút. File có thể rất lớn hoặc có lỗi.{' '}
              <button onClick={handleCheckNow} className="font-semibold underline">
                Kiểm tra trạng thái
              </button>
            </div>
          )}
        </div>
      )}

      {/* Done */}
      {stage === 'done' && session && (
        <div className="card">
          <div className="flex items-start gap-4 mb-5">
            {session.status === 'Success'
              ? <CheckCircle className="text-green-500 shrink-0 mt-0.5" size={32} />
              : session.status === 'Failed'
              ? <XCircle className="text-red-500 shrink-0 mt-0.5" size={32} />
              : <Clock className="text-yellow-500 shrink-0 mt-0.5" size={32} />}
            <div className="flex-1">
              <p className="font-semibold text-gray-800 text-lg">
                {session.status === 'Success' ? 'Upload thành công!' : session.status === 'Failed' ? 'Upload thất bại' : 'Đang xử lý'}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">{session.fileName}</p>
              <p className="text-sm text-gray-500">
                {session.totalRows > 0
                  ? `${session.totalRows.toLocaleString()} dòng đã được nhập`
                  : 'Không có dòng nào được nhập'}
              </p>
              {session.errorDetail && (
                <p className="text-sm text-red-600 mt-1">{session.errorDetail}</p>
              )}
            </div>
          </div>

          {/* Sheet results */}
          {session.sheetResults.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden mb-5">
              <button
                onClick={() => setExpandedSheets(!expandedSheets)}
                className="w-full flex items-center justify-between p-3 bg-gray-50 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                <span>Kết quả từng Sheet ({session.sheetResults.length})</span>
                {expandedSheets ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {expandedSheets && (
                <div className="divide-y divide-gray-100">
                  {session.sheetResults.map((r, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3 text-sm">
                      <div>
                        <span className="font-medium">{r.sheetName}</span>
                        {r.mappedTableName && (
                          <span className="text-gray-400 ml-2 font-mono text-xs">→ {r.mappedTableName}</span>
                        )}
                        {r.errorDetail && r.status !== 'Success' && (
                          <p className="text-xs text-red-500 mt-0.5">{r.errorDetail}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 ml-4 shrink-0">
                        <span className="text-gray-500 text-xs">
                          {r.insertedRows > 0 ? `${r.insertedRows} dòng` : '—'}
                        </span>
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

          <div className="flex gap-3">
            <button onClick={handleReset} className="btn-primary flex items-center gap-2">
              <Upload size={16} /> Upload file mới
            </button>
            <button onClick={handleDownload} className="btn-secondary flex items-center gap-2">
              <Download size={16} /> Tải file gốc
            </button>
          </div>
        </div>
      )}

      {/* Upload history shortcut */}
      {stage === 'idle' && (
        <UploadHistory />
      )}
    </div>
  )
}

function UploadHistory() {
  const [history, setHistory] = useState<UploadSession[]>([])
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    uploadApi.getHistory(1, 5).then(r => setHistory(r.data.items)).catch(() => {})
  }, [])

  if (history.length === 0) return null

  return (
    <div className="mt-8">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 mb-3"
      >
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        Lịch sử upload gần đây
      </button>
      {expanded && (
        <div className="card p-0 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {history.map(s => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div className="flex items-center gap-3">
                  {s.status === 'Success'
                    ? <CheckCircle size={16} className="text-green-500 shrink-0" />
                    : s.status === 'Failed'
                    ? <XCircle size={16} className="text-red-500 shrink-0" />
                    : <Clock size={16} className="text-yellow-500 shrink-0" />}
                  <div>
                    <p className="font-medium text-gray-800 truncate max-w-xs">{s.fileName}</p>
                    <p className="text-xs text-gray-400">
                      {s.uploadedAt ? new Date(s.uploadedAt).toLocaleString('vi-VN') : ''}
                      {s.totalRows > 0 && ` · ${s.totalRows.toLocaleString()} dòng`}
                    </p>
                  </div>
                </div>
                <span className={s.status === 'Success' ? 'badge-success' : s.status === 'Failed' ? 'badge-error' : 'badge-warning'}>
                  {s.status === 'Success' ? 'Thành công' : s.status === 'Failed' ? 'Thất bại' : 'Đang xử lý'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
