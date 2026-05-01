import { useState, useEffect, useCallback } from 'react'
import { Search, RefreshCw, Cpu } from 'lucide-react'
import api from '@/lib/api'

const LAB_CFG={cc1:{color:'#2563eb',bg:'#eff6ff'},cc2:{color:'#7c3aed',bg:'#faf5ff'},cts:{color:'#16a34a',bg:'#f0fdf4'}}

export default function Agents() {
  const [agents,setAgents]=useState([])
  const [loading,setLoading]=useState(true)
  const [search,setSearch]=useState('')
  const [labF,setLabF]=useState('all')
  const [statusF,setStatusF]=useState('all')

  const load=useCallback(async()=>{setLoading(true);try{const r=await api.get('/agents');setAgents(r.data)}catch{};setLoading(false)},[])
  useEffect(()=>{load();const id=setInterval(load,15000);return()=>clearInterval(id)},[load])

  const filtered=agents.filter(a=>{
    if(labF!=='all'&&a.lab_id!==labF)return false
    if(statusF==='online'&&!a.agent_online)return false
    if(statusF==='offline'&&a.agent_online)return false
    if(search&&!a.label?.toLowerCase().includes(search.toLowerCase())&&!a.hostname?.toLowerCase().includes(search.toLowerCase())&&!a.ip_address?.includes(search))return false
    return true
  })

  const online=agents.filter(a=>a.agent_online).length

  return (
    <div>
      <div className="topbar">
        <div><div className="topbar-title">PC agents</div><div className="topbar-sub">{online} online · {agents.length-online} offline</div></div>
        <button onClick={load} className="btn"><RefreshCw size={13} className={loading?'anim-spin':''}/></button>
      </div>
      <div className="page">
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
          {[{l:'Total',v:agents.length,c:'var(--txt)'},{l:'Online',v:online,c:'var(--green)'},{l:'Offline',v:agents.length-online,c:'var(--red)'},{l:'Occupied',v:agents.filter(a=>a.status==='occupied').length,c:'var(--blue)'}].map(({l,v,c})=>(
            <div key={l} className="stat-card anim-up" style={{display:'flex',alignItems:'center',gap:14}}>
              <div className="stat-val" style={{color:c}}>{v}</div><div className="stat-lbl">{l}</div>
            </div>
          ))}
        </div>
        <div className="card" style={{padding:12}}>
          <div style={{display:'flex',gap:8}}>
            <div style={{position:'relative',flex:1}}>
              <Search size={12} style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--txt3)'}}/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search machine, hostname, IP..." className="inp" style={{paddingLeft:30,width:'100%'}}/>
            </div>
            <select value={labF} onChange={e=>setLabF(e.target.value)} className="inp" style={{width:110}}>
              <option value="all">All labs</option><option value="cc1">CC1</option><option value="cc2">CC2</option><option value="cts">CTS</option>
            </select>
            <select value={statusF} onChange={e=>setStatusF(e.target.value)} className="inp" style={{width:120}}>
              <option value="all">All status</option><option value="online">Online</option><option value="offline">Offline</option>
            </select>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><div className="card-title">Machine agents</div><span style={{fontSize:11,color:'var(--txt3)',fontFamily:'monospace'}}>{filtered.length} machines</span></div>
          <div style={{overflowX:'auto'}}>
            <table className="tbl">
              <thead><tr>{['Machine','Lab','No.','Hostname','IP Address','Status','User','Last seen','Version'].map(h=><th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map(a=>{const c=LAB_CFG[a.lab_id]||{color:'#2563eb',bg:'#eff6ff'};return(
                  <tr key={a.id}>
                    <td><div style={{display:'flex',alignItems:'center',gap:8}}><div style={{width:26,height:26,borderRadius:6,background:a.agent_online?c.bg:'var(--bg2)',border:`0.5px solid ${a.agent_online?c.color+'30':'var(--border)'}`,display:'flex',alignItems:'center',justifyContent:'center'}}><Cpu size={11} color={a.agent_online?c.color:'var(--txt3)'}/></div><span style={{fontWeight:500,fontFamily:'monospace',fontSize:12,color:a.agent_online?c.color:'var(--txt3)'}}>{a.label}</span></div></td>
                    <td><span className="badge" style={{background:c.bg,color:c.color,borderColor:c.color+'30',fontFamily:'monospace'}}>{a.lab_id?.toUpperCase()}</span></td>
                    <td style={{fontFamily:'monospace',fontSize:12,color:'var(--txt3)'}}>#{a.machine_number}</td>
                    <td style={{fontFamily:'monospace',fontSize:11,color:'var(--txt2)'}}>{a.hostname||'—'}</td>
                    <td style={{fontFamily:'monospace',fontSize:11,color:'var(--txt3)'}}>{a.ip_address||'—'}</td>
                    <td>{a.agent_online?<span className="badge b-green"><div className="pulse" style={{width:5,height:5}}/>Online</span>:<span className="badge b-gray">Offline</span>}</td>
                    <td style={{fontSize:12,color:a.username?'var(--txt)':'var(--txt3)',fontWeight:a.username?500:400}}>{a.username||'—'}</td>
                    <td style={{fontFamily:'monospace',fontSize:11,color:'var(--txt3)'}}>{a.last_heartbeat?new Date(a.last_heartbeat).toLocaleTimeString():'—'}</td>
                    <td style={{fontFamily:'monospace',fontSize:11,color:'var(--txt3)'}}>{a.agent_version||'—'}</td>
                  </tr>
                )})}
                {filtered.length===0&&!loading&&<tr><td colSpan={9} style={{textAlign:'center',padding:'32px',color:'var(--txt3)'}}><Cpu size={24} style={{margin:'0 auto 6px',display:'block',opacity:0.3}}/>No agents registered yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
