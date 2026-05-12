import api from './client'
import type { DataTableResult, Department } from '../types'

export const dataApi = {
  getDepartments: () => api.get<Department[]>('/departments'),

  getData: (dept: string, table: string, page = 1, pageSize = 50, search?: string) =>
    api.get<DataTableResult>(`/data/${dept}/${table}`, {
      params: { page, pageSize, search },
    }),

  getVersions: (dept: string, table: string) =>
    api.get(`/data/${dept}/${table}/versions`),

  exportData: (dept: string, table: string) =>
    api.get(`/data/${dept}/${table}`, {
      params: { page: 1, pageSize: 10000 },
    }),
}
