import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { RefreshCw, ChevronLeft, Monitor } from 'lucide-react'
import api from '@/lib/api'

const LAB_CFG={cc1:{color:'#2563eb',bg:'#eff6ff',name:'Computer Centre 1',floor:'Ground floor'},cc2:{color:'#7c3aed',bg:'#faf5ff',name:'Computer Centre 2',floor:'Second floor'},cts:{color:'#16a34a',bg:'#f0fdf4',name:'Cisco Training Suite',floor:'First floor'}}

export default function LabPage() {
  const {id} = useParams()
  const cfg = LAB_CFG[id]||{color:'#2563eb',bg:'#eff6ff',name:'Lab',floor:''}
  const [machines,setMachines]=useState([])
  const [hover,setHover]=useState(null)
  const [loading,setLoading]=useState(true)

  const load=useCallback(async()=>{setLoading(true);try{const r=await api.get(`/labs/${id}/machines`);setMachines(r.data)}catch{};setLoading(false)},[id])
  useEffect(()=>{load()},[load])

  const occupied=machines.filter(m=>m.status==='occupied').length
  const free=machines.filter(m=>m.status==='free').length
  const pct=machines.length?Math.round(occupied/machines.length*100):0

  return (
    <div>
      <div className="topbar">
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <Link to="/" style={{display:'flex',alignItems:'center',gap:5,fontSize:13,color:'var(--txt3)',
            padding:'5px 10px',borderRadius:'var(--r)',border:'0.5px solid var(--border)',background:'var(--bg)'}}>
            <ChevronLeft size={13}/> Back
          </Link>
          <div>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontWeight:600,fontSize:15,color:cfg.color}}>{id?.toUpperCase()}</span>
              <span className="topbar-title">— {cfg.name}</span>
            </div>
            <div className="topbar-sub">{cfg.floor} · {machines.length} seats</div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontFamily:'monospace',fontSize:12,color:'var(--txt3)'}}>{pct}% utilized</span>
          <button onClick={load} className="btn"><RefreshCw size={13} className={loading?'anim-spin':''}/></button>
        </div>
      </div>

      <div className="page">
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
          {[{l:'Occupied',v:occupied,c:cfg.color},{l:'Free',v:free,c:'var(--green)'},{l:'Agents online',v:machines.filter(m=>m.agent_online).length,c:'var(--txt2)'},{l:'Utilization',v:`${pct}%`,c:pct>70?'var(--amber)':'var(--txt)'}].map(({l,v,c})=>(
            <div key={l} className="stat-card anim-up" style={{display:'flex',alignItems:'center',gap:14}}>
              <div className="stat-val" style={{color:c}}>{v}</div><div className="stat-lbl">{l}</div>
            </div>
          ))}
        </div>

        <div className="card" style={{padding:'14px 16px'}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:8,fontSize:12,color:'var(--txt3)'}}>
            <span>Lab utilization</span><span style={{fontWeight:500,color:cfg.color}}>{pct}%</span>
          </div>
          <div className="prog-track" style={{height:4}}>
            <div className="prog-fill" style={{width:`${pct}%`,background:cfg.color}}/>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:6,fontSize:11,color:'var(--txt3)'}}>
            <span>{occupied} occupied</span><span>{free} free</span>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Machine grid — {machines.length} PCs</div>
            <div style={{display:'flex',gap:12,fontSize:11,color:'var(--txt3)'}}>
              {[{c:cfg.color,l:'Occupied'},{c:'var(--green)',l:'Free'},{c:'var(--txt3)',l:'Offline'}].map(({c,l})=>(
                <div key={l} style={{display:'flex',alignItems:'center',gap:4}}>
                  <div style={{width:8,height:8,borderRadius:2,background:c}}/>{l}
                </div>
              ))}
            </div>
          </div>
          <div style={{padding:16}}>
            <div className="machine-grid">
              {machines.map(m=>{
                const isOcc=m.status==='occupied'
                const isOn=m.agent_online
                return (
                  <div key={m.id}
                    className={`machine-cell ${isOcc?'occupied':isOn?'free':'offline'}`}
                    style={{position:'relative'}}
                    onMouseEnter={()=>setHover(m)}
                    onMouseLeave={()=>setHover(null)}>
                    <span style={{fontSize:9,fontWeight:600,fontFamily:'monospace'}}>{m.machine_number}</span>
                    {isOcc&&<span style={{fontSize:7,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',width:'100%',textAlign:'center',padding:'0 2px'}}>{m.username?.slice(0,6)}</span>}
                    {hover?.id===m.id&&(
                      <div style={{position:'absolute',bottom:'calc(100% + 6px)',left:'50%',transform:'translateX(-50%)',zIndex:100,
                        background:'var(--bg)',border:'0.5px solid var(--border2)',borderRadius:'var(--r)',
                        padding:'10px 12px',minWidth:160,boxShadow:'0 4px 16px rgba(0,0,0,0.1)',
                        pointerEvents:'none',whiteSpace:'nowrap',fontSize:12}}>
                        <div style={{fontWeight:500,fontFamily:'monospace',color:cfg.color,marginBottom:6}}>{m.label}</div>
                        {m.username&&<div style={{color:'var(--txt3)',marginBottom:2}}>User: <span style={{color:'var(--txt)',fontWeight:500}}>{m.username}</span></div>}
                        <div style={{color:'var(--txt3)',marginBottom:2}}>IP: <span style={{fontFamily:'monospace',color:'var(--txt2)'}}>{m.ip_address||'—'}</span></div>
                        <div style={{color:'var(--txt3)'}}>Agent: <span style={{color:m.agent_online?'var(--green)':'var(--txt3)',fontWeight:500}}>{m.agent_online?'Online':'Offline'}</span></div>
                      </div>
                    )}
                  </div>
                )
              })}
              {machines.length===0&&!loading&&(
                <div style={{gridColumn:'1/-1',textAlign:'center',padding:'40px',color:'var(--txt3)'}}>
                  <Monitor size={28} style={{margin:'0 auto 8px',display:'block',opacity:0.3}}/>
                  No machines registered yet
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
