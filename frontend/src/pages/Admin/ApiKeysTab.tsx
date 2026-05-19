import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../api/client'
import { Plus, Copy, CheckCircle, ShieldOff, ShieldCheck, Trash2 } from 'lucide-react'

interface ApiKey {
  id: string
  name: string
  description?: string
  isActive: boolean
  createdAt: string
  lastUsedAt?: string
  expiresAt?: string
}

export default function ApiKeysTab() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [newKey, setNewKey] = useState<{ rawKey: string; name: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<ApiKey | null>(null)

  const { data } = useQuery<ApiKey[]>({
    queryKey: ['api-keys'],
    queryFn: () => api.get('/admin/api-keys').then(r => r.data),
  })

  const create = useMutation({
    mutationFn: (body: { name: string; description?: string }) =>
      api.post('/admin/api-keys', body),
    onSuccess: (res) => {
      setNewKey({ rawKey: res.data.rawKey, name: res.data.name })
      setShowCreate(false)
      qc.invalidateQueries({ queryKey: ['api-keys'] })
    }
  })

  const revoke = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/api-keys/${id}/revoke`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  })

  const activate = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/api-keys/${id}/activate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/api-keys/${id}`),
    onSuccess: () => {
      setConfirmDelete(null)
      qc.invalidateQueries({ queryKey: ['api-keys'] })
    },
  })

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold text-gray-700">API Keys cho iTitan</h2>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Tạo API Key
        </button>
      </div>

      {newKey && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
          <p className="font-semibold text-yellow-800 mb-2">⚠️ Lưu API Key ngay — không thể xem lại!</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white border border-yellow-300 rounded px-3 py-2 text-sm font-mono break-all">
              {newKey.rawKey}
            </code>
            <button onClick={() => copyKey(newKey.rawKey)} className="btn-secondary flex items-center gap-1">
              {copied ? <CheckCircle size={16} className="text-green-600" /> : <Copy size={16} />}
            </button>
          </div>
          <button onClick={() => setNewKey(null)} className="mt-2 text-sm text-yellow-700 hover:underline">
            Đóng
          </button>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tên</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Mô tả</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Trạng thái</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Sử dụng lần cuối</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Hết hạn</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data?.map(k => (
              <tr key={k.id} className={`hover:bg-gray-50 ${!k.isActive ? 'opacity-60' : ''}`}>
                <td className="px-4 py-3 font-medium">{k.name}</td>
                <td className="px-4 py-3 text-gray-500">{k.description || '—'}</td>
                <td className="px-4 py-3">
                  {k.isActive
                    ? <span className="badge-success">Active</span>
                    : <span className="badge-error">Revoked</span>}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString('vi-VN') : '—'}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {k.expiresAt ? new Date(k.expiresAt).toLocaleDateString('vi-VN') : 'Không hết hạn'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {k.isActive ? (
                      <button
                        onClick={() => revoke.mutate(k.id)}
                        disabled={revoke.isPending}
                        title="Vô hiệu hóa"
                        className="p-1.5 rounded text-orange-500 hover:bg-orange-50 transition-colors disabled:opacity-40">
                        <ShieldOff size={15} />
                      </button>
                    ) : (
                      <button
                        onClick={() => activate.mutate(k.id)}
                        disabled={activate.isPending}
                        title="Kích hoạt lại"
                        className="p-1.5 rounded text-green-600 hover:bg-green-50 transition-colors disabled:opacity-40">
                        <ShieldCheck size={15} />
                      </button>
                    )}
                    <button
                      onClick={() => setConfirmDelete(k)}
                      title="Xóa vĩnh viễn"
                      className="p-1.5 rounded text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!data?.length && (
              <tr>
                <td colSpan={6} className="text-center py-10 text-gray-400">Chưa có API Key nào</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateKeyModal
          onSubmit={(name, description) => create.mutate({ name, description })}
          onClose={() => setShowCreate(false)}
          loading={create.isPending}
        />
      )}

      {confirmDelete && (
        <ConfirmDeleteModal
          keyName={confirmDelete.name}
          loading={remove.isPending}
          onConfirm={() => remove.mutate(confirmDelete.id)}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}

function CreateKeyModal({
  onSubmit, onClose, loading
}: {
  onSubmit: (name: string, desc?: string) => void
  onClose: () => void
  loading: boolean
}) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
        <h3 className="font-semibold text-lg mb-4">Tạo API Key mới</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tên *</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="VD: iTitan Production" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Mô tả</label>
            <input className="input" value={desc} onChange={e => setDesc(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={() => onSubmit(name, desc)} className="btn-primary flex-1" disabled={!name || loading}>
            {loading ? 'Đang tạo...' : 'Tạo'}
          </button>
          <button onClick={onClose} className="btn-secondary flex-1">Hủy</button>
        </div>
      </div>
    </div>
  )
}

function ConfirmDeleteModal({
  keyName, loading, onConfirm, onClose
}: {
  keyName: string
  loading: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
        <h3 className="font-semibold text-lg mb-2 text-red-600">Xóa API Key</h3>
        <p className="text-sm text-gray-600 mb-1">
          Bạn có chắc muốn xóa vĩnh viễn key <span className="font-semibold text-gray-900">"{keyName}"</span>?
        </p>
        <p className="text-xs text-red-500 mb-5">
          ⚠ Mọi hệ thống đang dùng key này sẽ không còn truy cập được nữa.
        </p>
        <div className="flex gap-3">
          <button onClick={onConfirm} className="btn-danger flex-1" disabled={loading}>
            {loading ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
          </button>
          <button onClick={onClose} className="btn-secondary flex-1">Hủy</button>
        </div>
      </div>
    </div>
  )
}
