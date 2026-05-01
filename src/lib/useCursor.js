import { useEffect, useRef } from 'react'

/**
 * useCursor — injects the custom dot+ring cursor into any page.
 * Call once at the top of any component (Login, SystemLogin, Layout).
 * Cleans up on unmount automatically.
 */
export function useCursor() {
  const dot    = useRef(null)
  const ring   = useRef(null)
  const mouseX = useRef(-300)
  const mouseY = useRef(-300)
  const ringX  = useRef(-300)
  const ringY  = useRef(-300)
  const raf    = useRef(null)
  const hover  = useRef(false)

  useEffect(() => {
    // Create elements
    const dotEl = document.createElement('div')
    dotEl.id = 'kce-cursor-dot'
    Object.assign(dotEl.style, {
      position: 'fixed', top: 0, left: 0,
      width: '8px', height: '8px',
      borderRadius: '50%', background: '#1a1917',
      pointerEvents: 'none', zIndex: '999999',
      marginLeft: '-4px', marginTop: '-4px',
      transform: 'translate(-300px,-300px)',
      willChange: 'transform',
    })

    const ringEl = document.createElement('div')
    ringEl.id = 'kce-cursor-ring'
    Object.assign(ringEl.style, {
      position: 'fixed', top: 0, left: 0,
      width: '28px', height: '28px',
      borderRadius: '50%', border: '1.5px solid rgba(0,0,0,0.22)',
      background: 'transparent',
      pointerEvents: 'none', zIndex: '999998',
      marginLeft: '-14px', marginTop: '-14px',
      transform: 'translate(-300px,-300px)',
      willChange: 'transform',
      transition: 'width .18s ease, height .18s ease, border-color .18s ease, background .18s ease',
    })

    // Remove any existing cursors first
    document.getElementById('kce-cursor-dot')?.remove()
    document.getElementById('kce-cursor-ring')?.remove()

    document.body.appendChild(dotEl)
    document.body.appendChild(ringEl)
    dot.current  = dotEl
    ring.current = ringEl

    // Hide native cursor on everything
    const styleEl = document.createElement('style')
    styleEl.id = 'kce-cursor-style'
    styleEl.textContent = '*,*::before,*::after{cursor:none!important}'
    document.getElementById('kce-cursor-style')?.remove()
    document.head.appendChild(styleEl)

    // Event handlers
    const onMove = e => {
      mouseX.current = e.clientX
      mouseY.current = e.clientY
      dotEl.style.transform = `translate(${e.clientX}px,${e.clientY}px)`
    }

    const onOver = e => {
      const el = e.target.closest('button,a,input,select,textarea,[role="button"],label')
      if (el && !hover.current) {
        hover.current = true
        Object.assign(ringEl.style, {
          width: '40px', height: '40px',
          borderColor: 'rgba(0,0,0,0.38)',
          background: 'rgba(0,0,0,0.04)',
        })
      } else if (!el && hover.current) {
        hover.current = false
        Object.assign(ringEl.style, {
          width: '28px', height: '28px',
          borderColor: 'rgba(0,0,0,0.22)',
          background: 'transparent',
        })
      }
    }

    const onDown = () => {
      Object.assign(ringEl.style, { width: '20px', height: '20px' })
    }
    const onUp = () => {
      Object.assign(ringEl.style, {
        width: hover.current ? '40px' : '28px',
        height: hover.current ? '40px' : '28px',
      })
    }

    // RAF loop for smooth ring trailing
    const animate = () => {
      ringX.current += (mouseX.current - ringX.current) * 0.13
      ringY.current += (mouseY.current - ringY.current) * 0.13
      ringEl.style.transform = `translate(${ringX.current}px,${ringY.current}px)`
      raf.current = requestAnimationFrame(animate)
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('mouseover', onOver, { passive: true })
    window.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup',   onUp)
    raf.current = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseover', onOver)
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('mouseup',   onUp)
      cancelAnimationFrame(raf.current)
      dotEl.remove()
      ringEl.remove()
      document.getElementById('kce-cursor-style')?.remove()
    }
  }, [])
}
