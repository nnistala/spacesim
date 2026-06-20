import { useMemo } from 'react'
import * as THREE from 'three'

// ===========================================================================
// NEBULOSITY — a barely-there colour wash painted onto the background sky.
// ---------------------------------------------------------------------------
// One sky-sphere with a procedural fractal-noise (FBM) texture: faint, broad,
// soft pink/purple/cyan/gold tint concentrated in a wide band. Kept VERY light
// so it's just perceptible — never muddy contour bands or distinct clouds.
// ===========================================================================

const PALETTE: [number, number, number][] = [
  [0.85, 0.3, 0.55], // pink / magenta
  [0.55, 0.3, 0.82], // purple
  [0.4, 0.4, 0.85], // violet-blue
  [0.3, 0.62, 0.82], // cyan
  [0.82, 0.62, 0.36], // soft gold
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
    const nx0 = n00 + (n10 - n00) * sx
    const nx1 = n01 + (n11 - n01) * sx
    return nx0 + (nx1 - nx0) * sy
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
    const band = Math.exp(-(ny * ny) / (2 * 0.42 * 0.42)) // wide, soft band
    for (let px = 0; px < w; px++) {
      // Wrap longitude through cos/sin so there's no vertical seam.
      const lon = (px / w) * Math.PI * 2
      const cx = Math.cos(lon)
      const cz = Math.sin(lon)
      // Low frequency → big, broad, lengthy swells (no fine wisps or contours).
      const cloud = fbm(cx * 1.3 + 5, v * 1.7 + cz * 1.3 + 10, 4)
      let density = band * Math.pow(Math.max(0, cloud - 0.32) * 2.0, 1.2)
      density = Math.min(1, density)

      const cn = fbm(cx * 0.8 + 200, v * 1.0 + cz * 0.8 + 300, 3)
      const idx = Math.min(PALETTE.length - 1, Math.max(0, Math.floor(cn * PALETTE.length * 1.25)))
      const p = PALETTE[idx]
      col.setRGB(p[0], p[1], p[2])

      const i4 = (py * w + px) * 4
      d[i4] = col.r * 255
      d[i4 + 1] = col.g * 255
      d[i4 + 2] = col.b * 255
      d[i4 + 3] = density * 40 // super-light: barely perceptible
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
