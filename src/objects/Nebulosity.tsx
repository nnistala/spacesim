import { useMemo } from 'react'
import * as THREE from 'three'

// ===========================================================================
// NEBULOSITY — faint interstellar gas painted onto the background sky.
// ---------------------------------------------------------------------------
// A single large sky-sphere with a procedural fractal-noise (FBM) texture, so
// the colour is CONTINUOUS and seamless — no repeating sprite "petals". Emission
// concentrates in the galactic-plane band and is tinted with a soft
// pink/purple/violet/cyan/gold palette, kept faint so it reads as real
// background gas rather than a foreground cloud.
// ===========================================================================

// AUTHENTIC deep-space colours (emission / reflection / dust / X-ray), ordered
// by hue so adjacent entries blend into smooth gradients:
//   Hα+SII red → dust orange → star/dust gold → OIII teal → reflection blue →
//   X-ray violet → purple → Hα magenta → rose pink → (wraps back to red).
const PALETTE: [number, number, number][] = [
  [0.86, 0.22, 0.22], // deep red — hydrogen-α / sulfur-II
  [0.92, 0.45, 0.26], // orange — warm dust
  [0.95, 0.72, 0.36], // golden amber — starlight / dust
  [0.46, 0.78, 0.7], // teal — doubly-ionized oxygen (OIII)
  [0.28, 0.6, 0.92], // blue — reflection nebula
  [0.44, 0.38, 0.92], // violet — X-ray composite
  [0.64, 0.3, 0.88], // purple
  [0.88, 0.26, 0.64], // magenta — hydrogen-α
  [0.96, 0.48, 0.64], // rose pink
]

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

function makeNebulaTexture(w: number, h: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(w, h)
  const d = img.data

  const hash = (x: number, y: number): number => {
    let n = (x * 374761393 + y * 668265263) | 0
    n = ((n ^ (n >> 13)) * 1274126177) | 0
    return ((n ^ (n >> 16)) >>> 0) / 4294967296
  }
  const vnoise = (x: number, y: number): number => {
    const ix = Math.floor(x)
    const iy = Math.floor(y)
    const fx = x - ix
    const fy = y - iy
    const sx = fx * fx * (3 - 2 * fx)
    const sy = fy * fy * (3 - 2 * fy)
    const n00 = hash(ix, iy)
    const n10 = hash(ix + 1, iy)
    const n01 = hash(ix, iy + 1)
    const n11 = hash(ix + 1, iy + 1)
    return (n00 + (n10 - n00) * sx) + ((n01 + (n11 - n01) * sx) - (n00 + (n10 - n00) * sx)) * sy
  }
  const fbm = (x: number, y: number, oct: number): number => {
    let v = 0
    let a = 0.5
    let f = 1
    for (let i = 0; i < oct; i++) {
      v += a * vnoise(x * f, y * f)
      a *= 0.5
      f *= 2.07
    }
    return v
  }
  const col = new THREE.Color()
  for (let py = 0; py < h; py++) {
    const v = py / h
    const ny = (v - 0.5) * 2
    // Wide, soft band so the smoke is long and broad, not a tight stripe.
    const band = Math.exp(-(ny * ny) / (2 * 0.42 * 0.42))
    for (let px = 0; px < w; px++) {
      // Wrap longitude through cos/sin so there's no vertical seam.
      const lon = (px / w) * Math.PI * 2
      const cx = Math.cos(lon)
      const cz = Math.sin(lon)
      // Broad swells × a finer "smoke" layer → wide, noisy, fumy texture.
      const broad = fbm(cx * 1.3 + 5, v * 1.7 + cz * 1.3 + 10, 4)
      const smoke = fbm(cx * 3.6 + 50, v * 4.4 + cz * 3.6 + 80, 5)
      let density = band * Math.pow(Math.max(0, broad - 0.3) * 2.0, 1.2)
      density *= 0.35 + 0.65 * smoke // smoky modulation, fades into dark
      density = Math.min(1, density)

      // Smoothly blend BETWEEN authentic palette colours (no hard patches).
      const cn = fbm(cx * 0.8 + 200, v * 1.0 + cz * 0.8 + 300, 3)
      let hp = Math.min(0.999, Math.max(0, cn * 1.2)) * (PALETTE.length - 1)
      const i0 = Math.floor(hp)
      const f = hp - i0
      const a = PALETTE[i0]
      const b2 = PALETTE[i0 + 1]
      col.setRGB(lerp(a[0], b2[0], f), lerp(a[1], b2[1], f), lerp(a[2], b2[2], f))

      const i4 = (py * w + px) * 4
      d[i4] = col.r * 255
      d[i4 + 1] = col.g * 255
      d[i4 + 2] = col.b * 255
      d[i4 + 3] = density * 115 // visible smoky colour that still blends to dark
    }
  }
  ctx.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export default function Nebulosity({ radius = 82_000 }: { radius?: number }) {
  const tex = useMemo(() => makeNebulaTexture(2048, 1024), [])
  return (
    // Tilt to match the Milky Way disk (Cosmos buildMilkyWay) so the coloured
    // smoke wraps the galactic band, not the ecliptic.
    <mesh frustumCulled={false} rotation={[0.5, 0.65, 0.28]}>
      <sphereGeometry args={[radius, 48, 32]} />
      <meshBasicMaterial
        map={tex}
        side={THREE.BackSide}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  )
}
