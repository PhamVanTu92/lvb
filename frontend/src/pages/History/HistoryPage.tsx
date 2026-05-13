import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../contexts/AuthContext'
import api from '../../api/client'
import {
  CheckCircle, XCircle, Clock, Trash2, Eye,
  ChevronLeft, ChevronRight, FileSpreadsheet
} from 'lucide-react'

interface SheetResult {
  sheetName: string
  mappedTableName: string | null
  status: string
  insertedRows: number
  errorDetail?: string
}

interface UploadSession {
  id: string
  fileName: string
  fileSizeBytes: number
  departmentCode: string
  uploaderName: string
  uploadedAt: string
  status: string
  totalSheets: number
  totalRows: number
  errorDetail?: string
  completedAt?: string
  sheetResults: SheetResult[]
}

const PAGE_SIZE = 15

export default function HistoryPage() {
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const endpoint = isAdmin ? '/admin/uploads' : '/upload/history'

  const { data, isLoading } = useQuery({
    queryKey: ['upload-history', page, isAdmin],
    queryFn: () => api.get(endpoint, { params: { page, pageSize: PAGE_SIZE } }).then(r => r.data),
  })

  const sessions: UploadSession[] = data?.items ?? []
  const total: number = data?.totalCount ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/uploads/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['upload-history'] })
      setConfirmId(null)
    },
  })

  const statusIcon = (s: string) => {
    if (s === 'Success') return <CheckCircle size={16} className="text-green-500 shrink-0" />
    if (s === 'Failed') return <XCircle size={16} className="text-red-500 shrink-0" />
    return <Clock size={16} className="text-yellow-500 shrink-0" />
  }

  const statusBadge = (s: string) => {
    if (s === 'Success') return <span className="badge-success">Thành công</span>
    if (s === 'Failed') return <span className="badge-error">Thất bại</span>
    return <span className="badge-warning">Đang xử lý</span>
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lịch sử đẩy dữ liệu</h1>
          <p className="text-gray-500 mt-1 text-sm">
            {total > 0 ? `${total} lần upload` : 'Chưa có lần upload nào'}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Đang tải...</div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileSpreadsheet size={48} className="mx-auto mb-3 opacity-40" />
          <p>Chưa có lần upload nào</p>
        </div>
      ) : (
        <>
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">File</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Phòng ban</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Người đẩy</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Thời gian</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Dòng nhập</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Trạng thái</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sessions.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {statusIcon(s.status)}
                        <div>
                          <p className="font-medium text-gray-800 max-w-xs truncate">{s.fileName}</p>
                          <p className="text-xs text-gray-400">{(s.fileSizeBytes / 1024).toFixed(0)} KB</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{s.departmentCode}</td>
                    <td className="px-4 py-3 text-gray-600">{s.uploaderName}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(s.uploadedAt).toLocaleString('vi-VN')}
                    </td>
                    <td className="px-4 py-3 text-gray-700 font-medium">
                      {s.totalRows > 0 ? s.totalRows.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3">{statusBadge(s.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {/* Xem chi tiết — chỉ khi có dữ liệu */}
                        {s.status === 'Success' && s.sheetResults.some(r => r.mappedTableName) && (
                          <button
                            onClick={() => navigate(`/history/${s.id}`)}
                            className="text-gray-400 hover:text-blue-600 p-1"
                            title="Xem dữ liệu"
                          >
                            <Eye size={16} />
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => setConfirmId(s.id)}
                            className="text-gray-400 hover:text-red-600 p-1"
                            title="Xóa"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phân trang */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                Trang {page}/{totalPages} — {total} bản ghi
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-secondary py-1 px-2 disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="btn-secondary py-1 px-2 disabled:opacity-40"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Confirm delete dialog */}
      {confirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-semibold text-lg mb-2">Xác nhận xóa</h3>
            <p className="text-gray-600 text-sm mb-6">
              Toàn bộ dữ liệu đã import của lần upload này sẽ bị xóa vĩnh viễn. Không thể hoàn tác.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => del.mutate(confirmId)}
                disabled={del.isPending}
                className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg flex-1 disabled:opacity-50"
              >
                {del.isPending ? 'Đang xóa...' : 'Xóa'}
              </button>
              <button onClick={() => setConfirmId(null)} className="btn-secondary flex-1">
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
