import { useState, useEffect, useCallback } from 'react'
import { Users, UserPlus, Pencil, Trash2, ToggleLeft, ToggleRight, Search, Eye, EyeOff, RefreshCw, X } from 'lucide-react'
import api from '@/lib/api'

const DEPTS=['CSE','IT','ECE','EEE','MECH','CIVIL','MBA','MCA','Other']
const LAB_OPTIONS=[{v:'all',l:'All labs'},{v:'cc1',l:'CC1'},{v:'cc2',l:'CC2'},{v:'cts',l:'CTS'},{v:'cc1,cc2',l:'CC1 & CC2'},{v:'cc1,cts',l:'CC1 & CTS'},{v:'cc2,cts',l:'CC2 & CTS'}]
const EMPTY={username:'',password:'',full_name:'',roll_number:'',department:'',lab_access:'all',is_active:true,notes:''}

function Modal({title,onClose,children}){
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.3)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
      <div style={{background:'var(--bg)',border:'0.5px solid var(--border2)',borderRadius:'var(--r-lg)',width:'100%',maxWidth:440,maxHeight:'85vh',overflow:'auto',boxShadow:'0 8px 40px rgba(0,0,0,0.12)'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 18px',borderBottom:'0.5px solid var(--border)'}}>
          <div style={{fontWeight:500,fontSize:14,color:'var(--txt)'}}>{title}</div>
          <button onClick={onClose} style={{background:'none',border:'none',color:'var(--txt3)',display:'flex',padding:4}}><X size={14}/></button>
        </div>
        <div style={{padding:18}}>{children}</div>
      </div>
    </div>
  )
}

function Field({label,children}){
  return (
    <div style={{marginBottom:14}}>
      <label style={{display:'block',fontSize:12,fontWeight:500,color:'var(--txt2)',marginBottom:5}}>{label}</label>
      {children}
    </div>
  )
}

