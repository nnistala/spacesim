import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { proximityBodies } from '../stores/proximityStore'
import { useProximityStore } from '../stores/proximityStore'
import { formatRealDistance, type BodyKind } from '../data/scaleConfig'

const KIND_ICON: Partial<Record<BodyKind, string>> = {
  station: '🛰 ',
  satellite: '📡 ',
  rover: '🤖 ',
  flag: '🚩 ',
  galaxy: '🌌 ',
  structure: '✦ ',
}

interface MarkerProps {
  id: string
  name: string
  kind: BodyKind
}

// How far (in body radii) a label stays visible when no explicit range is set.
// An object roughly stops being visible once it shrinks past this, so its
// label gates on its own apparent size.
const DEFAULT_SHOW_FACTOR = 700

function Marker({ id, name, kind }: MarkerProps) {
  const groupRef = useRef<THREE.Group>(null)
  const innerRef = useRef<THREE.Group>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const camera = useThree((s) => s.camera)

  useFrame(() => {
    const body = proximityBodies.get(id)
    if (!body || !groupRef.current) return
    groupRef.current.position.set(body.position[0], body.position[1], body.position[2])
    // Float the label just above the body's north pole
    if (innerRef.current) innerRef.current.position.y = Math.max(body.radius * 1.15, 0.05)
    if (!contentRef.current) return

    // Show only while the object is reasonably visible; shrink the label as the
    // object recedes, then hide it entirely once it's too far/small.
    const dx = camera.position.x - body.position[0]
    const dy = camera.position.y - body.position[1]
    const dz = camera.position.z - body.position[2]
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
    const visibleRange = body.labelRange ?? body.radius * DEFAULT_SHOW_FACTOR
    if (dist > visibleRange) {
      contentRef.current.style.display = 'none'
    } else {
      const s = THREE.MathUtils.clamp(0.5 + (1 - dist / visibleRange) * 0.5, 0.5, 1)
      contentRef.current.style.display = 'flex'
      contentRef.current.style.transform = `translateY(-50%) scale(${s.toFixed(2)})`
    }
  })

  const nearest = useProximityStore((s) => s.nearest)
  const isNearest = nearest?.id === id
  const distanceLabel = isNearest && nearest ? formatRealDistance(nearest.distanceUnits) : null
  const displayName = `${KIND_ICON[kind] ?? ''}${name}`

  return (
    <group ref={groupRef}>
      <group ref={innerRef}>
        <Html
          center
          zIndexRange={[50, 0]}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          <div
            ref={contentRef}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              transform: 'translateY(-50%)',
              whiteSpace: 'nowrap',
            }}
          >
            <div
              style={{
                width: 1,
                height: 18,
                background: 'linear-gradient(to bottom, transparent, rgba(0,136,255,0.6))',
              }}
            />
            <div
              style={{
                fontFamily: "'Orbitron', monospace",
                fontSize: 11,
                letterSpacing: '0.14em',
                color: 'rgba(255,255,255,0.92)',
                textShadow: '0 0 6px rgba(0,136,255,0.6)',
                padding: '2px 8px',
                border: '1px solid rgba(0,136,255,0.35)',
                borderRadius: 4,
                background: 'rgba(0,0,0,0.35)',
                backdropFilter: 'blur(4px)',
              }}
            >
              {displayName.toUpperCase()}
            </div>
            {distanceLabel && (
              <div
                style={{
                  marginTop: 3,
                  fontFamily: "'Exo 2', sans-serif",
                  fontSize: 10,
                  color: 'rgba(0,180,255,0.85)',
                  textShadow: '0 0 4px rgba(0,0,0,0.8)',
                }}
              >
                {distanceLabel}
              </div>
            )}
          </div>
        </Html>
      </group>
    </group>
  )
}

export default function ObjectLabels() {
  // Reactively render a marker for every body registered with the proximity
  // system (Sun, planets, moons) — no hardcoded list to maintain.
  const bodyList = useProximityStore((s) => s.bodyList)
  return (
    <>
      {bodyList
        .filter((b) => !b.noLabel)
        .map((b) => (
          <Marker key={b.id} id={b.id} name={b.name} kind={b.kind} />
        ))}
    </>
  )
}
