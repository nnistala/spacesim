// ===========================================================================
// HYBRID SCALE SYSTEM
// ---------------------------------------------------------------------------
// 1 render unit = 1 Earth radius = 6,371 km  (GLOBAL — true for every body's
// size and for proximity/altitude readouts).
//
// Body SIZES are kept at true relative scale (the Sun really is 109x Earth).
// Body DISTANCES (heliocentric gaps) are log-compressed so the solar system
// composes beautifully and travel stays tractable. Local systems (Earth-Moon)
// stay near-real for authenticity.
// ===========================================================================

/** Kilometres represented by one render unit (= Earth's radius). */
export const KM_PER_UNIT = 6_371

/** 1 Astronomical Unit in km. */
export const AU_KM = 149_597_870.7

/** 1 light-year in km. */
export const LIGHT_YEAR_KM = 9.4607e12

/** Render-space distance assigned to Earth's 1 AU orbit (the anchor). */
export const EARTH_ORBIT_UNITS = 2000

/** Compression exponent for heliocentric distances (1 = real, <1 = pulled in). */
export const DISTANCE_COMPRESSION = 0.65

/**
 * Global simulation time scale: simulated seconds per real second, shared by
 * every animated body (planet spin, Moon orbit, satellites, surface markers)
 * so motion stays coherent and calm. 100 → the ISS (~92 min orbit) laps Earth
 * in ~55s, readable; planets rotate gently over minutes.
 */
export const TIME_SCALE = 100

/**
 * Map a real heliocentric distance (in AU) to render units.
 * Earth (1 AU) lands exactly on EARTH_ORBIT_UNITS; outer planets are pulled in.
 */
export function auToRenderUnits(au: number): number {
  if (au <= 0) return 0
  return EARTH_ORBIT_UNITS * Math.pow(au, DISTANCE_COMPRESSION)
}

/**
 * Map a 3D heliocentric position (in AU) into hybrid render units.
 * The radial distance is log-compressed (so the system composes) while the
 * direction — and therefore the Keplerian ellipse's shape — is preserved.
 */
export function auPositionToRenderUnits(
  x: number,
  y: number,
  z: number,
): [number, number, number] {
  const rAU = Math.sqrt(x * x + y * y + z * z)
  if (rAU === 0) return [0, 0, 0]
  const k = auToRenderUnits(rAU) / rAU
  return [x * k, y * k, z * k]
}

/** True relative body radii, in render units (Earth radius = 1). */
export const BODY_RADII = {
  sun: 109.3,
  mercury: 0.383,
  venus: 0.949,
  earth: 1.0,
  moon: 0.2727,
  mars: 0.532,
  jupiter: 10.97,
  saturn: 9.14,
  uranus: 3.98,
  neptune: 3.86,
} as const

/** Earth–Moon distance kept near-real (60.3 Earth radii) for an authentic local system. */
export const MOON_DISTANCE_UNITS = 60.3

/** Canonical render positions for the hero bodies (Sun at origin). */
export const SUN_POSITION: [number, number, number] = [0, 0, 0]
export const EARTH_POSITION: [number, number, number] = [EARTH_ORBIT_UNITS, 0, 0]

/**
 * Format a render-space distance as a human-readable real distance.
 * Accurate as a proximity/altitude readout (1 unit = 6,371 km).
 */
export function formatRealDistance(renderUnits: number): string {
  const km = renderUnits * KM_PER_UNIT

  if (km < 1) {
    return `${(km * 1000).toFixed(0)} m`
  }
  if (km < 1_000_000) {
    return `${Math.round(km).toLocaleString()} km`
  }
  const au = km / AU_KM
  if (au < 0.01) {
    return `${(km / 1000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} thousand km`
  }
  if (au < 1000) {
    return `${au.toFixed(3)} AU`
  }
  const ly = km / LIGHT_YEAR_KM
  return `${ly.toFixed(3)} ly`
}

/** Category of a body — drives search grouping, label gating and icons. */
export type BodyKind =
  | 'star'
  | 'planet'
  | 'moon'
  | 'satellite'
  | 'station'
  | 'rover'
  | 'flag'
  | 'galaxy'
  | 'structure'

/** A body the navigator can measure distance to, for the HUD readout. */
export interface MeasurableBody {
  id: string
  name: string
  /** World position in render units. */
  position: [number, number, number]
  /** Surface radius in render units (distance is measured to the surface). */
  radius: number
  /** Category (defaults to 'planet' if unset). */
  kind?: BodyKind
  /**
   * Max camera distance (render units) at which this body's label shows.
   * Undefined = always visible (Sun, planets). Small bodies set a short range
   * so they don't clutter the system view.
   */
  labelRange?: number
  /** Registered for search/fly-to but never draws a 3D label (cosmic shells). */
  noLabel?: boolean
  /** Skip in the "nearest body" computation (huge abstract shells centred on
   * the observer would otherwise always win). */
  excludeFromNearest?: boolean
  /**
   * This body legitimately lives at the origin (cosmic-scale shells centred on
   * the observer). Without this, fly-to treats a [0,0,0] position as "not yet
   * positioned" and refuses to navigate. Set so the navigator flies the camera
   * OUT to the shell's scale and looks back at the structure.
   */
  originAnchored?: boolean
}

const SPEED_OF_LIGHT_KMS = 299_792.458

/**
 * Format a render-space speed (units/second) as a real speed. Uses the hybrid
 * scale (1 unit = 6,371 km); shows km/s up to a fraction of light, then × c.
 */
export function formatRealSpeed(unitsPerSecond: number): {
  display: string
  unit: string
} {
  const kms = Math.abs(unitsPerSecond) * KM_PER_UNIT
  if (kms >= 0.01 * SPEED_OF_LIGHT_KMS) {
    return { display: `${(kms / SPEED_OF_LIGHT_KMS).toFixed(2)} c`, unit: 'c' }
  }
  if (kms >= 1) {
    return { display: `${Math.round(kms).toLocaleString()} km/s`, unit: 'km/s' }
  }
  return { display: `${Math.round(kms * 1000)} m/s`, unit: 'm/s' }
}
