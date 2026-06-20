export const AU_KM = 149_597_870.7
export const PARSEC_LY = 3.26156
export const LIGHT_YEAR_KM = 9.461e12
export const SOLAR_RADIUS_KM = 696_340
export const EARTH_RADIUS_KM = 6_371
export const MOON_RADIUS_KM = 1_737.4
export const JUPITER_RADIUS_KM = 69_911
export const G = 6.674e-11
export const C_KM_S = 299_792.458
export const SOLAR_MASS_KG = 1.989e30
export const EARTH_MASS_KG = 5.972e24
export const J2000_EPOCH = 2451545.0
export const DEG_TO_RAD = Math.PI / 180
export const RAD_TO_DEG = 180 / Math.PI

export const SCENE_SCALE = {
  AU_TO_UNITS: 100,
  KM_TO_UNITS: 100 / AU_KM,
}

export const SUN_SCENE_RADIUS = (SOLAR_RADIUS_KM / AU_KM) * SCENE_SCALE.AU_TO_UNITS * 3

export interface PlanetData {
  id: string
  name: string
  type: 'planet' | 'dwarf-planet'
  radiusKm: number
  massKg: number
  rotationPeriodHours: number
  axialTiltDeg: number
  temperatureK?: number
  hasAtmosphere: boolean
  atmosphereColor?: [number, number, number]
  atmosphereDensity?: number
  hasRings: boolean
  description: string
  orbital: {
    semiMajorAxisAU: number
    eccentricity: number
    inclinationDeg: number
    longitudeOfAscendingNodeDeg: number
    argumentOfPeriapsisDeg: number
    meanAnomalyAtEpochDeg: number
  }
}

export interface MoonData {
  id: string
  name: string
  parentId: string
  radiusKm: number
  orbitalRadiusKm: number
  orbitalPeriodDays: number
  description: string
}

