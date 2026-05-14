import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { dataApi } from '../../api/data'
import { useAuth } from '../../contexts/AuthContext'
import { BarChart2, Play, Plus, Pencil, Trash2, ChevronRight } from 'lucide-react'
import type { ReportListItem } from '../../types'

export default function ReportListPage() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const qc = useQueryClient()

  const { data: reports, isLoading } = useQuery({
    queryKey: ['reports'],
    queryFn: () => dataApi.getReports().then(r => r.data),
  })

  const del = useMutation({
    mutationFn: (id: string) => dataApi.deleteReport(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }),
  })

  const active = reports?.filter(r => r.isActive) ?? []
  const inactive = reports?.filter(r => !r.isActive) ?? []

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Xử lý dữ liệu</h1>
          <p className="text-gray-500 text-sm mt-1">
            Tổng hợp, so sánh dữ liệu từ các bảng đã khai báo
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => navigate('/reports/builder/new')}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={16} /> Tạo báo cáo mới
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin h-6 w-6 rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : active.length === 0 && inactive.length === 0 ? (
        <div className="text-center py-20">
          <BarChart2 className="mx-auto text-gray-300 mb-4" size={48} />
          <p className="text-gray-500 text-lg mb-2">Chưa có báo cáo nào</p>
          {isAdmin && (
            <button onClick={() => navigate('/reports/builder/new')} className="btn-primary mt-2">
              Tạo báo cáo đầu tiên
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          <ReportGrid
            title="Báo cáo đang hoạt động"
            items={active}
            isAdmin={isAdmin}
            onRun={id => navigate(`/reports/${id}`)}
            onEdit={id => navigate(`/reports/builder/${id}`)}
            onDelete={id => {
              if (confirm('Xóa báo cáo này?')) del.mutate(id)
            }}
          />
          {isAdmin && inactive.length > 0 && (
            <ReportGrid
              title="Đã ẩn"
              items={inactive}
              isAdmin={isAdmin}
              onRun={id => navigate(`/reports/${id}`)}
              onEdit={id => navigate(`/reports/builder/${id}`)}
              onDelete={id => {
                if (confirm('Xóa báo cáo này?')) del.mutate(id)
              }}
              muted
            />
          )}
        </div>
      )}
    </div>
  )
}

function ReportGrid({
  title, items, isAdmin, onRun, onEdit, onDelete, muted = false,
}: {
  title: string
  items: ReportListItem[]
  isAdmin: boolean
  onRun: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  muted?: boolean
}) {
  if (items.length === 0) return null
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{title}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(r => (
          <div
            key={r.id}
            className={`card group cursor-pointer hover:shadow-md transition-shadow relative ${muted ? 'opacity-60' : ''}`}
            onClick={() => onRun(r.id)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="p-2 bg-blue-100 rounded-lg shrink-0">
                <BarChart2 size={18} className="text-blue-600" />
              </div>
              {isAdmin && (
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={e => e.stopPropagation()}>
                  <button onClick={() => onEdit(r.id)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => onDelete(r.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50">
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>
            <h3 className="font-semibold text-gray-900 mt-3 mb-1 leading-snug">{r.name}</h3>
            {r.description && (
              <p className="text-sm text-gray-500 line-clamp-2">{r.description}</p>
            )}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-400">
                {r.departmentCode ? `Phòng ${r.departmentCode}` : 'Tất cả phòng ban'}
              </span>
              <span className="flex items-center gap-1 text-xs text-blue-600 font-medium group-hover:gap-2 transition-all">
                <Play size={11} /> Chạy <ChevronRight size={11} />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
