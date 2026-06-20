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

const PALETTE: [number, number, number][] = [
  [0.85, 0.25, 0.5], // magenta / pink
  [0.52, 0.26, 0.82], // purple
  [0.36, 0.32, 0.85], // violet
  [0.22, 0.6, 0.85], // cyan
  [0.85, 0.6, 0.32], // gold
]

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
    const band = Math.exp(-(ny * ny) / (2 * 0.3 * 0.3)) // galactic-plane concentration
    for (let px = 0; px < w; px++) {
      // Wrap longitude through cos/sin so there's no vertical seam.
      const lon = (px / w) * Math.PI * 2
      const cx = Math.cos(lon)
      const cz = Math.sin(lon)
      const cloud = fbm(cx * 3.0 + 5, v * 5.0 + cz * 3.0 + 10, 6)
      const fine = fbm(cx * 9.0 + 50, v * 11.0 + cz * 9.0 + 90, 4)
      let density = band * Math.pow(Math.max(0, cloud - 0.3) * 1.9, 1.3)
      density *= 0.5 + 0.5 * fine
      density = Math.min(1, density)

      // Region colour from low-frequency noise → smooth patches of each hue.
      const cn = fbm(cx * 1.4 + 200, v * 1.8 + cz * 1.4 + 300, 3)
      const idx = Math.min(PALETTE.length - 1, Math.max(0, Math.floor(cn * PALETTE.length * 1.25)))
      const p = PALETTE[idx]
      col.setRGB(p[0], p[1], p[2])

      const i4 = (py * w + px) * 4
      d[i4] = col.r * 255
      d[i4 + 1] = col.g * 255
      d[i4 + 2] = col.b * 255
      d[i4 + 3] = density * 105 // faint but visible
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
    <mesh frustumCulled={false}>
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
