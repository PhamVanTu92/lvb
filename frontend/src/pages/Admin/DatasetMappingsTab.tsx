import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../api/client'
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'

interface SheetMapping {
  id: string
  sheetName: string
  tableName: string
  departmentCode: string
  columnMappingJson: string
  isActive: boolean
  createdAt: string
}

export default function DatasetMappingsTab() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<SheetMapping | null>(null)

  const { data: mappings, isLoading } = useQuery<SheetMapping[]>({
    queryKey: ['admin-sheet-mappings'],
    queryFn: () => api.get('/admin/sheet-mappings').then(r => r.data),
  })

  const { data: departments } = useQuery<{ code: string; name: string }[]>({
    queryKey: ['admin-depts'],
    queryFn: () => api.get('/admin/departments').then(r => r.data),
  })

  const toggleActive = useMutation({
    mutationFn: (m: SheetMapping) =>
      api.put(`/admin/sheet-mappings/${m.id}`, {
        sheetName: m.sheetName,
        tableName: m.tableName,
        departmentCode: m.departmentCode,
        isActive: !m.isActive,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-sheet-mappings'] })
      qc.invalidateQueries({ queryKey: ['departments'] })
    },
  })

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/sheet-mappings/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-sheet-mappings'] })
      qc.invalidateQueries({ queryKey: ['departments'] })
    },
  })

  const deptName = (code: string) =>
    code === '' ? '🌐 Tất cả phòng ban' : (departments?.find(d => d.code === code)?.name ?? code)

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold text-gray-700">
          Khai báo Dataset ({mappings?.length ?? 0})
        </h2>
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} /> Thêm Dataset
        </button>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        Mỗi dataset tương ứng với một sheet Excel và một bảng trong cơ sở dữ liệu.
        Thêm dataset mới để hệ thống nhận dạng file upload và hiển thị menu tương ứng.
      </p>

      {isLoading ? (
        <p className="text-gray-500 text-sm">Đang tải...</p>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tên hiển thị (Sheet)</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tên bảng DB</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Phòng ban</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Trạng thái</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {mappings?.map(m => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{m.sheetName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-blue-700">{m.tableName}</td>
                  <td className="px-4 py-3">{deptName(m.departmentCode)}</td>
                  <td className="px-4 py-3">
                    {m.isActive
                      ? <span className="badge-success">Hoạt động</span>
                      : <span className="badge-error">Tắt</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setEditing(m); setShowForm(true) }}
                        className="text-gray-400 hover:text-blue-600 p-1"
                        title="Chỉnh sửa"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => toggleActive.mutate(m)}
                        className="text-gray-400 hover:text-gray-700 p-1"
                        title={m.isActive ? 'Tắt' : 'Bật'}
                      >
                        {m.isActive ? <ToggleRight size={16} className="text-green-500" /> : <ToggleLeft size={16} />}
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Xóa dataset "${m.sheetName}"?`)) del.mutate(m.id)
                        }}
                        className="text-gray-400 hover:text-red-600 p-1"
                        title="Xóa"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {mappings?.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-gray-400">
                    Chưa có dataset nào. Nhấn "Thêm Dataset" để khai báo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <DatasetForm
          departments={departments ?? []}
          editing={editing}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  )
}

function DatasetForm({
  departments,
  editing,
  onClose,
}: {
  departments: { code: string; name: string }[]
  editing: SheetMapping | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    sheetName: editing?.sheetName ?? '',
    tableName: editing?.tableName ?? '',
    departmentCode: editing?.departmentCode ?? '',
    columnMappingJson: editing?.columnMappingJson ?? '{}',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [jsonError, setJsonError] = useState('')

  const set = (field: string, value: string) => {
    setForm(f => ({ ...f, [field]: value }))
    setErrors(e => ({ ...e, [field]: '' }))
    if (field === 'sheetName' && !editing) {
      // Auto-generate table name from sheet name
      const auto = value
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
      setForm(f => ({ ...f, sheetName: value, tableName: auto }))
    }
  }

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!form.sheetName.trim()) errs.sheetName = 'Vui lòng nhập tên hiển thị'
    if (!form.tableName.trim()) errs.tableName = 'Vui lòng nhập tên bảng'
    else if (!/^[a-z0-9_]+$/.test(form.tableName)) errs.tableName = 'Chỉ dùng chữ thường, số và dấu _'
    try { JSON.parse(form.columnMappingJson) } catch { setJsonError('JSON không hợp lệ') }
    return errs
  }

  const save = useMutation({
    mutationFn: (payload: typeof form) =>
      editing
        ? api.put(`/admin/sheet-mappings/${editing.id}`, payload)
        : api.post('/admin/sheet-mappings', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-sheet-mappings'] })
      qc.invalidateQueries({ queryKey: ['departments'] })
      onClose()
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setErrors({ _form: msg ?? 'Lưu thất bại' })
    },
  })

  const handleSubmit = () => {
    const errs = validate()
    if (Object.keys(errs).length > 0 || jsonError) { setErrors(errs); return }
    save.mutate(form)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl">
        <h3 className="font-semibold text-lg mb-5">
          {editing ? 'Chỉnh sửa Dataset' : 'Thêm Dataset mới'}
        </h3>

        {errors._form && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-red-700 text-sm">
            {errors._form}
          </div>
        )}

        <div className="space-y-4">
          {/* Sheet name (display name) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tên hiển thị (tên sheet trong Excel)
            </label>
            <input
              className={`input ${errors.sheetName ? 'border-red-400' : ''}`}
              placeholder="VD: Huy động/Cho vay"
              value={form.sheetName}
              onChange={e => set('sheetName', e.target.value)}
            />
            {errors.sheetName && <p className="text-red-500 text-xs mt-1">{errors.sheetName}</p>}
          </div>

          {/* Table name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tên bảng trong DB <span className="text-gray-400 font-normal">(chỉ chữ thường, số, dấu _)</span>
            </label>
            <input
              className={`input font-mono text-sm ${errors.tableName ? 'border-red-400' : ''}`}
              placeholder="VD: huy_dong_cho_vay"
              value={form.tableName}
              onChange={e => set('tableName', e.target.value.toLowerCase())}
              disabled={!!editing}
            />
            {editing && <p className="text-xs text-gray-400 mt-1">Không thể đổi tên bảng sau khi tạo</p>}
            {errors.tableName && <p className="text-red-500 text-xs mt-1">{errors.tableName}</p>}
          </div>

          {/* Department */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phòng ban</label>
            <select
              className={`input ${errors.departmentCode ? 'border-red-400' : ''}`}
              value={form.departmentCode}
              onChange={e => set('departmentCode', e.target.value)}
              disabled={!!editing}
            >
              <option value="">🌐 Tất cả phòng ban (dùng chung)</option>
              {departments.map(d => (
                <option key={d.code} value={d.code}>{d.name} ({d.code})</option>
              ))}
            </select>
            <p className="text-gray-400 text-xs mt-1">
              "Tất cả" → hiển thị cho mọi phòng ban. Chọn cụ thể → chỉ phòng đó thấy màn hình này.
            </p>
            {errors.departmentCode && <p className="text-red-500 text-xs mt-1">{errors.departmentCode}</p>}
          </div>

          {/* Column mapping JSON */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ánh xạ cột <span className="text-gray-400 font-normal">(JSON, để mặc định nếu không cần)</span>
            </label>
            <textarea
              className={`input font-mono text-xs h-28 resize-none ${jsonError ? 'border-red-400' : ''}`}
              value={form.columnMappingJson}
              onChange={e => { set('columnMappingJson', e.target.value); setJsonError('') }}
              placeholder='{"COT_EXCEL": "ten_cot_db"}'
            />
            {jsonError && <p className="text-red-500 text-xs mt-1">{jsonError}</p>}
            <p className="text-gray-400 text-xs mt-1">
              Để <code>{'{}'}</code> nếu tên cột Excel và DB giống nhau
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSubmit}
            className="btn-primary flex-1"
            disabled={save.isPending}
          >
            {save.isPending ? 'Đang lưu...' : (editing ? 'Lưu thay đổi' : 'Tạo Dataset')}
          </button>
          <button onClick={onClose} className="btn-secondary flex-1">Hủy</button>
        </div>
      </div>
    </div>
  )
}
