import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { lyToRenderUnits } from '../data/cosmicScale'
import { BODY_RADII } from '../data/scaleConfig'
import { useProximityStore } from '../stores/proximityStore'

// ===========================================================================
// ALPHA CENTAURI — our nearest stellar neighbour (a real triple system)
// ---------------------------------------------------------------------------
// Alpha Centauri A (G2V, ~5790 K, white like our Sun), B (K1V, ~5260 K, amber)
// and Proxima Centauri (M5.5V, ~3040 K, red dwarf) at 4.37 ly. Placed at the
// system's true sky direction (RA 14h39.6m, Dec −60.83°) and the scale's
// log-compressed distance. Star SIZES are true-relative (R⊙ = BODY_RADII.sun);
// the A–B separation is stylised so both suns frame together. Each star is a
// blackbody-coloured core sphere wrapped in an additive limb-glow corona — the
// scene's Bloom pass turns them into searing points of light.
// ===========================================================================

const R_SUN = BODY_RADII.sun // render units per solar radius

// True-relative radii (× R⊙).
const A_RADIUS = 1.223 * R_SUN
const B_RADIUS = 0.863 * R_SUN
const PROXIMA_RADIUS = 0.154 * R_SUN

// Blackbody colours (white Sun convention — A is white, not yellow).
const A_COLOR = new THREE.Color('#fff6ec') // G2V
const B_COLOR = new THREE.Color('#ffcf8f') // K1V amber
const PROXIMA_COLOR = new THREE.Color('#ff6a3c') // M5.5V red

// Stylised local geometry (render units), so the system frames well on arrival.
const AB_SEPARATION = 620
const PROXIMA_OFFSET = new THREE.Vector3(240, 150, -1650)

// True sky direction of Alpha Centauri, equatorial → scene frame (y = up).
function skyDirection(): THREE.Vector3 {
  const raDeg = (14 + 39.6 / 60) * 15 // 14h39.6m
  const decDeg = -60.83
  const ra = raDeg * (Math.PI / 180)
  const dec = decDeg * (Math.PI / 180)
  // Equatorial cartesian (x→vernal equinox, z→celestial north)…
  const ex = Math.cos(dec) * Math.cos(ra)
  const ey = Math.cos(dec) * Math.sin(ra)
  const ez = Math.sin(dec)
  // …mapped to the scene's frame where +Y is up.
  return new THREE.Vector3(ex, ez, ey).normalize()
}

// ---- Additive limb-glow corona shader (frontside, brightest toward centre) --
const GLOW_VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`
const GLOW_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float d = max(dot(normalize(vNormal), normalize(vView)), 0.0);
    // Bright, soft core falloff toward the limb.
    float halo = pow(d, 2.2);
    gl_FragColor = vec4(uColor * uIntensity, halo);
  }
`

function Star({
  position,
  radius,
  color,
  glowIntensity = 1.4,
}: {
  position: [number, number, number]
  radius: number
  color: THREE.Color
  glowIntensity?: number
}) {
  const coreMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color,
        toneMapped: false, // let Bloom blow it out
      }),
    [color],
  )
  const glowMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: GLOW_VERT,
        fragmentShader: GLOW_FRAG,
        uniforms: {
          uColor: { value: color },
          uIntensity: { value: glowIntensity },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.FrontSide,
      }),
    [color, glowIntensity],
  )

  return (
    <group position={position}>
      <mesh material={coreMat}>
        <sphereGeometry args={[radius, 48, 48]} />
      </mesh>
      {/* Nested corona shells: a tight inner glow that fills the limb plus a
          broad soft halo, both additive so the core never reads hollow. */}
      <mesh material={glowMat} scale={1.22}>
        <sphereGeometry args={[radius, 32, 32]} />
      </mesh>
      <mesh material={glowMat} scale={1.9}>
        <sphereGeometry args={[radius, 32, 32]} />
      </mesh>
      <mesh material={glowMat} scale={3.0}>
        <sphereGeometry args={[radius, 32, 32]} />
      </mesh>
    </group>
  )
}

export default function AlphaCentauri() {
  const center = useMemo(() => skyDirection().multiplyScalar(lyToRenderUnits(4.37)), [])
  const groupRef = useRef<THREE.Group>(null)

  // A and B sit either side of the system barycentre; Proxima trails far out.
  const aPos = useMemo<[number, number, number]>(() => [-AB_SEPARATION / 2, 0, 0], [])
  const bPos = useMemo<[number, number, number]>(() => [AB_SEPARATION / 2, 0, 0], [])
  const pPos = useMemo<[number, number, number]>(
    () => [PROXIMA_OFFSET.x, PROXIMA_OFFSET.y, PROXIMA_OFFSET.z],
    [],
  )

  // Register for search + fly-to at world positions.
  useEffect(() => {
    const store = useProximityStore.getState()
    const abRadius = AB_SEPARATION / 2 + A_RADIUS // frames both suns
    store.registerBody({
      id: 'alpha-centauri',
      name: 'Alpha Centauri',
      position: [center.x, center.y, center.z],
      radius: abRadius,
      kind: 'star',
      labelRange: abRadius * 60,
    })
    store.registerBody({
      id: 'proxima-centauri',
      name: 'Proxima Centauri',
      position: [center.x + pPos[0], center.y + pPos[1], center.z + pPos[2]],
      radius: PROXIMA_RADIUS * 2.5,
      kind: 'star',
      labelRange: PROXIMA_RADIUS * 220,
    })
    return () => {
      store.unregisterBody('alpha-centauri')
      store.unregisterBody('proxima-centauri')
    }
  }, [center, pPos])

  // Gentle binary orbit of A and B about the barycentre — slow, cinematic.
  useFrame((state) => {
    const g = groupRef.current
    if (!g) return
    const t = state.clock.elapsedTime * 0.02
    const a = g.getObjectByName('alpha-a')
    const b = g.getObjectByName('alpha-b')
    if (a && b) {
      const r = AB_SEPARATION / 2
      a.position.set(Math.cos(t) * r, 0, Math.sin(t) * r * 0.4)
      b.position.set(-Math.cos(t) * r, 0, -Math.sin(t) * r * 0.4)
    }
  })

  return (
    <group ref={groupRef} position={[center.x, center.y, center.z]}>
      <group name="alpha-a" position={aPos}>
        <Star position={[0, 0, 0]} radius={A_RADIUS} color={A_COLOR} glowIntensity={1.5} />
      </group>
      <group name="alpha-b" position={bPos}>
        <Star position={[0, 0, 0]} radius={B_RADIUS} color={B_COLOR} glowIntensity={1.3} />
      </group>
      <Star position={pPos} radius={PROXIMA_RADIUS} color={PROXIMA_COLOR} glowIntensity={1.1} />
    </group>
  )
}
