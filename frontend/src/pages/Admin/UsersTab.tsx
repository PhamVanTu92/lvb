import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../api/client'
import type { UserDto } from './types'
import { Plus, UserX, UserCheck } from 'lucide-react'

const ROLE_OPTIONS = [
  { value: 'EndUser', label: 'Nhân viên' },
  { value: 'DepartmentManager', label: 'Trưởng phòng' },
  { value: 'SystemAdmin', label: 'Quản trị viên' },
]

const roleLabel = (role: string) =>
  ROLE_OPTIONS.find(r => r.value === role)?.label ?? role

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

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold text-gray-700">
          Danh sách người dùng ({data?.totalCount ?? 0})
        </h2>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Thêm người dùng
        </button>
      </div>

      {isLoading ? (
        <p className="text-gray-500 text-sm">Đang tải...</p>
      ) : (
        <>
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
                    <td className="px-4 py-3">
                      <span className="badge-info">{roleLabel(u.role)}</span>
                    </td>
                    <td className="px-4 py-3">{u.departmentName || u.departmentCode}</td>
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

          {/* Phân trang */}
          {data?.totalCount > 20 && (
            <div className="flex gap-2 mt-4 justify-end">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary px-3 py-1 text-sm disabled:opacity-40"
              >Trước</button>
              <span className="px-3 py-1 text-sm text-gray-600">Trang {page}</span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={data?.items?.length < 20}
                className="btn-secondary px-3 py-1 text-sm disabled:opacity-40"
              >Sau</button>
            </div>
          )}
        </>
      )}

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}

function Field({ name, label, type = 'text', form, errors, onChange }: {
  name: string; label: string; type?: string
  form: Record<string, string>
  errors: Record<string, string>
  onChange: (field: string, value: string) => void
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        className={`input ${errors[name] ? 'border-red-400 focus:ring-red-400' : ''}`}
        type={type}
        value={form[name]}
        onChange={e => onChange(name, e.target.value)}
        placeholder={label}
      />
      {errors[name] && <p className="text-red-500 text-xs mt-1">{errors[name]}</p>}
    </div>
  )
}

function CreateUserModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    username: '', fullName: '', email: '', password: '',
    role: 'EndUser', departmentCode: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Load danh sách phòng ban
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then(r => r.data),
  })

  const set = (field: string, value: string) => {
    setForm(f => ({ ...f, [field]: value }))
    setErrors(e => ({ ...e, [field]: '' }))
  }

  // Validate phía client
  const validate = () => {
    const errs: Record<string, string> = {}
    if (!form.username.trim()) errs.username = 'Vui lòng nhập tên đăng nhập'
    if (!form.fullName.trim()) errs.fullName = 'Vui lòng nhập họ tên'
    if (!form.email.trim()) errs.email = 'Vui lòng nhập email'
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Email không hợp lệ'
    if (!form.password) errs.password = 'Vui lòng nhập mật khẩu'
    else if (form.password.length < 8) errs.password = 'Mật khẩu tối thiểu 8 ký tự'
    if (!form.departmentCode) errs.departmentCode = 'Vui lòng chọn phòng ban'
    return errs
  }

  const create = useMutation({
    mutationFn: (data: typeof form) => api.post('/admin/users', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      onClose()
    },
    onError: (err: unknown) => {
      const resp = (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data
      if (resp?.errors) {
        // Validation errors từ ASP.NET
        const mapped: Record<string, string> = {}
        for (const [key, msgs] of Object.entries(resp.errors)) {
          const field = key === '$' ? '_form' : key.replace('$.', '').replace(/([A-Z])/g, c => c.toLowerCase())
          mapped[field] = Array.isArray(msgs) ? msgs[0] : String(msgs)
        }
        setErrors(mapped)
      } else {
        setErrors({ _form: resp?.message ?? 'Tạo người dùng thất bại' })
      }
    }
  })

  const handleSubmit = () => {
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    create.mutate(form)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
        <h3 className="font-semibold text-lg mb-5">Thêm người dùng mới</h3>

        {errors._form && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-red-700 text-sm">
            {errors._form}
          </div>
        )}

        <div className="space-y-4">
          <Field name="username" label="Tên đăng nhập" form={form} errors={errors} onChange={set} />
          <Field name="fullName" label="Họ và tên" form={form} errors={errors} onChange={set} />
          <Field name="email" label="Email" type="email" form={form} errors={errors} onChange={set} />
          <Field name="password" label="Mật khẩu" type="password" form={form} errors={errors} onChange={set} />

          {/* Vai trò */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vai trò</label>
            <select
              className="input"
              value={form.role}
              onChange={e => set('role', e.target.value)}
            >
              {ROLE_OPTIONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* Phòng ban – dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phòng ban</label>
            <select
              className={`input ${errors.departmentCode ? 'border-red-400 focus:ring-red-400' : ''}`}
              value={form.departmentCode}
              onChange={e => set('departmentCode', e.target.value)}
            >
              <option value="">-- Chọn phòng ban --</option>
              {departments?.map((d: { code: string; name: string }) => (
                <option key={d.code} value={d.code}>{d.name} ({d.code})</option>
              ))}
            </select>
            {errors.departmentCode && (
              <p className="text-red-500 text-xs mt-1">{errors.departmentCode}</p>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSubmit}
            className="btn-primary flex-1"
            disabled={create.isPending}
          >
            {create.isPending ? 'Đang tạo...' : 'Tạo người dùng'}
          </button>
          <button onClick={onClose} className="btn-secondary flex-1">Hủy</button>
        </div>
      </div>
    </div>
  )
}
