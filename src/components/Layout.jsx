import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Clock, AlertTriangle, Cpu, BarChart3, LogOut, Users } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import api from '@/lib/api'

const LAB_CFG = {
  cc1: { color: '#2563eb', bg: '#eff6ff' },
  cc2: { color: '#7c3aed', bg: '#faf5ff' },
  cts: { color: '#16a34a', bg: '#f0fdf4' },
}

function LiveClock() {
  const [t, setT] = useState(new Date())
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id) }, [])
  return <span style={{ fontFamily:'monospace', fontSize:11, color:'var(--txt3)' }}>{t.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>
}

export default function Layout({ children }) {
  const { admin, logout } = useAuth()
  const navigate = useNavigate()
  const [labs,   setLabs]   = useState([])
  const [alerts, setAlerts] = useState(0)

  useEffect(() => {
    const load = () => {
      api.get('/labs').then(r => setLabs(r.data)).catch(() => {})
      api.get('/idle-alerts?limit=100').then(r => setAlerts(r.data.filter(a => a.alert_type === 'WARNING').length)).catch(() => {})
    }
    load(); const id = setInterval(load, 5000); return () => clearInterval(id)
  }, [])

  const doLogout = async () => { await logout(); navigate('/login') }
  const nc = ({ isActive }) => `nav-item${isActive ? ' active' : ''}`

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
            <div className="brand-icon">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                <rect x="2" y="3" width="20" height="14" rx="2" stroke="white" strokeWidth="2"/>
                <path d="M8 21h8M12 17v4" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div><div className="brand-name">KEC Lab</div><div className="brand-sub">Cognentrz</div></div>
          </div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'6px 10px', background:'var(--bg2)', border:'0.5px solid var(--border)', borderRadius:'var(--r)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
              <div className="pulse"/><span style={{ fontSize:11, fontWeight:500, color:'var(--green)' }}>Live</span>
            </div>
            <LiveClock/>
          </div>
        </div>

        <nav className="nav-scroll">
          <div className="nav-section">Overview</div>
          <NavLink to="/" end className={nc}><LayoutDashboard size={13} style={{flexShrink:0}}/> Dashboard</NavLink>

          <div className="nav-section">Labs</div>
          {['cc1','cc2','cts'].map(id => {
            const lab = labs.find(l => l.id === id)
            const cfg = LAB_CFG[id]
            const pct = lab?.utilization_pct ?? 0
            return (
              <NavLink key={id} to={`/lab/${id}`} className={nc}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:cfg.color, flexShrink:0 }}/>
                <span style={{ flex:1 }}>{id.toUpperCase()}</span>
                {lab && (
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2 }}>
                    <span style={{ fontSize:10, fontWeight:500, color:cfg.color }}>{pct}%</span>
                    <div style={{ width:28, height:2, borderRadius:99, background:'var(--bg3)', overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, background:cfg.color, borderRadius:99 }}/>
                    </div>
                  </div>
                )}
              </NavLink>
            )
          })}

          <div className="nav-section">Tracking</div>
          <NavLink to="/sessions"    className={nc}><Clock size={13} style={{flexShrink:0}}/> Sessions</NavLink>
          <NavLink to="/idle-alerts" className={nc}>
            <AlertTriangle size={13} style={{flexShrink:0}}/>
            <span style={{flex:1}}>Idle alerts</span>
            {alerts > 0 && <span className="nav-badge">{alerts}</span>}
          </NavLink>
          <NavLink to="/agents"  className={nc}><Cpu size={13} style={{flexShrink:0}}/> PC agents</NavLink>
          <NavLink to="/reports" className={nc}><BarChart3 size={13} style={{flexShrink:0}}/> Reports</NavLink>

          <div className="nav-section">Admin</div>
          <NavLink to="/system-users" className={nc}><Users size={13} style={{flexShrink:0}}/> System users</NavLink>
        </nav>

        <div className="user-footer">
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div className="user-avatar">{admin?.name?.[0]?.toUpperCase() || 'A'}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:500, color:'var(--txt)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {admin?.name || 'Lab Admin'}
              </div>
              <div style={{ fontSize:11, color:'var(--txt3)' }}>Administrator</div>
            </div>
            <button onClick={doLogout} className="logout-btn" title="Sign out"><LogOut size={11}/></button>
          </div>
        </div>
      </aside>

      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <main className="main-content">{children}</main>
        <div style={{ padding:'8px 24px', borderTop:'0.5px solid var(--border)', background:'var(--bg)', textAlign:'center' }}>
          <span style={{ fontSize:11, color:'var(--txt3)' }}>Developed by <strong style={{ fontWeight:500, color:'var(--txt)' }}>Logesh</strong> · Cognentrz</span>
        </div>
      </div>
    </div>
  )
}
