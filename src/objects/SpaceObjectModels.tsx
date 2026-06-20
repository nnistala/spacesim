import { Suspense, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

import { ORBITERS, SURFACE_OBJECTS, MODEL_RADII } from '../data/spaceObjects'
import { proximityBodies } from '../stores/proximityStore'

// Real public-domain NASA 3D models (nasa/NASA-3D-Resources). Curiosity reuses
// the Perseverance model — near-identical rover design (no clean GLB exists).
const GLB = {
  iss: `${import.meta.env.BASE_URL}models/iss.glb`,
  hubble: `${import.meta.env.BASE_URL}models/hubble.glb`,
  rover: `${import.meta.env.BASE_URL}models/perseverance.glb`,
}
useGLTF.preload(GLB.iss)
useGLTF.preload(GLB.hubble)
useGLTF.preload(GLB.rover)

/**
 * Load a GLB and normalize it to a unit bounding sphere centred at the origin,
 * so the manager's per-kind scale (MODEL_RADII) sizes it consistently with the
 * procedural fallbacks. `rot` corrects each model's native up-axis.
 */
function GltfModel({ url, rot }: { url: string; rot?: [number, number, number] }) {
  const { scene } = useGLTF(url)
  const node = useMemo(() => {
    const c = scene.clone(true)
    const sphere = new THREE.Box3().setFromObject(c).getBoundingSphere(new THREE.Sphere())
    const s = sphere.radius > 0 ? 1 / sphere.radius : 1
    c.scale.setScalar(s)
    c.position.set(-sphere.center.x * s, -sphere.center.y * s, -sphere.center.z * s)
    const g = new THREE.Group()
    if (rot) g.rotation.set(rot[0], rot[1], rot[2])
    g.add(c)
    return g
  }, [scene, rot])
  return <primitive object={node} />
}

// ===========================================================================
// 3D MODELS FOR HUMAN-MADE OBJECTS
// ---------------------------------------------------------------------------
// Recognizable procedural models for the stations / satellites / rovers / flags
// that otherwise show only as point-glints. Each model is authored in a LOCAL
// space bounded by a unit sphere with "up" = +Y, then a single manager scales
// it to the kind's iconic size (MODEL_RADII), places it at the body's live
// position (read from the proximity store) and orients +Y along the local
// vertical (radial-out from the parent planet). A distance test (LOD) keeps the
// detailed mesh hidden until you approach — far away, the cheap glint suffices.
// ===========================================================================

/** Camera must be within radius × this for the detailed model to render. */
const SHOW_FACTOR = 160

const UP = new THREE.Vector3(0, 1, 0)

// ---- Procedural detail textures (built once) -------------------------------
// Real spacecraft read as *surfaces*, not flat colours: gridded photovoltaic
// cells, crinkled gold multi-layer insulation. Tiny canvas textures sell this
// the moment you fly close, at almost no cost.
function makeSolarTexture(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#0a1740'
  ctx.fillRect(0, 0, 128, 128)
  const n = 8
  const cell = 128 / n
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#16297a' : '#1d3690'
      ctx.fillRect(x * cell + 1.5, y * cell + 1.5, cell - 3, cell - 3)
    }
  }
  ctx.strokeStyle = 'rgba(150,180,255,0.28)'
  ctx.lineWidth = 1
  for (let i = 0; i <= n; i++) {
    ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, 128); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(128, i * cell); ctx.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(2, 3)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

