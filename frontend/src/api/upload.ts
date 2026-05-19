import api from './client'
import type { PagedResult, UploadSession } from '../types'

export const uploadApi = {
  upload: (file: File, mappingId?: string, batchName?: string, dataMonth?: string, notes?: string, onProgress?: (pct: number) => void, metadataJson?: string) => {
    const form = new FormData()
    form.append('file', file)
    if (mappingId) form.append('mappingId', mappingId)
    if (batchName) form.append('batchName', batchName)
    if (dataMonth) form.append('dataMonth', dataMonth)
    if (notes) form.append('notes', notes)
    if (metadataJson) form.append('metadataJson', metadataJson)
    return api.post<UploadSession>('/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total))
      },
    })
  },

  getStatus: (sessionId: string) =>
    api.get<UploadSession>(`/upload/${sessionId}/status`),

  getStats: () =>
    api.get<{ total: number; success: number; failed: number; pending: number }>('/upload/stats'),

  getHistory: (page = 1, pageSize = 20) =>
    api.get<PagedResult<UploadSession>>('/upload/history', { params: { page, pageSize } }),

  download: (sessionId: string) =>
    api.get(`/upload/${sessionId}/download`, { responseType: 'blob' }),
}
