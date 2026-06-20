import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { lyToRenderUnits } from '../data/cosmicScale'
import { useProximityStore } from '../stores/proximityStore'

// ===========================================================================
// BLACK HOLE — a stellar-mass black hole (Cygnus X-1) with a blazing accretion
// disk and relativistic jets. Beautiful and genuinely menacing.
// ---------------------------------------------------------------------------
// Event horizon: a pure-black sphere that occludes everything behind it.
// Accretion disk: a hot, rotating ring of plasma — white-blue (hottest) inner →
// orange → red outer. Photon ring: a thin searing rim hugging the horizon.
// Jets: twin blue-white beams along the spin axis. Real sky direction
// (Cygnus X-1, RA 19h58m, Dec +35.2°, ~7000 ly).
// ===========================================================================

const DIR: [number, number, number] = [0.4049, 0.5764, -0.7098]
const DISTANCE_LY = 7000
const HORIZON = 42
const DISK_INNER = 56
const DISK_OUTER = 190
const TILT: [number, number, number] = [1.15, 0.4, 0.0]

function gaussian(sigma: number): number {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

// Hot accretion-disk plasma: white-blue (inner, hottest) → orange → deep red.
const HOT = new THREE.Color(0.8, 0.9, 1.0)
const MID = new THREE.Color(1.0, 0.82, 0.45)
const COOL = new THREE.Color(1.0, 0.36, 0.16)

function buildDisk(count: number): THREE.BufferGeometry {
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const c = new THREE.Color()
  for (let i = 0; i < count; i++) {
    const t = Math.pow(Math.random(), 0.6) // denser toward the inner edge
    const r = DISK_INNER + t * (DISK_OUTER - DISK_INNER)
    const ang = Math.random() * Math.PI * 2
    positions[i * 3] = Math.cos(ang) * r
    positions[i * 3 + 1] = gaussian(2.2 + t * 4) // thin, flaring outward
    positions[i * 3 + 2] = Math.sin(ang) * r
    if (t < 0.5) c.copy(HOT).lerp(MID, t / 0.5)
    else c.copy(MID).lerp(COOL, (t - 0.5) / 0.5)
    const b = (1.0 - t * 0.5) * (0.6 + Math.random() * 0.4) // inner brighter
    colors[i * 3] = c.r * b
    colors[i * 3 + 1] = c.g * b
    colors[i * 3 + 2] = c.b * b
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeBoundingSphere()
  return geo
}

export default function BlackHole() {
  const center = useMemo(
    () => new THREE.Vector3(...DIR).normalize().multiplyScalar(lyToRenderUnits(DISTANCE_LY)),
    [],
  )
  const diskRef = useRef<THREE.Points>(null)
  const disk = useMemo(() => buildDisk(4500), [])
  const diskMat = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 2.4,
        sizeAttenuation: true,
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
    store.registerBody({
      id: 'cygnus-x1',
      name: 'Black Hole (Cygnus X-1)',
      position: [center.x, center.y, center.z],
      radius: DISK_OUTER,
      kind: 'structure',
      labelRange: DISK_OUTER * 14,
    })
    return () => store.unregisterBody('cygnus-x1')
  }, [center])

  useFrame((_, delta) => {
    if (diskRef.current) diskRef.current.rotation.y += Math.min(delta, 0.1) * 0.25
  })

  return (
    <group position={[center.x, center.y, center.z]} rotation={TILT}>
      {/* Event horizon — pure black, occludes everything behind it. */}
      <mesh>
        <sphereGeometry args={[HORIZON, 48, 48]} />
        <meshBasicMaterial color="#000000" toneMapped={false} />
      </mesh>
      {/* Photon ring — a thin searing rim hugging the horizon. */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[HORIZON * 1.06, HORIZON * 0.04, 16, 96]} />
        <meshBasicMaterial color="#ffd8a0" toneMapped={false} />
      </mesh>
      {/* Accretion disk. */}
      <points ref={diskRef} geometry={disk} material={diskMat} frustumCulled={false} />
      {/* Relativistic jets — twin beams along the spin axis. */}
      {[1, -1].map((s) => (
        <mesh key={s} position={[0, s * DISK_OUTER * 1.6, 0]} rotation={[s < 0 ? Math.PI : 0, 0, 0]}>
          <coneGeometry args={[10, DISK_OUTER * 3.2, 16, 1, true]} />
          <meshBasicMaterial
            color="#9cc8ff"
            transparent
            opacity={0.28}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  )
}