export default function SystemUsers() {
  const [users,setUsers]=useState([])
  const [loading,setLoading]=useState(true)
  const [search,setSearch]=useState('')
  const [modal,setModal]=useState(null)
  const [form,setForm]=useState(EMPTY)
  const [saving,setSaving]=useState(false)
  const [showPwd,setShowPwd]=useState(false)
  const [msg,setMsg]=useState('')

  const load=useCallback(async()=>{setLoading(true);try{const r=await api.get('/admin/system-users');setUsers(r.data)}catch{};setLoading(false)},[])
  useEffect(()=>{load()},[load])

  const openCreate=()=>{setForm(EMPTY);setModal('create');setMsg('');setShowPwd(false)}
  const openEdit=u=>{setForm({...u,password:''});setModal(u);setMsg('');setShowPwd(false)}

  const save=async()=>{
    if(!form.username||(!form.password&&modal==='create')){setMsg('Username and password are required');return}
    setSaving(true);setMsg('')
    try{
      if(modal==='create'){await api.post('/admin/system-users',form);setMsg('✓ User created')}
      else{await api.put(`/admin/system-users/${modal.id}`,form);setMsg('✓ Updated')}
      load();setTimeout(()=>setModal(null),800)
    }catch(e){setMsg('✗ '+(e.response?.data?.error||'Error'))}
    setSaving(false)
  }

  const toggle=async u=>{try{await api.patch(`/admin/system-users/${u.id}/toggle`);load()}catch{}}
  const del=async u=>{if(!confirm(`Delete "${u.username}"?`))return;try{await api.delete(`/admin/system-users/${u.id}`);load()}catch{}}

  const filtered=users.filter(u=>!search||u.username?.toLowerCase().includes(search.toLowerCase())||u.full_name?.toLowerCase().includes(search.toLowerCase())||u.department?.toLowerCase().includes(search.toLowerCase()))

  const inp={width:'100%',height:36,padding:'0 10px',background:'var(--bg)',border:'0.5px solid var(--border2)',borderRadius:'var(--r)',color:'var(--txt)',fontSize:13,outline:'none',fontFamily:'inherit'}

  return (
    <div>
      <div className="topbar">
        <div><div className="topbar-title">System users</div><div className="topbar-sub">{users.length} total · {users.filter(u=>u.is_active).length} active</div></div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={openCreate} className="btn btn-primary" style={{fontSize:12}}><UserPlus size={13}/> New user</button>
          <button onClick={load} className="btn"><RefreshCw size={13} className={loading?'anim-spin':''}/></button>
        </div>
      </div>

      <div className="page">
        <div style={{position:'relative',maxWidth:340}}>
          <Search size={12} style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--txt3)'}}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search users…" className="inp" style={{paddingLeft:30,width:'100%'}}/>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">All system users</div><span style={{fontSize:11,color:'var(--txt3)',fontFamily:'monospace'}}>{filtered.length} users</span></div>
          <div style={{overflowX:'auto'}}>
            <table className="tbl">
              <thead><tr>{['User','Roll no','Department','Lab access','Status','Last login','Actions'].map(h=><th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map(u=>(
                  <tr key={u.id}>
                    <td>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <div style={{width:28,height:28,borderRadius:6,background:'var(--bg2)',border:'0.5px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:500,fontSize:12,color:'var(--txt2)',flexShrink:0}}>
                          {u.full_name?.[0]?.toUpperCase()||u.username?.[0]?.toUpperCase()||'?'}
                        </div>
                        <div>
                          <div style={{fontWeight:500,color:'var(--txt)',fontSize:13}}>{u.full_name||u.username}</div>
                          <div style={{fontFamily:'monospace',fontSize:11,color:'var(--txt3)'}}>{u.username}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{fontFamily:'monospace',fontSize:12,color:'var(--txt3)'}}>{u.roll_number||'—'}</td>
                    <td style={{fontSize:12,color:'var(--txt2)'}}>{u.department||'—'}</td>
                    <td><span className="badge b-blue">{u.lab_access==='all'?'All labs':u.lab_access?.toUpperCase()}</span></td>
                    <td>{u.is_active?<span className="badge b-green"><div className="pulse" style={{width:5,height:5}}/>Active</span>:<span className="badge b-gray">Disabled</span>}</td>
                    <td style={{fontFamily:'monospace',fontSize:11,color:'var(--txt3)'}}>{u.last_login||'Never'}</td>
                    <td>
                      <div style={{display:'flex',gap:3}}>
                        {[
                          {icon:<Pencil size={11}/>,action:()=>openEdit(u),title:'Edit',hover:'var(--blue-bg)'},
                          {icon:u.is_active?<ToggleRight size={12} color="var(--green)"/>:<ToggleLeft size={12}/>,action:()=>toggle(u),title:u.is_active?'Disable':'Enable',hover:'var(--bg2)'},
                          {icon:<Trash2 size={11}/>,action:()=>del(u),title:'Delete',hover:'var(--red-bg)'},
                        ].map(({icon,action,title,hover},i)=>(
                          <button key={i} onClick={action} title={title}
                            style={{width:28,height:28,borderRadius:6,background:'var(--bg)',border:'0.5px solid var(--border)',color:'var(--txt3)',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.12s'}}
                            onMouseEnter={e=>{e.currentTarget.style.background=hover;e.currentTarget.style.borderColor='var(--border2)'}}
                            onMouseLeave={e=>{e.currentTarget.style.background='var(--bg)';e.currentTarget.style.borderColor='var(--border)'}}>
                            {icon}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length===0&&!loading&&<tr><td colSpan={7} style={{textAlign:'center',padding:'32px',color:'var(--txt3)'}}><Users size={24} style={{margin:'0 auto 6px',display:'block',opacity:0.3}}/>No users found</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modal&&(
        <Modal title={modal==='create'?'Create user':`Edit — ${modal.username}`} onClose={()=>setModal(null)}>
          <Field label="Username"><input value={form.username} onChange={e=>setForm(p=>({...p,username:e.target.value}))} placeholder="e.g. john.doe" style={inp} disabled={modal!=='create'}/></Field>
          <Field label={modal==='create'?'Password':'New password (leave blank to keep)'}><div style={{position:'relative'}}><input type={showPwd?'text':'password'} value={form.password} onChange={e=>setForm(p=>({...p,password:e.target.value}))} placeholder={modal==='create'?'Min. 4 characters':'Leave blank to keep'} style={{...inp,paddingRight:36}}/><button type="button" onClick={()=>setShowPwd(v=>!v)} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:'var(--txt3)',display:'flex'}}>{showPwd?<EyeOff size={12}/>:<Eye size={12}/>}</button></div></Field>
          <Field label="Full name"><input value={form.full_name} onChange={e=>setForm(p=>({...p,full_name:e.target.value}))} placeholder="Full name" style={inp}/></Field>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <Field label="Roll number"><input value={form.roll_number} onChange={e=>setForm(p=>({...p,roll_number:e.target.value}))} placeholder="22CSE001" style={inp}/></Field>
            <Field label="Department"><select value={form.department} onChange={e=>setForm(p=>({...p,department:e.target.value}))} style={inp}><option value="">Select</option>{DEPTS.map(d=><option key={d}>{d}</option>)}</select></Field>
          </div>
          <Field label="Lab access"><select value={form.lab_access} onChange={e=>setForm(p=>({...p,lab_access:e.target.value}))} style={inp}>{LAB_OPTIONS.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select></Field>
          {modal!=='create'&&(
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14,padding:'10px 12px',background:'var(--bg2)',borderRadius:'var(--r)',border:'0.5px solid var(--border)'}}>
              <input type="checkbox" id="active" checked={form.is_active} onChange={e=>setForm(p=>({...p,is_active:e.target.checked}))} style={{width:14,height:14}}/>
              <label htmlFor="active" style={{fontSize:13,color:'var(--txt2)',fontWeight:500}}>Account active</label>
            </div>
          )}
          {msg&&<div style={{marginBottom:12,padding:'8px 12px',borderRadius:'var(--r)',fontSize:13,background:msg.startsWith('✓')?'var(--green-bg)':'var(--red-bg)',border:`0.5px solid ${msg.startsWith('✓')?'var(--green-b)':'var(--red-b)'}`,color:msg.startsWith('✓')?'var(--green)':'var(--red)'}}>{msg}</div>}
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>setModal(null)} className="btn" style={{flex:1,justifyContent:'center'}}>Cancel</button>
            <button onClick={save} disabled={saving} className="btn btn-primary" style={{flex:1,justifyContent:'center'}}>
              {saving?<span style={{width:12,height:12,border:'1.5px solid rgba(255,255,255,0.3)',borderTopColor:'var(--bg)',borderRadius:'50%',display:'inline-block',animation:'spin 0.7s linear infinite'}}/>:modal==='create'?'Create user':'Save changes'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
