import React, { createContext, useContext, useState, useCallback } from 'react'
import type { User } from '../types'
import { authApi } from '../api/auth'

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  isAdmin: boolean
  isManager: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('lvb_user')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  const login = useCallback(async (username: string, password: string) => {
    const res = await authApi.login(username, password)
    const data = res.data
    localStorage.setItem('lvb_token', data.token)
    const userData: User = {
      id: '',
      username: data.username,
      fullName: data.fullName,
      email: data.email,
      role: data.role as User['role'],
      departmentCode: data.departmentCode,
      expiresAt: data.expiresAt,
    }
    localStorage.setItem('lvb_user', JSON.stringify(userData))
    setUser(userData)
  }, [])

  const logout = useCallback(() => {
    authApi.logout().catch(() => {})
    localStorage.removeItem('lvb_token')
    localStorage.removeItem('lvb_user')
    setUser(null)
    window.location.href = '/login'
  }, [])

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      login,
      logout,
      isAdmin: user?.role === 'SystemAdmin',
      isManager: user?.role === 'DepartmentManager' || user?.role === 'SystemAdmin',
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
