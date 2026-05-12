import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../api/client'

export default function DepartmentsTab() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['admin-depts'],
    queryFn: () => api.get('/admin/departments').then(r => r.data),
  })

  return (
    <div>
      <h2 className="font-semibold text-gray-700 mb-4">Danh sách phòng ban</h2>
      {isLoading ? <p className="text-gray-500 text-sm">Đang tải...</p> : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Mã</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tên phòng ban</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data?.map((d: { code: string; name: string; isActive: boolean }) => (
                <tr key={d.code} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-blue-700">{d.code}</td>
                  <td className="px-4 py-3">{d.name}</td>
                  <td className="px-4 py-3">
                    {d.isActive ? <span className="badge-success">Hoạt động</span> : <span className="badge-error">Tắt</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
