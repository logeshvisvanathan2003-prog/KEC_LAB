import { useState, useEffect, useRef } from 'react'
import api from '@/lib/api'

const DEPTS = ['CSE','IT','ECE','EEE','MECH','CIVIL','MBA','MCA','Other']

/* ── Shared input ── */
function Inp({ type='text', ph='', val, set, req, pw }) {
  const [show, setShow] = useState(false)
  const [focus, setFocus] = useState(false)
  const t = pw ? (show ? 'text' : 'password') : type
  return (
    <div style={{position:'relative'}}>
      <input type={t} placeholder={ph} value={val} required={req}
        onChange={e=>set(e.target.value)}
        onFocus={()=>setFocus(true)} onBlur={()=>setFocus(false)}
        style={{width:'100%',height:38,padding:pw?'0 38px 0 12px':'0 12px',
          background:'var(--bg)',border:`0.5px solid ${focus?'var(--blue)':'var(--border2)'}`,
          borderRadius:'var(--r)',color:'var(--txt)',fontSize:14,outline:'none',
          fontFamily:'inherit',transition:'border-color .12s,box-shadow .12s',
          boxShadow:focus?'0 0 0 3px rgba(37,99,235,0.08)':'none'}}/>
      {pw && (
        <button type="button" onClick={()=>setShow(v=>!v)}
          style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',
            background:'none',border:'none',color:'var(--txt3)',display:'flex',padding:3}}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
            {show&&<line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>}
          </svg>
        </button>
      )}
    </div>
  )
}

function Row({label,children}) {
  return (
    <div style={{marginBottom:13}}>
      <label style={{display:'block',fontSize:11,fontWeight:500,color:'var(--txt2)',
        marginBottom:5,textTransform:'uppercase',letterSpacing:'0.06em'}}>{label}</label>
      {children}
    </div>
  )
}

function Err({msg}) {
  if(!msg) return null
  return <div style={{padding:'9px 12px',borderRadius:'var(--r)',background:'var(--red-bg)',
    border:'0.5px solid var(--red-b)',color:'var(--red)',fontSize:13,marginBottom:12,lineHeight:1.5}}>{msg}</div>
}

function Ok({msg}) {
  if(!msg) return null
  return <div style={{padding:'9px 12px',borderRadius:'var(--r)',background:'var(--green-bg)',
    border:'0.5px solid var(--green-b)',color:'var(--green)',fontSize:13,marginBottom:12,lineHeight:1.5}}>{msg}</div>
}

function Spin() {
  return <span style={{width:13,height:13,border:'1.5px solid rgba(255,255,255,.3)',
    borderTopColor:'var(--bg)',borderRadius:'50%',display:'inline-block',
    animation:'spin .7s linear infinite'}}/>
}

/* ── Login ── */
function LoginPanel({onSuccess, onSwitch}) {
  const [u,setU]=useState(''), [p,setP]=useState('')
  const [err,setErr]=useState(''), [loading,setLoading]=useState(false)

  const submit = async e => {
    e.preventDefault(); setErr(''); setLoading(true)
    try {
      const {data} = await api.post('/system/login', {
        username: u.trim().toLowerCase(),
        password: p,
      })
      onSuccess(data)
    } catch(ex) {
      setErr(ex.response?.data?.error || 'Login failed. Check your credentials.')
    }
    setLoading(false)
  }

  return (
    <form onSubmit={submit}>
      <Row label="Username"><Inp type="email" ph="yourname@kec.edu" val={u} set={setU} req/></Row>
      <Row label="Password"><Inp ph="••••••••" val={p} set={setP} req pw/></Row>
      <Err msg={err}/>
      <button type="submit" disabled={loading} className="login-btn" style={{marginTop:4}}>
        {loading ? <Spin/> : 'Sign in →'}
      </button>
      <div style={{textAlign:'center',marginTop:14,fontSize:12,color:'var(--txt3)'}}>
        New student?{' '}
        <button type="button" onClick={onSwitch}
          style={{color:'var(--blue)',fontWeight:500,background:'none',border:'none',fontSize:12}}>
          Create an account
        </button>
      </div>
    </form>
  )
}

