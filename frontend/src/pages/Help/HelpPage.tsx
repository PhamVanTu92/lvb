import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import {
  LogIn, LayoutDashboard, Upload, Table2, History,
  Settings, Search, Filter, Download, ChevronRight,
  ChevronDown, HelpCircle, Users, Database, Building2,
  AlertCircle, CheckCircle2, Info
} from 'lucide-react'

interface Section {
  id: string
  icon: React.ReactNode
  title: string
  adminOnly?: boolean
}

const SECTIONS: Section[] = [
  { id: 'overview',  icon: <HelpCircle size={16} />,      title: 'Tổng quan hệ thống' },
  { id: 'login',     icon: <LogIn size={16} />,           title: 'Đăng nhập / Đăng xuất' },
  { id: 'dashboard', icon: <LayoutDashboard size={16} />, title: 'Dashboard' },
  { id: 'upload',    icon: <Upload size={16} />,          title: 'Đẩy tài liệu (Upload)' },
  { id: 'data',      icon: <Table2 size={16} />,          title: 'Xem & lọc dữ liệu' },
  { id: 'history',   icon: <History size={16} />,         title: 'Lịch sử đẩy dữ liệu' },
  { id: 'admin',     icon: <Settings size={16} />,        title: 'Quản trị hệ thống', adminOnly: true },
]

function Note({ type = 'info', children }: { type?: 'info' | 'warn' | 'ok'; children: React.ReactNode }) {
  const styles = {
    info: { bg: 'bg-blue-50 border-blue-200 text-blue-800', icon: <Info size={15} className="text-blue-500 flex-shrink-0 mt-0.5" /> },
    warn: { bg: 'bg-yellow-50 border-yellow-200 text-yellow-800', icon: <AlertCircle size={15} className="text-yellow-500 flex-shrink-0 mt-0.5" /> },
    ok:   { bg: 'bg-green-50 border-green-200 text-green-800', icon: <CheckCircle2 size={15} className="text-green-500 flex-shrink-0 mt-0.5" /> },
  }
  const s = styles[type]
  return (
    <div className={`flex gap-2 text-sm border rounded-lg px-3 py-2.5 my-3 ${s.bg}`}>
      {s.icon}
      <span>{children}</span>
    </div>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 mb-2">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">{n}</span>
      <span className="text-gray-700 text-sm leading-relaxed">{children}</span>
    </div>
  )
}