function makeGoldFoilTexture(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#b8902f'
  ctx.fillRect(0, 0, 128, 128)
  // Crinkled MLI: scattered bright/dark blotches.
  for (let i = 0; i < 500; i++) {
    const x = Math.random() * 128
    const y = Math.random() * 128
    const r = Math.random() * 9 + 2
    ctx.fillStyle =
      Math.random() > 0.5
        ? `rgba(255,228,150,${Math.random() * 0.45})`
        : `rgba(70,48,8,${Math.random() * 0.45})`
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

const SOLAR_TEX = makeSolarTexture()
const GOLD_TEX = makeGoldFoilTexture()

// ---- Shared materials (lit by the Sun's single point light) ----------------
// A faint emissive keeps the structure readable on the shadowed/night side
// without flooding space with fake ambient.
const M = {
  hull: new THREE.MeshStandardMaterial({ color: '#d8dce2', metalness: 0.9, roughness: 0.32, emissive: '#222831', emissiveIntensity: 0.16 }),
  white: new THREE.MeshStandardMaterial({ color: '#eef0f3', metalness: 0.2, roughness: 0.65, emissive: '#1a1d22', emissiveIntensity: 0.14 }),
  gold: new THREE.MeshStandardMaterial({ map: GOLD_TEX, color: '#caa24c', metalness: 1.0, roughness: 0.5, emissive: '#2a1e06', emissiveIntensity: 0.2 }),
  panel: new THREE.MeshStandardMaterial({ map: SOLAR_TEX, color: '#cdd6ff', metalness: 0.35, roughness: 0.42, emissive: '#0a1740', emissiveIntensity: 0.32 }),
  dark: new THREE.MeshStandardMaterial({ color: '#14161c', metalness: 0.5, roughness: 0.8 }),
  red: new THREE.MeshStandardMaterial({ color: '#b22234', roughness: 0.7, emissive: '#3a0a10', emissiveIntensity: 0.3 }),
  blue: new THREE.MeshStandardMaterial({ color: '#3c3b6e', roughness: 0.7, emissive: '#10103a', emissiveIntensity: 0.3 }),
}

// Solar-array pair offset along Z, used by several models.
function SolarWing({ x, len = 0.9, w = 0.34 }: { x: number; len?: number; w?: number }) {
  return (
    <group position={[x, 0, 0]}>
      <mesh material={M.panel}>
        <boxGeometry args={[w, 0.008, len]} />
      </mesh>
      {/* spar */}
      <mesh material={M.hull}>
        <boxGeometry args={[0.015, 0.02, len * 1.02]} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// ISS — long lattice truss, four big solar-array pairs, central module stack
// ---------------------------------------------------------------------------
function ISSModel() {
  return (
    <group>
      {/* Integrated truss along X */}
      <mesh material={M.hull}>
        <boxGeometry args={[1.9, 0.05, 0.05]} />
      </mesh>
      {/* Four solar-array pairs out toward the truss ends */}
      {[-0.92, -0.58, 0.58, 0.92].map((x, i) => (
        <group key={i} position={[x, 0, 0]}>
          <mesh material={M.panel} position={[0, 0, 0.46]}>
            <boxGeometry args={[0.3, 0.008, 0.78]} />
          </mesh>
          <mesh material={M.panel} position={[0, 0, -0.46]}>
            <boxGeometry args={[0.3, 0.008, 0.78]} />
          </mesh>
        </group>
      ))}
      {/* Thermal radiators (white) at centre, perpendicular */}
      <mesh material={M.white} position={[0.18, 0.0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.34, 0.006, 0.5]} />
      </mesh>
      {/* Pressurised module stack along Z */}
      {[-0.26, 0, 0.26].map((z, i) => (
        <mesh key={i} material={M.white} position={[0, -0.02, z]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.34, 16]} />
        </mesh>
      ))}
      {/* Cross module */}
      <mesh material={M.white} position={[0, -0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.08, 0.08, 0.46, 16]} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Tiangong — T-shaped: axial core + two lab modules, three solar wings
// ---------------------------------------------------------------------------
function TiangongModel() {
  return (
    <group>
      {/* Core module along Z */}
      <mesh material={M.white} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 1.0, 20]} />
      </mesh>
      {/* Node + two lab modules branching along X at the forward end */}
      <mesh material={M.white} position={[0, 0, 0.5]}>
        <sphereGeometry args={[0.17, 16, 16]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} material={M.hull} position={[s * 0.4, 0, 0.5]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.13, 0.13, 0.66, 18]} />
        </mesh>
      ))}
      {/* Solar wings: pair on the core aft, one pair per lab module */}
      <SolarWing x={0.0} len={0.9} w={0.4} />
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.78, 0, 0.5]}>
          <mesh material={M.panel} position={[0, 0, 0.4]}>
            <boxGeometry args={[0.34, 0.008, 0.6]} />
          </mesh>
          <mesh material={M.panel} position={[0, 0, -0.4]}>
            <boxGeometry args={[0.34, 0.008, 0.6]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// Hubble — silver tube with gold-foil wrap, aperture door, two solar wings
// ---------------------------------------------------------------------------
function HubbleModel() {
  return (
    <group>
      {/* Main body along Z */}
      <mesh material={M.hull} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 1.2, 28]} />
      </mesh>
      {/* Gold MLI wrap (aft section) */}
      <mesh material={M.gold} position={[0, 0, -0.35]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.305, 0.305, 0.5, 28]} />
      </mesh>
      {/* Aperture (dark opening) at the front */}
      <mesh material={M.dark} position={[0, 0, 0.61]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.27, 0.27, 0.04, 28]} />
      </mesh>
      {/* Two solar wings */}
      {[-1, 1].map((s) => (
        <mesh key={s} material={M.panel} position={[s * 0.55, 0, -0.1]}>
          <boxGeometry args={[0.5, 0.008, 0.9]} />
        </mesh>
      ))}
      {/* High-gain antenna dishes on booms */}
      {[-1, 1].map((s) => (
        <group key={s} position={[0, s * 0.34, -0.2]}>
          <mesh material={M.hull}>
            <cylinderGeometry args={[0.01, 0.01, 0.26, 8]} />
          </mesh>
          <mesh material={M.white} position={[0, s * 0.16, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.12, 0.12, 0.02, 16]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// Generic satellite — gold-foil bus, two solar wings, dish on a boom
// ---------------------------------------------------------------------------
function SatelliteModel() {
  return (
    <group>
      {/* Bus */}
      <mesh material={M.gold}>
        <boxGeometry args={[0.42, 0.42, 0.5]} />
      </mesh>
      {/* Solar wings */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.6, 0, 0]}>
          <mesh material={M.hull}>
            <boxGeometry args={[0.36, 0.018, 0.04]} />
          </mesh>
          <mesh material={M.panel} position={[s * 0.32, 0, 0]}>
            <boxGeometry args={[0.5, 0.008, 0.5]} />
          </mesh>
        </group>
      ))}
      {/* Dish on a short boom out the front (+Z) */}
      <mesh material={M.hull} position={[0, 0, 0.36]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.22, 8]} />
      </mesh>
      <mesh material={M.white} position={[0, 0, 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.18, 0.12, 20, 1, true]} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Rover — chassis, six wheels, mast/camera head, RTG, arm (Perseverance-like)
// ---------------------------------------------------------------------------
function RoverModel() {
  const wheelXs = [-0.34, 0.34]
  const wheelZs = [-0.3, 0, 0.3]
  return (
    <group position={[0, 0.22, 0]}>
      {/* Chassis */}
      <mesh material={M.white} position={[0, 0.06, 0]}>
        <boxGeometry args={[0.5, 0.22, 0.74]} />
      </mesh>
      {/* Gold deck plate */}
      <mesh material={M.gold} position={[0, 0.18, 0]}>
        <boxGeometry args={[0.46, 0.03, 0.7]} />
      </mesh>
      {/* Six wheels (axis along X) */}
      {wheelXs.map((x) =>
        wheelZs.map((z) => (
          <mesh key={`${x}-${z}`} material={M.dark} position={[x, -0.16, z]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.17, 0.17, 0.14, 16]} />
          </mesh>
        )),
      )}
      {/* Mast + camera head at the front */}
      <mesh material={M.hull} position={[0, 0.42, 0.28]}>
        <cylinderGeometry args={[0.03, 0.03, 0.48, 10]} />
      </mesh>
      <mesh material={M.dark} position={[0, 0.68, 0.28]}>
        <boxGeometry args={[0.22, 0.1, 0.1]} />
      </mesh>
      {/* RTG power unit at the back, slightly raised/angled */}
      <mesh material={M.dark} position={[0, 0.3, -0.42]} rotation={[Math.PI / 5, 0, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.34, 12]} />
      </mesh>
      {/* Robotic arm reaching forward */}
      <mesh material={M.hull} position={[0.1, -0.02, 0.5]} rotation={[Math.PI / 2.4, 0, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.4, 8]} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Flag — pole + stars-and-stripes cloth on a small footpad (Apollo)
// ---------------------------------------------------------------------------
function FlagModel() {
  return (
    <group>
      {/* Footpad */}
      <mesh material={M.hull} position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.12, 0.14, 0.04, 12]} />
      </mesh>
      {/* Pole */}
      <mesh material={M.white} position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 1.05, 8]} />
      </mesh>
      {/* Horizontal top bar holding the cloth out (no wind on the Moon) */}
      <mesh material={M.white} position={[0.3, 1.04, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.012, 0.012, 0.62, 8]} />
      </mesh>
      {/* Cloth: red field + blue canton */}
      <mesh material={M.red} position={[0.32, 0.84, 0.002]}>
        <boxGeometry args={[0.6, 0.38, 0.006]} />
      </mesh>
      <mesh material={M.blue} position={[0.13, 0.93, 0.006]}>
        <boxGeometry args={[0.24, 0.2, 0.008]} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Manager — render every model once, drive transform + LOD from the store
