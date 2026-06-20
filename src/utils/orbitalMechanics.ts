import { DEG_TO_RAD, J2000_EPOCH } from '../data/physicsConstants'
import type { PlanetData } from '../data/physicsConstants'
import { SCENE_SCALE } from '../data/physicsConstants'

export function solveKeplerEquation(
  M: number,
  e: number,
  tolerance: number = 1e-8,
  maxIterations: number = 50
): number {
  let E = M
  for (let i = 0; i < maxIterations; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E))
    E -= dE
    if (Math.abs(dE) < tolerance) break
  }
  return E
}

export function meanAnomalyToTrueAnomaly(M: number, e: number): number {
  const E = solveKeplerEquation(M, e)
  const sinNu = (Math.sqrt(1 - e * e) * Math.sin(E)) / (1 - e * Math.cos(E))
  const cosNu = (Math.cos(E) - e) / (1 - e * Math.cos(E))
  return Math.atan2(sinNu, cosNu)
}

export function keplerianToCartesian(
  a: number,
  e: number,
  i: number,
  omega: number,
  Omega: number,
  nu: number
): { x: number; y: number; z: number } {
  const r = (a * (1 - e * e)) / (1 + e * Math.cos(nu))

  const xOrbital = r * Math.cos(nu)
  const yOrbital = r * Math.sin(nu)

  const cosO = Math.cos(Omega)
  const sinO = Math.sin(Omega)
  const cosI = Math.cos(i)
  const sinI = Math.sin(i)
  const cosW = Math.cos(omega)
  const sinW = Math.sin(omega)

  const x = xOrbital * (cosO * cosW - sinO * sinW * cosI) -
    yOrbital * (cosO * sinW + sinO * cosW * cosI)

  const y = xOrbital * (sinO * cosW + cosO * sinW * cosI) -
    yOrbital * (sinO * sinW - cosO * cosW * cosI)

  const z = xOrbital * (sinW * sinI) + yOrbital * (cosW * sinI)

  return { x, y, z }
}

export function dateToJulianDate(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5
}

export function daysSinceJ2000(date: Date): number {
  return dateToJulianDate(date) - J2000_EPOCH
}

export function getMeanAnomaly(
  M0Deg: number,
  semiMajorAxisAU: number,
  daysSinceEpoch: number
): number {
  const n = (2 * Math.PI) / (365.25 * Math.pow(semiMajorAxisAU, 1.5))
  return (M0Deg * DEG_TO_RAD + n * daysSinceEpoch) % (2 * Math.PI)
}

export function getPlanetPosition(
  planet: PlanetData,
  date: Date
): { x: number; y: number; z: number } {
  const days = daysSinceJ2000(date)
  const orb = planet.orbital

  const M = getMeanAnomaly(orb.meanAnomalyAtEpochDeg, orb.semiMajorAxisAU, days)
  const nu = meanAnomalyToTrueAnomaly(M, orb.eccentricity)

  const pos = keplerianToCartesian(
    orb.semiMajorAxisAU,
    orb.eccentricity,
    orb.inclinationDeg * DEG_TO_RAD,
    orb.argumentOfPeriapsisDeg * DEG_TO_RAD,
    orb.longitudeOfAscendingNodeDeg * DEG_TO_RAD,
    nu
  )

  return {
    x: pos.x * SCENE_SCALE.AU_TO_UNITS,
    y: pos.y * SCENE_SCALE.AU_TO_UNITS,
    z: pos.z * SCENE_SCALE.AU_TO_UNITS,
  }
}

export function getPlanetSceneRadius(radiusKm: number): number {
  return (radiusKm / 149_597_870.7) * SCENE_SCALE.AU_TO_UNITS * 800
}
