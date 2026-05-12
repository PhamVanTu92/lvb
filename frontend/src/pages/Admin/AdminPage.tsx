import { useState } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import { Users, Building2, Key } from 'lucide-react'
import UsersTab from './UsersTab'
import DepartmentsTab from './DepartmentsTab'
import ApiKeysTab from './ApiKeysTab'

export default function AdminPage() {
  const tabClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      isActive ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
    }`

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Quản trị hệ thống</h1>
      <div className="flex gap-2 mb-6 border-b border-gray-200 pb-2">
        <NavLink to="/admin/users" className={tabClass}>
          <Users size={16} /> Người dùng
        </NavLink>
        <NavLink to="/admin/departments" className={tabClass}>
          <Building2 size={16} /> Phòng ban
        </NavLink>
        <NavLink to="/admin/api-keys" className={tabClass}>
          <Key size={16} /> API Keys (iTitan)
        </NavLink>
      </div>
      <Routes>
        <Route path="users" element={<UsersTab />} />
        <Route path="departments" element={<DepartmentsTab />} />
        <Route path="api-keys" element={<ApiKeysTab />} />
        <Route index element={<UsersTab />} />
      </Routes>
    </div>
  )
}
