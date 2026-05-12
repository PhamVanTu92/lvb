import { useState, useCallback, useEffect, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { useSearchParams } from 'react-router-dom'
import * as signalR from '@microsoft/signalr'
import { uploadApi } from '../../api/upload'
import { Upload, FileSpreadsheet, X, CheckCircle, XCircle, Clock, Download, ChevronDown, ChevronUp } from 'lucide-react'
import type { UploadSession } from '../../types'

type Stage = 'idle' | 'selected' | 'uploading' | 'processing' | 'done'

export default function UploadPage() {
  const [searchParams] = useSearchParams()
  const [stage, setStage] = useState<Stage>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [uploadPct, setUploadPct] = useState(0)
  const [processPct, setProcessPct] = useState(0)
  const [processMsg, setProcessMsg] = useState('')
  const [session, setSession] = useState<UploadSession | null>(null)
  const [error, setError] = useState('')
  const [expandedSheets, setExpandedSheets] = useState(false)
  const hubRef = useRef<signalR.HubConnection | null>(null)

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

  const connectSignalR = useCallback((sessionId: string) => {
    const token = localStorage.getItem('lvb_token')
    const hub = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/upload-progress', {
        accessTokenFactory: () => token ?? '',
      })
      .withAutomaticReconnect()
      .build()

    hub.on('UploadProgress', (data: { status: string; progress: number; message: string }) => {
      setProcessPct(data.progress)
      setProcessMsg(data.message)
      if (data.status === 'success' || data.status === 'failed') {
        uploadApi.getStatus(sessionId).then(r => {
          setSession(r.data)
          setStage('done')
        })
        hub.stop()
      }
    })

    hub.start().then(() => hub.invoke('JoinSession', sessionId))
    hubRef.current = hub
    return () => { hub.stop() }
  }, [])

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

  const handleUpload = async () => {
    if (!file) return
    setStage('uploading')
    setError('')
    try {
      const res = await uploadApi.upload(file, setUploadPct)
      const newSession = res.data
      setSession(newSession)
      setStage('processing')
      connectSignalR(newSession.id)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message
      setError(msg || 'Upload thất bại')
      setStage('selected')
    }
  }

  const handleReset = () => {
    hubRef.current?.stop()
    setFile(null)
    setStage('idle')
    setUploadPct(0)
    setProcessPct(0)
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
      {(stage === 'selected') && file && (
        <div className="card">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-green-100 rounded-xl"><FileSpreadsheet className="text-green-600" size={28} /></div>
            <div className="flex-1">
              <p className="font-semibold text-gray-800">{file.name}</p>
              <p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            <button onClick={handleReset} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>
          <div className="mt-4 flex gap-3">
            <button onClick={handleUpload} className="btn-primary flex items-center gap-2">
              <Upload size={16} /> Xác nhận đẩy dữ liệu
            </button>
            <button onClick={handleReset} className="btn-secondary">Hủy</button>
          </div>
        </div>
      )}

      {/* Uploading */}
      {stage === 'uploading' && (
        <div className="card">
          <p className="font-medium text-gray-700 mb-3">Đang tải file lên MinIO...</p>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div className="bg-blue-600 h-2.5 rounded-full transition-all" style={{ width: `${uploadPct}%` }} />
          </div>
          <p className="text-sm text-gray-500 mt-2">{uploadPct}%</p>
        </div>
      )}

      {/* Processing */}
      {stage === 'processing' && (
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <svg className="animate-spin h-5 w-5 text-blue-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <p className="font-medium text-gray-700">{processMsg || 'Đang phân tích file Excel...'}</p>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div className="bg-blue-600 h-2.5 rounded-full transition-all" style={{ width: `${processPct}%` }} />
          </div>
          <p className="text-sm text-gray-500 mt-2">{processPct}% — Đang xử lý các sheet...</p>
        </div>
      )}

      {/* Done */}
      {stage === 'done' && session && (
        <div className="card">
          <div className="flex items-start gap-4 mb-4">
            {session.status === 'Success'
              ? <CheckCircle className="text-green-500 shrink-0" size={32} />
              : session.status === 'Failed'
              ? <XCircle className="text-red-500 shrink-0" size={32} />
              : <Clock className="text-yellow-500 shrink-0" size={32} />}
            <div className="flex-1">
              <p className="font-semibold text-gray-800">{session.fileName}</p>
              <p className="text-sm text-gray-500">{session.totalRows.toLocaleString()} dòng đã được xử lý</p>
              {session.errorDetail && (
                <p className="text-sm text-red-600 mt-1">{session.errorDetail}</p>
              )}
            </div>
          </div>

          {/* Sheet results */}
          {session.sheetResults.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
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
                    <div key={i} className="flex items-center justify-between p-3 text-sm">
                      <div>
                        <span className="font-medium">{r.sheetName}</span>
                        {r.mappedTableName && (
                          <span className="text-gray-500 ml-2">→ {r.mappedTableName}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-500">{r.insertedRows} dòng</span>
                        <span className={r.status === 'Success' ? 'badge-success' : 'badge-error'}>
                          {r.status === 'Success' ? 'OK' : 'Lỗi'}
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
    </div>
  )
}
