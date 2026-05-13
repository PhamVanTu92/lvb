import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../api/client'
import { dataApi } from '../../api/data'
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Columns, X, GripVertical } from 'lucide-react'
import type { DatasetField } from '../../types'

interface SheetMapping {
  id: string
  sheetName: string
  tableName: string
  departmentCode: string
  columnMappingJson: string
  isActive: boolean
  createdAt: string
}

const FIELD_TYPES = [
  { value: 'text', label: 'Văn bản (text)' },
  { value: 'number', label: 'Số (number)' },
  { value: 'date', label: 'Ngày (date)' },
  { value: 'month', label: 'Tháng (MM/YYYY)' },
  { value: 'quarter', label: 'Quý (QN/YYYY)' },
  { value: 'year', label: 'Năm (YYYY)' },
  { value: 'dropdown', label: 'Danh sách chọn (dropdown)' },
  { value: 'textarea', label: 'Đoạn văn (textarea)' },
]

export default function DatasetMappingsTab() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<SheetMapping | null>(null)
  const [fieldsMapping, setFieldsMapping] = useState<SheetMapping | null>(null)

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
                        onClick={() => setFieldsMapping(m)}
                        className="text-gray-400 hover:text-purple-600 p-1"
                        title="Khai báo trường dữ liệu"
                      >
                        <Columns size={15} />
                      </button>
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

      {fieldsMapping && (
        <FieldsModal
          mapping={fieldsMapping}
          onClose={() => setFieldsMapping(null)}
        />
      )}
    </div>
  )
}

// ── Dataset create/edit form ─────────────────────────────────────────────────

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

// ── Field management modal ───────────────────────────────────────────────────

