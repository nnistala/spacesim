import { useUIStore } from '../stores/uiStore'
import { useTimeStore } from '../stores/timeStore'

// Speed presets multiply the baseline sim clock (TIME_SCALE = 100 sim-s/real-s).
const PRESETS = [
  { label: '0.1×', value: 0.1 },
  { label: '1×', value: 1 },
  { label: '10×', value: 10 },
  { label: '100×', value: 100 },
  { label: '1000×', value: 1000 },
]

export default function TimePanel() {
  const open = useUIStore((s) => s.timeOpen)
  const multiplier = useTimeStore((s) => s.multiplier)
  const paused = useTimeStore((s) => s.paused)
  const setMultiplier = useTimeStore((s) => s.setMultiplier)
  const togglePause = useTimeStore((s) => s.togglePause)

  if (!open) return null

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 96,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        background: 'rgba(4, 10, 20, 0.82)',
        backdropFilter: 'blur(14px)',
        border: '1px solid rgba(0, 136, 255, 0.35)',
        borderRadius: 12,
        boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
        padding: '14px 18px',
        zIndex: 200,
        pointerEvents: 'auto',
        fontFamily: "'Exo 2', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'rgba(0, 136, 255, 0.8)',
          fontFamily: "'Orbitron', monospace",
          textAlign: 'center',
        }}
      >
        Time Control
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button
          onClick={(e) => {
            togglePause()
            e.currentTarget.blur()
          }}
          style={{
            background: paused ? 'rgba(0,136,255,0.3)' : 'rgba(0,0,0,0.4)',
            border: '1px solid rgba(0,136,255,0.4)',
            borderRadius: 8,
            padding: '8px 14px',
            color: '#fff',
            fontSize: 14,
            cursor: 'pointer',
            minWidth: 44,
            fontFamily: "'Orbitron', monospace",
          }}
        >
          {paused ? '▶' : '❚❚'}
        </button>

        {PRESETS.map((p) => {
          const active = !paused && multiplier === p.value
          return (
            <button
              key={p.label}
              onClick={(e) => {
                setMultiplier(p.value)
                e.currentTarget.blur()
              }}
              style={{
                background: active ? 'rgba(0,136,255,0.35)' : 'rgba(0,0,0,0.4)',
                border: `1px solid ${active ? 'rgba(0,180,255,0.8)' : 'rgba(0,136,255,0.3)'}`,
                borderRadius: 8,
                padding: '8px 12px',
                color: active ? '#fff' : 'rgba(255,255,255,0.75)',
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: "'Orbitron', monospace",
              }}
            >
              {p.label}
            </button>
          )
        })}
      </div>

      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
        {paused ? 'Paused' : `${multiplier}× speed — planets & satellites in motion`}
      </div>
    </div>
  )
}
