import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, RefreshCw, Search } from 'lucide-react'
import api from '@/lib/api'

export default function IdleAlerts() {
  const [alerts,setAlerts]=useState([])
  const [loading,setLoading]=useState(true)
  const [search,setSearch]=useState('')
  const [typeF,setTypeF]=useState('all')

  const load=useCallback(async()=>{setLoading(true);try{const r=await api.get('/idle-alerts?limit=500');setAlerts(r.data)}catch{};setLoading(false)},[])
  useEffect(()=>{load();const id=setInterval(load,30000);return()=>clearInterval(id)},[load])

  const filtered=alerts.filter(a=>{
    if(typeF!=='all'&&a.alert_type!==typeF)return false
    if(search&&!a.sys_username?.toLowerCase().includes(search.toLowerCase())&&!a.machine_label?.toLowerCase().includes(search.toLowerCase()))return false
    return true
  })

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="topbar-title">Idle alerts</div>
          <div className="topbar-sub">{alerts.filter(a=>a.alert_type==='WARNING').length} warnings · {alerts.filter(a=>a.alert_type==='AUTO_SHUTDOWN').length} auto-shutdowns</div>
        </div>
        <button onClick={load} className="btn"><RefreshCw size={13} className={loading?'anim-spin':''}/></button>
      </div>

      <div className="page">
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
          {[{l:'Total alerts',v:alerts.length,c:'var(--txt)'},{l:'Warnings',v:alerts.filter(a=>a.alert_type==='WARNING').length,c:'var(--amber)'},{l:'Auto-shutdowns',v:alerts.filter(a=>a.alert_type==='AUTO_SHUTDOWN').length,c:'var(--red)'}].map(({l,v,c})=>(
            <div key={l} className="stat-card anim-up" style={{display:'flex',alignItems:'center',gap:14}}>
              <div className="stat-val" style={{color:c}}>{v}</div>
              <div className="stat-lbl">{l}</div>
            </div>
          ))}
        </div>

        <div className="card" style={{padding:12}}>
          <div style={{display:'flex',gap:8}}>
            <div style={{position:'relative',flex:1}}>
              <Search size={12} style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--txt3)'}}/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search user or machine..." className="inp" style={{paddingLeft:30,width:'100%'}}/>
            </div>
            <select value={typeF} onChange={e=>setTypeF(e.target.value)} className="inp" style={{width:160}}>
              <option value="all">All types</option>
              <option value="WARNING">Warnings</option>
              <option value="AUTO_SHUTDOWN">Auto shutdowns</option>
            </select>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Alert history</div>
            <span style={{fontSize:11,color:'var(--txt3)',fontFamily:'monospace'}}>{filtered.length} records</span>
          </div>
          <div style={{overflowX:'auto'}}>
            <table className="tbl">
              <thead><tr>{['Time','User','Lab','Machine','IP','Idle','Type','Message'].map(h=><th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map(a=>(
                  <tr key={a.id}>
                    <td style={{fontFamily:'monospace',fontSize:11,color:'var(--txt3)',whiteSpace:'nowrap'}}>{a.created_at}</td>
                    <td><span style={{fontWeight:500,color:'var(--txt)'}}>{a.sys_username}</span></td>
                    <td><span style={{fontFamily:'monospace',fontSize:11,fontWeight:500,color:'var(--blue)'}}>{a.lab_id?.toUpperCase()}</span></td>
                    <td style={{fontFamily:'monospace',fontSize:11,color:'var(--txt2)'}}>{a.machine_label}</td>
                    <td style={{fontFamily:'monospace',fontSize:11,color:'var(--txt3)'}}>{a.ip_address||'—'}</td>
                    <td><span style={{fontWeight:500,fontSize:13,color:a.idle_minutes>=30?'var(--red)':a.idle_minutes>=15?'var(--amber)':'var(--txt2)'}}>{a.idle_minutes}m</span></td>
                    <td>{a.alert_type==='AUTO_SHUTDOWN'?<span className="badge b-red">Auto-off</span>:<span className="badge b-amber">Warning</span>}</td>
                    <td style={{fontSize:11,color:'var(--txt3)',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.alert_message}</td>
                  </tr>
                ))}
                {filtered.length===0&&!loading&&<tr><td colSpan={8} style={{textAlign:'center',padding:'32px',color:'var(--txt3)'}}><AlertTriangle size={24} style={{margin:'0 auto 6px',display:'block',opacity:0.3}}/>No alerts found</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