/* ── Register ── */
function RegisterPanel({onDone}) {
  const [f,setF]=useState({u:'',p:'',c:'',name:'',roll:'',dept:''})
  const s=(k,v)=>setF(x=>({...x,[k]:v}))
  const [err,setErr]=useState(''), [ok,setOk]=useState(''), [loading,setLoading]=useState(false)

  const submit = async e => {
    e.preventDefault(); setErr(''); setOk('')
    if(f.p!==f.c){setErr('Passwords do not match');return}
    if(f.p.length<4){setErr('Password must be at least 4 characters');return}
    if(f.u.length<3){setErr('Username must be at least 3 characters');return}
    setLoading(true)
    try {
      await api.post('/system/register', {
        username: f.u.trim().toLowerCase(),
        password: f.p,
        full_name: f.name.trim(),
        roll_number: f.roll.trim(),
        department: f.dept,
      })
      setOk(`✓ Account "${f.u}" created! Switching to sign in...`)
      setTimeout(onDone, 1800)
    } catch(ex) {
      setErr(ex.response?.data?.error || 'Registration failed.')
    }
    setLoading(false)
  }

  return (
    <form onSubmit={submit}>
      <Row label="Username *"><Inp type="email" ph="yourname@kec.edu" val={f.u} set={v=>s('u',v)} req/></Row>
      <Row label="Full name"><Inp ph="e.g. John Doe" val={f.name} set={v=>s('name',v)}/></Row>
      <Row label="Roll number"><Inp ph="e.g. 22CS001" val={f.roll} set={v=>s('roll',v)}/></Row>
      <Row label="Department">
        <select value={f.dept} onChange={e=>s('dept',e.target.value)}
          style={{width:'100%',height:38,padding:'0 10px',background:'var(--bg)',
            border:'0.5px solid var(--border2)',borderRadius:'var(--r)',fontSize:14,
            color:f.dept?'var(--txt)':'var(--txt3)',outline:'none',fontFamily:'inherit'}}>
          <option value="">Select department</option>
          {DEPTS.map(d=><option key={d} value={d}>{d}</option>)}
        </select>
      </Row>
      <Row label="Password *"><Inp ph="Min 4 characters" val={f.p} set={v=>s('p',v)} req pw/></Row>
      <Row label="Confirm password *"><Inp ph="Re-enter password" val={f.c} set={v=>s('c',v)} req pw/></Row>
      <Err msg={err}/><Ok msg={ok}/>
      <button type="submit" disabled={loading} className="login-btn" style={{marginTop:4}}>
        {loading ? <Spin/> : 'Create account →'}
      </button>
    </form>
  )
}

