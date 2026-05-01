import { useState, useEffect, useCallback } from 'react'
import { Search, RefreshCw, Clock, Download } from 'lucide-react'
import api from '@/lib/api'

const LAB_CFG={cc1:{color:'#2563eb',bg:'#eff6ff'},cc2:{color:'#7c3aed',bg:'#faf5ff'},cts:{color:'#16a34a',bg:'#f0fdf4'}}
function esc(v){const s=String(v??'');return s.includes(',')||s.includes('"')?`"${s.replace(/"/g,'""')}"`:s}
function toCSV(rows){if(!rows.length)return '';const h=Object.keys(rows[0]);return[h.join(','),...rows.map(r=>h.map(k=>esc(r[k])).join(','))].join('\r\n')}
function dl(c,n){const b=new Blob(['\uFEFF'+c],{type:'text/csv;charset=utf-8;'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=n;a.click();URL.revokeObjectURL(u)}

export default function Sessions() {
  const [sessions,setSessions]=useState([])
  const [loading,setLoading]=useState(true)
  const [search,setSearch]=useState('')
  const [labF,setLabF]=useState('all')
  const [statusF,setStatusF]=useState('all')

  const load=useCallback(async()=>{
    setLoading(true)
    try{const p=new URLSearchParams();if(labF!=='all')p.set('lab',labF);if(statusF!=='all')p.set('status',statusF);const r=await api.get(`/system/sessions?${p}&limit=500`);setSessions(r.data)}catch{}
    setLoading(false)
  },[labF,statusF])

  useEffect(()=>{load();const id=setInterval(load,20000);return()=>clearInterval(id)},[load])

  const filtered=sessions.filter(s=>!search||s.sys_username?.toLowerCase().includes(search.toLowerCase())||s.machine_label?.toLowerCase().includes(search.toLowerCase())||s.ip_address?.includes(search))
  const active=sessions.filter(s=>s.status==='active').length

  const exportCSV=()=>{
    dl(toCSV(filtered.map(s=>({Date:s.login_date,Username:s.sys_username,Lab:s.lab_id?.toUpperCase(),Machine:s.machine_label,IP:s.ip_address,Login:s.login_time,Logout:s.logout_time||'Active',Duration:s.duration||''}))),`sessions_${new Date().toISOString().slice(0,10)}.csv`)
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="topbar-title">Sessions</div>
          <div className="topbar-sub">{sessions.length} records · {active} active now</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={exportCSV} className="btn" style={{fontSize:12}}><Download size={12}/> Export</button>
          <button onClick={load} className="btn"><RefreshCw size={13} className={loading?'anim-spin':''}/></button>
        </div>
      </div>

      <div className="page">
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
          {[{l:'Active',v:active,c:'#16a34a'},{l:'Ended',v:sessions.filter(s=>s.status==='ended').length,c:'var(--txt3)'},{l:'Total',v:sessions.length,c:'var(--blue)'}].map(({l,v,c})=>(
            <div key={l} className="stat-card anim-up" style={{display:'flex',alignItems:'center',gap:14}}>
              <div className="stat-val" style={{color:c}}>{v}</div>
              <div className="stat-lbl">{l} sessions</div>
            </div>
          ))}
        </div>

        <div className="card" style={{padding:12}}>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <div style={{position:'relative',flex:1,minWidth:200}}>
              <Search size={12} style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--txt3)'}}/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search user, machine, IP..." className="inp" style={{paddingLeft:30,width:'100%'}}/>
            </div>
            <select value={labF} onChange={e=>setLabF(e.target.value)} className="inp" style={{width:110}}>
              <option value="all">All labs</option>
              <option value="cc1">CC1</option><option value="cc2">CC2</option><option value="cts">CTS</option>
            </select>
            <select value={statusF} onChange={e=>setStatusF(e.target.value)} className="inp" style={{width:120}}>
              <option value="all">All status</option>
              <option value="active">Active</option><option value="ended">Ended</option>
            </select>
            <button onClick={()=>{setSearch('');setLabF('all');setStatusF('all')}} className="btn" style={{fontSize:12}}>Clear</button>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Session records</div>
            <span style={{fontSize:11,color:'var(--txt3)',fontFamily:'monospace'}}>{filtered.length} rows</span>
          </div>
          <div style={{overflowX:'auto'}}>
            <table className="tbl">
              <thead><tr>{['Date','User','Lab','Machine','IP','Login','Logout','Duration','Status'].map(h=><th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map(s=>{const c=LAB_CFG[s.lab_id]||{color:'#2563eb',bg:'#eff6ff'};return(
                  <tr key={s.id}>
                    <td style={{fontFamily:'monospace',fontSize:11,color:'var(--txt3)'}}>{s.login_date}</td>
                    <td><span style={{fontWeight:500,color:'var(--txt)'}}>{s.sys_username}</span></td>
                    <td><span className="badge" style={{background:c.bg,color:c.color,borderColor:c.color+'30',fontFamily:'monospace'}}>{s.lab_id?.toUpperCase()}</span></td>
                    <td style={{fontFamily:'monospace',fontSize:11,color:'var(--txt2)'}}>{s.machine_label}</td>
                    <td style={{fontFamily:'monospace',fontSize:11,color:'var(--txt3)'}}>{s.ip_address||'—'}</td>
                    <td style={{fontSize:12,color:'var(--txt2)'}}>{s.login_time}</td>
                    <td style={{fontSize:12,color:'var(--txt2)'}}>{s.logout_time||<span style={{color:'var(--green)',fontWeight:500}}>Active</span>}</td>
                    <td style={{fontFamily:'monospace',fontSize:12,color:'var(--txt2)'}}>{s.duration||'—'}</td>
                    <td>{s.status==='active'?<span className="badge b-green"><div className="pulse" style={{width:5,height:5}}/>Live</span>:<span className="badge b-gray">Ended</span>}</td>
                  </tr>
                )})}
                {filtered.length===0&&!loading&&<tr><td colSpan={9} style={{textAlign:'center',padding:'32px',color:'var(--txt3)'}}><Clock size={24} style={{margin:'0 auto 6px',display:'block',opacity:0.3}}/> No sessions found</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
