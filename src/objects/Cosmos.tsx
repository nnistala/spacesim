import { useEffect, useMemo } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import {
  COSMIC_SHELLS,
  OORT_UNITS,
  MILKY_WAY_INNER,
  MILKY_WAY_OUTER,
  GALAXY_FIELD_INNER,
  GALAXY_FIELD_OUTER,
  lyToRenderUnits,
  LY_PER_AU,
} from '../data/cosmicScale'
import { useProximityStore } from '../stores/proximityStore'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normally-distributed random (mean 0, given sigma). */
function gaussian(sigma: number): number {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function pointsGeometry(positions: Float32Array, colors: Float32Array): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeBoundingSphere()
  return geo
}

// Crisp, constant-pixel additive points — the "map of the universe" look:
// structures read as dot fields at every zoom rather than ballooning up close.
function pointsMaterial(size: number, opacity = 1): THREE.PointsMaterial {
  return new THREE.PointsMaterial({
    size,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  })
}

// ---------------------------------------------------------------------------
// Milky Way — spiral disk of stars centred on the observer
// ---------------------------------------------------------------------------

function buildMilkyWay(count: number) {
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  // TWO arms + a central bar → a barred spiral that reads as a slanted "S"
  // (like the real Milky Way), not a symmetric disc/oval.
  const arms = 2
  const inner = MILKY_WAY_INNER
  const outer = MILKY_WAY_OUTER
  const span = outer - inner
  const barLen = 0.22 // fraction of radius occupied by the bar

  const bulge = new THREE.Color(1.0, 0.86, 0.62)
  const mid = new THREE.Color(1.0, 0.97, 0.9)
  const armCol = new THREE.Color(0.68, 0.8, 1.0)
  const c = new THREE.Color()

  // Tilt the whole galaxy so it is seen slanted, never as a flat face-on oval.
  const tilt = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.5, 0.65, 0.28))
  const v = new THREE.Vector3()

  for (let i = 0; i < count; i++) {
    // Radius biased toward the centre (dense core, thinning rim).
    const t = Math.pow(Math.random(), 1.8)
    const rad = inner + span * t
    const tt = t // normalised radius 0..1

    let angle: number
    if (tt < barLen) {
      // Central BAR: stars lie along a single straight axis (with thin spread).
      const along = (tt / barLen) * (Math.random() < 0.5 ? 1 : -1)
      const barAngle = along >= 0 ? 0 : Math.PI
      angle = barAngle + gaussian(0.18)
    } else {
      // Two trailing log-spiral arms springing from the bar ends.
      const arm = Math.floor(Math.random() * arms)
      const winding = (tt - barLen) * Math.PI * 3.4
      const spread = gaussian(0.28 + (1 - tt) * 0.4)
      angle = arm * Math.PI + winding + spread
    }

    const thickness = tt < 0.12 ? span * 0.1 : span * 0.045
    v.set(Math.cos(angle) * rad, gaussian(thickness), Math.sin(angle) * rad)
    v.applyMatrix4(tilt)
    positions[i * 3] = v.x
    positions[i * 3 + 1] = v.y
    positions[i * 3 + 2] = v.z

    // Colour: warm bulge → white → blue arms, with occasional pink HII regions.
    if (tt < 0.15) c.copy(bulge).lerp(mid, tt / 0.15)
    else c.copy(mid).lerp(armCol, Math.min((tt - 0.15) / 0.5, 1))
    if (tt > 0.2) {
      const r = Math.random()
      if (r < 0.05) c.setRGB(1.0, 0.4, 0.6) // pink star-forming region
      else if (r < 0.09) c.setRGB(1.0, 0.55, 0.35) // ruddy dust glow
    }
    const b = 0.28 + Math.random() * 0.4
    colors[i * 3] = c.r * b
    colors[i * 3 + 1] = c.g * b
    colors[i * 3 + 2] = c.b * b
  }
  return pointsGeometry(positions, colors)
}

// ---------------------------------------------------------------------------
// Kuiper Belt + Oort Cloud — icy shells around the solar system
// ---------------------------------------------------------------------------

function buildKuiperBelt(count: number) {
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const r0 = lyToRenderUnits(35 * LY_PER_AU)
  const r1 = lyToRenderUnits(50 * LY_PER_AU)
  for (let i = 0; i < count; i++) {
    const rad = r0 + Math.random() * (r1 - r0)
    const angle = Math.random() * Math.PI * 2
    const y = gaussian((r1 - r0) * 0.15)
    positions[i * 3] = Math.cos(angle) * rad
    positions[i * 3 + 1] = y
    positions[i * 3 + 2] = Math.sin(angle) * rad
    const b = 0.4 + Math.random() * 0.4
    colors[i * 3] = b * 0.7
    colors[i * 3 + 1] = b * 0.78
    colors[i * 3 + 2] = b
  }
  return pointsGeometry(positions, colors)
}

function buildOort(count: number) {
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    // Uniform on a slightly fuzzy sphere.
    const u = Math.random() * 2 - 1
    const theta = Math.random() * Math.PI * 2
    const s = Math.sqrt(1 - u * u)
    const rad = OORT_UNITS * (0.85 + Math.random() * 0.3)
    positions[i * 3] = s * Math.cos(theta) * rad
    positions[i * 3 + 1] = u * rad
    positions[i * 3 + 2] = s * Math.sin(theta) * rad
    const b = 0.25 + Math.random() * 0.3
    colors[i * 3] = b * 0.8
    colors[i * 3 + 1] = b * 0.85
    colors[i * 3 + 2] = b
  }
  return pointsGeometry(positions, colors)
}

// ---------------------------------------------------------------------------
// Cosmic web — colourful distant galaxies (JWST deep-field look)
// ---------------------------------------------------------------------------