/* ── Active session screen ── */
function SessionScreen({user, sessionId, onLogout}) {
  const [secs, setSecs] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(()=>{
    const id = setInterval(()=>setSecs(s=>s+1), 1000)
    // heartbeat every 60s to keep session alive
    const hb = setInterval(async()=>{
      try { await api.post('/system/heartbeat', {session_id: sessionId}) } catch{}
    }, 60000)
    return ()=>{ clearInterval(id); clearInterval(hb) }
  }, [sessionId])

  const fmt = s => {
    const h=Math.floor(s/3600), m=Math.floor(s%3600/60), sc=s%60
    return h>0 ? `${h}h ${m}m ${sc}s` : `${m}m ${sc}s`
  }

  const doLogout = async () => {
    if(!confirm('Log out from your lab session?')) return
    setLoading(true)
    try {
      await api.post('/system/logout', {session_id: sessionId})
    } catch{}
    setLoading(false)
    onLogout()
  }

  return (
    <div style={{textAlign:'center',padding:'10px 0'}}>
      {/* success icon */}
      <div style={{width:52,height:52,borderRadius:'50%',background:'var(--green-bg)',
        border:'0.5px solid var(--green-b)',display:'flex',alignItems:'center',
        justifyContent:'center',margin:'0 auto 14px'}}>
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
          <path d="M20 6L9 17l-5-5" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      <div style={{fontWeight:500,fontSize:17,color:'var(--txt)',marginBottom:3,letterSpacing:'-0.3px'}}>
        Welcome, {user.full_name || user.username}!
      </div>
      <div style={{fontSize:12,color:'var(--txt3)',marginBottom:16}}>Session active · being tracked in admin dashboard</div>

      {/* timer */}
      <div style={{fontFamily:'monospace',fontSize:30,fontWeight:500,color:'var(--txt)',
        letterSpacing:2,marginBottom:16,padding:'12px',background:'var(--bg2)',
        border:'0.5px solid var(--border)',borderRadius:'var(--r)'}}>{fmt(secs)}</div>

      {/* info chips */}
      <div style={{display:'flex',gap:8,justifyContent:'center',marginBottom:16,flexWrap:'wrap'}}>
        <span style={{padding:'4px 10px',borderRadius:4,background:'var(--bg2)',
          border:'0.5px solid var(--border)',fontSize:12,color:'var(--txt3)'}}>
          Lab: <strong style={{color:'var(--txt)'}}>{user.lab_access==='all'?'All labs':(user.lab_access||'').toUpperCase()}</strong>
        </span>
        <span style={{padding:'4px 10px',borderRadius:4,background:'var(--blue-bg)',
          border:'0.5px solid var(--blue-b)',fontSize:12,color:'var(--blue)'}}>
          ● Live
        </span>
      </div>

      <div style={{marginBottom:16,fontSize:12,color:'var(--txt3)',lineHeight:1.7,
        padding:'10px 14px',background:'var(--amber-bg)',border:'0.5px solid var(--amber-b)',
        borderRadius:'var(--r)',textAlign:'left'}}>
        ⚠️ Idle 15 min → alert appears in dashboard<br/>
        🔒 Idle 50 min → session ends automatically
      </div>

      <button onClick={doLogout} disabled={loading}
        style={{width:'100%',height:40,background:'var(--red-bg)',color:'var(--red)',
          border:'0.5px solid var(--red-b)',borderRadius:'var(--r)',fontSize:13,
          fontWeight:500,fontFamily:'inherit',transition:'opacity .15s'}}>
        {loading ? <Spin/> : '⏻  Log out now'}
      </button>
    </div>
  )
}

