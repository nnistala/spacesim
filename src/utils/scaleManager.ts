import type { ScaleLevel } from '../stores/navigationStore'

export const SCALE_THRESHOLDS: Record<ScaleLevel, { min: number; max: number; unit: string; factor: number }> = {
  SURFACE: { min: 0, max: 0.001, unit: 'm', factor: 1 },
  ORBITAL: { min: 0.001, max: 0.1, unit: 'km', factor: 1000 },
  PLANETARY: { min: 0.1, max: 1000, unit: 'AU', factor: 149_597_870.7 },
  STELLAR: { min: 1000, max: 100_000, unit: 'ly', factor: 9.461e12 },
  GALACTIC: { min: 100_000, max: 1e9, unit: 'kly', factor: 9.461e15 },
  COSMIC: { min: 1e9, max: Infinity, unit: 'Mly', factor: 9.461e18 },
}

export function formatSpeed(sceneUnitsPerSecond: number): string {
  const auPerSecond = sceneUnitsPerSecond / 100
  const kmPerSecond = auPerSecond * 149_597_870.7

  if (kmPerSecond < 1) {
    return `${(kmPerSecond * 1000).toFixed(0)} m/s`
  }
  if (kmPerSecond < 10_000) {
    return `${kmPerSecond.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} km/s`
  }
  if (auPerSecond < 100) {
    return `${auPerSecond.toFixed(2)} AU/s`
  }
  const lyPerSecond = auPerSecond / 63_241.1
  if (lyPerSecond < 1000) {
    return `${lyPerSecond.toFixed(1)} ly/s`
  }
  return `${(lyPerSecond / 1000).toFixed(1)} kly/s`
}

export function formatDistance(sceneUnits: number): string {
  const au = sceneUnits / 100
  const km = au * 149_597_870.7

  if (km < 1) {
    return `${(km * 1000).toFixed(0)} m`
  }
  if (km < 1_000_000) {
    return `${km.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} km`
  }
  if (au < 100) {
    return `${au.toFixed(3)} AU`
  }
  const ly = au / 63_241.1
  if (ly < 1000) {
    return `${ly.toFixed(2)} ly`
  }
  if (ly < 1_000_000) {
    return `${(ly / 1000).toFixed(1)} kly`
  }
  return `${(ly / 1_000_000).toFixed(2)} Mly`
}
