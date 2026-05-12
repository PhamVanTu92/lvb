import api from './client'
import type { PagedResult, UploadSession } from '../types'

export const uploadApi = {
  upload: (file: File, onProgress?: (pct: number) => void) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<UploadSession>('/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total))
      },
    })
  },

  getStatus: (sessionId: string) =>
    api.get<UploadSession>(`/upload/${sessionId}/status`),

  getHistory: (page = 1, pageSize = 20) =>
    api.get<PagedResult<UploadSession>>('/upload/history', { params: { page, pageSize } }),

  download: (sessionId: string) =>
    api.get(`/upload/${sessionId}/download`, { responseType: 'blob' }),
}
