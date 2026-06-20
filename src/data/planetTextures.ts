// ===========================================================================
// PLANET VISUAL ASSETS
// ---------------------------------------------------------------------------
// Maps each planet id to its vendored NASA-derived textures (Solar System
// Scope, CC-BY 4.0). Ring extents are expressed in BODY RADII so they scale
// with the planet's true relative size under the hybrid scale system.
// ===========================================================================

export interface RingVisual {
  texture: string
  /** Inner radius as a multiple of the planet's radius. */
  inner: number
  /** Outer radius as a multiple of the planet's radius. */
  outer: number
}

export interface PlanetVisual {
  /** Surface diffuse map. */
  texture: string
  /** Optional separate cloud/atmosphere layer (e.g. Venus' sulfuric haze). */
  clouds?: string
  /** Optional ring system (Saturn). */
  rings?: RingVisual
}

export const PLANET_VISUALS: Record<string, PlanetVisual> = {
  mercury: { texture: '/textures/2k_mercury.jpg' },
  venus: {
    texture: '/textures/2k_venus_surface.jpg',
    clouds: '/textures/2k_venus_atmosphere.jpg',
  },
  mars: { texture: '/textures/2k_mars.jpg' },
  jupiter: { texture: '/textures/2k_jupiter.jpg' },
  saturn: {
    texture: '/textures/2k_saturn.jpg',
    // Real ring span: ~1.11 R (D ring) out to ~2.27 R (F ring edge).
    rings: {
      texture: '/textures/2k_saturn_ring_alpha.png',
      inner: 1.18,
      outer: 2.27,
    },
  },
  uranus: { texture: '/textures/2k_uranus.jpg' },
  neptune: { texture: '/textures/2k_neptune.jpg' },
}