// Soft round additive glow with per-point size + colour — reads as little
// galaxies of varied hue and size rather than uniform white dots.
const GALAXY_VERT = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
attribute float aAngle;
attribute float aShape;
uniform float uPixelRatio;
varying vec3 vColor;
varying float vAngle;
varying float vShape;
void main() {
  vColor = aColor;
  vAngle = aAngle;
  vShape = aShape;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uPixelRatio;
}
`

const GALAXY_FRAG = /* glsl */ `
precision highp float;
varying vec3 vColor;
varying float vAngle;
varying float vShape;
void main() {
  vec2 c = gl_PointCoord - vec2(0.5);
  // Rotate, then squash one axis: round ellipticals → tilted ovals →
  // thin edge-on streaks, so the field has real morphological variety.
  float s = sin(vAngle), co = cos(vAngle);
  vec2 r = vec2(c.x * co - c.y * s, c.x * s + c.y * co);
  float squash = mix(1.0, 4.5, vShape);
  vec2 e = vec2(r.x, r.y * squash);
  float d = length(e) * 2.0;
  if (d > 1.0) discard;
  // Faint axial tail along the long axis for spirals/edge-ons.
  float tail = vShape * smoothstep(1.0, 0.0, abs(r.y) * 6.0) * (1.0 - abs(r.x) * 1.6);
  float core = pow(1.0 - d, 2.6);
  float a = core + (1.0 - d) * 0.2 + max(tail, 0.0) * 0.4;
  gl_FragColor = vec4(vColor * a, a);
}
`

// JWST deep-field palette: mostly redshifted reds/oranges, gold ellipticals,
// some blue-white spirals, a few teal.
const GALAXY_PALETTE: [number, number, number][] = [
  [1.0, 0.45, 0.28], [1.0, 0.55, 0.32], [0.95, 0.5, 0.35], [1.0, 0.62, 0.4], // warm/red (distant)
  [1.0, 0.85, 0.55], [1.0, 0.93, 0.78], [1.0, 0.97, 0.9],                    // gold / white ellipticals
  [0.7, 0.82, 1.0], [0.82, 0.9, 1.0],                                        // blue-white spirals
  [0.55, 0.95, 0.95],                                                        // teal
]

function buildGalaxies(count: number) {
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const angles = new Float32Array(count)
  const shapes = new Float32Array(count)
  const inner = GALAXY_FIELD_INNER
  const outer = GALAXY_FIELD_OUTER
  const c = new THREE.Color()

  // ~35% along thin elongated FILAMENTS, ~65% scattered everywhere. Elongated
  // (not spherical) clusters avoid the "exploding firework" look and read as
  // the stringy cosmic web.
  const clusterCount = Math.floor(count * 0.35)
  const nFilaments = 150
  const filaments: { c: THREE.Vector3; d: THREE.Vector3; len: number }[] = []
  for (let i = 0; i < nFilaments; i++) {
    const u = Math.random() * 2 - 1
    const theta = Math.random() * Math.PI * 2
    const s = Math.sqrt(1 - u * u)
    const rad = inner + Math.pow(Math.random(), 0.7) * (outer - inner)
    const c = new THREE.Vector3(s * Math.cos(theta) * rad, u * rad, s * Math.sin(theta) * rad)
    const d = new THREE.Vector3(gaussian(1), gaussian(1), gaussian(1)).normalize()
    filaments.push({ c, d, len: (outer - inner) * (0.06 + Math.random() * 0.14) })
  }
  const perp = (outer - inner) * 0.012

  for (let i = 0; i < count; i++) {
    if (i < clusterCount) {
      const f = filaments[(Math.random() * nFilaments) | 0]
      const along = (Math.random() * 2 - 1) * f.len
      positions[i * 3] = f.c.x + f.d.x * along + gaussian(perp)
      positions[i * 3 + 1] = f.c.y + f.d.y * along + gaussian(perp)
      positions[i * 3 + 2] = f.c.z + f.d.z * along + gaussian(perp)
    } else {
      const u = Math.random() * 2 - 1
      const theta = Math.random() * Math.PI * 2
      const s = Math.sqrt(1 - u * u)
      const rad = inner + Math.pow(Math.random(), 0.7) * (outer - inner)
      positions[i * 3] = s * Math.cos(theta) * rad
      positions[i * 3 + 1] = u * rad
      positions[i * 3 + 2] = s * Math.sin(theta) * rad
    }

    const p = GALAXY_PALETTE[(Math.random() * GALAXY_PALETTE.length) | 0]
    // Keep most galaxies below the bloom threshold so their colour survives;
    // only a few bright ones blow out to white.
    const b = 0.38 + Math.random() * 0.42
    c.setRGB(p[0] * b, p[1] * b, p[2] * b)
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b

    // Most galaxies small; a few large/near ones for depth.
    sizes[i] = Math.random() < 0.08 ? 5 + Math.random() * 8 : 1.5 + Math.random() * 2.5
    angles[i] = Math.random() * Math.PI * 2
    // ~45% round, the rest progressively elongated (ovals → edge-on streaks).
    shapes[i] = Math.random() < 0.45 ? Math.random() * 0.2 : 0.4 + Math.random() * 0.6
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  geo.setAttribute('aAngle', new THREE.BufferAttribute(angles, 1))
  geo.setAttribute('aShape', new THREE.BufferAttribute(shapes, 1))
  geo.computeBoundingSphere()
  return geo
}

// ---------------------------------------------------------------------------
// Named galaxies — real spiral disks you can fly to (Andromeda, etc.)
// ---------------------------------------------------------------------------

interface NamedGalaxy {
  id: string
  name: string
  distanceLy: number
  dir: [number, number, number]
  radius: number
  tilt: [number, number, number]
  arms: number
  bulge: [number, number, number]
  arm: [number, number, number]
}

const NAMED_GALAXIES: NamedGalaxy[] = [
  { id: 'andromeda', name: 'Andromeda Galaxy', distanceLy: 2.5e6, dir: [0.5, 0.45, 0.74], radius: 9000, tilt: [1.15, 0.2, 0.0], arms: 2, bulge: [1.0, 0.9, 0.72], arm: [0.72, 0.82, 1.0] },
  { id: 'triangulum', name: 'Triangulum Galaxy', distanceLy: 2.9e6, dir: [-0.55, -0.28, 0.79], radius: 5500, tilt: [0.6, 0.0, 0.7], arms: 3, bulge: [1.0, 0.92, 0.78], arm: [0.78, 0.85, 1.0] },
  { id: 'whirlpool', name: 'Whirlpool Galaxy', distanceLy: 2.3e7, dir: [0.34, 0.62, -0.71], radius: 7000, tilt: [0.25, 0.0, 0.1], arms: 2, bulge: [1.0, 0.88, 0.66], arm: [0.7, 0.8, 1.0] },
  { id: 'sombrero', name: 'Sombrero Galaxy', distanceLy: 2.9e7, dir: [-0.7, 0.15, -0.7], radius: 6000, tilt: [1.45, 0.0, 0.2], arms: 2, bulge: [1.0, 0.93, 0.78], arm: [0.85, 0.8, 0.7] },
]

function namedGalaxyPosition(g: NamedGalaxy): THREE.Vector3 {
  const d = new THREE.Vector3(...g.dir).normalize()
  return d.multiplyScalar(lyToRenderUnits(g.distanceLy))
}

function buildSpiralGalaxy(g: NamedGalaxy, count: number, center: THREE.Vector3) {
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const rot = new THREE.Matrix4().makeRotationFromEuler(
    new THREE.Euler(g.tilt[0], g.tilt[1], g.tilt[2]),
  )
  const bulge = new THREE.Color(...g.bulge)
  const arm = new THREE.Color(...g.arm)
  const v = new THREE.Vector3()
  const c = new THREE.Color()
  for (let i = 0; i < count; i++) {
    const t = Math.pow(Math.random(), 1.8)
    const rad = g.radius * (0.04 + 0.96 * t)
    const a = Math.floor(Math.random() * g.arms)
    const winding = t * Math.PI * 3.0
    const spread = gaussian(0.3 + (1 - t) * 0.5)
    const angle = a * ((2 * Math.PI) / g.arms) + winding + spread
    const thickness = t < 0.14 ? g.radius * 0.07 : g.radius * 0.02
    v.set(Math.cos(angle) * rad, gaussian(thickness), Math.sin(angle) * rad)
    v.applyMatrix4(rot).add(center)
    positions[i * 3] = v.x
    positions[i * 3 + 1] = v.y
    positions[i * 3 + 2] = v.z
    c.copy(bulge).lerp(arm, Math.min(t / 0.6, 1))
    if (t > 0.25 && Math.random() < 0.04) c.setRGB(1.0, 0.45, 0.62) // HII pink
    const b = 0.45 + Math.random() * 0.5
    colors[i * 3] = c.r * b
    colors[i * 3 + 1] = c.g * b
    colors[i * 3 + 2] = c.b * b
  }
  return pointsGeometry(positions, colors)
}

// Sombrero (M104) — a near edge-on disc: a huge bright spheroidal bulge cut by
// a dark equatorial DUST LANE, with a thin extended disc. NOT a face-on spiral.
// The lane is carved as a gap (additive points can't darken) so the bulge reads
// as split by a dark band — the galaxy's signature "hat brim".
function buildSombrero(g: NamedGalaxy, count: number, center: THREE.Vector3) {
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const rot = new THREE.Matrix4().makeRotationFromEuler(
    new THREE.Euler(g.tilt[0], g.tilt[1], g.tilt[2]),
  )
  const bulge = new THREE.Color(...g.bulge)
  const disc = new THREE.Color(...g.arm)
  const v = new THREE.Vector3()
  const c = new THREE.Color()
  const R = g.radius
  const laneHalf = 0.028 * R
  const bulgeCount = Math.floor(count * 0.68)
  let i = 0
  // Bright flattened bulge, with the equatorial dust lane carved out.
  let guard = 0
  while (i < bulgeCount && guard < bulgeCount * 40) {
    guard++
    const t = Math.pow(Math.random(), 1.7)
    const rr = 0.58 * R * t
    const u = Math.random() * 2 - 1
    const th = Math.random() * Math.PI * 2
    const s = Math.sqrt(1 - u * u)
    const x = rr * s * Math.cos(th)
    const y = rr * u * 0.72
    const z = rr * s * Math.sin(th)
    const horiz = Math.sqrt(x * x + z * z)
    // Carve the dark lane: skip points in the thin equatorial slab (keep the
    // bright core so the bulge still glows through above/below).
    if (Math.abs(y) < laneHalf && horiz > 0.12 * R) continue
    v.set(x, y, z).applyMatrix4(rot).add(center)
    positions[i * 3] = v.x
    positions[i * 3 + 1] = v.y
    positions[i * 3 + 2] = v.z
    const b = (0.55 + Math.random() * 0.45) * (1 - t * 0.25)
    c.copy(bulge).multiplyScalar(b)
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
    i++
  }
  // Thin extended disc (the brim) reaching out past the bulge.
  for (; i < count; i++) {
    const rr = (0.3 + 0.7 * Math.sqrt(Math.random())) * R
    const th = Math.random() * Math.PI * 2
    const x = rr * Math.cos(th)
    const z = rr * Math.sin(th)
    const y = gaussian(0.018 * R)
    v.set(x, y, z).applyMatrix4(rot).add(center)
    positions[i * 3] = v.x
    positions[i * 3 + 1] = v.y
    positions[i * 3 + 2] = v.z
    c.copy(disc)
    if (Math.random() < 0.05) c.setRGB(1.0, 0.5, 0.62) // HII pink knots
    const b = 0.38 + Math.random() * 0.4
    colors[i * 3] = c.r * b
    colors[i * 3 + 1] = c.g * b
    colors[i * 3 + 2] = c.b * b
  }
  return pointsGeometry(positions, colors)
}

// ---------------------------------------------------------------------------
// Nebulae — colourful JWST-style emission clouds you can fly into
// ---------------------------------------------------------------------------

interface NebulaDef {
  id: string
  name: string
  distanceLy: number
  dir: [number, number, number]
  radius: number
  palette: [number, number, number][]
}

const NEBULAE: NebulaDef[] = [
  {
    id: 'carina', name: 'Carina Nebula', distanceLy: 7500, dir: [0.25, 0.12, 0.96], radius: 2600,
    palette: [[1.0, 0.5, 0.35], [1.0, 0.7, 0.4], [0.6, 0.85, 0.95], [0.55, 0.4, 0.8], [1.0, 0.85, 0.6]],
  },
  {
    id: 'orion', name: 'Orion Nebula', distanceLy: 1340, dir: [-0.3, -0.15, 0.94], radius: 1700,
    palette: [[1.0, 0.45, 0.5], [0.95, 0.55, 0.75], [0.5, 0.8, 1.0], [0.7, 0.9, 0.85], [1.0, 0.8, 0.55]],
  },
  {
    // M16 — Pillars of Creation: golden dust pillars + teal + pink star-forming gas.
    id: 'eagle', name: 'Eagle Nebula', distanceLy: 7000, dir: [0.0795, -0.2385, -0.9679], radius: 2200,
    palette: [[1.0, 0.62, 0.34], [0.95, 0.8, 0.5], [0.55, 0.85, 0.75], [0.55, 0.45, 0.78], [1.0, 0.5, 0.55]],
  },
  {
    // M8 — Lagoon: hydrogen-α pink/red emission with a blue-white core cluster.
    id: 'lagoon', name: 'Lagoon Nebula', distanceLy: 4100, dir: [0.0151, -0.4131, -0.9111], radius: 2000,
    palette: [[1.0, 0.38, 0.5], [1.0, 0.55, 0.62], [0.9, 0.45, 0.68], [0.6, 0.72, 1.0], [1.0, 0.72, 0.5]],
  },
  {
    // M45 — Pleiades: blue reflection nebula around hot young stars.
    id: 'pleiades', name: 'Pleiades', distanceLy: 440, dir: [0.5002, 0.4088, 0.7633], radius: 900,
    palette: [[0.6, 0.78, 1.0], [0.75, 0.88, 1.0], [0.5, 0.68, 1.0], [0.85, 0.92, 1.0], [0.65, 0.8, 1.0]],
  },
]

// Build a clumpy, colourful emission cloud as galaxy-shader points.
function buildNebula(n: NebulaDef, count: number, center: THREE.Vector3) {
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const angles = new Float32Array(count)
  const shapes = new Float32Array(count)
  const c = new THREE.Color()

  // A handful of dense clumps + diffuse haze gives the billowing pillar look.
  const clumps: THREE.Vector3[] = []
  for (let k = 0; k < 7; k++) {
    clumps.push(
      new THREE.Vector3(gaussian(n.radius * 0.5), gaussian(n.radius * 0.35), gaussian(n.radius * 0.5)),
    )
  }
  for (let i = 0; i < count; i++) {
    let px: number, py: number, pz: number
    if (Math.random() < 0.6) {
      const cl = clumps[(Math.random() * clumps.length) | 0]
      px = cl.x + gaussian(n.radius * 0.22)
      py = cl.y + gaussian(n.radius * 0.22)
      pz = cl.z + gaussian(n.radius * 0.22)
    } else {
      px = gaussian(n.radius * 0.6)
      py = gaussian(n.radius * 0.45)
      pz = gaussian(n.radius * 0.6)
    }
    positions[i * 3] = center.x + px
    positions[i * 3 + 1] = center.y + py
    positions[i * 3 + 2] = center.z + pz

    const p = n.palette[(Math.random() * n.palette.length) | 0]
    const b = 0.3 + Math.random() * 0.45
    c.setRGB(p[0] * b, p[1] * b, p[2] * b)
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
    sizes[i] = 3 + Math.random() * 7
    angles[i] = Math.random() * Math.PI * 2
    shapes[i] = Math.random() * 0.3
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  geo.setAttribute('aAngle', new THREE.BufferAttribute(angles, 1))
  geo.setAttribute('aShape', new THREE.BufferAttribute(shapes, 1))
  geo.computeBoundingSphere()
  return geo
}

// ---------------------------------------------------------------------------
// Galaxy clusters & groups — distinct large-scale structure you can fly to
// ---------------------------------------------------------------------------

function galaxyShaderGeometry(
  positions: Float32Array,
  colors: Float32Array,
  sizes: Float32Array,
  angles: Float32Array,
  shapes: Float32Array,
): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  geo.setAttribute('aAngle', new THREE.BufferAttribute(angles, 1))
  geo.setAttribute('aShape', new THREE.BufferAttribute(shapes, 1))
  geo.computeBoundingSphere()
  return geo
}

// Virgo: a rich cluster — hundreds of members concentrated toward a few giant
// central ellipticals (M87/M49-like cD galaxies), ellipticals-dominated with a
// minority of blue spirals at the outskirts.
const VIRGO_ELLIPTICAL: [number, number, number][] = [
  [1.0, 0.93, 0.78], [1.0, 0.88, 0.66], [1.0, 0.96, 0.86],
]
const VIRGO_SPIRAL: [number, number, number][] = [
  [0.72, 0.82, 1.0], [0.82, 0.9, 1.0],
]

function buildCluster(center: THREE.Vector3, radius: number, count: number) {
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const angles = new Float32Array(count)
  const shapes = new Float32Array(count)
  const c = new THREE.Color()
  for (let i = 0; i < count; i++) {
    // r² concentration toward the core.
    const t = Math.pow(Math.random(), 2.2)
    const u = Math.random() * 2 - 1
    const theta = Math.random() * Math.PI * 2
    const s = Math.sqrt(1 - u * u)
    const rad = radius * t
    positions[i * 3] = center.x + s * Math.cos(theta) * rad
    positions[i * 3 + 1] = center.y + u * rad * 0.82
    positions[i * 3 + 2] = center.z + s * Math.sin(theta) * rad

    const isEll = Math.random() < 0.7
    const pal = isEll
      ? VIRGO_ELLIPTICAL[(Math.random() * VIRGO_ELLIPTICAL.length) | 0]
      : VIRGO_SPIRAL[(Math.random() * VIRGO_SPIRAL.length) | 0]
    const b = 0.42 + Math.random() * 0.45
    c.setRGB(pal[0] * b, pal[1] * b, pal[2] * b)
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
    sizes[i] = Math.random() < 0.1 ? 5 + Math.random() * 6 : 2 + Math.random() * 3
    angles[i] = Math.random() * Math.PI * 2
    shapes[i] = isEll ? Math.random() * 0.25 : 0.4 + Math.random() * 0.5
  }
  // Central giant cD galaxies — big, bright, near the very core.
  for (let k = 0; k < 3 && k < count; k++) {
    positions[k * 3] = center.x + gaussian(radius * 0.05)
    positions[k * 3 + 1] = center.y + gaussian(radius * 0.04)
    positions[k * 3 + 2] = center.z + gaussian(radius * 0.05)
    c.setRGB(1.0, 0.95, 0.85)
    colors[k * 3] = c.r
    colors[k * 3 + 1] = c.g
    colors[k * 3 + 2] = c.b
    sizes[k] = 16 + Math.random() * 10
    shapes[k] = Math.random() * 0.15
  }
  return galaxyShaderGeometry(positions, colors, sizes, angles, shapes)
}

// Local Group: our home — a sparse scatter of dim dwarf galaxies around the
// observer (the Milky Way, Andromeda and Triangulum are drawn separately). Two
// brighter members stand in for the Magellanic Clouds close in.
function buildLocalGroup(count: number) {
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const angles = new Float32Array(count)
  const shapes = new Float32Array(count)
  const c = new THREE.Color()
  const rIn = lyToRenderUnits(2e5)
  const rOut = lyToRenderUnits(6e6)
  for (let i = 0; i < count; i++) {
    const u = Math.random() * 2 - 1
    const theta = Math.random() * Math.PI * 2
    const s = Math.sqrt(1 - u * u)
    const rad = rIn + Math.pow(Math.random(), 0.6) * (rOut - rIn)
    positions[i * 3] = s * Math.cos(theta) * rad
    positions[i * 3 + 1] = u * rad
    positions[i * 3 + 2] = s * Math.sin(theta) * rad
    // Faint, slightly blue-white dwarfs.
    const b = 0.22 + Math.random() * 0.28
    c.setRGB(0.85 * b, 0.9 * b, 1.0 * b)
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
    sizes[i] = 1.5 + Math.random() * 2
    angles[i] = Math.random() * Math.PI * 2
    shapes[i] = Math.random() * 0.6 // dwarfs are irregular
  }
  // Magellanic-Cloud stand-ins: two brighter, larger irregulars close in.
  for (let k = 0; k < 2 && k < count; k++) {
    const dir = new THREE.Vector3(gaussian(1), gaussian(1), gaussian(1)).normalize()
    const p = dir.multiplyScalar(rIn * (1.2 + k * 0.6))
    positions[k * 3] = p.x
    positions[k * 3 + 1] = p.y
    positions[k * 3 + 2] = p.z
    c.setRGB(0.8, 0.86, 1.0)
    colors[k * 3] = c.r
    colors[k * 3 + 1] = c.g
    colors[k * 3 + 2] = c.b
    sizes[k] = 7 + Math.random() * 4
    shapes[k] = 0.3 + Math.random() * 0.3
  }
  return galaxyShaderGeometry(positions, colors, sizes, angles, shapes)
}

// Virgo Cluster — real sky direction (RA 12h27m, Dec +12.7°), ~65 Mly.
const VIRGO = {
  dir: [-0.9687, 0.2198, -0.1155] as [number, number, number],
  distanceLy: 6.5e7,
  radius: 7500,
}

// ---------------------------------------------------------------------------
// Crab Nebula (M1) — supernova remnant (Hubble palette). Filamentary expanding
// cage of orange (H), red (O III), green (S II) and blue (neutral O) shell
// filaments around an eerie blue-white synchrotron interior + central pulsar.
// Ref: NASA/ESA Hubble Messier 1 — 6 ly across, 6,500 ly away in Taurus.
// ---------------------------------------------------------------------------
const CRAB = {
  dir: [0.1027, 0.3748, 0.9215] as [number, number, number],
  distanceLy: 6500,
  radius: 1800,
}

// Shell-filament palette (weighted toward orange/red, with green + blue).
const CRAB_FILAMENT: [number, number, number][] = [
  [1.0, 0.42, 0.26], [1.0, 0.55, 0.3], // red / O III + Hα
  [1.0, 0.68, 0.4], [1.0, 0.78, 0.5], // orange / hydrogen
  [0.6, 0.98, 0.5], [0.72, 1.0, 0.55], // green / S II
  [0.45, 0.78, 1.0], // blue / neutral O
]
const CRAB_SYNCHROTRON: [number, number, number][] = [
  [0.62, 0.8, 1.0], [0.78, 0.9, 1.0], [0.7, 0.85, 1.0],
]

function buildCrabNebula(center: THREE.Vector3, radius: number, count: number) {
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const angles = new Float32Array(count)
  const shapes = new Float32Array(count)
  const c = new THREE.Color()
  const filamentCount = Math.floor(count * 0.74)
  // Prolate squash so the remnant reads as an oval cage, not a ball.
  const sx = 1.12
  const sy = 0.86
  const sz = 1.0

  // Tangled filament strands radiating through the volume — the Crab's signature
  // ragged web. Each strand is a slightly curved spoke from near the core to the
  // ragged outer edge; points scatter along it.
  const nStrand = 95
  const strands: { dir: THREE.Vector3; curl: THREE.Vector3; hue: number }[] = []
  for (let k = 0; k < nStrand; k++) {
    const dir = new THREE.Vector3(gaussian(1), gaussian(1), gaussian(1)).normalize()
    const curl = new THREE.Vector3(gaussian(1), gaussian(1), gaussian(1))
      .projectOnPlane(dir)
      .normalize()
      .multiplyScalar(0.18 + Math.random() * 0.3)
    strands.push({ dir, curl, hue: Math.random() })
  }

  for (let i = 0; i < count; i++) {
    if (i < filamentCount) {
      const st = strands[(Math.random() * nStrand) | 0]
      // Along the strand: dense at the bright outer rim, thinning inward.
      const t = 0.34 + Math.pow(Math.random(), 0.75) * 0.74
      const rr = radius * t
      const jitter = radius * (0.05 + (1 - t) * 0.04)
      const px = st.dir.x * rr + st.curl.x * rr * t + gaussian(jitter)
      const py = st.dir.y * rr + st.curl.y * rr * t + gaussian(jitter)
      const pz = st.dir.z * rr + st.curl.z * rr * t + gaussian(jitter)
      positions[i * 3] = center.x + px * sx
      positions[i * 3 + 1] = center.y + py * sy
      positions[i * 3 + 2] = center.z + pz * sz
      // Bias each strand toward one hue family for coherent coloured filaments.
      const idx =
        st.hue < 0.5
          ? (Math.random() * 4) | 0 // red/orange
          : st.hue < 0.78
            ? 4 + ((Math.random() * 2) | 0) // green
            : 6
      const p = CRAB_FILAMENT[idx]
      // Keep filaments below the bloom threshold so their hue survives (dense
      // overlap supplies the glow); dim enough to never read as a flashlight.
      const b = 0.38 + Math.random() * 0.34
      c.setRGB(p[0] * b, p[1] * b, p[2] * b)
      sizes[i] = 6 + Math.random() * 8
      angles[i] = Math.random() * Math.PI * 2
      shapes[i] = 0.5 + Math.random() * 0.45 // elongated → wispy filaments
    } else {
      // Blue-white synchrotron interior, centrally concentrated and bright.
      const t = Math.pow(Math.random(), 0.5)
      positions[i * 3] = center.x + gaussian(radius * 0.5 * t) * sx
      positions[i * 3 + 1] = center.y + gaussian(radius * 0.4 * t) * sy
      positions[i * 3 + 2] = center.z + gaussian(radius * 0.5 * t) * sz
      const p = CRAB_SYNCHROTRON[(Math.random() * CRAB_SYNCHROTRON.length) | 0]
      const b = 0.3 + Math.random() * 0.28
      c.setRGB(p[0] * b, p[1] * b, p[2] * b)
      sizes[i] = 4 + Math.random() * 6
      angles[i] = Math.random() * Math.PI * 2
      shapes[i] = Math.random() * 0.3 // soft, round haze
    }
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  // Central pulsar — a bright blue-white point (not a blinding flash).
  positions[0] = center.x
  positions[1] = center.y
  positions[2] = center.z
  colors[0] = 0.7
  colors[1] = 0.8
  colors[2] = 0.95
  sizes[0] = 10
  shapes[0] = 0
  return galaxyShaderGeometry(positions, colors, sizes, angles, shapes)
}

// ---------------------------------------------------------------------------
// Planetary nebulae — glowing shells cast off by dying stars (Ring, Helix)
// ---------------------------------------------------------------------------
// An expanding shell of gas with a central white-dwarf. Rendered as a thick
// spherical shell of points: seen from any angle the denser limb reads as the
// classic bright "ring", with a teal-ish interior and red/pink outer rim.
interface PlanetaryDef {
  id: string
  name: string
  distanceLy: number
  dir: [number, number, number]
  radius: number
  tilt: [number, number, number]
  inner: [number, number, number]
  outer: [number, number, number]
  core: [number, number, number]
}

const PLANETARY: PlanetaryDef[] = [
  {
    id: 'ring-nebula', name: 'Ring Nebula', distanceLy: 2570, dir: [0.1943, 0.5446, -0.8159],
    radius: 850, tilt: [0.6, 0, 0.35],
    inner: [0.4, 0.85, 0.78], outer: [1.0, 0.42, 0.42], core: [0.75, 0.85, 1.0],
  },
  {
    id: 'helix-nebula', name: 'Helix Nebula', distanceLy: 650, dir: [0.8636, -0.3551, -0.3595],
    radius: 1200, tilt: [1.0, 0, 0.2],
    inner: [0.5, 0.85, 0.82], outer: [1.0, 0.46, 0.4], core: [0.6, 0.8, 1.0],
  },
]

function buildPlanetaryNebula(def: PlanetaryDef, center: THREE.Vector3) {
  const count = 6500
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const angles = new Float32Array(count)
  const shapes = new Float32Array(count)
  const rot = new THREE.Matrix4().makeRotationFromEuler(
    new THREE.Euler(def.tilt[0], def.tilt[1], def.tilt[2]),
  )
  const inner = new THREE.Color(...def.inner)
  const outer = new THREE.Color(...def.outer)
  const v = new THREE.Vector3()
  const c = new THREE.Color()
  for (let i = 0; i < count; i++) {
    const u = Math.random() * 2 - 1
    const th = Math.random() * Math.PI * 2
    const s = Math.sqrt(1 - u * u)
    const r = def.radius * (0.8 + Math.abs(gaussian(0.1)))
    v.set(s * Math.cos(th) * r, u * r * 0.85, s * Math.sin(th) * r).applyMatrix4(rot)
    positions[i * 3] = center.x + v.x
    positions[i * 3 + 1] = center.y + v.y
    positions[i * 3 + 2] = center.z + v.z
    // Teal interior gas → red/pink outer rim; occasional bright Hα knots.
    c.copy(inner).lerp(outer, Math.random())
    if (Math.random() < 0.12) c.setRGB(1.0, 0.4, 0.55)
    const b = 0.4 + Math.random() * 0.4
    colors[i * 3] = c.r * b
    colors[i * 3 + 1] = c.g * b
    colors[i * 3 + 2] = c.b * b
    sizes[i] = 3 + Math.random() * 5
    angles[i] = Math.random() * Math.PI * 2
    shapes[i] = 0.35 + Math.random() * 0.4
  }
  // Central white dwarf.
  positions[0] = center.x
  positions[1] = center.y
  positions[2] = center.z
  colors[0] = def.core[0] * 0.9
  colors[1] = def.core[1] * 0.9
  colors[2] = def.core[2]
  sizes[0] = 9
  shapes[0] = 0
  return galaxyShaderGeometry(positions, colors, sizes, angles, shapes)
}

// ---------------------------------------------------------------------------
// Cosmos
// ---------------------------------------------------------------------------

// Soft radial-gradient sprite used as a coloured glow halo behind nebulae, so
// the clumpy emission points sit inside a luminous cloud (real nebulae glow).
function makeGlowTexture(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.22, 'rgba(255,255,255,0.5)')
  g.addColorStop(0.55, 'rgba(255,255,255,0.14)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}
const GLOW_TEX = makeGlowTexture()

export default function Cosmos() {
  const gl = useThree((s) => s.gl)
  const milkyWay = useMemo(() => buildMilkyWay(60_000), [])
  const kuiper = useMemo(() => buildKuiperBelt(2_500), [])
  const oort = useMemo(() => buildOort(2_500), [])
  const galaxies = useMemo(() => buildGalaxies(14_000), [])

  // Distinct large-scale structure: our Local Group (dwarfs around us) and the
  // Virgo Cluster (a rich cluster at its real sky direction, fly-to-able).
  const localGroup = useMemo(() => buildLocalGroup(60), [])
  const virgo = useMemo(() => {
    const center = new THREE.Vector3(...VIRGO.dir).normalize().multiplyScalar(lyToRenderUnits(VIRGO.distanceLy))
    return { center, geo: buildCluster(center, VIRGO.radius, 320) }
  }, [])
  const crab = useMemo(() => {
    const center = new THREE.Vector3(...CRAB.dir).normalize().multiplyScalar(lyToRenderUnits(CRAB.distanceLy))
    return { center, geo: buildCrabNebula(center, CRAB.radius, 30000) }
  }, [])

  // Named spiral galaxies (real disks) + their positions.
  const namedGalaxies = useMemo(
    () =>
      NAMED_GALAXIES.map((g) => {
        const center = namedGalaxyPosition(g)
        const geo =
          g.id === 'sombrero'
            ? buildSombrero(g, 9_000, center)
            : buildSpiralGalaxy(g, 9_000, center)
        // Own material per galaxy so each can fade by distance.
        return { def: g, center, geo, mat: pointsMaterial(1.3, 0.9) }
      }),
    [],
  )
  // JWST-style nebulae + their positions.
  const nebulae = useMemo(
    () =>
      NEBULAE.map((n) => {
        const center = new THREE.Vector3(...n.dir).normalize().multiplyScalar(lyToRenderUnits(n.distanceLy))
        return { def: n, center, geo: buildNebula(n, 4_000, center) }
      }),
    [],
  )
  // Planetary nebulae (Ring, Helix) — glowing shells round dying stars.
  const planetaries = useMemo(
    () =>
      PLANETARY.map((p) => {
        const center = new THREE.Vector3(...p.dir).normalize().multiplyScalar(lyToRenderUnits(p.distanceLy))
        return { def: p, center, geo: buildPlanetaryNebula(p, center) }
      }),
    [],
  )

  // Coloured glow halos so nebulae read as luminous clouds, not bare points.
  const nebulaGlows = useMemo(() => {
    const glows = nebulae.map((n) => {
      const a = n.def.palette[0]
      const b = n.def.palette[Math.min(1, n.def.palette.length - 1)]
      return {
        key: `${n.def.id}-glow`,
        pos: [n.center.x, n.center.y, n.center.z] as [number, number, number],
        color: new THREE.Color((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2),
        scale: n.def.radius * 3.2,
        opacity: 0.85,
      }
    })
    // Planetary nebulae get a soft halo tinted toward their outer rim colour.
    for (const p of planetaries) {
      const o = p.def.outer
      const inn = p.def.inner
      glows.push({
        key: `${p.def.id}-glow`,
        pos: [p.center.x, p.center.y, p.center.z] as [number, number, number],
        color: new THREE.Color((o[0] + inn[0]) / 2, (o[1] + inn[1]) / 2, (o[2] + inn[2]) / 2),
        scale: p.def.radius * 3.0,
        opacity: 0.6,
      })
    }
    // NB: the Crab gets NO glow halo — its dense filaments are already bright,
    // and a halo turned it into a blinding "flashlight" blob.
    return glows
  }, [nebulae, planetaries])

  const mwMat = useMemo(() => pointsMaterial(1.2, 0.85), [])
  const kuiperMat = useMemo(() => pointsMaterial(1.4, 0.8), [])
  const oortMat = useMemo(() => pointsMaterial(1.2, 0.7), [])

  // Distance-fade the named galaxies: faint, distant smudges from afar, only
  // resolving into bright spirals as you approach their scale — so the wide
  // zoom reads naturally instead of every galaxy blazing at the same size.
  useFrame(({ camera }) => {
    for (const g of namedGalaxies) {
      const dist = camera.position.distanceTo(g.center)
      const r = g.def.radius
      const t = THREE.MathUtils.clamp((dist - r * 5) / (r * 55), 0, 1)
      // eslint-disable-next-line react-hooks/immutability -- R3F per-frame mutation
      g.mat.opacity = THREE.MathUtils.lerp(0.9, 0.08, t)
    }
  })

  const galaxyMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: GALAXY_VERT,
        fragmentShader: GALAXY_FRAG,
        uniforms: { uPixelRatio: { value: gl.getPixelRatio() } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [gl],
  )

  // Register the cosmic shells, named galaxies and nebulae for search + fly-to.
  useEffect(() => {
    const store = useProximityStore.getState()
    for (const s of COSMIC_SHELLS) {
      // These are SCALES centred on the observer, not discrete objects. Anchor
      // them at the origin with a framing radius so fly-to pulls the camera out
      // to that scale looking back at the real structure (Milky Way, cosmic
      // web) — never landing in empty space. Excluded from "nearest".
      store.registerBody({
        id: s.id,
        name: s.name,
        position: [0, 0, 0],
        radius: s.radius * 0.6,
        kind: s.kind,
        noLabel: true,
        excludeFromNearest: true,
        originAnchored: true,
      })
    }
    for (const g of namedGalaxies) {
      store.registerBody({
        id: g.def.id,
        name: g.def.name,
        position: [g.center.x, g.center.y, g.center.z],
        radius: g.def.radius,
        kind: 'galaxy',
        labelRange: g.def.radius * 7,
      })
    }
    for (const n of nebulae) {
      store.registerBody({
        id: n.def.id,
        name: n.def.name,
        position: [n.center.x, n.center.y, n.center.z],
        radius: n.def.radius,
        kind: 'structure',
        labelRange: n.def.radius * 8,
      })
    }
    for (const p of planetaries) {
      store.registerBody({
        id: p.def.id,
        name: p.def.name,
        position: [p.center.x, p.center.y, p.center.z],
        radius: p.def.radius,
        kind: 'structure',
        labelRange: p.def.radius * 9,
      })
    }
    // Virgo Cluster — a discrete structure at its real sky position.
    store.registerBody({
      id: 'virgo-cluster',
      name: 'Virgo Cluster',
      position: [virgo.center.x, virgo.center.y, virgo.center.z],
      radius: VIRGO.radius,
      kind: 'structure',
      labelRange: VIRGO.radius * 7,
    })
    // Crab Nebula (M1) — supernova remnant.
    store.registerBody({
      id: 'crab-nebula',
      name: 'Crab Nebula',
      position: [crab.center.x, crab.center.y, crab.center.z],
      radius: CRAB.radius,
      kind: 'structure',
      labelRange: CRAB.radius * 8,
    })
    return () => {
      for (const s of COSMIC_SHELLS) store.unregisterBody(s.id)
      for (const g of namedGalaxies) store.unregisterBody(g.def.id)
      for (const n of nebulae) store.unregisterBody(n.def.id)
      for (const p of planetaries) store.unregisterBody(p.def.id)
      store.unregisterBody('virgo-cluster')
      store.unregisterBody('crab-nebula')
    }
  }, [namedGalaxies, nebulae, planetaries, virgo, crab])

  return (
    <group>
      <points geometry={kuiper} material={kuiperMat} frustumCulled={false} />
      <points geometry={oort} material={oortMat} frustumCulled={false} />
      <points geometry={milkyWay} material={mwMat} frustumCulled={false} />
      <points geometry={galaxies} material={galaxyMat} frustumCulled={false} />
      <points geometry={localGroup} material={galaxyMat} frustumCulled={false} />
      <points geometry={virgo.geo} material={galaxyMat} frustumCulled={false} />
      <points geometry={crab.geo} material={galaxyMat} frustumCulled={false} />

      {/* Named spiral galaxies you can fly to (Andromeda, Triangulum, …). */}
      {namedGalaxies.map((g) => (
        <points key={g.def.id} geometry={g.geo} material={g.mat} frustumCulled={false} />
      ))}
      {/* Soft coloured glow halos behind the nebulae + Crab: a broad outer halo
          plus a tighter, brighter inner core so they read as luminous clouds. */}
      {nebulaGlows.map((g) => (
        <group key={g.key} position={g.pos}>
          <sprite scale={[g.scale, g.scale, 1]}>
            <spriteMaterial
              map={GLOW_TEX}
              color={g.color}
              transparent
              opacity={g.opacity * 0.6}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </sprite>
          <sprite scale={[g.scale * 0.5, g.scale * 0.5, 1]}>
            <spriteMaterial
              map={GLOW_TEX}
              color={g.color}
              transparent
              opacity={g.opacity}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </sprite>
        </group>
      ))}
      {/* JWST-style emission nebulae. */}
      {nebulae.map((n) => (
        <points key={n.def.id} geometry={n.geo} material={galaxyMat} frustumCulled={false} />
      ))}
      {/* Planetary nebulae (Ring, Helix). */}
      {planetaries.map((p) => (
        <points key={p.def.id} geometry={p.geo} material={galaxyMat} frustumCulled={false} />
      ))}
    </group>
  )
}
