import { useRef, useCallback } from 'react';
import { useNavigationStore } from '../stores/navigationStore';
import type { ScaleLevel } from '../stores/navigationStore';

/**
 * Speed regime definitions for each scale level.
 * baseSpeed is in "scene units per second" — the canonical travel speed
 * when no multiplier is applied.
 */
const SPEED_REGIMES: Record<
  ScaleLevel,
  { baseSpeed: number; unit: string; factor: number }
> = {
  SURFACE: { baseSpeed: 10, unit: 'm/s', factor: 1 },
  ORBITAL: { baseSpeed: 500_000, unit: 'km/s', factor: 1000 },
  PLANETARY: { baseSpeed: 0.5, unit: 'AU/s', factor: 149_597_870_700 },
  STELLAR: { baseSpeed: 12, unit: 'ly/s', factor: 9.461e15 },
  GALACTIC: { baseSpeed: 5000, unit: 'ly/s', factor: 9.461e15 },
  COSMIC: { baseSpeed: 50, unit: 'Mpc/s', factor: 3.086e22 },
};

/**
 * Unit thresholds for auto-formatting speed display.
 * Ordered from largest to smallest so we pick the first that fits.
 */
interface UnitDef {
  label: string;
  /** Speed in m/s at which this unit becomes appropriate. */
  threshold: number;
  /** Divisor to convert m/s into this unit. */
  divisor: number;
  /** Number of decimal places to show. */
  decimals: number;
}

const UNIT_DEFS: UnitDef[] = [
  { label: 'Mpc/s', threshold: 3.086e22, divisor: 3.086e22, decimals: 1 },
  { label: 'kpc/s', threshold: 3.086e19, divisor: 3.086e19, decimals: 1 },
  { label: 'ly/s', threshold: 9.461e15, divisor: 9.461e15, decimals: 1 },
  { label: 'AU/s', threshold: 1.496e11, divisor: 1.496e11, decimals: 2 },
  { label: 'km/s', threshold: 1000, divisor: 1000, decimals: 0 },
  { label: 'm/s', threshold: 0, divisor: 1, decimals: 0 },
];

/**
 * Formats a number with thousands separators (commas).
 */
function formatNumber(value: number, decimals: number): string {
  const fixed = value.toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decPart !== undefined ? `${withCommas}.${decPart}` : withCommas;
}

/**
 * Auto-format a speed in m/s to the most appropriate human-readable string.
 */
function formatSpeed(speedMetersPerSecond: number): {
  display: string;
  unit: string;
} {
  const absSpeed = Math.abs(speedMetersPerSecond);

  for (const def of UNIT_DEFS) {
    if (absSpeed >= def.threshold || def.threshold === 0) {
      const value = speedMetersPerSecond / def.divisor;
      const display = `${formatNumber(Math.abs(value), def.decimals)} ${def.label}`;
      return { display, unit: def.label };
    }
  }

  // Fallback — should never reach here
  return { display: `${Math.round(speedMetersPerSecond)} m/s`, unit: 'm/s' };
}

export interface AdaptiveSpeedResult {
  /** Current base speed in scene units/second for the active scale. */
  baseSpeed: number;
  /** Combined multiplier from scroll wheel and boost key. */
  speedMultiplier: number;
  /** Formatted string like "1,500 km/s". */
  displaySpeed: string;
  /** Current display unit (e.g. "km/s"). */
  unit: string;
  /** Get the base speed for a given scale level. */
  getBaseSpeedForScale: (scale: ScaleLevel) => number;
  /** Compute display speed from a raw scene-unit speed value. */
  formatSceneSpeed: (
    sceneSpeed: number,
    scale: ScaleLevel,
  ) => { display: string; unit: string };
}

