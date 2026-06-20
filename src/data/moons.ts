// ===========================================================================
// NATURAL SATELLITES
// ---------------------------------------------------------------------------
// The major moons of Mars, Jupiter, Saturn, Uranus and Neptune (Earth's Moon
// is rendered separately as a hero body). SIZES are true-relative (render unit
// = 1 Earth radius = 6371 km) with a small floor so the tiniest moons stay
// visible. Orbit radii are COMPRESSED to a multiple of the parent's radius
// (consistent with the app's hybrid scale) so a planet's whole moon family
// frames together when you fly to it; real ORBITAL-PERIOD ratios are preserved
// so relative motion is correct (and Triton orbits retrograde).
// ===========================================================================

import { BODY_RADII } from './scaleConfig'

export type PlanetId = keyof typeof BODY_RADII

export interface MoonData {
  id: string
  name: string
  parent: PlanetId
  /** Sphere radius, render units. */
  radiusUnits: number
  /** Orbit radius from the parent's centre, render units. */
  orbitUnits: number
  /** Real sidereal period in days (negative = retrograde). */
  periodDays: number
  inclinationDeg: number
  phaseDeg: number
  color: string
}

interface MoonSpec {
  id: string
  name: string
  parent: PlanetId
  radiusKm: number
  /** Orbit radius as a multiple of the parent planet's radius. */
  orbitMul: number
  periodDays: number
  inclinationDeg: number
  phaseDeg: number
  color: string
}

/** Floor on moon render-radius so tiny bodies (Phobos, Mimas…) stay visible. */
const MIN_MOON_RADIUS = 0.05

const SPECS: MoonSpec[] = [
  // --- Mars ---
  { id: 'phobos', name: 'Phobos', parent: 'mars', radiusKm: 11, orbitMul: 1.6, periodDays: 0.319, inclinationDeg: 1, phaseDeg: 0, color: '#6f655c' },
  { id: 'deimos', name: 'Deimos', parent: 'mars', radiusKm: 6, orbitMul: 2.3, periodDays: 1.26, inclinationDeg: 2, phaseDeg: 140, color: '#7a7065' },
  // --- Jupiter (Galilean) ---
  { id: 'io', name: 'Io', parent: 'jupiter', radiusKm: 1821, orbitMul: 1.7, periodDays: 1.77, inclinationDeg: 0.04, phaseDeg: 0, color: '#e3d27a' },
  { id: 'europa', name: 'Europa', parent: 'jupiter', radiusKm: 1561, orbitMul: 2.3, periodDays: 3.55, inclinationDeg: 0.47, phaseDeg: 70, color: '#d8cdbb' },
  { id: 'ganymede', name: 'Ganymede', parent: 'jupiter', radiusKm: 2634, orbitMul: 3.0, periodDays: 7.15, inclinationDeg: 0.2, phaseDeg: 160, color: '#9b8e7d' },
  { id: 'callisto', name: 'Callisto', parent: 'jupiter', radiusKm: 2410, orbitMul: 3.9, periodDays: 16.69, inclinationDeg: 0.28, phaseDeg: 240, color: '#5f534a' },
  // --- Saturn (outside the rings) ---
  { id: 'mimas', name: 'Mimas', parent: 'saturn', radiusKm: 198, orbitMul: 2.6, periodDays: 0.94, inclinationDeg: 1.6, phaseDeg: 20, color: '#cdd2d4' },
  { id: 'enceladus', name: 'Enceladus', parent: 'saturn', radiusKm: 252, orbitMul: 2.9, periodDays: 1.37, inclinationDeg: 0.0, phaseDeg: 100, color: '#eef2f4' },
  { id: 'rhea', name: 'Rhea', parent: 'saturn', radiusKm: 764, orbitMul: 3.4, periodDays: 4.52, inclinationDeg: 0.35, phaseDeg: 200, color: '#c3c8ca' },
  { id: 'titan', name: 'Titan', parent: 'saturn', radiusKm: 2575, orbitMul: 4.1, periodDays: 15.95, inclinationDeg: 0.33, phaseDeg: 300, color: '#c98f3c' },
  { id: 'iapetus', name: 'Iapetus', parent: 'saturn', radiusKm: 735, orbitMul: 5.0, periodDays: 79.3, inclinationDeg: 15.5, phaseDeg: 45, color: '#8a7560' },
  // --- Uranus ---
  { id: 'miranda', name: 'Miranda', parent: 'uranus', radiusKm: 236, orbitMul: 1.8, periodDays: 1.41, inclinationDeg: 4.2, phaseDeg: 0, color: '#9aa3a6' },
  { id: 'ariel', name: 'Ariel', parent: 'uranus', radiusKm: 579, orbitMul: 2.2, periodDays: 2.52, inclinationDeg: 0.3, phaseDeg: 80, color: '#b7bec0' },
  { id: 'umbriel', name: 'Umbriel', parent: 'uranus', radiusKm: 585, orbitMul: 2.6, periodDays: 4.14, inclinationDeg: 0.36, phaseDeg: 160, color: '#8f989b' },
  { id: 'titania', name: 'Titania', parent: 'uranus', radiusKm: 789, orbitMul: 3.1, periodDays: 8.71, inclinationDeg: 0.14, phaseDeg: 240, color: '#b0b7b9' },
  { id: 'oberon', name: 'Oberon', parent: 'uranus', radiusKm: 761, orbitMul: 3.6, periodDays: 13.46, inclinationDeg: 0.1, phaseDeg: 310, color: '#9aa1a3' },
  // --- Neptune (Triton is retrograde) ---
  { id: 'proteus', name: 'Proteus', parent: 'neptune', radiusKm: 210, orbitMul: 1.8, periodDays: 1.12, inclinationDeg: 0.5, phaseDeg: 30, color: '#4f4f52' },
  { id: 'triton', name: 'Triton', parent: 'neptune', radiusKm: 1353, orbitMul: 2.6, periodDays: -5.88, inclinationDeg: 20, phaseDeg: 200, color: '#cdb6ad' },
]

export const MOONS: MoonData[] = SPECS.map((s) => ({
  id: s.id,
  name: s.name,
  parent: s.parent,
  radiusUnits: Math.max(s.radiusKm / 6371, MIN_MOON_RADIUS),
  orbitUnits: BODY_RADII[s.parent] * s.orbitMul,
  periodDays: s.periodDays,
  inclinationDeg: s.inclinationDeg,
  phaseDeg: s.phaseDeg,
  color: s.color,
}))
