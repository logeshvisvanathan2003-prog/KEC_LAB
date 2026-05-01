import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/lib/auth'
import AdminLogin   from '@/components/pages/AdminLogin'
import SystemLogin  from '@/components/pages/SystemLogin'
import Layout       from '@/components/Layout'
import Overview     from '@/components/pages/Overview'
import LabPage      from '@/components/pages/LabPage'
import Sessions     from '@/components/pages/Sessions'
import IdleAlerts   from '@/components/pages/IdleAlerts'
import Agents       from '@/components/pages/Agents'
import Reports      from '@/components/pages/Reports'
import SystemUsers  from '@/components/pages/SystemUsers'

// Only guards admin routes — never intercepts /system-login
function AdminGuard({ children }) {
  const { isAuth } = useAuth()
  return isAuth ? children : <Navigate to="/admin-login" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Student portal — always accessible */}
          <Route path="/system-login" element={<SystemLogin />} />

          {/* Admin login — renamed route, /login also kept as alias */}
          <Route path="/admin-login"  element={<AdminLogin />} />
          <Route path="/login"        element={<AdminLogin />} />

          {/* Admin dashboard — protected */}
          <Route path="/*" element={
            <AdminGuard>
              <Layout>
                <Routes>
                  <Route index               element={<Overview />} />
                  <Route path="lab/:id"      element={<LabPage />} />
                  <Route path="sessions"     element={<Sessions />} />
                  <Route path="idle-alerts"  element={<IdleAlerts />} />
                  <Route path="agents"       element={<Agents />} />
                  <Route path="reports"      element={<Reports />} />
                  <Route path="system-users" element={<SystemUsers />} />
                  <Route path="*"            element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            </AdminGuard>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
