import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../api/client'
import type { UserDto } from './types'
import { Plus, Pencil, UserX, UserCheck } from 'lucide-react'

export default function UsersTab() {
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page],
    queryFn: () => api.get(`/admin/users?page=${page}&pageSize=20`).then(r => r.data),
  })

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.put(`/admin/users/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const roleLabel = (role: string) => ({
    SystemAdmin: 'Quản trị viên',
    DepartmentManager: 'Trưởng phòng',
    EndUser: 'Nhân viên',
  }[role] ?? role)

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold text-gray-700">Danh sách người dùng ({data?.totalCount ?? 0})</h2>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Thêm người dùng
        </button>
      </div>

      {isLoading ? (
        <p className="text-gray-500 text-sm">Đang tải...</p>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tên đăng nhập</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Họ tên</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Vai trò</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Phòng ban</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Trạng thái</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data?.items?.map((u: UserDto) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{u.username}</td>
                  <td className="px-4 py-3">{u.fullName}</td>
                  <td className="px-4 py-3"><span className="badge-info">{roleLabel(u.role)}</span></td>
                  <td className="px-4 py-3">{u.departmentName}</td>
                  <td className="px-4 py-3">
                    {u.isActive
                      ? <span className="badge-success">Hoạt động</span>
                      : <span className="badge-error">Vô hiệu</span>}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive.mutate({ id: u.id, isActive: !u.isActive })}
                      className="text-gray-400 hover:text-gray-600 p-1"
                      title={u.isActive ? 'Vô hiệu hóa' : 'Kích hoạt'}
                    >
                      {u.isActive ? <UserX size={16} /> : <UserCheck size={16} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}

function CreateUserModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    username: '', fullName: '', email: '', password: '',
    role: 'EndUser', departmentCode: ''
  })
  const [error, setError] = useState('')

  const create = useMutation({
    mutationFn: (data: typeof form) => api.post('/admin/users', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      onClose()
    },
    onError: (err: unknown) => {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Lỗi tạo user')
    }
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <h3 className="font-semibold text-lg mb-4">Thêm người dùng mới</h3>
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        <div className="space-y-3">
          {(['username', 'fullName', 'email', 'password', 'departmentCode'] as const).map(field => (
            <div key={field}>
              <label className="block text-xs font-medium text-gray-600 mb-1 capitalize">{field}</label>
              <input
                className="input"
                type={field === 'password' ? 'password' : 'text'}
                value={form[field]}
                onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
              />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Vai trò</label>
            <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              <option value="EndUser">Nhân viên</option>
              <option value="DepartmentManager">Trưởng phòng</option>
              <option value="SystemAdmin">Quản trị viên</option>
            </select>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={() => create.mutate(form)} className="btn-primary flex-1" disabled={create.isPending}>
            {create.isPending ? 'Đang tạo...' : 'Tạo người dùng'}
          </button>
          <button onClick={onClose} className="btn-secondary flex-1">Hủy</button>
        </div>
      </div>
    </div>
  )
}
