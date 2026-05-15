import api from './client'
import type { AuditLog, BatchListResult, DatasetField, DataTableResult, Department, PagedResult, ReportListItem, ReportDetail, ReportRunResult, SqlScriptListItem, SqlScriptDetail, ScriptRunResult } from '../types'

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

  deleteBatch: (dept: string, table: string, sessionId: string) =>
    api.delete(`/data/${dept}/${table}/batches/${sessionId}`),

  getDatasetFields: (mappingId: string) =>
    api.get<DatasetField[]>(`/admin/dataset-fields/${mappingId}`),

  createDatasetField: (data: { mappingId: string; fieldName: string; displayName: string; fieldType: string; dropdownOptions?: string[]; isRequired: boolean }) =>
    api.post<DatasetField>('/admin/dataset-fields', data),

  updateDatasetField: (id: string, data: { mappingId: string; fieldName: string; displayName: string; fieldType: string; dropdownOptions?: string[]; isRequired: boolean }) =>
    api.put(`/admin/dataset-fields/${id}`, data),

  deleteDatasetField: (id: string) =>
    api.delete(`/admin/dataset-fields/${id}`),

  // Audit logs
  getAuditLogs: (params: {
    page?: number; pageSize?: number; action?: string; entityType?: string;
    username?: string; entityId?: string; from?: string; to?: string;
  }) =>
    api.get<{ items: AuditLog[]; totalCount: number; page: number; pageSize: number }>(
      '/admin/audit-logs', { params }
    ),

  getBatchAudit: (dept: string, table: string, sessionId: string, limit = 20) =>
    api.get<AuditLog[]>(`/data/${dept}/${table}/batches/${sessionId}/audit`, { params: { limit } }),

  // ── Reports ──────────────────────────────────────────────────────────────
  getReports: () =>
    api.get<ReportListItem[]>('/reports'),

  getReport: (id: string) =>
    api.get<ReportDetail>(`/reports/${id}`),

  runReport: (id: string, params: Record<string, string>, page = 1, pageSize = 50) =>
    api.get<ReportRunResult>(`/reports/${id}/run`, { params: { page, pageSize, ...params } }),

  createReport: (data: { name: string; description?: string; departmentCode?: string; configJson: string; orderIndex?: number }) =>
    api.post<ReportDetail>('/admin/reports', data),

  updateReport: (id: string, data: { name?: string; description?: string; departmentCode?: string; configJson?: string; isActive?: boolean; orderIndex?: number }) =>
    api.put(`/admin/reports/${id}`, data),

  deleteReport: (id: string) =>
    api.delete(`/admin/reports/${id}`),

  getTableColumns: (tableName: string) =>
    api.get<string[]>(`/admin/tables/${tableName}/columns`),

  // ── SQL Scripts ─────────────────────────────────────────────────────────────
  getScripts: () =>
    api.get<SqlScriptListItem[]>('/admin/scripts'),

  getScript: (id: string) =>
    api.get<SqlScriptDetail>(`/admin/scripts/${id}`),

  createScript: (data: { name: string; description?: string; scriptSql: string; paramsJson?: string; orderIndex?: number }) =>
    api.post<SqlScriptDetail>('/admin/scripts', data),

  updateScript: (id: string, data: { name?: string; description?: string; scriptSql?: string; paramsJson?: string; isActive?: boolean; orderIndex?: number }) =>
    api.put(`/admin/scripts/${id}`, data),

  deleteScript: (id: string) =>
    api.delete(`/admin/scripts/${id}`),

  runScript: (id: string, params: Record<string, string>) =>
    api.post<ScriptRunResult>(`/admin/scripts/${id}/run`, { params }),

  runAdhocScript: (scriptSql: string, params: Record<string, string>) =>
    api.post<ScriptRunResult>('/admin/scripts/run-adhoc', { scriptSql, params }),
}
