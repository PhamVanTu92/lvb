import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('lvb_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 - redirect to login
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('lvb_token')
      localStorage.removeItem('lvb_user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
