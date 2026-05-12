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
