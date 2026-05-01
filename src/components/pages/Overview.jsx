import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, ArrowRight, Monitor } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Link } from 'react-router-dom'
import api from '@/lib/api'

const LAB_CFG = {
  cc1:{color:'#2563eb',bg:'#eff6ff',name:'Computer Centre 1'},
  cc2:{color:'#7c3aed',bg:'#faf5ff',name:'Computer Centre 2'},
  cts:{color:'#16a34a',bg:'#f0fdf4',name:'Cognizant Technologies Solutions'},
}

function LiveClock() {
  const [t,setT]=useState(new Date())
  useEffect(()=>{const id=setInterval(()=>setT(new Date()),1000);return()=>clearInterval(id)},[])
  return <span style={{fontFamily:'monospace',fontSize:12,color:'var(--txt3)'}}>{t.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>
}

const Tip = ({active,payload,label}) => {
  if (!active||!payload?.length) return null
  return (
    <div style={{background:'var(--bg)',border:'0.5px solid var(--border2)',borderRadius:'var(--r)',padding:'8px 12px',fontSize:12}}>
      <div style={{color:'var(--txt3)',marginBottom:2}}>{label}:00</div>
      <div style={{fontWeight:500,color:'var(--txt)'}}>{payload[0].value} sessions</div>
    </div>
  )
}

export default function Overview() {
  const [labs,    setLabs]    = useState([])
  const [hourly,  setHourly]  = useState([])
  const [recent,  setRecent]  = useState([])
  const [alerts,  setAlerts]  = useState([])
  const [summary, setSummary] = useState({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const [dashR, sumR] = await Promise.all([api.get('/stats/dashboard'), api.get('/analytics/summary')])
      setLabs(dashR.data.labs || [])
      setHourly(Array.from({length:24},(_,h)=>({h:String(h),sessions:dashR.data.hourly?.[h]||0})))
      setRecent(dashR.data.recent_sessions?.slice(0,8)||[])
      setAlerts(dashR.data.recent_alerts?.slice(0,5)||[])
      setSummary(sumR.data||{})
    } catch{}
    setLoading(false)
  },[])

  useEffect(()=>{load();const id=setInterval(load,5000);return()=>clearInterval(id)},[load])

  const totalActive = labs.reduce((s,l)=>s+l.occupied,0)
  const totalSeats  = labs.reduce((s,l)=>s+l.total_seats,0)

  const kpis = [
    {label:'Active sessions',  val:totalActive,           icon:'●', color:'#16a34a'},
    {label:'Total seats',      val:totalSeats,            icon:'□', color:'var(--txt3)'},
    {label:'Sessions today',   val:summary.total_today||0,icon:'↑', color:'#2563eb'},
    {label:'Idle alerts today',val:summary.idle_alerts_today||0,icon:'⚠',color:'#d97706'},
  ]

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="topbar-title">Dashboard</div>
          <div style={{display:'flex',alignItems:'center',gap:8,marginTop:1}}>
            <div className="topbar-sub">{new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</div>
            <span style={{color:'var(--border2)'}}>·</span>
            <LiveClock/>
          </div>
        </div>
        <button onClick={load} className="btn" style={{padding:'6px 10px'}}>
          <RefreshCw size={13} className={loading?'anim-spin':''}/>
        </button>
      </div>

      <div className="page">
        {/* KPIs */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
          {kpis.map(({label,val,icon,color},i)=>(
            <div key={label} className={`stat-card anim-up s${i+1}`}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                <div className="stat-icon">
                  <span style={{fontSize:13,color}}>{icon}</span>
                </div>
              </div>
              <div className="stat-val" style={{color}}>{loading?'—':val}</div>
              <div className="stat-lbl">{label}</div>
            </div>
          ))}
        </div>

        {/* Lab cards */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
          {labs.map((lab,i)=>{
            const cfg = LAB_CFG[lab.id]||{color:'#2563eb',bg:'#eff6ff',name:lab.full_name}
            const free = lab.total_seats - lab.occupied
            return (
              <Link key={lab.id} to={`/lab/${lab.id}`} className={`card anim-up s${i+3}`}
                style={{display:'block',textDecoration:'none',transition:'border-color 0.15s'}}
                onMouseEnter={e=>e.currentTarget.style.borderColor=cfg.color}
                onMouseLeave={e=>e.currentTarget.style.borderColor=''}>
                <div style={{padding:'14px 16px',borderBottom:'0.5px solid var(--border)'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{width:28,height:28,borderRadius:6,background:cfg.bg,border:`0.5px solid ${cfg.color}30`,
                        display:'flex',alignItems:'center',justifyContent:'center',
                        fontWeight:600,fontSize:12,color:cfg.color}}>
                        {lab.id.toUpperCase()}
                      </div>
                      <div>
                        <div style={{fontWeight:500,fontSize:13,color:'var(--txt)'}}>{cfg.name}</div>
                      </div>
                    </div>
                    <ArrowRight size={13} style={{color:'var(--txt3)'}}/>
                  </div>
                  <div className="prog-track">
                    <div className="prog-fill" style={{width:`${lab.utilization_pct}%`,background:cfg.color}}/>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',marginTop:6,fontSize:11,color:'var(--txt3)'}}>
                    <span>{lab.utilization_pct}% utilized</span>
                    <span>{lab.total_seats} seats</span>
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:0}}>
                  {[{v:lab.occupied,l:'Occupied',c:cfg.color},{v:free,l:'Free',c:'var(--green)'},{v:lab.agents_online,l:'Agents',c:'var(--txt3)'}].map(({v,l,c},j)=>(
                    <div key={l} style={{padding:'10px 0',textAlign:'center',borderRight:j<2?'0.5px solid var(--border)':'none'}}>
                      <div style={{fontWeight:500,fontSize:16,color:c}}>{v}</div>
                      <div style={{fontSize:10,color:'var(--txt3)',marginTop:2,textTransform:'uppercase',letterSpacing:'0.04em'}}>{l}</div>
                    </div>
                  ))}
                </div>
              </Link>
            )
          })}
          {labs.length===0&&!loading&&[...Array(3)].map((_,i)=>(
            <div key={i} className="card" style={{height:160,display:'flex',alignItems:'center',justifyContent:'center'}}>
              <div className="skeleton" style={{width:100,height:12,borderRadius:6}}/>
            </div>
          ))}
        </div>

        {/* Chart + alerts */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:12}}>
          <div className="card">
            <div className="card-header">
              <div className="card-title">Hourly sessions — today</div>
            </div>
            <div style={{padding:'16px 18px'}}>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={hourly} margin={{top:0,right:0,left:-20,bottom:0}}>
                  <defs>
                    <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity={0.12}/>
                      <stop offset="100%" stopColor="#2563eb" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(0,0,0,0.05)" strokeDasharray="4 4"/>
                  <XAxis dataKey="h" tick={{fontSize:10,fill:'var(--txt3)'}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}h`}/>
                  <YAxis tick={{fontSize:10,fill:'var(--txt3)'}} axisLine={false} tickLine={false}/>
                  <Tooltip content={<Tip/>}/>
                  <Area type="monotone" dataKey="sessions" stroke="#2563eb" strokeWidth={1.5} fill="url(#aGrad)" dot={false}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Recent alerts</div>
              <Link to="/idle-alerts" style={{fontSize:12,color:'var(--blue)',display:'flex',alignItems:'center',gap:3}}>
                View all <ArrowRight size={11}/>
              </Link>
            </div>
            {alerts.length===0
              ? <div style={{padding:'24px',textAlign:'center',color:'var(--txt3)',fontSize:13}}>No recent alerts</div>
              : alerts.map((a,i)=>(
                  <div key={a.id} style={{display:'flex',alignItems:'flex-start',gap:8,padding:'10px 14px',
                    borderBottom:i<alerts.length-1?'0.5px solid var(--border)':'none'}}>
                    <span style={{fontSize:12,marginTop:1}}>{a.alert_type==='AUTO_SHUTDOWN'?'🔴':'🟡'}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:500,color:'var(--txt)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.sys_username}</div>
                      <div style={{fontSize:11,color:'var(--txt3)',marginTop:1}}>{a.machine_label} · {a.idle_minutes}min idle</div>
                    </div>
                  </div>
                ))
            }
          </div>
        </div>

        {/* Recent sessions table */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Recent sessions</div>
            <Link to="/sessions" style={{fontSize:12,color:'var(--blue)',display:'flex',alignItems:'center',gap:3}}>
              View all <ArrowRight size={11}/>
            </Link>
          </div>
          <table className="tbl">
            <thead><tr>
              {['User','Lab','Machine','IP Address','Login','Duration','Status'].map(h=><th key={h}>{h}</th>)}
            </tr></thead>
            <tbody>
              {recent.map(s=>{
                const cfg=LAB_CFG[s.lab_id]||{color:'#2563eb',bg:'#eff6ff'}
                return (
                  <tr key={s.id}>
                    <td><span style={{fontWeight:500,color:'var(--txt)',fontSize:13}}>{s.sys_username}</span></td>
                    <td><span className="badge" style={{background:cfg.bg,color:cfg.color,borderColor:cfg.color+'30',fontFamily:'monospace'}}>{s.lab_id?.toUpperCase()}</span></td>
                    <td style={{fontFamily:'monospace',fontSize:12,color:'var(--txt3)'}}>{s.machine_label}</td>
                    <td style={{fontFamily:'monospace',fontSize:11,color:'var(--txt3)'}}>{s.ip_address||'—'}</td>
                    <td style={{fontSize:12,color:'var(--txt2)'}}>{s.login_time}</td>
                    <td style={{fontSize:12,color:'var(--txt2)'}}>{s.duration||'—'}</td>
                    <td>{s.status==='active'
                      ? <span className="badge b-green"><div className="pulse" style={{width:5,height:5}}/>Live</span>
                      : <span className="badge b-gray">Ended</span>
                    }</td>
                  </tr>
                )
              })}
              {recent.length===0&&!loading&&(
                <tr><td colSpan={7} style={{textAlign:'center',padding:'28px',color:'var(--txt3)'}}>
                  <Monitor size={24} style={{margin:'0 auto 6px',display:'block',opacity:0.3}}/>
                  No sessions yet
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
