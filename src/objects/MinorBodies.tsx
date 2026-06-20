import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

import { auToRenderUnits } from '../data/scaleConfig'
import { useProximityStore } from '../stores/proximityStore'

// ===========================================================================
// MINOR BODIES — the asteroid belt + comets ("tail stars")
// ===========================================================================

function gaussian(sigma: number): number {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

// --- Asteroid belt: a faint dusty ring between Mars and Jupiter (~2.1–3.3 AU)
function buildBelt(count: number): THREE.BufferGeometry {
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const inner = auToRenderUnits(2.1)
  const outer = auToRenderUnits(3.3)
  for (let i = 0; i < count; i++) {
    const rad = inner + Math.random() * (outer - inner)
    const ang = Math.random() * Math.PI * 2
    positions[i * 3] = Math.cos(ang) * rad
    positions[i * 3 + 1] = gaussian((outer - inner) * 0.05)
    positions[i * 3 + 2] = Math.sin(ang) * rad
    const b = 0.3 + Math.random() * 0.45
    colors[i * 3] = b * 0.62
    colors[i * 3 + 1] = b * 0.55
    colors[i * 3 + 2] = b * 0.46
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeBoundingSphere()
  return geo
}

// --- Comets: a bright head + a straight blue ion tail and a curved gold dust
// tail, both streaming AWAY from the Sun (at the origin).
interface CometDef {
  id: string
  name: string
  dir: [number, number, number]
  distanceAu: number
  tailLen: number
}
const COMETS: CometDef[] = [
  { id: 'comet-halley', name: 'Halley', dir: [0.5, 0.35, -0.79], distanceAu: 2.6, tailLen: 1500 },
  { id: 'comet-neowise', name: 'NEOWISE', dir: [-0.62, 0.5, 0.6], distanceAu: 3.4, tailLen: 2100 },
]

function buildComet(def: CometDef): { geo: THREE.BufferGeometry; center: THREE.Vector3 } {
  const head = new THREE.Vector3(...def.dir).normalize().multiplyScalar(auToRenderUnits(def.distanceAu))
  const away = head.clone().normalize()
  const perp = new THREE.Vector3().crossVectors(away, new THREE.Vector3(0, 1, 0)).normalize()
  const N = 900
  const positions = new Float32Array((N + 30) * 3)
  const colors = new Float32Array((N + 30) * 3)
  // Bright head cluster.
  for (let i = 0; i < 30; i++) {
    positions[i * 3] = head.x + gaussian(8)
    positions[i * 3 + 1] = head.y + gaussian(8)
    positions[i * 3 + 2] = head.z + gaussian(8)
    colors[i * 3] = 0.8
    colors[i * 3 + 1] = 0.95
    colors[i * 3 + 2] = 1.0
  }
  for (let i = 0; i < N; i++) {
    const t = i / N
    const fade = 1 - t
    const ion = Math.random() < 0.5
    const dist = t * def.tailLen
    if (ion) {
      // Straight, narrow blue ion tail.
      const p = head.clone().addScaledVector(away, dist)
      p.x += gaussian(20 + t * 40)
      p.y += gaussian(20 + t * 40)
      p.z += gaussian(20 + t * 40)
      const o = (30 + i) * 3
      positions[o] = p.x
      positions[o + 1] = p.y
      positions[o + 2] = p.z
      colors[o] = 0.45 * fade
      colors[o + 1] = 0.7 * fade
      colors[o + 2] = 1.0 * fade
    } else {
      // Broad, curved gold dust tail.
      const p = head.clone().addScaledVector(away, dist * 0.85).addScaledVector(perp, def.tailLen * 0.18 * t * t)
      p.x += gaussian(40 + t * 90)
      p.y += gaussian(40 + t * 90)
      p.z += gaussian(40 + t * 90)
      const o = (30 + i) * 3
      positions[o] = p.x
      positions[o + 1] = p.y
      positions[o + 2] = p.z
      colors[o] = 1.0 * fade
      colors[o + 1] = 0.85 * fade
      colors[o + 2] = 0.55 * fade
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeBoundingSphere()
  return { geo, center: head }
}

export default function MinorBodies() {
  const belt = useMemo(() => buildBelt(4000), [])
  const comets = useMemo(() => COMETS.map((def) => ({ def, ...buildComet(def) })), [])

  const beltMat = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 1.3,
        sizeAttenuation: false,
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      }),
    [],
  )
  const cometMat = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 2.0,
        sizeAttenuation: false,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  )

  useEffect(() => {
    const store = useProximityStore.getState()
    for (const c of comets) {
      store.registerBody({
        id: c.def.id,
        name: c.def.name,
        position: [c.center.x, c.center.y, c.center.z],
        radius: 60,
        kind: 'structure',
        labelRange: 4000,
      })
    }
    return () => {
      for (const c of comets) store.unregisterBody(c.def.id)
    }
  }, [comets])

  return (
    <group>
      <points geometry={belt} material={beltMat} frustumCulled={false} />
      {comets.map((c) => (
        <points key={c.def.id} geometry={c.geo} material={cometMat} frustumCulled={false} />
      ))}
    </group>
  )
}
