import { useEffect, useMemo, useRef } from 'react'
import { useUIStore } from '../stores/uiStore'
import { useProximityStore } from '../stores/proximityStore'
import { useNavigationStore } from '../stores/navigationStore'
import type { BodyKind } from '../data/scaleConfig'

const KIND_META: Record<BodyKind, { label: string; icon: string; order: number }> = {
  star: { label: 'Star', icon: '☀', order: 0 },
  planet: { label: 'Planet', icon: '🪐', order: 1 },
  moon: { label: 'Moon', icon: '🌙', order: 2 },
  station: { label: 'Space Station', icon: '🛰', order: 3 },
  satellite: { label: 'Satellite', icon: '📡', order: 4 },
  rover: { label: 'Rover', icon: '🤖', order: 5 },
  flag: { label: 'Landing Site', icon: '🚩', order: 6 },
  galaxy: { label: 'Galaxy', icon: '🌌', order: 7 },
  structure: { label: 'Cosmic Structure', icon: '✦', order: 8 },
}

export default function SearchPanel() {
  const open = useUIStore((s) => s.searchOpen)
  const setOpen = useUIStore((s) => s.setSearchOpen)
  const toggle = useUIStore((s) => s.toggleSearch)
  const query = useUIStore((s) => s.searchQuery)
  const setQuery = useUIStore((s) => s.setSearchQuery)
  const bodyList = useProximityStore((s) => s.bodyList)
  const setWarpTarget = useNavigationStore((s) => s.setWarpTarget)
  const inputRef = useRef<HTMLInputElement>(null)

  // Global key: "/" opens search, Escape closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing =
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      if (e.key === '/' && !typing) {
        e.preventDefault()
        toggle()
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle, setOpen])

  useEffect(() => {
    if (open) {
      // Release pointer lock so the cursor is usable.
      document.exitPointerLock?.()
      // Auto-focus only on desktop. On touch devices, focusing immediately pops
      // the on-screen keyboard before the user even taps the field — let them
      // tap the box themselves.
      const isTouch = window.matchMedia('(pointer: coarse)').matches
      if (!isTouch) requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matched = bodyList.filter((b) => !q || b.name.toLowerCase().includes(q))
    return [...matched].sort((a, b) => {
      const ko = KIND_META[a.kind].order - KIND_META[b.kind].order
      return ko !== 0 ? ko : a.name.localeCompare(b.name)
    })
  }, [bodyList, query])

  if (!open) return null

  const goTo = (id: string) => {
    setWarpTarget(id)
    setQuery('')
    setOpen(false)
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(440px, 92vw)',
        maxHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(4, 10, 20, 0.82)',
        backdropFilter: 'blur(14px)',
        border: '1px solid rgba(0, 136, 255, 0.35)',
        borderRadius: 12,
        boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
        zIndex: 200,
        pointerEvents: 'auto',
        overflow: 'hidden',
        fontFamily: "'Exo 2', system-ui, sans-serif",
      }}
    >
      <div style={{ padding: 12, borderBottom: '1px solid rgba(0,136,255,0.18)' }}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results.length > 0) goTo(results[0].id)
          }}
          placeholder="Search the universe…  (planets, moons, stations, rovers)"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            background: 'rgba(0,0,0,0.4)',
            border: '1px solid rgba(0,136,255,0.3)',
            borderRadius: 8,
            padding: '10px 14px',
            color: '#fff',
            fontSize: 15,
            outline: 'none',
            fontFamily: "'Exo 2', system-ui, sans-serif",
          }}
        />
      </div>

      <div style={{ overflowY: 'auto', padding: '6px 0' }}>
        {results.length === 0 && (
          <div style={{ padding: '16px 18px', color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
            No matches.
          </div>
        )}
        {results.map((b) => {
          const meta = KIND_META[b.kind]
          return (
            <button
              key={b.id}
              onClick={() => goTo(b.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 18px',
                background: 'transparent',
                border: 'none',
                borderLeft: '2px solid transparent',
                color: 'rgba(255,255,255,0.92)',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: 14,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0,136,255,0.15)'
                e.currentTarget.style.borderLeftColor = 'rgba(0,180,255,0.8)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.borderLeftColor = 'transparent'
              }}
            >
              <span style={{ fontSize: 18, width: 22, textAlign: 'center' }}>{meta.icon}</span>
              <span style={{ flex: 1, fontWeight: 500 }}>{b.name}</span>
              <span
                style={{
                  fontSize: 10,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'rgba(0,160,255,0.7)',
                  fontFamily: "'Orbitron', monospace",
                }}
              >
                {meta.label}
              </span>
            </button>
          )
        })}
      </div>

      <div
        style={{
          padding: '8px 18px',
          borderTop: '1px solid rgba(0,136,255,0.18)',
          fontSize: 11,
          color: 'rgba(255,255,255,0.4)',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>↵ fly to first result</span>
        <span>Esc to close</span>
      </div>
    </div>
  )
}