/* ── Main ── */
export default function SystemLogin() {
  const [tab, setTab]         = useState('login')
  const [session, setSession] = useState(null)   // {user, sessionId}

  const handleLoginSuccess = data => {
    // Store token for API calls
    localStorage.setItem('kce_user_token', data.token)
    // Use user-specific token (not admin token)
    // Note: we don't store as kce_token to avoid admin auth conflicts
    setSession({ user: data, sessionId: data.session_id })
  }

  const handleLogout = () => {
    localStorage.removeItem('kce_user_token')
    setSession(null)
    setTab('login')
  }

  const labs = [
    ['CC1','Computer Centre 1','64 seats'],
    ['CC2','Computer Centre 2','88 seats'],
    ['CTS','Cognizant Technologies Solutions','60 seats'],
  ]

  return (
    <div className="login-wrap">
      {/* LEFT */}
      <div className="login-left">
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:44}}>
          <div style={{width:32,height:32,borderRadius:8,background:'var(--txt)',
            display:'flex',alignItems:'center',justifyContent:'center'}}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
              <rect x="2" y="3" width="20" height="14" rx="2" stroke="white" strokeWidth="2"/>
              <path d="M8 21h8M12 17v4" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div style={{fontWeight:600,fontSize:13,color:'var(--txt)'}}>KEC Lab Tracker</div>
            <div style={{fontSize:11,color:'var(--txt3)',marginTop:1}}>Student Portal</div>
          </div>
        </div>

        <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'center',maxWidth:440}}>
          <h1 style={{fontSize:28,fontWeight:500,color:'var(--txt)',letterSpacing:'-0.5px',lineHeight:1.25,marginBottom:12}}>
            Lab Access<br/>Student Portal
          </h1>
          <p style={{fontSize:13,color:'var(--txt2)',lineHeight:1.7,marginBottom:28}}>
            Sign in with your credentials. Every login is tracked in real-time on the admin dashboard.
          </p>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {labs.map(([name,full,seats])=>(
              <div key={name} style={{display:'flex',alignItems:'center',gap:12,
                padding:'10px 14px',background:'var(--bg)',
                border:'0.5px solid var(--border)',borderRadius:'var(--r)'}}>
                <div style={{width:7,height:7,borderRadius:'50%',background:'var(--txt3)',flexShrink:0}}/>
                <div>
                  <div style={{fontSize:13,fontWeight:500,color:'var(--txt)'}}>{name}</div>
                  <div style={{fontSize:12,color:'var(--txt3)',marginTop:1}}>{full} · {seats}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{fontSize:11,color:'var(--txt3)'}}>CC1 · CC2 · CTS — 212 seats total</div>
      </div>

      {/* RIGHT */}
      <div className="login-right">
        <div style={{width:'100%',maxWidth:340}}>

          {session ? (
            <SessionScreen
              user={session.user}
              sessionId={session.sessionId}
              onLogout={handleLogout}
            />
          ) : (
            <>
              <div style={{display:'inline-flex',alignItems:'center',gap:6,padding:'4px 10px',
                borderRadius:4,marginBottom:20,background:'var(--green-bg)',border:'0.5px solid var(--green-b)'}}>
                <span className="pulse"/>
                <span style={{fontSize:11,fontWeight:500,color:'var(--green)'}}>System online</span>
              </div>

              {/* Tab switcher */}
              <div style={{display:'flex',background:'var(--bg2)',border:'0.5px solid var(--border)',
                borderRadius:'var(--r)',padding:3,marginBottom:20,gap:2}}>
                {[['login','Sign in'],['register','Create account']].map(([id,label])=>(
                  <button key={id} type="button" onClick={()=>setTab(id)}
                    style={{flex:1,height:32,fontSize:13,fontWeight:tab===id?500:400,
                      borderRadius:6,border:'none',transition:'all .15s',
                      background:tab===id?'var(--bg)':'transparent',
                      color:tab===id?'var(--txt)':'var(--txt3)',
                      boxShadow:tab===id?'0 1px 3px rgba(0,0,0,0.08)':'none'}}>
                    {label}
                  </button>
                ))}
              </div>

              {tab==='login' ? (
                <>
                  <h2 style={{fontSize:20,fontWeight:500,color:'var(--txt)',marginBottom:4,letterSpacing:'-0.3px'}}>Sign in</h2>
                  <p style={{fontSize:13,color:'var(--txt3)',marginBottom:18}}>Access any KEC lab</p>
                  <LoginPanel onSuccess={handleLoginSuccess} onSwitch={()=>setTab('register')}/>
                </>
              ) : (
                <>
                  <h2 style={{fontSize:20,fontWeight:500,color:'var(--txt)',marginBottom:4,letterSpacing:'-0.3px'}}>Create account</h2>
                  <p style={{fontSize:13,color:'var(--txt3)',marginBottom:18}}>Register as a new KEC student</p>
                  <RegisterPanel onDone={()=>setTab('login')}/>
                </>
              )}

              <div style={{marginTop:16,textAlign:'center',fontSize:11,color:'var(--txt3)'}}>
                Developed by Logesh · Cognentrz
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
