export interface User {
  id: string
  username: string
  fullName: string
  email: string
  role: 'EndUser' | 'DepartmentManager' | 'SystemAdmin'
  departmentCode: string
  expiresAt: string
}

export interface LoginResponse {
  token: string
  username: string
  fullName: string
  email: string
  role: string
  departmentCode: string
  expiresAt: string
}

export interface UploadSession {
  id: string
  fileName: string
  fileSizeBytes: number
  departmentCode: string
  uploaderName: string
  uploadedAt: string
  status: 'Pending' | 'Processing' | 'Success' | 'Failed'
  totalSheets: number
  processedSheets: number
  totalRows: number
  errorDetail?: string
  completedAt?: string
  sheetResults: SheetResult[]
}

export interface SheetResult {
  sheetName: string
  mappedTableName?: string
  status: string
  insertedRows: number
  errorDetail?: string
}

export interface PagedResult<T> {
  items: T[]
  totalCount: number
  page: number
  pageSize: number
}

export interface DataTableResult {
  tableName: string
  departmentCode: string
  columns: string[]
  rows: Record<string, unknown>[]
  totalRows: number
  page: number
  pageSize: number
  lastUpdated?: string
}

export interface TableInfo {
  tableName: string
  sheetName: string
}

export interface Department {
  code: string
  name: string
  tables?: TableInfo[]
}

export interface BatchListItem {
  id: string
  batchName: string
  dataMonth?: string
  notes?: string
  uploaderName: string
  uploaderUsername: string
  rowCount: number
  uploadedAt: string
  status: string
  fileName: string
  metadataJson?: string
}

export interface BatchListResult {
  items: BatchListItem[]
  totalCount: number
  page: number
  pageSize: number
}

export interface AuditLog {
  id: string
  action: string
  entityType: string
  entityId?: string
  entityName?: string
  username?: string
  departmentCode?: string
  details?: string
  ipAddress?: string
  createdAt: string
}

// ── Report Builder ───────────────────────────────────────────────────────────
export interface RTable { alias: string; tableName: string }
export interface RJoin  { type: string; left: string; right: string }
export interface RSelect { ref: string; agg?: string; displayName: string }
export interface RFilter { ref: string; op: string; paramName: string; displayName: string; paramType: string }
export interface ROrderBy { ref: string; agg?: string; desc: boolean }
export interface RChart  { type: string; xField: string; yFields: string[] }

export interface ReportConfig {
  // Visual builder mode
  tables?: RTable[]
  joins?: RJoin[]
  select?: RSelect[]
  groupBy?: string[]
  orderBy?: ROrderBy[]
  // Shared
  filters?: RFilter[]
  chart?: RChart
  // Raw SQL mode (when set, visual builder fields are ignored)
  rawSql?: string
}

export interface ReportListItem {
  id: string; name: string; description?: string; departmentCode?: string
  createdAt: string; updatedAt: string; isActive: boolean; orderIndex: number; createdByName?: string
}

export interface ReportDetail extends ReportListItem {
  configJson: string
}

export interface ReportRunResult {
  columns: string[]
  rows: Record<string, unknown>[]
  totalCount: number
  page: number
  pageSize: number
}

export interface DatasetField {
  id: string
  mappingId: string
  fieldName: string
  displayName: string
  fieldType: string
  dropdownOptions?: string[]
  isRequired: boolean
  orderIndex: number
  isActive: boolean
}
