import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { uploadApi } from '../../api/upload'
import { Upload, CheckCircle, XCircle, Clock, FileSpreadsheet, ArrowRight, RefreshCw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { vi } from 'date-fns/locale'

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['upload-history'],
    queryFn: () => uploadApi.getHistory(1, 10).then(r => r.data),
    refetchInterval: 10_000,
  })

  const stats = {
    total: data?.totalCount ?? 0,
    success: data?.items.filter(i => i.status === 'Success').length ?? 0,
    failed: data?.items.filter(i => i.status === 'Failed').length ?? 0,
    pending: data?.items.filter(i => i.status === 'Pending' || i.status === 'Processing').length ?? 0,
  }

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      Success: 'badge-success',
      Failed: 'badge-error',
      Processing: 'badge-warning',
      Pending: 'badge-info',
    }
    const labels: Record<string, string> = {
      Success: 'Thành công',
      Failed: 'Lỗi',
      Processing: 'Đang xử lý',
      Pending: 'Chờ xử lý',
    }
    return <span className={map[status] ?? 'badge-info'}>{labels[status] ?? status}</span>
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tổng quan</h1>
        <p className="text-gray-500 mt-1">Xin chào, <span className="font-medium text-gray-700">{user?.fullName}</span> — {user?.departmentCode}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card flex items-center gap-4">
          <div className="p-3 bg-blue-100 rounded-xl"><FileSpreadsheet className="text-blue-600" size={24} /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-sm text-gray-500">Tổng file đã upload</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-3 bg-green-100 rounded-xl"><CheckCircle className="text-green-600" size={24} /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.success}</p>
            <p className="text-sm text-gray-500">Xử lý thành công</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-3 bg-yellow-100 rounded-xl"><Clock className="text-yellow-600" size={24} /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
            <p className="text-sm text-gray-500">Đang xử lý</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-3 bg-red-100 rounded-xl"><XCircle className="text-red-600" size={24} /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.failed}</p>
            <p className="text-sm text-gray-500">Lỗi</p>
          </div>
        </div>
      </div>

      {/* Quick action */}
      <button
        onClick={() => navigate('/upload')}
        className="btn-primary mb-6 flex items-center gap-2"
      >
        <Upload size={16} />
        Đẩy Tài Liệu Mới
      </button>

      {/* Recent uploads */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800">Lịch sử Upload gần đây</h2>
          <button onClick={() => refetch()} className="text-gray-400 hover:text-gray-600 p-1">
            <RefreshCw size={16} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <svg className="animate-spin h-6 w-6 text-blue-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">File</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Trạng thái</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Sheets</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Thời gian</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map(session => (
                  <tr key={session.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="text-green-600 shrink-0" size={16} />
                        <span className="font-medium truncate max-w-48">{session.fileName}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">{statusBadge(session.status)}</td>
                    <td className="py-3 px-3 text-gray-600">
                      {session.processedSheets}/{session.totalSheets}
                    </td>
                    <td className="py-3 px-3 text-gray-500">
                      {formatDistanceToNow(new Date(session.uploadedAt), { addSuffix: true, locale: vi })}
                    </td>
                    <td className="py-3 px-3">
                      <button
                        onClick={() => navigate(`/upload?session=${session.id}`)}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <ArrowRight size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {!data?.items.length && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-400">
                      Chưa có file nào được upload
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
