import api from './client'
import type { BatchListResult, DatasetField, DataTableResult, Department } from '../types'

export const dataApi = {
  getDepartments: () => api.get<Department[]>('/departments'),

  getData: (dept: string, table: string, page = 1, pageSize = 50, search?: string, sessionId?: string, columnFilters?: Record<string, string>) =>
    api.get<DataTableResult>(`/data/${dept}/${table}`, {
      params: {
        page, pageSize, search, sessionId,
        columnFilters: columnFilters && Object.keys(columnFilters).length > 0
          ? JSON.stringify(columnFilters)
          : undefined,
      },
    }),

  getVersions: (dept: string, table: string) =>
    api.get(`/data/${dept}/${table}/versions`),

  exportData: (dept: string, table: string) =>
    api.get(`/data/${dept}/${table}`, {
      params: { page: 1, pageSize: 10000 },
    }),

  getSheetMappings: () =>
    api.get<{ id: string; sheetName: string; tableName: string; departmentCode: string }[]>(
      '/datasets'
    ),

  getBatches: (dept: string, table: string, page = 1, pageSize = 20, search?: string, month?: string, status?: string) =>
    api.get<BatchListResult>(`/data/${dept}/${table}/batches`, {
      params: { page, pageSize, search, month, status },
    }),

  updateBatch: (dept: string, table: string, sessionId: string, data: { batchName?: string; notes?: string }) =>
    api.patch(`/data/${dept}/${table}/batches/${sessionId}`, data),

  deleteBatch: (sessionId: string) =>
    api.delete(`/admin/uploads/${sessionId}`),

  getDatasetFields: (mappingId: string) =>
    api.get<DatasetField[]>(`/admin/dataset-fields/${mappingId}`),

  createDatasetField: (data: { mappingId: string; fieldName: string; displayName: string; fieldType: string; dropdownOptions?: string[]; isRequired: boolean }) =>
    api.post<DatasetField>('/admin/dataset-fields', data),

  updateDatasetField: (id: string, data: { mappingId: string; fieldName: string; displayName: string; fieldType: string; dropdownOptions?: string[]; isRequired: boolean }) =>
    api.put(`/admin/dataset-fields/${id}`, data),

  deleteDatasetField: (id: string) =>
    api.delete(`/admin/dataset-fields/${id}`),
}