function SectionCard({ id, title, icon, children }: { id: string; title: string; icon: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div id={id} className="card mb-6 scroll-mt-6">
      <button
        className="w-full flex items-center justify-between gap-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <span className="text-blue-600">{icon}</span>
          <h2 className="text-base font-semibold text-gray-800">{title}</h2>
        </div>
        {open ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
      </button>
      {open && <div className="mt-4 border-t border-gray-100 pt-4 space-y-3">{children}</div>}
    </div>
  )
}

function Badge({ label, color = 'blue' }: { label: string; color?: 'blue' | 'green' | 'yellow' | 'gray' }) {
  const c = {
    blue:   'bg-blue-100 text-blue-700',
    green:  'bg-green-100 text-green-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    gray:   'bg-gray-100 text-gray-600',
  }[color]
  return <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded ${c}`}>{label}</span>
}

export default function HelpPage() {
  const { isAdmin } = useAuth()
  const visibleSections = SECTIONS.filter(s => !s.adminOnly || isAdmin)

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Table of contents */}
      <aside className="w-56 flex-shrink-0 border-r border-gray-200 bg-white p-4 overflow-y-auto hidden md:block">
        <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Mục lục</p>
        <nav className="space-y-1">
          {visibleSections.map(s => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-left"
            >
              <span className="text-gray-400">{s.icon}</span>
              {s.title}
            </button>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 max-w-3xl">
        {/* Page title */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <HelpCircle className="text-blue-600" size={28} />
            <h1 className="text-2xl font-bold text-gray-900">Hướng dẫn sử dụng</h1>
          </div>
          <p className="text-gray-500 text-sm">LVB Portal — Cổng thông tin dữ liệu Ngân hàng Lào-Việt</p>
        </div>

        {/* ── 1. Tổng quan ── */}
        <SectionCard id="overview" title="Tổng quan hệ thống" icon={<HelpCircle size={16} />}>
          <p className="text-sm text-gray-700 leading-relaxed">
            <strong>LVB Portal</strong> là hệ thống quản lý và chia sẻ dữ liệu nội bộ của Ngân hàng Lào-Việt.
            Hệ thống cho phép các phòng ban tải lên dữ liệu từ file Excel, xem, tìm kiếm và xuất báo cáo.
          </p>
          <div className="grid grid-cols-2 gap-3 mt-3">
            {[
              { icon: <Upload size={16} />, title: 'Đẩy dữ liệu', desc: 'Upload file Excel vào hệ thống theo từng dataset' },
              { icon: <Table2 size={16} />, title: 'Xem dữ liệu', desc: 'Tra cứu, lọc và xuất dữ liệu theo phòng ban' },
              { icon: <History size={16} />, title: 'Lịch sử', desc: 'Theo dõi các lần upload, xem dữ liệu từng phiên' },
              { icon: <Settings size={16} />, title: 'Quản trị', desc: 'Quản lý người dùng, phòng ban, dataset (Admin)' },
            ].map(item => (
              <div key={item.title} className="border border-gray-100 rounded-lg p-3">
                <div className="flex items-center gap-2 text-blue-600 mb-1">
                  {item.icon}
                  <span className="text-sm font-medium text-gray-800">{item.title}</span>
                </div>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-3">
            <p className="text-sm font-medium text-gray-700 mb-2">Vai trò người dùng</p>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Badge label="Nhân viên" />
                <span className="text-xs text-gray-600">Xem và upload dữ liệu của phòng ban mình</span>
              </div>
              <div className="flex items-start gap-2">
                <Badge label="Trưởng phòng" color="green" />
                <span className="text-xs text-gray-600">Xem và upload dữ liệu của phòng ban mình</span>
              </div>
              <div className="flex items-start gap-2">
                <Badge label="Quản trị viên" color="yellow" />
                <span className="text-xs text-gray-600">Toàn quyền: xem tất cả phòng ban, quản lý người dùng, dataset</span>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* ── 2. Đăng nhập ── */}
        <SectionCard id="login" title="Đăng nhập / Đăng xuất" icon={<LogIn size={16} />}>
          <p className="text-sm font-medium text-gray-700">Đăng nhập</p>
          <Step n={1}>Truy cập địa chỉ hệ thống. Trang đăng nhập hiển thị tự động.</Step>
          <Step n={2}>Nhập <strong>Tên đăng nhập</strong> và <strong>Mật khẩu</strong> được cấp bởi quản trị viên.</Step>
          <Step n={3}>Nhấn <strong>Đăng nhập</strong>. Hệ thống chuyển sang trang Dashboard.</Step>
          <Note type="warn">Mật khẩu phân biệt chữ hoa/thường. Liên hệ quản trị viên nếu quên mật khẩu.</Note>

          <p className="text-sm font-medium text-gray-700 mt-2">Đăng xuất</p>
          <Step n={1}>Nhấn nút <strong>Đăng xuất</strong> ở góc dưới cùng thanh điều hướng bên trái.</Step>
          <Note type="info">Phiên đăng nhập tự động hết hạn sau 8 giờ.</Note>
        </SectionCard>

        {/* ── 3. Dashboard ── */}
        <SectionCard id="dashboard" title="Dashboard" icon={<LayoutDashboard size={16} />}>
          <p className="text-sm text-gray-700 leading-relaxed">
            Dashboard là trang tổng quan hiển thị sau khi đăng nhập. Tại đây bạn thấy:
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-gray-700 list-none">
            {[
              'Số lượng dataset hiện có của phòng ban',
              'Tổng số bản ghi đã upload',
              'Lần cập nhật gần nhất',
              'Danh sách nhanh các dataset để truy cập nhanh',
            ].map(item => (
              <li key={item} className="flex items-start gap-2">
                <CheckCircle2 size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
          <Note type="info">
            Thanh điều hướng bên trái liệt kê tất cả dataset bạn có quyền truy cập — nhấn để xem dữ liệu chi tiết.
          </Note>
        </SectionCard>

        {/* ── 4. Upload ── */}
        <SectionCard id="upload" title="Đẩy tài liệu (Upload)" icon={<Upload size={16} />}>
          <p className="text-sm text-gray-700">Để upload dữ liệu từ file Excel vào hệ thống:</p>
          <div className="mt-2 space-y-1">
            <Step n={1}>Vào menu <strong>Đẩy Tài Liệu</strong> trên thanh điều hướng.</Step>
            <Step n={2}>
              Tại mục <strong>Đẩy vào dataset</strong>, chọn loại dữ liệu phù hợp từ danh sách thả xuống.{' '}
              <span className="text-red-500 text-xs">(*)</span> Bắt buộc phải chọn.
            </Step>
            <Step n={3}>
              Kéo thả file Excel vào vùng upload, hoặc nhấn <strong>Chọn file</strong> để duyệt tìm file.
              Hệ thống chấp nhận định dạng <Badge label=".xlsx" color="gray" /> <Badge label=".xls" color="gray" /> tối đa <strong>50 MB</strong>.
            </Step>
            <Step n={4}>
              Nhấn <strong>Đẩy dữ liệu</strong>. Thanh tiến trình hiển thị quá trình xử lý.
            </Step>
            <Step n={5}>Khi hoàn thành, thông báo <Badge label="Hoàn thành" color="green" /> xuất hiện kèm số dòng đã nhập.</Step>
          </div>

          <Note type="ok">
            Hệ thống tự động phát hiện hàng tiêu đề trong file Excel (kể cả khi có dòng tiêu đề chính ở trên cùng).
          </Note>
          <Note type="warn">
            Mỗi lần upload sẽ <strong>thêm mới</strong> dữ liệu vào bảng, không ghi đè dữ liệu cũ.
            Dữ liệu cũ vẫn được lưu và xem qua Lịch sử.
          </Note>

          <p className="text-sm font-medium text-gray-700 mt-3">Yêu cầu định dạng file Excel</p>
          <ul className="mt-1 space-y-1 text-sm text-gray-600">
            {[
              'File có ít nhất 1 sheet, hệ thống chỉ đọc sheet đầu tiên',
              'Hàng tiêu đề cột phải là hàng có nhiều ô chứa dữ liệu nhất',
              'Không cần đặt tên sheet trùng với tên dataset — chỉ cần chọn đúng dataset khi upload',
              'Các ô trống sẽ được lưu là giá trị rỗng',
            ].map(item => (
              <li key={item} className="flex items-start gap-2">
                <ChevronRight size={13} className="text-gray-400 flex-shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
        </SectionCard>

        {/* ── 5. Xem dữ liệu ── */}
        <SectionCard id="data" title="Xem & lọc dữ liệu" icon={<Table2 size={16} />}>
          <p className="text-sm text-gray-700">
            Nhấn vào tên dataset trên thanh điều hướng để mở bảng dữ liệu tương ứng.
          </p>

          <p className="text-sm font-medium text-gray-700 mt-3">Tìm kiếm toàn bộ</p>
          <div className="flex items-start gap-2 text-sm text-gray-600">
            <Search size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
            <span>Nhập từ khóa vào ô tìm kiếm phía trên bảng, nhấn <strong>Tìm</strong> hoặc Enter. Hệ thống tìm kiếm trên tất cả cột.</span>
          </div>

          <p className="text-sm font-medium text-gray-700 mt-3">Lọc theo cột</p>
          <div className="flex items-start gap-2 text-sm text-gray-600">
            <Filter size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
            <span>Hàng thứ hai trong tiêu đề bảng là hàng lọc — gõ giá trị vào ô của cột muốn lọc. Kết quả cập nhật tự động sau 400ms.</span>
          </div>
          <Note type="info">Có thể lọc nhiều cột cùng lúc. Nhấn <strong>Xóa tất cả bộ lọc</strong> để reset.</Note>

          <p className="text-sm font-medium text-gray-700 mt-3">Phân trang</p>
          <ul className="mt-1 space-y-1 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <ChevronRight size={13} className="text-gray-400 flex-shrink-0 mt-0.5" />
              Chọn số dòng hiển thị: nhấn nhanh <Badge label="5" color="gray" /> <Badge label="10" color="gray" /> <Badge label="25" color="gray" /> <Badge label="50" color="gray" /> <Badge label="100" color="gray" /> <Badge label="200" color="gray" /> hoặc nhập số tùy chỉnh (tối đa 500).
            </li>
            <li className="flex items-start gap-2">
              <ChevronRight size={13} className="text-gray-400 flex-shrink-0 mt-0.5" />
              Điều hướng trang bằng các nút ⏮ ◀ [số trang] ▶ ⏭ ở phía dưới bảng.
            </li>
            <li className="flex items-start gap-2">
              <ChevronRight size={13} className="text-gray-400 flex-shrink-0 mt-0.5" />
              Thanh tiêu đề cố định khi cuộn dọc, bảng cuộn ngang khi có nhiều cột.
            </li>
          </ul>

          <p className="text-sm font-medium text-gray-700 mt-3">Xuất dữ liệu</p>
          <div className="flex items-start gap-2 text-sm text-gray-600">
            <Download size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
            <span>Nhấn <strong>Xuất CSV</strong> để tải toàn bộ trang dữ liệu hiện tại về máy dưới dạng file CSV (mở được bằng Excel).</span>
          </div>
        </SectionCard>

        {/* ── 6. Lịch sử ── */}
        <SectionCard id="history" title="Lịch sử đẩy dữ liệu" icon={<History size={16} />}>
          <p className="text-sm text-gray-700">
            Trang <strong>Lịch sử đẩy dữ liệu</strong> lưu lại tất cả các lần upload của phòng ban bạn.
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-gray-700">
            {[
              { label: 'Tên file', desc: 'Tên file Excel đã upload' },
              { label: 'Dataset', desc: 'Tên dataset dữ liệu được đẩy vào' },
              { label: 'Thời gian', desc: 'Ngày giờ upload' },
              { label: 'Số dòng', desc: 'Số bản ghi đã nhập thành công' },
              { label: 'Trạng thái', desc: 'Thành công / Đang xử lý / Thất bại' },
            ].map(item => (
              <li key={item.label} className="flex items-start gap-2">
                <Badge label={item.label} color="gray" />
                <span className="text-gray-600 text-xs mt-0.5">{item.desc}</span>
              </li>
            ))}
          </ul>

          <p className="text-sm font-medium text-gray-700 mt-3">Xem chi tiết lần upload</p>
          <Step n={1}>Nhấn biểu tượng <strong>👁 Xem</strong> ở cuối dòng để mở chi tiết.</Step>
          <Step n={2}>Trang chi tiết hiển thị toàn bộ dữ liệu của lần upload đó, có tìm kiếm, lọc, phân trang và xuất CSV.</Step>

          <Note type="info">
            Quản trị viên có thể xóa lịch sử upload. Khi xóa, toàn bộ dữ liệu của lần upload đó sẽ bị xóa vĩnh viễn khỏi bảng.
          </Note>
        </SectionCard>

        {/* ── 7. Quản trị (admin only) ── */}
        {isAdmin && (
          <SectionCard id="admin" title="Quản trị hệ thống" icon={<Settings size={16} />}>
            <Note type="warn">Mục này chỉ dành cho tài khoản có vai trò <Badge label="Quản trị viên" color="yellow" />.</Note>
            <p className="text-sm text-gray-700">Vào <strong>Quản trị</strong> trên thanh điều hướng để quản lý hệ thống.</p>

            {/* Tab: Người dùng */}
            <div className="mt-4 border border-gray-100 rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 border-b border-gray-100">
                <Users size={14} className="text-blue-600" />
                <span className="text-sm font-medium text-gray-700">Tab: Người dùng</span>
              </div>
              <div className="px-3 py-3 space-y-1 text-sm text-gray-600">
                <p>Quản lý toàn bộ tài khoản người dùng trong hệ thống.</p>
                <div className="mt-2 space-y-1">
                  <Step n={1}>Nhấn <strong>Thêm người dùng</strong> để tạo tài khoản mới.</Step>
                  <Step n={2}>Điền đầy đủ: Tên đăng nhập, Họ tên, Email, Mật khẩu (≥ 8 ký tự), Vai trò, Phòng ban.</Step>
                  <Step n={3}>Dùng biểu tượng bên phải mỗi dòng để <strong>kích hoạt / vô hiệu hóa</strong> tài khoản.</Step>
                </div>
              </div>
            </div>

            {/* Tab: Phòng ban */}
            <div className="mt-3 border border-gray-100 rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 border-b border-gray-100">
                <Building2 size={14} className="text-blue-600" />
                <span className="text-sm font-medium text-gray-700">Tab: Phòng ban</span>
              </div>
              <div className="px-3 py-3 text-sm text-gray-600">
                <p>Quản lý danh mục phòng ban. Mỗi phòng ban có <strong>Mã</strong> (viết tắt, không dấu) và <strong>Tên đầy đủ</strong>.</p>
                <Note type="info">Mã phòng ban được gắn vào tài khoản người dùng để phân quyền dữ liệu.</Note>
              </div>
            </div>

            {/* Tab: Dataset */}
            <div className="mt-3 border border-gray-100 rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 border-b border-gray-100">
                <Database size={14} className="text-blue-600" />
                <span className="text-sm font-medium text-gray-700">Tab: Khai báo Dataset</span>
              </div>
              <div className="px-3 py-3 space-y-1 text-sm text-gray-600">
                <p>Khai báo các loại dữ liệu (dataset) mà hệ thống quản lý. Mỗi dataset cần:</p>
                <ul className="mt-1 space-y-1">
                  {[
                    { field: 'Tên hiển thị', desc: 'Tên tiếng Việt, hiển thị trên giao diện (ví dụ: Thu nhập ròng dịch vụ)' },
                    { field: 'Tên bảng DB', desc: 'Tên kỹ thuật, chỉ dùng chữ thường và dấu gạch dưới (ví dụ: thu_nhap_rong_dich_vu)' },
                    { field: 'Phòng ban', desc: 'Gắn dataset cho phòng ban cụ thể, hoặc để trống = dùng chung cho tất cả' },
                    { field: 'Mapping cột', desc: 'JSON ánh xạ tên cột Excel → tên cột DB. Để trống {} để tự động phát hiện từ header' },
                  ].map(item => (
                    <li key={item.field} className="flex items-start gap-2 text-xs">
                      <Badge label={item.field} color="gray" />
                      <span className="text-gray-500 mt-0.5">{item.desc}</span>
                    </li>
                  ))}
                </ul>
                <Note type="ok">
                  Để <strong>Mapping cột</strong> là <code className="bg-gray-100 px-1 rounded text-xs">{'{}'}</code> và hệ thống sẽ tự động tạo cột dựa trên tiêu đề file Excel.
                </Note>
              </div>
            </div>

            {/* Lịch sử admin */}
            <div className="mt-3 border border-gray-100 rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 border-b border-gray-100">
                <History size={14} className="text-blue-600" />
                <span className="text-sm font-medium text-gray-700">Xóa lịch sử upload</span>
              </div>
              <div className="px-3 py-3 text-sm text-gray-600">
                <p>Trong trang <strong>Lịch sử đẩy dữ liệu</strong>, Admin thấy thêm nút <strong>🗑 Xóa</strong> bên phải mỗi dòng.</p>
                <Note type="warn">Xóa lịch sử sẽ xóa vĩnh viễn toàn bộ dữ liệu của lần upload đó. Không thể hoàn tác.</Note>
              </div>
            </div>
          </SectionCard>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 mt-4 pb-6">
          LVB Portal v1.0 · Ngân hàng Lào-Việt · Liên hệ IT nếu cần hỗ trợ thêm
        </div>
      </div>
    </div>
  )
}
