// ===========================================================================
// HUMAN-MADE & SURFACE OBJECTS
// ---------------------------------------------------------------------------
// Named stations/satellites orbiting Earth, the Moon and Mars, plus Apollo
// landing flags on the Moon and rovers on Mars. Rendered as moving point-glints
// with proximity-gated labels; searchable and fly-to-able like any body.
// Altitudes are real (km); orbital/spin periods in hours.
// ===========================================================================

import type { BodyKind } from './scaleConfig'

export type ParentId = 'earth' | 'moon' | 'mars'

export interface OrbiterObject {
  id: string
  name: string
  kind: Extract<BodyKind, 'satellite' | 'station'>
  parent: ParentId
  /** Orbit altitude above the parent's surface, in km. */
  altitudeKm: number
  /** Orbital period, hours. */
  periodHours: number
  /** Orbital inclination, degrees. */
  inclinationDeg: number
  /** Starting phase, degrees (spreads objects around their orbits). */
  phaseDeg: number
  /** Glint colour [r,g,b] 0–1. */
  color: [number, number, number]
}

export interface SurfaceObject {
  id: string
  name: string
  kind: Extract<BodyKind, 'rover' | 'flag'>
  parent: ParentId
  latDeg: number
  lonDeg: number
  /** Parent rotation (sidereal) period in hours, for surface co-rotation. */
  parentSpinHours: number
  color: [number, number, number]
}

/**
 * Iconic bounding radius (render units; 1 unit = 6371 km) per kind. Real
 * spacecraft (~100 m) are far below the renderer's ~6.4 km near plane, so they
 * are drawn at an exaggerated, *visible* scale — large enough to fly up to and
 * read as a real structure, small enough to still look like specks beside their
 * parent planet. Shared by the proximity radius (fly-to framing) and the 3D
 * models so both agree.
 */
export const MODEL_RADII: Record<'station' | 'satellite' | 'rover' | 'flag', number> = {
  station: 0.012,
  satellite: 0.008,
  rover: 0.006,
  flag: 0.006,
}

const WHITE: [number, number, number] = [1, 1, 1]
const GOLD: [number, number, number] = [1, 0.82, 0.45]
const CYAN: [number, number, number] = [0.5, 0.85, 1]
const RED: [number, number, number] = [1, 0.5, 0.4]

// Sidereal rotation periods used for surface co-rotation.
const MOON_SPIN_H = 655.7 // 27.322 d (tidally locked)
const MARS_SPIN_H = 24.623

export const ORBITERS: OrbiterObject[] = [
  // --- Earth ---
  { id: 'iss', name: 'ISS', kind: 'station', parent: 'earth', altitudeKm: 420, periodHours: 1.54, inclinationDeg: 51.6, phaseDeg: 0, color: WHITE },
  { id: 'tiangong', name: 'Tiangong', kind: 'station', parent: 'earth', altitudeKm: 390, periodHours: 1.51, inclinationDeg: 41.5, phaseDeg: 120, color: WHITE },
  { id: 'hubble', name: 'Hubble', kind: 'satellite', parent: 'earth', altitudeKm: 540, periodHours: 1.61, inclinationDeg: 28.5, phaseDeg: 200, color: CYAN },
  { id: 'gps', name: 'GPS IIF-2', kind: 'satellite', parent: 'earth', altitudeKm: 20180, periodHours: 11.97, inclinationDeg: 55, phaseDeg: 60, color: GOLD },
  { id: 'goes16', name: 'GOES-16', kind: 'satellite', parent: 'earth', altitudeKm: 35786, periodHours: 23.93, inclinationDeg: 0.1, phaseDeg: 280, color: GOLD },
  // --- Moon ---
  { id: 'lro', name: 'Lunar Recon Orbiter', kind: 'satellite', parent: 'moon', altitudeKm: 50, periodHours: 2.0, inclinationDeg: 90, phaseDeg: 0, color: CYAN },
  // --- Mars ---
  { id: 'mro', name: 'Mars Recon Orbiter', kind: 'satellite', parent: 'mars', altitudeKm: 300, periodHours: 1.95, inclinationDeg: 93, phaseDeg: 0, color: RED },
  { id: 'maven', name: 'MAVEN', kind: 'satellite', parent: 'mars', altitudeKm: 6200, periodHours: 4.5, inclinationDeg: 75, phaseDeg: 150, color: GOLD },
]

export const SURFACE_OBJECTS: SurfaceObject[] = [
  // --- Apollo flags (Moon, near side) ---
  { id: 'apollo11', name: 'Apollo 11', kind: 'flag', parent: 'moon', latDeg: 0.67, lonDeg: 23.47, parentSpinHours: MOON_SPIN_H, color: WHITE },
  { id: 'apollo17', name: 'Apollo 17', kind: 'flag', parent: 'moon', latDeg: 20.19, lonDeg: 30.77, parentSpinHours: MOON_SPIN_H, color: WHITE },
  // --- Mars rovers ---
  { id: 'perseverance', name: 'Perseverance', kind: 'rover', parent: 'mars', latDeg: 18.44, lonDeg: 77.45, parentSpinHours: MARS_SPIN_H, color: RED },
  { id: 'curiosity', name: 'Curiosity', kind: 'rover', parent: 'mars', latDeg: -4.59, lonDeg: 137.44, parentSpinHours: MARS_SPIN_H, color: RED },
]
