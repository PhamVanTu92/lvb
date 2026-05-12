import api from './client'
import type { LoginResponse } from '../types'

export const authApi = {
  login: (username: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { username, password }),

  logout: () => api.post('/auth/logout'),

  me: () => api.get('/auth/me'),
}
