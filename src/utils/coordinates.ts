import { DEG_TO_RAD, RAD_TO_DEG } from '../data/physicsConstants'

export function raDecToCartesian(
  raDeg: number,
  decDeg: number,
  distance: number
): { x: number; y: number; z: number } {
  const ra = raDeg * DEG_TO_RAD
  const dec = decDeg * DEG_TO_RAD
  return {
    x: distance * Math.cos(dec) * Math.cos(ra),
    y: distance * Math.sin(dec),
    z: -distance * Math.cos(dec) * Math.sin(ra),
  }
}

export function cartesianToRaDec(
  x: number,
  y: number,
  z: number
): { ra: number; dec: number; distance: number } {
  const distance = Math.sqrt(x * x + y * y + z * z)
  const dec = Math.asin(y / distance) * RAD_TO_DEG
  let ra = Math.atan2(-z, x) * RAD_TO_DEG
  if (ra < 0) ra += 360
  return { ra, dec, distance }
}

const GALACTIC_NORTH_RA = 192.85948 * DEG_TO_RAD
const GALACTIC_NORTH_DEC = 27.12825 * DEG_TO_RAD
const GALACTIC_CENTER_L = 32.93192 * DEG_TO_RAD

export function equatorialToGalactic(
  raDeg: number,
  decDeg: number
): { l: number; b: number } {
  const ra = raDeg * DEG_TO_RAD
  const dec = decDeg * DEG_TO_RAD

  const sinB =
    Math.sin(GALACTIC_NORTH_DEC) * Math.sin(dec) +
    Math.cos(GALACTIC_NORTH_DEC) * Math.cos(dec) * Math.cos(ra - GALACTIC_NORTH_RA)
  const b = Math.asin(sinB)

  const numerator = Math.cos(dec) * Math.sin(ra - GALACTIC_NORTH_RA)
  const denominator =
    Math.cos(GALACTIC_NORTH_DEC) * Math.sin(dec) -
    Math.sin(GALACTIC_NORTH_DEC) * Math.cos(dec) * Math.cos(ra - GALACTIC_NORTH_RA)
  let l = GALACTIC_CENTER_L - Math.atan2(numerator, denominator)
  l = ((l * RAD_TO_DEG) % 360 + 360) % 360

  return { l, b: b * RAD_TO_DEG }
}

export function galacticToEquatorial(
  lDeg: number,
  bDeg: number
): { ra: number; dec: number } {
  const l = lDeg * DEG_TO_RAD
  const b = bDeg * DEG_TO_RAD

  const sinDec =
    Math.sin(GALACTIC_NORTH_DEC) * Math.sin(b) +
    Math.cos(GALACTIC_NORTH_DEC) * Math.cos(b) * Math.cos(GALACTIC_CENTER_L - l)
  const dec = Math.asin(sinDec)

  const numerator = Math.cos(b) * Math.sin(GALACTIC_CENTER_L - l)
  const denominator =
    Math.cos(GALACTIC_NORTH_DEC) * Math.sin(b) -
    Math.sin(GALACTIC_NORTH_DEC) * Math.cos(b) * Math.cos(GALACTIC_CENTER_L - l)
  let ra = GALACTIC_NORTH_RA + Math.atan2(numerator, denominator)
  ra = ((ra * RAD_TO_DEG) % 360 + 360) % 360

  return { ra, dec: dec * RAD_TO_DEG }
}
