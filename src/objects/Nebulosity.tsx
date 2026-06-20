import { useMemo } from 'react'
import * as THREE from 'three'

// ===========================================================================
// NEBULOSITY — diffuse coloured interstellar gas clouds (the Chandra look)
// ---------------------------------------------------------------------------
// Soft, large, additive sprites in a pink / purple / violet / cyan / gold
// palette, scattered through a shell around the observer and concentrated near
// the galactic plane. They give deep space the colourful, gaseous backdrop of
// NASA's X-ray/optical composites instead of plain black with white dots.
// ===========================================================================

const PALETTE: [number, number, number][] = [
  [1.0, 0.32, 0.62], // magenta / pink
  [0.78, 0.3, 1.0], // purple
  [0.5, 0.38, 0.98], // violet
  [0.32, 0.78, 1.0], // cyan
  [1.0, 0.72, 0.34], // gold
  [0.95, 0.45, 0.85], // rose
]

function gaussian(sigma: number): number {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

// Soft, slightly irregular cloud sprite (radial base + a few offset blobs).
function makeCloudTexture(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')!
  const base = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
  base.addColorStop(0, 'rgba(255,255,255,0.85)')
  base.addColorStop(0.3, 'rgba(255,255,255,0.32)')
  base.addColorStop(0.65, 'rgba(255,255,255,0.08)')
  base.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, 256, 256)
  // Wispy irregularity.
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 16; i++) {
    const x = 128 + gaussian(45)
    const y = 128 + gaussian(45)
    const r = 25 + Math.random() * 70
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `rgba(255,255,255,${0.08 + Math.random() * 0.14})`)
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 256, 256)
  }
  return new THREE.CanvasTexture(c)
}

interface Cloud {
  pos: [number, number, number]
  scale: [number, number, number]
  color: THREE.Color
  opacity: number
  rot: number
}

export default function Nebulosity({
  radius = 80_000,
  count = 260,
}: {
  radius?: number
  count?: number
}) {
  const tex = useMemo(makeCloudTexture, [])
  const clouds = useMemo<Cloud[]>(() => {
    const arr: Cloud[] = []
    for (let i = 0; i < count; i++) {
      // Hug the galactic plane tightly (most emission lives in the band) so the
      // colour reads as faint wispy structure, not big blobs floating overhead.
      const lat = gaussian(0.16)
      const lon = Math.random() * Math.PI * 2
      const r = radius * (0.55 + Math.random() * 0.7)
      const cosLat = Math.cos(lat)
      const p = PALETTE[(Math.random() * PALETTE.length) | 0]
      // Small, elongated wisps (many overlapping → texture, not a smear).
      const s = radius * (0.03 + Math.random() * 0.1)
      const stretch = 1.3 + Math.random() * 2.2
      // Dim + slightly desaturated so it's a faint tint, never a neon cloud.
      const dim = 0.55 + Math.random() * 0.3
      arr.push({
        pos: [r * cosLat * Math.cos(lon), r * Math.sin(lat), r * cosLat * Math.sin(lon)],
        scale: [s * stretch, s, 1],
        color: new THREE.Color(p[0], p[1], p[2]).multiplyScalar(dim),
        opacity: 0.018 + Math.random() * 0.05,
        rot: Math.random() * Math.PI * 2,
      })
    }
    return arr
  }, [radius, count])

  return (
    <group>
      {clouds.map((c, i) => (
        <sprite key={i} position={c.pos} scale={c.scale}>
          <spriteMaterial
            map={tex}
            color={c.color}
            rotation={c.rot}
            transparent
            opacity={c.opacity}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </sprite>
      ))}
    </group>
  )
}
