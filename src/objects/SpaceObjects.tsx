import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { KM_PER_UNIT } from '../data/scaleConfig'
import { getTimeScale } from '../stores/timeStore'
import { ORBITERS, SURFACE_OBJECTS, MODEL_RADII } from '../data/spaceObjects'
import { useProximityStore, proximityBodies } from '../stores/proximityStore'

const DEG = Math.PI / 180

// Label visibility ranges (camera distance, render units) per kind.
const LABEL_RANGE = { station: 8, satellite: 8, flag: 5, rover: 5 } as const

/**
 * All human-made objects (orbiting stations/satellites) and surface markers
 * (Apollo flags, Mars rovers). Rendered as additive point-glints whose world
 * positions are recomputed each frame from their parent body's live position.
 */
export default function SpaceObjects() {
  const pointsRef = useRef<THREE.Points>(null)
  const simTimeRef = useRef(0)

  const count = ORBITERS.length + SURFACE_OBJECTS.length

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const all = [...ORBITERS, ...SURFACE_OBJECTS]
    all.forEach((o, i) => {
      colors[i * 3] = o.color[0]
      colors[i * 3 + 1] = o.color[1]
      colors[i * 3 + 2] = o.color[2]
    })
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return geo
  }, [count])

  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 4,
        sizeAttenuation: false,
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  )

  // Register every object with the proximity system (labels + search + fly-to).
  useEffect(() => {
    const store = useProximityStore.getState()
    for (const o of ORBITERS) {
      store.registerBody({
        id: o.id,
        name: o.name,
        position: [0, 0, 0],
        radius: MODEL_RADII[o.kind],
        kind: o.kind,
        labelRange: LABEL_RANGE[o.kind],
      })
    }
    for (const s of SURFACE_OBJECTS) {
      store.registerBody({
        id: s.id,
        name: s.name,
        position: [0, 0, 0],
        radius: MODEL_RADII[s.kind],
        kind: s.kind,
        labelRange: LABEL_RANGE[s.kind],
      })
    }
    return () => {
      for (const o of ORBITERS) store.unregisterBody(o.id)
      for (const s of SURFACE_OBJECTS) store.unregisterBody(s.id)
    }
  }, [])

  useFrame((_state, delta) => {
    // Accumulate adjustable sim-time (respects time-warp + pause) so changing
    // the speed never makes orbiters jump.
    simTimeRef.current += Math.min(delta, 0.1) * getTimeScale()
    const t = simTimeRef.current
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute
    const arr = posAttr.array as Float32Array

    let i = 0
    const write = (id: string, x: number, y: number, z: number) => {
      arr[i * 3] = x
      arr[i * 3 + 1] = y
      arr[i * 3 + 2] = z
      const body = proximityBodies.get(id)
      if (body) {
        body.position[0] = x
        body.position[1] = y
        body.position[2] = z
      }
      i++
    }

    // --- Orbiters ---
    for (const o of ORBITERS) {
      const parent = proximityBodies.get(o.parent)
      if (!parent) {
        write(o.id, 1e9, 1e9, 1e9) // park off-scene until parent exists
        continue
      }
      const r = parent.radius + o.altitudeKm / KM_PER_UNIT
      // t is accumulated sim-seconds; period is in hours.
      const ang = o.phaseDeg * DEG + (2 * Math.PI * t) / (o.periodHours * 3600)
      const incl = o.inclinationDeg * DEG
      const x = Math.cos(ang) * r
      const zr = Math.sin(ang) * r
      const y = zr * Math.sin(incl)
      const z = zr * Math.cos(incl)
      write(o.id, parent.position[0] + x, parent.position[1] + y, parent.position[2] + z)
    }

    // --- Surface markers (co-rotate with the parent's spin) ---
    for (const s of SURFACE_OBJECTS) {
      const parent = proximityBodies.get(s.parent)
      if (!parent) {
        write(s.id, 1e9, 1e9, 1e9)
        continue
      }
      const spin = (2 * Math.PI * t) / (s.parentSpinHours * 3600)
      const lat = s.latDeg * DEG
      const lon = s.lonDeg * DEG + spin
      const cl = Math.cos(lat)
      const dx = cl * Math.cos(lon)
      const dy = Math.sin(lat)
      const dz = cl * Math.sin(lon)
      // Exactly on the surface — the 3D models are anchored at their base so
      // they SIT on it (a lift here left them hovering above the surface).
      const rr = parent.radius
      write(s.id, parent.position[0] + dx * rr, parent.position[1] + dy * rr, parent.position[2] + dz * rr)
    }

    posAttr.needsUpdate = true
  })

  return <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />
}