/**
 * Hook that computes appropriate travel speed based on the current scale
 * context and provides formatted display values.
 *
 * The speed system works in layers:
 *   1. Base speed — determined by scale level
 *   2. Scroll multiplier — player-controlled 0.1x to 10x
 *   3. Boost (shift) — 5x while held
 *
 * The actual velocity in scene units is:
 *   baseSpeed * scrollMultiplier * (boost ? 5 : 1)
 *
 * For display, we convert scene units through the regime's factor to get
 * a physically-meaningful m/s value, then auto-format with the best unit.
 */
export function useAdaptiveSpeed(): AdaptiveSpeedResult {
  const scaleLevel = useNavigationStore((s) => s.scaleLevel);
  const speed = useNavigationStore((s) => s.speed);
  const speedUnit = useNavigationStore((s) => s.speedUnit);
  const displaySpeed = useNavigationStore((s) => s.displaySpeed);

  // Smoothed base speed for transitions between scale levels.
  // When the scale changes, we lerp toward the new base over several frames
  // instead of snapping — but that lerp happens in SpaceNavigator's useFrame.
  // This ref tracks the previous target so we can detect changes.
  const prevScaleRef = useRef<ScaleLevel>(scaleLevel);
  const smoothedBaseRef = useRef<number>(
    SPEED_REGIMES[scaleLevel].baseSpeed,
  );

  if (prevScaleRef.current !== scaleLevel) {
    prevScaleRef.current = scaleLevel;
    // The actual smooth transition is driven by SpaceNavigator;
    // we just note the new target here.
  }

  const regime = SPEED_REGIMES[scaleLevel];
  smoothedBaseRef.current = regime.baseSpeed;

  const getBaseSpeedForScale = useCallback((scale: ScaleLevel): number => {
    return SPEED_REGIMES[scale].baseSpeed;
  }, []);

  const formatSceneSpeed = useCallback(
    (
      sceneSpeed: number,
      scale: ScaleLevel,
    ): { display: string; unit: string } => {
      const mps = convertSceneSpeedToMps(sceneSpeed, scale);
      return formatSpeed(mps);
    },
    [],
  );

  return {
    baseSpeed: smoothedBaseRef.current,
    speedMultiplier: speed > 0 ? speed / smoothedBaseRef.current : 0,
    displaySpeed,
    unit: speedUnit,
    getBaseSpeedForScale,
    formatSceneSpeed,
  };
}

/**
 * Convert a scene-unit speed at a given scale to meters per second.
 *
 * At each scale level, scene units map to physical distances differently.
 * We define the mapping so that:
 *   SURFACE:    1 scene unit = 1 meter
 *   ORBITAL:    1 scene unit = 1 km (1,000 m)
 *   PLANETARY:  1 scene unit = 1 AU (1.496e11 m)
 *   STELLAR:    1 scene unit = 1 ly (9.461e15 m)
 *   GALACTIC:   1 scene unit = 1 ly (same, just different base speed)
 *   COSMIC:     1 scene unit = 1 Mpc (3.086e22 m)
 */
const SCENE_UNIT_TO_METERS: Record<ScaleLevel, number> = {
  SURFACE: 1,
  ORBITAL: 1_000,
  PLANETARY: 1.496e11,
  STELLAR: 9.461e15,
  GALACTIC: 9.461e15,
  COSMIC: 3.086e22,
};

export function convertSceneSpeedToMps(
  sceneSpeed: number,
  scale: ScaleLevel,
): number {
  return sceneSpeed * SCENE_UNIT_TO_METERS[scale];
}

/**
 * Get the base speed (in scene units/second) for a scale level.
 */
export function getBaseSpeed(scale: ScaleLevel): number {
  return SPEED_REGIMES[scale].baseSpeed;
}

/**
 * Format a scene-speed at a given scale into a display string.
 */
export function formatSceneSpeed(
  sceneSpeed: number,
  scale: ScaleLevel,
): { display: string; unit: string } {
  const mps = convertSceneSpeedToMps(sceneSpeed, scale);
  return formatSpeed(mps);
}
