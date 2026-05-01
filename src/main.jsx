import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Global cursor — injected once, works on ALL pages
;(function() {
  const dot = document.createElement('div')
  dot.id = 'kce-dot'
  Object.assign(dot.style, {
    position:'fixed',top:0,left:0,width:'8px',height:'8px',borderRadius:'50%',
    background:'#1a1917',pointerEvents:'none',zIndex:'2147483647',
    marginLeft:'-4px',marginTop:'-4px',transform:'translate(-300px,-300px)',willChange:'transform',
  })
  const ring = document.createElement('div')
  ring.id = 'kce-ring'
  Object.assign(ring.style, {
    position:'fixed',top:0,left:0,width:'28px',height:'28px',borderRadius:'50%',
    border:'1.5px solid rgba(0,0,0,0.22)',background:'transparent',
    pointerEvents:'none',zIndex:'2147483646',marginLeft:'-14px',marginTop:'-14px',
    transform:'translate(-300px,-300px)',willChange:'transform',
    transition:'width .18s,height .18s,border-color .18s,background .18s',
  })
  document.body.appendChild(dot)
  document.body.appendChild(ring)

  let mx=-300,my=-300,rx=-300,ry=-300,hov=false
  window.addEventListener('mousemove',e=>{
    mx=e.clientX;my=e.clientY
    dot.style.transform=`translate(${mx}px,${my}px)`
  },{passive:true})
  window.addEventListener('mouseover',e=>{
    const el=e.target.closest('button,a,input,select,textarea,[role="button"],label')
    if(el&&!hov){hov=true;Object.assign(ring.style,{width:'40px',height:'40px',borderColor:'rgba(0,0,0,0.38)',background:'rgba(0,0,0,0.04)'})}
    else if(!el&&hov){hov=false;Object.assign(ring.style,{width:'28px',height:'28px',borderColor:'rgba(0,0,0,0.22)',background:'transparent'})}
  },{passive:true})
  window.addEventListener('mousedown',()=>Object.assign(ring.style,{width:'18px',height:'18px'}))
  window.addEventListener('mouseup',()=>Object.assign(ring.style,{width:hov?'40px':'28px',height:hov?'40px':'28px'}))
  ;(function loop(){rx+=(mx-rx)*0.13;ry+=(my-ry)*0.13;ring.style.transform=`translate(${rx}px,${ry}px)`;requestAnimationFrame(loop)})()
})()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
)
