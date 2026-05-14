import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { dataApi } from '../../api/data'
import { Copy, Check, ExternalLink, Key, Database, BarChart2, ChevronDown, ChevronUp } from 'lucide-react'

const BASE_URL = window.location.origin

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <button onClick={copy}
      className="shrink-0 p-1 text-gray-400 hover:text-blue-600 rounded transition-colors"
      title="Sao chép">
      {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
    </button>
  )
}

// ── Expandable code block ─────────────────────────────────────────────────────
function CodeBlock({ code, lang = 'bash' }: { code: string; lang?: string }) {
  return (
    <div className="relative bg-gray-900 rounded-lg px-4 py-3 text-xs font-mono text-gray-200 overflow-x-auto">
      <CopyBtn text={code} />
      <pre className="whitespace-pre-wrap pr-6">{code}</pre>
      <span className="absolute top-1 right-8 text-gray-600 text-[10px]">{lang}</span>
    </div>
  )
}

// ── Endpoint card ─────────────────────────────────────────────────────────────
function EndpointCard({
  method, path, title, description, params, exampleUrl, exampleResponse, badge,
}: {
  method: 'GET' | 'POST'
  path: string
  title: string
  description: string
  params?: { name: string; type: string; required: boolean; description: string }[]
  exampleUrl: string
  exampleResponse?: string
  badge?: string
}) {
  const [open, setOpen] = useState(false)
  const methodColor = method === 'GET'
    ? 'bg-green-100 text-green-700 border border-green-200'
    : 'bg-blue-100 text-blue-700 border border-blue-200'

  const curlCmd = `curl -X ${method} \\
  "${BASE_URL}${exampleUrl}" \\
  -H "X-Api-Key: <YOUR_API_KEY>" \\
  -H "Accept: application/json"`

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors text-left"
      >
        <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded ${methodColor}`}>{method}</span>
        <code className="text-sm text-gray-700 font-mono flex-1 truncate">{path}</code>
        {badge && (
          <span className="shrink-0 text-[10px] font-semibold bg-yellow-100 text-yellow-700 border border-yellow-200 px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
        <span className="shrink-0 text-gray-400">{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-4 bg-gray-50/50">
          <div>
            <h4 className="font-semibold text-gray-800 text-sm">{title}</h4>
            <p className="text-sm text-gray-500 mt-0.5">{description}</p>
          </div>

          {params && params.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Tham số</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-400">
                    <th className="pb-1 pr-3 font-medium">Tên</th>
                    <th className="pb-1 pr-3 font-medium">Kiểu</th>
                    <th className="pb-1 pr-3 font-medium">Bắt buộc</th>
                    <th className="pb-1 font-medium">Mô tả</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {params.map(p => (
                    <tr key={p.name}>
                      <td className="py-1.5 pr-3 font-mono text-blue-700">{p.name}</td>
                      <td className="py-1.5 pr-3 text-gray-500">{p.type}</td>
                      <td className="py-1.5 pr-3">
                        {p.required
                          ? <span className="text-red-500">Có</span>
                          : <span className="text-gray-400">Không</span>}
                      </td>
                      <td className="py-1.5 text-gray-600">{p.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">URL mẫu</p>
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
              <code className="text-xs text-gray-700 flex-1 truncate">{BASE_URL}{exampleUrl}</code>
              <CopyBtn text={`${BASE_URL}${exampleUrl}`} />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Lệnh cURL</p>
            <CodeBlock code={curlCmd} />
          </div>

          {exampleResponse && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Response mẫu</p>
              <CodeBlock code={exampleResponse} lang="json" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ApiDocsPage() {
  const { data: datasets } = useQuery({
    queryKey: ['sheet-mappings-upload'],
    queryFn: () => dataApi.getSheetMappings().then(r => r.data),
    staleTime: 60_000,
  })

  const { data: reports } = useQuery({
    queryKey: ['reports'],
    queryFn: () => dataApi.getReports().then(r => r.data),
    staleTime: 60_000,
  })

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-gray-800 text-lg">Tài liệu API tích hợp</h2>
          <p className="text-sm text-gray-500 mt-1">
            Danh sách endpoint có thể gọi từ hệ thống ngoài bằng API Key
          </p>
        </div>
        <a
          href="/swagger"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <ExternalLink size={14} /> Swagger UI
        </a>
      </div>

      {/* Auth guide */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Key size={18} className="text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-blue-800 mb-1">Xác thực bằng API Key</p>
            <p className="text-blue-700 mb-2">
              Thêm header <code className="bg-blue-100 px-1 rounded font-mono text-xs">X-Api-Key: &lt;key&gt;</code> vào mọi request.
              Tạo và quản lý API Key tại <strong>Quản trị → API Keys (iTitan)</strong>.
            </p>
            <CodeBlock code={`curl "https://lvb.foxai.com.vn/api/v1/reports/{id}/run?month=04/2026" \\
  -H "X-Api-Key: lvb_xxxxxxxxxxxxxxxx" \\
  -H "Accept: application/json"`} />
          </div>
        </div>
      </div>

      {/* Dataset endpoints */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Database size={16} className="text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Bảng dữ liệu</h3>
        </div>
        <div className="space-y-2">
          <EndpointCard
            method="GET"
            path="/api/v1/data/{dept}/{table}/latest"
            title="Lấy dữ liệu mới nhất của bảng"
            description="Trả về toàn bộ dữ liệu từ lô upload mới nhất của bảng. Tối đa 1000 bản ghi."
            badge="ApiKey ✓"
            params={[
              { name: 'dept', type: 'string (path)', required: true, description: 'Mã phòng ban (VD: CV, HD, IT)' },
              { name: 'table', type: 'string (path)', required: true, description: 'Tên bảng dữ liệu (snake_case)' },
            ]}
            exampleUrl="/api/v1/data/CV/thu_nhap_rong_dv/latest"
            exampleResponse={`{
  "tableName": "thu_nhap_rong_dv",
  "columns": ["ten_kh", "ma_don_vi", "thu_nhap"],
  "rows": [
    { "ten_kh": "Cty TNHH A", "ma_don_vi": "HN01", "thu_nhap": 25489660 }
  ],
  "totalRows": 1247,
  "page": 1,
  "pageSize": 1000
}`}
          />

          {datasets && datasets.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Các bảng đang có dữ liệu
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {datasets.map(ds => (
                  <div key={ds.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{ds.sheetName}</p>
                      <p className="text-xs font-mono text-gray-400 truncate">{ds.tableName}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <code className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">
                        {ds.departmentCode || 'ALL'}
                      </code>
                      <CopyBtn text={`${BASE_URL}/api/v1/data/${ds.departmentCode || '_all'}/${ds.tableName}/latest`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Report endpoints */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 size={16} className="text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Báo cáo xử lý dữ liệu</h3>
        </div>
        <div className="space-y-2">
          <EndpointCard
            method="GET"
            path="/api/v1/reports/{id}/run"
            title="Chạy báo cáo (JOIN / SUM / AVG...)"
            description="Thực thi báo cáo đã cấu hình và trả về kết quả dạng JSON có phân trang. Hỗ trợ tham số động (tháng, năm, phòng ban...) qua query string."
            badge="ApiKey ✓"
            params={[
              { name: 'id', type: 'guid (path)', required: true, description: 'ID của báo cáo' },
              { name: 'page', type: 'integer', required: false, description: 'Trang (mặc định: 1)' },
              { name: 'pageSize', type: 'integer', required: false, description: 'Số dòng/trang (mặc định: 50, tối đa: 500)' },
              { name: '...params', type: 'string', required: false, description: 'Tham số lọc động khai báo trong báo cáo (VD: month=04/2026)' },
            ]}
            exampleUrl="/api/v1/reports/00000000-0000-0000-0000-000000000000/run?page=1&pageSize=100&month=04/2026"
            exampleResponse={`{
  "columns": ["ten_don_vi", "Tổng thu nhập", "Số giao dịch"],
  "rows": [
    { "ten_don_vi": "HN01", "Tổng thu nhập": 25489660, "Số giao dịch": 42 }
  ],
  "totalCount": 15,
  "page": 1,
  "pageSize": 100
}`}
          />

          {reports && reports.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Các báo cáo hiện có
              </p>
              <div className="space-y-2">
                {reports.map(r => (
                  <div key={r.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{r.name}</p>
                      <p className="text-xs font-mono text-gray-400 truncate">
                        /api/v1/reports/{r.id}/run
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {r.departmentCode && (
                        <code className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">
                          {r.departmentCode}
                        </code>
                      )}
                      <CopyBtn text={`${BASE_URL}/api/v1/reports/${r.id}/run`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {reports?.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              Chưa có báo cáo nào. Tạo báo cáo tại <strong>Xử lý dữ liệu → Tạo báo cáo mới</strong>.
            </p>
          )}
        </div>
      </section>

      {/* Response format */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Định dạng lỗi</h3>
        <CodeBlock lang="json" code={`// HTTP 400 — Tham số sai
{ "message": "Filter parameter 'month' is required but not supplied." }

// HTTP 401 — Chưa xác thực
{ "message": "Unauthorized" }

// HTTP 403 — Không có quyền truy cập báo cáo này
{ "message": "Forbidden" }

// HTTP 500 — Lỗi hệ thống
{ "message": "An error occurred while running the report.", "detail": "..." }`} />
      </section>
    </div>
  )
}
