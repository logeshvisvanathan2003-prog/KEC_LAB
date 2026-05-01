import { useState, useEffect, useCallback } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts'
import api from '@/lib/api'

function esc(v){const s=String(v??'');return s.includes(',')||s.includes('"')?`"${s.replace(/"/g,'""')}"`:`${s}`}
function toCSV(rows){if(!rows.length)return '';const h=Object.keys(rows[0]);return[h.join(','),...rows.map(r=>h.map(k=>esc(r[k])).join(','))].join('\r\n')}
function dl(c,n){const b=new Blob(['\uFEFF'+c],{type:'text/csv;charset=utf-8;'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=n;a.click();URL.revokeObjectURL(u)}

const Tip=({active,payload,label})=>{
  if(!active||!payload?.length)return null
  return <div style={{background:'var(--bg)',border:'0.5px solid var(--border2)',borderRadius:'var(--r)',padding:'8px 12px',fontSize:12}}><div style={{color:'var(--txt3)',marginBottom:2}}>{label}</div><div style={{fontWeight:500,color:'var(--txt)'}}>{payload[0].value} sessions</div></div>
}

const LAB_COLORS=['#2563eb','#7c3aed','#16a34a']

export default function Reports() {
  const [period,setPeriod]=useState('weekly')
  const [data,setData]=useState(null)
  const [loading,setLoading]=useState(true)

  const load=useCallback(async()=>{setLoading(true);try{const r=await api.get(`/reports/${period}`);setData(r.data)}catch{};setLoading(false)},[period])
  useEffect(()=>{load()},[load])

  const exportCSV=()=>{
    if(!data?.all_sessions?.length)return
    dl(toCSV(data.all_sessions.map(s=>({Date:s.login_date,Username:s.sys_username,Lab:s.lab_id?.toUpperCase(),Machine:s.machine_label,IP:s.ip_address,Login:s.login_time,Logout:s.logout_time||'Active',Duration:s.duration||''}))),`kce_${period}_${new Date().toISOString().slice(0,10)}.csv`)
  }

  return (
    <div>
      <div className="topbar">
        <div><div className="topbar-title">Reports</div><div className="topbar-sub">{data?`${data.from} → ${data.to}`:''}</div></div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={exportCSV} disabled={!data?.all_sessions?.length} className="btn btn-primary" style={{fontSize:12}}><Download size={12}/> Export CSV</button>
          <button onClick={load} className="btn"><RefreshCw size={13} className={loading?'anim-spin':''}/></button>
        </div>
      </div>

      <div className="page">
        <div style={{display:'flex',gap:6}}>
          {[{id:'weekly',label:'This week'},{id:'monthly',label:'This month'},{id:'yearly',label:'This year'}].map(p=>(
            <button key={p.id} onClick={()=>setPeriod(p.id)}
              className="btn"
              style={period===p.id?{background:'var(--txt)',color:'var(--bg)',borderColor:'var(--txt)'}:{}}>
              {p.label}
            </button>
          ))}
        </div>

        {data&&(
          <>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
              {[{l:'Total sessions',v:data.total,c:'var(--blue)'},{l:'Unique users',v:data.unique_users,c:'var(--purple)'},{l:'Avg duration',v:`${data.avg_duration}m`,c:'var(--green)'},{l:'Idle alerts',v:data.idle_alerts?.length||0,c:'var(--amber)'}].map(({l,v,c})=>(
                <div key={l} className="stat-card anim-up"><div className="stat-val" style={{color:c}}>{v}</div><div className="stat-lbl">{l}</div></div>
              ))}
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div className="card">
                <div className="card-header"><div className="card-title">Session trend</div></div>
                <div style={{padding:'14px 16px'}}>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={data.trend} margin={{top:0,right:0,left:-20,bottom:0}}>
                      <CartesianGrid stroke="rgba(0,0,0,0.05)" strokeDasharray="4 4"/>
                      <XAxis dataKey="label" tick={{fontSize:10,fill:'var(--txt3)'}} axisLine={false} tickLine={false} tickFormatter={v=>v.slice(5)}/>
                      <YAxis tick={{fontSize:10,fill:'var(--txt3)'}} axisLine={false} tickLine={false}/>
                      <Tooltip content={<Tip/>}/>
                      <Line type="monotone" dataKey="sessions" stroke="var(--blue)" strokeWidth={1.5} dot={{r:2,fill:'var(--blue)',strokeWidth:0}} activeDot={{r:4}}/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card">
                <div className="card-header"><div className="card-title">Sessions per lab</div></div>
                <div style={{padding:'14px 16px'}}>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={data.by_lab} barSize={36} margin={{top:0,right:0,left:-20,bottom:0}}>
                      <CartesianGrid stroke="rgba(0,0,0,0.05)" vertical={false}/>
                      <XAxis dataKey="lab" tick={{fontSize:12,fill:'var(--txt2)',fontWeight:500}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fontSize:10,fill:'var(--txt3)'}} axisLine={false} tickLine={false}/>
                      <Tooltip content={<Tip/>}/>
                      <Bar dataKey="sessions" radius={[4,4,0,0]}>
                        {data.by_lab.map((e,i)=><rect key={i} fill={LAB_COLORS[i%3]}/>)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><div className="card-title">Top users</div></div>
              <table className="tbl">
                <thead><tr>{['Rank','Username','Sessions','Total time'].map(h=><th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {data.top_users?.slice(0,10).map((u,i)=>(
                    <tr key={u.username}>
                      <td style={{fontFamily:'monospace',fontSize:12,color:'var(--txt3)',fontWeight:500}}>#{i+1}</td>
                      <td><span style={{fontWeight:500,color:'var(--txt)'}}>{u.username}</span></td>
                      <td><span className="badge b-blue">{u.sessions}</span></td>
                      <td style={{fontFamily:'monospace',fontSize:12,color:'var(--txt2)'}}>{Math.round((u.total_min||0)/60*10)/10}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {loading&&<div style={{textAlign:'center',padding:'48px',color:'var(--txt3)'}}>Loading {period} report…</div>}
      </div>
    </div>
  )
}
