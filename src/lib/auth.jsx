import { createContext, useContext, useState, useCallback } from 'react'
import api from '@/lib/api'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(() => {
    try { return JSON.parse(localStorage.getItem('kce_admin') || 'null') } catch { return null }
  })

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/admin/login', { email, password })
    localStorage.setItem('kce_token', data.token)
    localStorage.setItem('kce_admin', JSON.stringify(data.admin))
    setAdmin(data.admin)
    return data.admin
  }, [])

  const logout = useCallback(async () => {
    try { await api.post('/admin/logout') } catch(err) { console.warn('Auth error:', err?.message) }
    localStorage.removeItem('kce_token')
    localStorage.removeItem('kce_admin')
    setAdmin(null)
  }, [])

  return (
    <AuthCtx.Provider value={{ admin, login, logout, isAuth: !!admin }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