// ---------------------------------------------------------------------------

interface Item {
  id: string
  kind: keyof typeof MODEL_RADII
  parent: string
  radius: number
  model: React.ReactNode
}

function modelFor(id: string, kind: Item['kind']): React.ReactNode {
  // Real NASA GLB models for the iconic craft, with the procedural shapes as
  // the loading fallback (so they still appear instantly, then sharpen).
  if (id === 'iss') {
    return (
      <Suspense fallback={<ISSModel />}>
        <GltfModel url={GLB.iss} />
      </Suspense>
    )
  }
  if (id === 'hubble') {
    return (
      <Suspense fallback={<HubbleModel />}>
        <GltfModel url={GLB.hubble} />
      </Suspense>
    )
  }
  if (kind === 'rover') {
    return (
      <Suspense fallback={<RoverModel />}>
        {/* GLB is Z-up → stand it on +Y (radial-out) like the procedural rover. */}
        <GltfModel url={GLB.rover} rot={[-Math.PI / 2, 0, 0]} />
      </Suspense>
    )
  }
  if (id === 'tiangong') return <TiangongModel />
  if (kind === 'flag') return <FlagModel />
  return <SatelliteModel />
}

export default function SpaceObjectModels() {
  const { camera } = useThree()
  const groupsRef = useRef<(THREE.Group | null)[]>([])

  const items = useMemo<Item[]>(() => {
    const orbiters: Item[] = ORBITERS.map((o) => ({
      id: o.id,
      kind: o.kind,
      parent: o.parent,
      radius: MODEL_RADII[o.kind],
      model: modelFor(o.id, o.kind),
    }))
    const surface: Item[] = SURFACE_OBJECTS.map((s) => ({
      id: s.id,
      kind: s.kind,
      parent: s.parent,
      radius: MODEL_RADII[s.kind],
      model: modelFor(s.id, s.kind),
    }))
    return [...orbiters, ...surface]
  }, [])

  // Scratch
  const _pos = useRef(new THREE.Vector3())
  const _radial = useRef(new THREE.Vector3())
  const _quat = useRef(new THREE.Quaternion())

  useFrame(() => {
    for (let idx = 0; idx < items.length; idx++) {
      const g = groupsRef.current[idx]
      if (!g) continue
      const it = items[idx]
      const body = proximityBodies.get(it.id)
      if (!body) {
        g.visible = false
        continue
      }
      const p = body.position
      // Parked far off-scene until the parent exists.
      if (p[0] > 1e8) {
        g.visible = false
        continue
      }
      const pos = _pos.current.set(p[0], p[1], p[2])
      const dist = camera.position.distanceTo(pos)
      const show = dist < it.radius * SHOW_FACTOR
      g.visible = show
      if (!show) continue

      g.position.copy(pos)

      // Orient local +Y along the radial-out from the parent (objects "stand"
      // on the surface; orbiters keep a stable, planet-aware attitude).
      const parent = proximityBodies.get(it.parent)
      if (parent) {
        const radial = _radial.current
          .set(p[0] - parent.position[0], p[1] - parent.position[1], p[2] - parent.position[2])
        if (radial.lengthSq() > 1e-12) {
          radial.normalize()
          g.quaternion.copy(_quat.current.setFromUnitVectors(UP, radial))
        }
      }
    }
  })

  return (
    <>
      {/* Sun-direction light with NO distance falloff (decay 0) so the real GLB
          models are lit from the Sun correctly at any heliocentric distance — a
          normal point light's 1/d² would leave them black out by the planets. */}
      <pointLight position={[0, 0, 0]} intensity={3} decay={0} color="#fff6ec" />
      {items.map((it, idx) => (
        <group
          key={it.id}
          ref={(el) => (groupsRef.current[idx] = el)}
          scale={it.radius}
          visible={false}
        >
          {it.model}
        </group>
      ))}
    </>
  )
}
