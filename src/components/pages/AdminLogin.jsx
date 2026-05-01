import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { useNavigate } from 'react-router-dom'

export default function AdminLogin() {
  const navigate = useNavigate()
  const { login, isAuth } = useAuth()
  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [showPwd,    setShowPwd]    = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [focusEmail, setFocusEmail] = useState(false)
  const [focusPwd,   setFocusPwd]   = useState(false)

  useEffect(() => { if (isAuth) navigate('/') }, [isAuth])

  const submit = async e => {
    e.preventDefault(); setError(''); setLoading(true)
    try { await login(email.trim(), password); navigate('/') }
    catch (err) { setError(err.response?.data?.error || 'Invalid credentials') }
    setLoading(false)
  }

  const fill = () => { setEmail('Labadmin@kce.edu'); setPassword('Kec@2026'); setError('') }

  const inp = focused => ({
    width:'100%', height:38, padding:'0 12px',
    background:'var(--bg)', border:`0.5px solid ${focused?'var(--blue)':'var(--border2)'}`,
    borderRadius:'var(--r)', color:'var(--txt)', fontSize:14,
    outline:'none', fontFamily:'inherit',
    boxShadow: focused ? '0 0 0 3px rgba(37,99,235,0.08)' : 'none',
    transition:'border-color .12s, box-shadow .12s',
  })

  return (
    <div className="login-wrap">
      {/* LEFT */}
      <div className="login-left">
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:40}}>
          <div style={{width:32,height:32,borderRadius:8,background:'var(--txt)',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
              <rect x="2" y="3" width="20" height="14" rx="2" stroke="var(--bg)" strokeWidth="2"/>
              <path d="M8 21h8M12 17v4" stroke="var(--bg)" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div style={{fontWeight:600,fontSize:14,color:'var(--txt)'}}>KEC Lab Tracker</div>
            <div style={{fontSize:11,color:'var(--txt3)'}}>Cognentrz Platform</div>
          </div>
        </div>

        <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'center',maxWidth:460}}>
          <h1 style={{fontSize:28,fontWeight:500,color:'var(--txt)',letterSpacing:'-0.5px',lineHeight:1.2,marginBottom:12}}>
            Lab Utilization<br/>Command Centre
          </h1>
          <p style={{fontSize:14,color:'var(--txt2)',lineHeight:1.7,marginBottom:32}}>
            Real-time tracking across CC1, CC2 &amp; CTS labs. Monitor sessions, idle alerts and generate utilization reports.
          </p>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {[
              ['Real-time PC login tracking','Windows event log monitoring'],
              ['Session time analytics','Login · Logout · Duration'],
              ['15-min idle alerts','Auto-logout at 50 minutes'],
              ['Weekly · Monthly · Yearly CSV','One-click report export'],
            ].map(([t,s])=>(
              <div key={t} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',
                background:'var(--bg)',border:'0.5px solid var(--border)',borderRadius:'var(--r)'}}>
                <div style={{width:6,height:6,borderRadius:'50%',background:'var(--txt3)',flexShrink:0}}/>
                <div>
                  <div style={{fontSize:13,fontWeight:500,color:'var(--txt)'}}>{t}</div>
                  <div style={{fontSize:12,color:'var(--txt3)',marginTop:1}}>{s}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{fontSize:11,color:'var(--txt3)'}}>CC1 · CC2 · CTS — 212 seats total</div>
      </div>

      {/* RIGHT */}
      <div className="login-right">
        <div style={{width:'100%',maxWidth:320}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:6,padding:'4px 10px',
            borderRadius:4,marginBottom:24,background:'var(--green-bg)',border:'0.5px solid var(--green-b)'}}>
            <div className="pulse"/>
            <span style={{fontSize:11,fontWeight:500,color:'var(--green)'}}>System online</span>
          </div>

          <h2 style={{fontSize:20,fontWeight:500,color:'var(--txt)',marginBottom:4}}>Sign in</h2>
          <p style={{fontSize:13,color:'var(--txt3)',marginBottom:24}}>Admin dashboard access</p>

          <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:14}}>
            <div>
              <label style={{display:'block',fontSize:12,fontWeight:500,color:'var(--txt2)',marginBottom:6}}>Email</label>
              <input style={inp(focusEmail)} type="email" placeholder="Enter your email"
                value={email} onChange={e=>setEmail(e.target.value)} required
                onFocus={()=>setFocusEmail(true)} onBlur={()=>setFocusEmail(false)}/>
            </div>
            <div>
              <label style={{display:'block',fontSize:12,fontWeight:500,color:'var(--txt2)',marginBottom:6}}>Password</label>
              <div style={{position:'relative'}}>
                <input style={{...inp(focusPwd),paddingRight:36}}
                  type={showPwd?'text':'password'} placeholder="Enter your password"
                  value={password} onChange={e=>setPassword(e.target.value)} required
                  onFocus={()=>setFocusPwd(true)} onBlur={()=>setFocusPwd(false)}/>
                <button type="button" onClick={()=>setShowPwd(v=>!v)}
                  style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',
                    background:'none',border:'none',color:'var(--txt3)',display:'flex',padding:0}}>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="1.5"/>
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
                    {showPwd&&<line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>}
                  </svg>
                </button>
              </div>
            </div>
            {error&&(
              <div style={{padding:'8px 12px',borderRadius:'var(--r)',
                background:'var(--red-bg)',border:'0.5px solid var(--red-b)',color:'var(--red)',fontSize:13}}>
                {error}
              </div>
            )}
            <button type="submit" disabled={loading} className="login-btn" style={{marginTop:2}}>
              {loading
                ? <span style={{width:14,height:14,border:'1.5px solid rgba(255,255,255,0.3)',
                    borderTopColor:'var(--bg)',borderRadius:'50%',display:'inline-block',
                    animation:'spin 0.7s linear infinite'}}/>
                : 'Sign in →'}
            </button>
          </form>


          <div style={{marginTop:20,textAlign:'center',fontSize:11,color:'var(--txt3)'}}>
            Developed by Logesh · Cognentrz
          </div>
        </div>
      </div>
    </div>
  )
}