function FieldsModal({ mapping, onClose }: { mapping: SheetMapping; onClose: () => void }) {
  const qc = useQueryClient()
  const [showFieldForm, setShowFieldForm] = useState(false)
  const [editingField, setEditingField] = useState<DatasetField | null>(null)

  const { data: fields, isLoading } = useQuery<DatasetField[]>({
    queryKey: ['dataset-fields', mapping.id],
    queryFn: () => dataApi.getDatasetFields(mapping.id).then(r => r.data),
  })

  const delField = useMutation({
    mutationFn: (id: string) => dataApi.deleteDatasetField(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dataset-fields', mapping.id] }),
  })

  const fieldTypeName = (v: string) => FIELD_TYPES.find(t => t.value === v)?.label ?? v

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="font-semibold text-lg">Trường dữ liệu</h3>
            <p className="text-sm text-gray-500 mt-0.5">{mapping.sheetName} · <span className="font-mono text-xs text-blue-600">{mapping.tableName}</span></p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1"><X size={20} /></button>
        </div>

        {/* Field list */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent" />
            </div>
          ) : fields && fields.length > 0 ? (
            <div className="space-y-2">
              {fields.sort((a, b) => a.orderIndex - b.orderIndex).map(f => (
                <div key={f.id} className="flex items-center gap-3 border border-gray-200 rounded-lg px-3 py-2.5 hover:bg-gray-50">
                  <GripVertical size={14} className="text-gray-300 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800 text-sm">{f.displayName}</span>
                      {f.isRequired && (
                        <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">Bắt buộc</span>
                      )}
                      {!f.isActive && (
                        <span className="text-xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">Tắt</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                      <span className="font-mono">{f.fieldName}</span>
                      <span>·</span>
                      <span>{fieldTypeName(f.fieldType)}</span>
                      {f.dropdownOptions && f.dropdownOptions.length > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-blue-500">{f.dropdownOptions.length} lựa chọn</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => { setEditingField(f); setShowFieldForm(true) }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                      title="Chỉnh sửa"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Xóa trường "${f.displayName}"?`)) delField.mutate(f.id)
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                      title="Xóa"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-gray-400">
              <Columns size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Chưa có trường nào được khai báo</p>
              <p className="text-xs mt-1">Thêm trường để hiển thị form nhập liệu khi upload</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
          <p className="text-xs text-gray-400">{fields?.length ?? 0} trường</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary">Đóng</button>
            <button
              onClick={() => { setEditingField(null); setShowFieldForm(true) }}
              className="btn-primary flex items-center gap-2"
            >
              <Plus size={15} /> Thêm trường
            </button>
          </div>
        </div>
      </div>

      {showFieldForm && (
        <FieldForm
          mappingId={mapping.id}
          editing={editingField}
          nextOrder={(fields?.length ?? 0)}
          onClose={() => { setShowFieldForm(false); setEditingField(null) }}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['dataset-fields', mapping.id] })
            setShowFieldForm(false)
            setEditingField(null)
          }}
        />
      )}
    </div>
  )
}

// ── Single field create/edit form ────────────────────────────────────────────

function FieldForm({
  mappingId, editing, nextOrder, onClose, onSaved,
}: {
  mappingId: string
  editing: DatasetField | null
  nextOrder: number
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    fieldName: editing?.fieldName ?? '',
    displayName: editing?.displayName ?? '',
    fieldType: editing?.fieldType ?? 'text',
    isRequired: editing?.isRequired ?? false,
    dropdownRaw: editing?.dropdownOptions?.join('\n') ?? '',
    isActive: editing?.isActive ?? true,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm(f => ({ ...f, [k]: v }))
    setErrors(e => ({ ...e, [k]: '' }))
    if (k === 'displayName' && !editing) {
      const auto = (v as string)
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
      setForm(f => ({ ...f, displayName: v as string, fieldName: auto }))
    }
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.displayName.trim()) e.displayName = 'Vui lòng nhập tên hiển thị'
    if (!form.fieldName.trim()) e.fieldName = 'Vui lòng nhập tên trường'
    else if (!/^[a-z0-9_]+$/.test(form.fieldName)) e.fieldName = 'Chỉ dùng chữ thường, số và dấu _'
    return e
  }

  const save = useMutation({
    mutationFn: () => {
      const dropdownOptions = form.fieldType === 'dropdown'
        ? form.dropdownRaw.split('\n').map(s => s.trim()).filter(Boolean)
        : undefined
      const payload = {
        mappingId,
        fieldName: form.fieldName,
        displayName: form.displayName,
        fieldType: form.fieldType,
        isRequired: form.isRequired,
        dropdownOptions,
      }
      return editing
        ? dataApi.updateDatasetField(editing.id, { ...payload, mappingId })
        : dataApi.createDatasetField(payload)
    },
    onSuccess: onSaved,
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setErrors({ _form: msg ?? 'Lưu thất bại' })
    },
  })

  const handleSubmit = () => {
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }
    save.mutate()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="font-semibold text-base mb-4">
          {editing ? 'Chỉnh sửa trường' : 'Thêm trường mới'}
        </h3>

        {errors._form && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-red-700 text-sm">
            {errors._form}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên hiển thị</label>
            <input
              className={`input text-sm ${errors.displayName ? 'border-red-400' : ''}`}
              placeholder="VD: Số tài khoản"
              value={form.displayName}
              onChange={e => set('displayName', e.target.value)}
              autoFocus
            />
            {errors.displayName && <p className="text-red-500 text-xs mt-1">{errors.displayName}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tên trường (field name) <span className="text-gray-400 font-normal text-xs">chỉ a-z, 0-9, _</span>
            </label>
            <input
              className={`input text-sm font-mono ${errors.fieldName ? 'border-red-400' : ''}`}
              placeholder="VD: so_tai_khoan"
              value={form.fieldName}
              onChange={e => set('fieldName', e.target.value.toLowerCase())}
              disabled={!!editing}
            />
            {editing && <p className="text-xs text-gray-400 mt-1">Không thể đổi tên trường sau khi tạo</p>}
            {errors.fieldName && <p className="text-red-500 text-xs mt-1">{errors.fieldName}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kiểu dữ liệu</label>
            <select
              className="input text-sm"
              value={form.fieldType}
              onChange={e => set('fieldType', e.target.value)}
            >
              {FIELD_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {form.fieldType === 'dropdown' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Danh sách lựa chọn <span className="text-gray-400 font-normal text-xs">(mỗi dòng 1 giá trị)</span>
              </label>
              <textarea
                className="input text-sm resize-none h-28"
                placeholder={'Lựa chọn 1\nLựa chọn 2\nLựa chọn 3'}
                value={form.dropdownRaw}
                onChange={e => set('dropdownRaw', e.target.value)}
              />
            </div>
          )}

          <div className="flex items-center gap-4 pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-4 h-4 text-blue-600 rounded"
                checked={form.isRequired}
                onChange={e => set('isRequired', e.target.checked)}
              />
              <span className="text-sm text-gray-700">Trường bắt buộc</span>
            </label>
            {editing && (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-blue-600 rounded"
                  checked={form.isActive}
                  onChange={e => set('isActive', e.target.checked)}
                />
                <span className="text-sm text-gray-700">Đang hoạt động</span>
              </label>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={handleSubmit} className="btn-primary flex-1" disabled={save.isPending}>
            {save.isPending ? 'Đang lưu...' : (editing ? 'Lưu thay đổi' : 'Thêm trường')}
          </button>
          <button onClick={onClose} className="btn-secondary flex-1">Hủy</button>
        </div>
      </div>
    </div>
  )
}
