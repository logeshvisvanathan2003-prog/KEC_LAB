import axios from 'axios'

// Production: set VITE_API_URL=https://your-app.onrender.com in Vercel env vars
// Local dev:  set VITE_API_URL=http://localhost:5000 in .env.local
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const api = axios.create({ baseURL: API_URL, timeout: 15000 })

let _online = true
const _listeners = new Set()
export const onBackendStatusChange = fn => { _listeners.add(fn); return () => _listeners.delete(fn) }
export const isBackendOnline = () => _online
const setStatus = v => { if (_online !== v) { _online = v; _listeners.forEach(fn => fn(v)) } }

api.interceptors.request.use(cfg => {
  const adminToken = localStorage.getItem('kce_token')
  const userToken  = localStorage.getItem('kce_user_token')
  const token = adminToken || userToken
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

api.interceptors.response.use(
  res => { setStatus(true); return res },
  err => {
    if (err.response?.status === 401) {
      const url = err.config?.url || ''
      if (url.includes('/admin/') || url.includes('/stats/') || url.includes('/analytics/')) {
        localStorage.removeItem('kce_token')
        localStorage.removeItem('kce_admin')
        window.location.href = '/login'
      }
      return Promise.reject(err)
    }
    if (!err.response) { err.isOffline = true; setStatus(false) } else setStatus(true)
    return Promise.reject(err)
  }
)

export default api