export const PLANETS: PlanetData[] = [
  {
    id: 'mercury',
    name: 'Mercury',
    type: 'planet',
    radiusKm: 2_439.7,
    massKg: 3.301e23,
    rotationPeriodHours: 1407.6,
    axialTiltDeg: 0.034,
    temperatureK: 440,
    hasAtmosphere: false,
    hasRings: false,
    description: 'The smallest planet and closest to the Sun. Its surface is heavily cratered, resembling Earth\'s Moon.',
    orbital: {
      semiMajorAxisAU: 0.38710,
      eccentricity: 0.20563,
      inclinationDeg: 7.005,
      longitudeOfAscendingNodeDeg: 48.331,
      argumentOfPeriapsisDeg: 29.124,
      meanAnomalyAtEpochDeg: 174.796,
    },
  },
  {
    id: 'venus',
    name: 'Venus',
    type: 'planet',
    radiusKm: 6_051.8,
    massKg: 4.867e24,
    rotationPeriodHours: -5832.5,
    axialTiltDeg: 177.36,
    temperatureK: 737,
    hasAtmosphere: true,
    atmosphereColor: [0.95, 0.9, 0.7],
    atmosphereDensity: 0.8,
    hasRings: false,
    description: 'The hottest planet, shrouded in thick clouds of sulfuric acid. It rotates backwards compared to most planets.',
    orbital: {
      semiMajorAxisAU: 0.72333,
      eccentricity: 0.00677,
      inclinationDeg: 3.3946,
      longitudeOfAscendingNodeDeg: 76.680,
      argumentOfPeriapsisDeg: 54.884,
      meanAnomalyAtEpochDeg: 50.115,
    },
  },
  {
    id: 'earth',
    name: 'Earth',
    type: 'planet',
    radiusKm: EARTH_RADIUS_KM,
    massKg: EARTH_MASS_KG,
    rotationPeriodHours: 23.934,
    axialTiltDeg: 23.439,
    temperatureK: 288,
    hasAtmosphere: true,
    atmosphereColor: [0.3, 0.6, 1.0],
    atmosphereDensity: 0.5,
    hasRings: false,
    description: 'Our home. The only known planet with liquid water on its surface and life.',
    orbital: {
      semiMajorAxisAU: 1.00000,
      eccentricity: 0.01671,
      inclinationDeg: 0.00005,
      longitudeOfAscendingNodeDeg: -11.260,
      argumentOfPeriapsisDeg: 102.947,
      meanAnomalyAtEpochDeg: 100.464,
    },
  },
  {
    id: 'mars',
    name: 'Mars',
    type: 'planet',
    radiusKm: 3_389.5,
    massKg: 6.417e23,
    rotationPeriodHours: 24.623,
    axialTiltDeg: 25.19,
    temperatureK: 210,
    hasAtmosphere: true,
    atmosphereColor: [0.8, 0.5, 0.3],
    atmosphereDensity: 0.1,
    hasRings: false,
    description: 'The Red Planet. Home to Olympus Mons, the largest volcano in the solar system, and Valles Marineris, a canyon system that dwarfs the Grand Canyon.',
    orbital: {
      semiMajorAxisAU: 1.52368,
      eccentricity: 0.09341,
      inclinationDeg: 1.8497,
      longitudeOfAscendingNodeDeg: 49.558,
      argumentOfPeriapsisDeg: 286.502,
      meanAnomalyAtEpochDeg: 19.373,
    },
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    type: 'planet',
    radiusKm: JUPITER_RADIUS_KM,
    massKg: 1.898e27,
    rotationPeriodHours: 9.925,
    axialTiltDeg: 3.13,
    temperatureK: 165,
    hasAtmosphere: true,
    atmosphereColor: [0.8, 0.7, 0.5],
    atmosphereDensity: 0.6,
    hasRings: true,
    description: 'The largest planet in the solar system. Its Great Red Spot is a storm larger than Earth that has raged for centuries.',
    orbital: {
      semiMajorAxisAU: 5.20440,
      eccentricity: 0.04839,
      inclinationDeg: 1.3030,
      longitudeOfAscendingNodeDeg: 100.464,
      argumentOfPeriapsisDeg: 273.867,
      meanAnomalyAtEpochDeg: 20.020,
    },
  },
  {
    id: 'saturn',
    name: 'Saturn',
    type: 'planet',
    radiusKm: 58_232,
    massKg: 5.683e26,
    rotationPeriodHours: 10.656,
    axialTiltDeg: 26.73,
    temperatureK: 134,
    hasAtmosphere: true,
    atmosphereColor: [0.9, 0.8, 0.6],
    atmosphereDensity: 0.5,
    hasRings: true,
    description: 'Famous for its stunning ring system, Saturn is a gas giant with the lowest density of any planet — it would float in water.',
    orbital: {
      semiMajorAxisAU: 9.53667,
      eccentricity: 0.05386,
      inclinationDeg: 2.4845,
      longitudeOfAscendingNodeDeg: 113.665,
      argumentOfPeriapsisDeg: 339.392,
      meanAnomalyAtEpochDeg: 317.020,
    },
  },
  {
    id: 'uranus',
    name: 'Uranus',
    type: 'planet',
    radiusKm: 25_362,
    massKg: 8.681e25,
    rotationPeriodHours: -17.24,
    axialTiltDeg: 97.77,
    temperatureK: 76,
    hasAtmosphere: true,
    atmosphereColor: [0.5, 0.8, 0.9],
    atmosphereDensity: 0.4,
    hasRings: true,
    description: 'An ice giant tilted on its side. Uranus rotates nearly perpendicular to its orbital plane.',
    orbital: {
      semiMajorAxisAU: 19.18916,
      eccentricity: 0.04726,
      inclinationDeg: 0.7734,
      longitudeOfAscendingNodeDeg: 74.006,
      argumentOfPeriapsisDeg: 96.998,
      meanAnomalyAtEpochDeg: 142.238,
    },
  },
  {
    id: 'neptune',
    name: 'Neptune',
    type: 'planet',
    radiusKm: 24_622,
    massKg: 1.024e26,
    rotationPeriodHours: 16.11,
    axialTiltDeg: 28.32,
    temperatureK: 72,
    hasAtmosphere: true,
    atmosphereColor: [0.2, 0.4, 0.9],
    atmosphereDensity: 0.5,
    hasRings: true,
    description: 'The most distant planet. Neptune has the strongest winds in the solar system, reaching 2,100 km/h.',
    orbital: {
      semiMajorAxisAU: 30.06992,
      eccentricity: 0.00859,
      inclinationDeg: 1.7700,
      longitudeOfAscendingNodeDeg: 131.784,
      argumentOfPeriapsisDeg: 276.336,
      meanAnomalyAtEpochDeg: 256.228,
    },
  },
]

export const MOON_DATA: MoonData = {
  id: 'moon',
  name: 'Moon',
  parentId: 'earth',
  radiusKm: MOON_RADIUS_KM,
  orbitalRadiusKm: 384_400,
  orbitalPeriodDays: 27.322,
  description: 'Earth\'s only natural satellite. The Moon is tidally locked, always showing the same face to Earth.',
}

export const SUN_DATA = {
  id: 'sun',
  name: 'Sun',
  type: 'star' as const,
  radiusKm: SOLAR_RADIUS_KM,
  massKg: SOLAR_MASS_KG,
  temperatureK: 5_778,
  spectralType: 'G2V',
  rotationPeriodHours: 609.12,
  description: 'Our star. A G-type main-sequence star (G2V) containing 99.86% of the mass in the solar system. Its surface temperature is 5,778 K — nearly white, not yellow.',
}
