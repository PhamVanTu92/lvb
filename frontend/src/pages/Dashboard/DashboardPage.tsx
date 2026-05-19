import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { uploadApi } from '../../api/upload'
import {
  Upload, CheckCircle, XCircle, Clock, FileSpreadsheet,
  ArrowRight, RefreshCw, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { vi } from 'date-fns/locale'

const PAGE_SIZE = 20

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [page, setPage] = useState(1)

  // Stats — số liệu thực từ server
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['upload-stats'],
    queryFn: () => uploadApi.getStats().then(r => r.data),
    refetchInterval: 15_000,
  })

  // Danh sách phiếu (phân trang)
  const { data, isLoading, refetch: refetchHistory } = useQuery({
    queryKey: ['upload-history', page],
    queryFn: () => uploadApi.getHistory(page, PAGE_SIZE).then(r => r.data),
    refetchInterval: 15_000,
  })

  const totalPages = data ? Math.ceil(data.totalCount / PAGE_SIZE) : 0

  const handleRefresh = () => {
    refetchStats()
    refetchHistory()
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
        <p className="text-gray-500 mt-1">
          Xin chào, <span className="font-medium text-gray-700">{user?.fullName}</span>
          {user?.departmentCode && <span> — {user.departmentCode}</span>}
        </p>
      </div>

      {/* Stats — dữ liệu thực từ server */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card flex items-center gap-4">
          <div className="p-3 bg-blue-100 rounded-xl">
            <FileSpreadsheet className="text-blue-600" size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {stats?.total?.toLocaleString('vi-VN') ?? '—'}
            </p>
            <p className="text-sm text-gray-500">Tổng phiếu đã upload</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-3 bg-green-100 rounded-xl">
            <CheckCircle className="text-green-600" size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {stats?.success?.toLocaleString('vi-VN') ?? '—'}
            </p>
            <p className="text-sm text-gray-500">Xử lý thành công</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-3 bg-yellow-100 rounded-xl">
            <Clock className="text-yellow-600" size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {stats?.pending?.toLocaleString('vi-VN') ?? '—'}
            </p>
            <p className="text-sm text-gray-500">Đang xử lý</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-3 bg-red-100 rounded-xl">
            <XCircle className="text-red-600" size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {stats?.failed?.toLocaleString('vi-VN') ?? '—'}
            </p>
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

      {/* Upload history — with pagination */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">
            Danh sách phiếu đã upload
            {data && (
              <span className="ml-2 text-sm font-normal text-gray-400">
                ({data.totalCount.toLocaleString('vi-VN')} phiếu)
              </span>
            )}
          </h2>
          <button onClick={handleRefresh} className="text-gray-400 hover:text-gray-600 p-1 rounded">
            <RefreshCw size={16} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-6 w-6 rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">File</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Phòng ban</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Người upload</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Trạng thái</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Sheets</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Thời gian</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data?.items.map(session => (
                    <tr key={session.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="text-green-600 shrink-0" size={15} />
                          <span className="font-medium truncate max-w-52">{session.fileName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{session.departmentCode}</td>
                      <td className="px-4 py-3 text-gray-600">{session.uploaderName}</td>
                      <td className="px-4 py-3">{statusBadge(session.status)}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {session.processedSheets}/{session.totalSheets}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {formatDistanceToNow(new Date(session.uploadedAt), { addSuffix: true, locale: vi })}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => navigate(`/upload?session=${session.id}`)}
                          className="text-blue-600 hover:text-blue-700 p-1"
                          title="Xem chi tiết"
                        >
                          <ArrowRight size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!data?.items.length && (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-gray-400">
                        Chưa có phiếu nào được upload
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 text-sm text-gray-500">
                <span>
                  {((page - 1) * PAGE_SIZE + 1)}–{Math.min(page * PAGE_SIZE, data?.totalCount ?? 0)}
                  {' '}/ {data?.totalCount.toLocaleString('vi-VN')}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn-secondary py-1 px-2 disabled:opacity-40">
                    <ChevronLeft size={14} />
                  </button>
                  <span className="px-3 font-semibold text-blue-600">{page} / {totalPages}</span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="btn-secondary py-1 px-2 disabled:opacity-40">
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
