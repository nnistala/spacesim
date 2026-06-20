import { useMemo, useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useTexture, Line } from '@react-three/drei'

import Planet from './Planet'
import { PLANETS, DEG_TO_RAD, type PlanetData } from '../data/physicsConstants'
import {
  keplerianToCartesian,
  meanAnomalyToTrueAnomaly,
  getMeanAnomaly,
  daysSinceJ2000,
} from '../utils/orbitalMechanics'
import { BODY_RADII, auPositionToRenderUnits } from '../data/scaleConfig'
import { PLANET_VISUALS } from '../data/planetTextures'
import { useProximityStore } from '../stores/proximityStore'
import { useUIStore } from '../stores/uiStore'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Heliocentric render-space position of a body at a given date.
 * Kepler's planar (x, y) maps to the scene's horizontal ecliptic (x, z); the
 * out-of-plane inclination component maps to scene-up (y). The radius is then
 * log-compressed by the hybrid scale.
 */
function planetRenderPosition(
  planet: PlanetData,
  date: Date,
): [number, number, number] {
  const orb = planet.orbital
  const days = daysSinceJ2000(date)
  const M = getMeanAnomaly(orb.meanAnomalyAtEpochDeg, orb.semiMajorAxisAU, days)
  const nu = meanAnomalyToTrueAnomaly(M, orb.eccentricity)
  const c = keplerianToCartesian(
    orb.semiMajorAxisAU,
    orb.eccentricity,
    orb.inclinationDeg * DEG_TO_RAD,
    orb.argumentOfPeriapsisDeg * DEG_TO_RAD,
    orb.longitudeOfAscendingNodeDeg * DEG_TO_RAD,
    nu,
  )
  return auPositionToRenderUnits(c.x, c.z, c.y)
}

/** Sample the full orbital ellipse as a closed loop of render-space points. */
function orbitPoints(planet: PlanetData, segments = 256): THREE.Vector3[] {
  const orb = planet.orbital
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= segments; i++) {
    const nu = (i / segments) * Math.PI * 2
    const c = keplerianToCartesian(
      orb.semiMajorAxisAU,
      orb.eccentricity,
      orb.inclinationDeg * DEG_TO_RAD,
      orb.argumentOfPeriapsisDeg * DEG_TO_RAD,
      orb.longitudeOfAscendingNodeDeg * DEG_TO_RAD,
      nu,
    )
    const [x, y, z] = auPositionToRenderUnits(c.x, c.z, c.y)
    pts.push(new THREE.Vector3(x, y, z))
  }
  return pts
}

// ---------------------------------------------------------------------------
// OrbitingPlanet — one planet + its orbit path
// ---------------------------------------------------------------------------

function OrbitingPlanet({ planet, date }: { planet: PlanetData; date: Date }) {
  const setInfoPanelBody = useUIStore((s) => s.setInfoPanelBody)

  const position = useMemo(() => planetRenderPosition(planet, date), [planet, date])
  const radius = BODY_RADII[planet.id as keyof typeof BODY_RADII] ?? 1
  const visual = PLANET_VISUALS[planet.id]

  // Direction from the planet toward the Sun (at the origin), normalised.
  const sunDirection = useMemo<[number, number, number]>(() => {
    const len = Math.hypot(position[0], position[1], position[2])
    if (len === 0) return [1, 0, 0]
    return [-position[0] / len, -position[1] / len, -position[2] / len]
  }, [position])

  // ---- Real NASA-derived textures (vendored locally) ----
  const textureUrls = useMemo(
    () => (visual.clouds ? [visual.texture, visual.clouds] : [visual.texture]),
    [visual],
  )
  const textures = useTexture(textureUrls)
  const [diffuseMap, cloudsMap] = Array.isArray(textures) ? textures : [textures]

  useMemo(() => {
    for (const t of [diffuseMap, cloudsMap]) {
      if (!t) continue
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 16
      t.wrapS = THREE.RepeatWrapping
      t.wrapT = THREE.ClampToEdgeWrapping
      t.needsUpdate = true
    }
  }, [diffuseMap, cloudsMap])

  // ---- Register with the proximity system for the distance HUD + labels ----
  useEffect(() => {
    const store = useProximityStore.getState()
    store.registerBody({
      id: planet.id,
      name: planet.name,
      position: [position[0], position[1], position[2]],
      radius,
      kind: 'planet',
    })
    return () => store.unregisterBody(planet.id)
  }, [planet.id, planet.name, position, radius])

  return (
    <Planet
      name={planet.name}
      radius={radius}
      position={position}
      diffuseTexture={diffuseMap}
      cloudsTexture={visual.clouds ? cloudsMap : undefined}
      hasAtmosphere={planet.hasAtmosphere}
      atmosphereColor={planet.atmosphereColor}
      atmosphereDensity={planet.atmosphereDensity}
      atmosphereScale={1.07}
      rotationPeriod={planet.rotationPeriodHours}
      axialTilt={planet.axialTiltDeg}
      sunDirection={sunDirection}
      hasRings={!!visual.rings}
      ringInnerRadius={visual.rings ? radius * visual.rings.inner : undefined}
      ringOuterRadius={visual.rings ? radius * visual.rings.outer : undefined}
      ringMapUrl={visual.rings?.texture}
      onClick={() => setInfoPanelBody(planet.id)}
    />
  )
}

// ---------------------------------------------------------------------------
// OrbitLine — faint elliptical path of a single body around the Sun
// ---------------------------------------------------------------------------

function OrbitLine({ planet }: { planet: PlanetData }) {
  const points = useMemo(() => orbitPoints(planet), [planet])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ref = useRef<any>(null)

  // Fade the orbit rings out once the camera is far from the Sun, so from across
  // the galaxy the solar system doesn't read as a tiny ringed "Saturn" disc.
  useFrame(({ camera }) => {
    const mat = ref.current?.material
    if (!mat) return
    const d = camera.position.length() // distance from the Sun (origin)
    mat.opacity = 0.12 * THREE.MathUtils.clamp(1 - (d - 22000) / 23000, 0, 1)
  })

  return (
    <Line
      ref={ref}
      points={points}
      color="#4488cc"
      transparent
      opacity={0.12}
      lineWidth={1}
      depthWrite={false}
    />
  )
}

// ---------------------------------------------------------------------------
// SolarSystem — every planet except Earth (rendered separately as the hero)
// ---------------------------------------------------------------------------

export default function SolarSystem() {
  // Positions are computed for "today" once at mount.
  const date = useMemo(() => new Date(), [])
  const bodies = useMemo(() => PLANETS.filter((p) => p.id !== 'earth'), [])

  return (
    <>
      {/* Orbit paths for every planet (incl. Earth) as navigation cues. */}
      {PLANETS.map((planet) => (
        <OrbitLine key={`orbit-${planet.id}`} planet={planet} />
      ))}
      {bodies.map((planet) => (
        <OrbitingPlanet key={planet.id} planet={planet} date={date} />
      ))}
    </>
  )
}
