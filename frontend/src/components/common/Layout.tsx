import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { LayoutDashboard, Upload, Table2, Settings, LogOut, Building2, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { dataApi } from '../../api/data'

export default function Layout() {
  const { user, logout, isAdmin } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const navigate = useNavigate()

  const { data: depts } = useQuery({
    queryKey: ['departments'],
    queryFn: () => dataApi.getDepartments().then(r => r.data),
    staleTime: 60_000,
  })

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-700/60'
    }`

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-blue-900 flex flex-col transition-all duration-300`}>
        {/* Logo */}
        <div className="flex items-center justify-between p-4 border-b border-blue-800">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <Building2 className="text-yellow-400" size={24} />
              <div>
                <p className="text-white font-bold text-sm">LVB Portal</p>
                <p className="text-blue-300 text-xs">Ngân hàng Lào-Việt</p>
              </div>
            </div>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-blue-300 hover:text-white p-1">
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* User info */}
        {sidebarOpen && (
          <div className="p-4 border-b border-blue-800">
            <p className="text-white text-sm font-medium truncate">{user?.fullName}</p>
            <p className="text-blue-300 text-xs truncate">{user?.role}</p>
            <span className="inline-block mt-1 px-2 py-0.5 bg-blue-700 text-blue-200 text-xs rounded">
              {user?.departmentCode}
            </span>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <NavLink to="/dashboard" className={navItemClass}>
            <LayoutDashboard size={18} />
            {sidebarOpen && 'Dashboard'}
          </NavLink>
          <NavLink to="/upload" className={navItemClass}>
            <Upload size={18} />
            {sidebarOpen && 'Đẩy Tài Liệu'}
          </NavLink>

          {sidebarOpen && depts && depts.length > 0 && (
            <div className="pt-2">
              <p className="text-blue-400 text-xs uppercase px-3 py-1">Dữ liệu</p>
              {depts.map(dept =>
                dept.tables?.map(table => (
                  <NavLink
                    key={`${dept.code}-${table}`}
                    to={`/data/${dept.code}/${table}`}
                    className={navItemClass}
                  >
                    <Table2 size={18} />
                    <span className="truncate">{table.replace(/_/g, ' ')}</span>
                  </NavLink>
                ))
              )}
            </div>
          )}

          {isAdmin && (
            <NavLink to="/admin" className={navItemClass}>
              <Settings size={18} />
              {sidebarOpen && 'Quản trị'}
            </NavLink>
          )}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-blue-800">
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2 text-blue-200 hover:bg-red-700/50 hover:text-white rounded-lg text-sm transition-colors"
          >
            <LogOut size={18} />
            {sidebarOpen && 'Đăng xuất'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
