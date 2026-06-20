import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { MOONS } from '../data/moons'
import { getTimeScale } from '../stores/timeStore'
import { useProximityStore, proximityBodies } from '../stores/proximityStore'

const DEG = Math.PI / 180
// Sim-seconds per real day of orbital period — tuned so inner moons sweep round
// in a readable ~10–15s while preserving real period ratios.
const DAY_TO_SIM = 800

// Sun-lit lambert shader: lights by DIRECTION to the Sun (at the origin), so it
// works at any heliocentric distance (a point light's 1/d² falloff would leave
// the outer moons black). Faint ambient keeps the night side from pure black.
const MOON_VERT = /* glsl */ `
  varying vec3 vN;
  varying vec3 vWorld;
  void main() {
    vN = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`
const MOON_FRAG = /* glsl */ `
  uniform vec3 uColor;
  varying vec3 vN;
  varying vec3 vWorld;
  void main() {
    vec3 sunDir = normalize(-vWorld); // Sun sits at the origin
    float diff = max(dot(normalize(vN), sunDir), 0.0);
    vec3 col = uColor * (0.05 + 0.95 * diff);
    gl_FragColor = vec4(col, 1.0);
  }
`

interface MoonItem {
  id: string
  parent: string
  radiusUnits: number
  orbitUnits: number
  rate: number
  incl: number
  phase: number
  material: THREE.ShaderMaterial
}

export default function Moons() {
  const groupsRef = useRef<(THREE.Group | null)[]>([])
  const simTimeRef = useRef(0)

  const items = useMemo<MoonItem[]>(
    () =>
      MOONS.map((m) => ({
        id: m.id,
        parent: m.parent,
        radiusUnits: m.radiusUnits,
        orbitUnits: m.orbitUnits,
        rate: ((2 * Math.PI) / (Math.abs(m.periodDays) * DAY_TO_SIM)) * Math.sign(m.periodDays),
        incl: m.inclinationDeg * DEG,
        phase: m.phaseDeg * DEG,
        material: new THREE.ShaderMaterial({
          vertexShader: MOON_VERT,
          fragmentShader: MOON_FRAG,
          uniforms: { uColor: { value: new THREE.Color(m.color) } },
        }),
      })),
    [],
  )

  // Register for search / labels / fly-to.
  useEffect(() => {
    const store = useProximityStore.getState()
    for (const m of MOONS) {
      store.registerBody({
        id: m.id,
        name: m.name,
        position: [0, 0, 0],
        radius: m.radiusUnits,
        kind: 'moon',
        labelRange: Math.max(m.radiusUnits * 140, m.orbitUnits * 2.5),
      })
    }
    return () => {
      for (const m of MOONS) store.unregisterBody(m.id)
    }
  }, [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    simTimeRef.current += dt * getTimeScale()
    const t = simTimeRef.current
    for (let i = 0; i < items.length; i++) {
      const g = groupsRef.current[i]
      if (!g) continue
      const m = items[i]
      const parent = proximityBodies.get(m.parent)
      if (!parent) {
        g.visible = false
        continue
      }
      g.visible = true
      const ang = m.phase + t * m.rate
      const x = Math.cos(ang) * m.orbitUnits
      const zr = Math.sin(ang) * m.orbitUnits
      const y = zr * Math.sin(m.incl)
      const z = zr * Math.cos(m.incl)
      const px = parent.position[0] + x
      const py = parent.position[1] + y
      const pz = parent.position[2] + z
      g.position.set(px, py, pz)
      g.rotation.y += dt * 0.05 // gentle spin
      const body = proximityBodies.get(m.id)
      if (body) {
        body.position[0] = px
        body.position[1] = py
        body.position[2] = pz
      }
    }
  })

  return (
    <>
      {items.map((m, i) => (
        <group key={m.id} ref={(el) => (groupsRef.current[i] = el)}>
          <mesh material={m.material}>
            <sphereGeometry args={[m.radiusUnits, 32, 24]} />
          </mesh>
        </group>
      ))}
    </>
  )
}
