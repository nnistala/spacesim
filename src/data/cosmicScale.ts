// ===========================================================================
// LOGARITHMIC COSMIC SCALE
// ---------------------------------------------------------------------------
// Beyond Neptune, real distances span 14 orders of magnitude (Kuiper belt at
// ~5e-4 ly to the observable-universe edge at ~4.65e10 ly). We compress them
// onto a logarithmic radial map — exactly the Budassi / "map of the known
// universe" projection: the observer sits at the centre and every shell sits
// at a render radius proportional to log10(distance). This keeps the whole
// universe inside a bounded, float-safe region (no floating origin needed).
// ===========================================================================

import { EARTH_ORBIT_UNITS, DISTANCE_COMPRESSION, auToRenderUnits } from './scaleConfig'
import type { BodyKind } from './scaleConfig'

/** Light-years per AU. */
export const LY_PER_AU = 1 / 63_241.077

// Neptune is the anchor where the planetary (hybrid) scale hands off to the
// logarithmic cosmic scale.
const NEPTUNE_AU = 30.07
export const NEPTUNE_UNITS = EARTH_ORBIT_UNITS * Math.pow(NEPTUNE_AU, DISTANCE_COMPRESSION)
const NEPTUNE_LY = NEPTUNE_AU * LY_PER_AU

/** Radius of the observable universe, light-years. */
export const OBSERVABLE_LY = 4.65e10
/** Render radius assigned to the observable-universe boundary. */
export const COSMIC_MAX_UNITS = 240_000

const LOG_NEPTUNE = Math.log10(NEPTUNE_LY)
const LOG_OBSERVABLE = Math.log10(OBSERVABLE_LY)
/** Render units added per decade (×10) of real distance. */
export const UNITS_PER_DECADE =
  (COSMIC_MAX_UNITS - NEPTUNE_UNITS) / (LOG_OBSERVABLE - LOG_NEPTUNE)

/**
 * Map a real distance (light-years) to a render radius. Within the planetary
 * region it defers to the hybrid AU scale; beyond Neptune it is logarithmic.
 */
export function lyToRenderUnits(ly: number): number {
  if (ly <= NEPTUNE_LY) return auToRenderUnits(ly / LY_PER_AU)
  return NEPTUNE_UNITS + UNITS_PER_DECADE * (Math.log10(ly) - LOG_NEPTUNE)
}

export interface CosmicShell {
  id: string
  name: string
  /** Characteristic real distance, light-years. */
  distanceLy: number
  kind: BodyKind
  /** Render radius (filled from distanceLy). */
  radius: number
}

function shell(id: string, name: string, distanceLy: number, kind: BodyKind): CosmicShell {
  return { id, name, distanceLy, kind, radius: lyToRenderUnits(distanceLy) }
}

// Key shells of the known universe, inner → outer.
export const COSMIC_SHELLS: CosmicShell[] = [
  shell('kuiper-belt', 'Kuiper Belt', 50 * LY_PER_AU, 'structure'),
  shell('oort-cloud', 'Oort Cloud', 1, 'structure'),
  // NB: Alpha Centauri is NOT an observer-centred shell — it's a real triple
  // star at a real sky direction, rendered by src/objects/AlphaCentauri.tsx.
  shell('milky-way', 'Milky Way', 27_000, 'galaxy'),
  shell('local-group', 'Local Group', 1e7, 'structure'),
  // NB: Virgo Cluster is a discrete structure at a real sky direction, rendered
  // + registered by Cosmos.tsx (buildCluster) — not an observer-centred shell.
  shell('laniakea', 'Laniakea Supercluster', 5e8, 'structure'),
  shell('cosmic-web', 'Cosmic Web', 5e9, 'structure'),
  shell('observable-universe', 'Observable Universe', OBSERVABLE_LY, 'structure'),
]

// Convenient named radii used by the Cosmos renderer.
export const OORT_UNITS = lyToRenderUnits(1)
export const LOCAL_STARS_UNITS = lyToRenderUnits(4.37)
export const MILKY_WAY_INNER = lyToRenderUnits(50)
export const MILKY_WAY_OUTER = lyToRenderUnits(80_000)
export const MILKY_WAY_CENTER = lyToRenderUnits(27_000)
export const GALAXY_FIELD_INNER = lyToRenderUnits(2.5e6)
export const GALAXY_FIELD_OUTER = COSMIC_MAX_UNITS
