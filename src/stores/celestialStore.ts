import { create } from 'zustand'

export interface OrbitalElements {
  semiMajorAxis: number
  eccentricity: number
  inclination: number
  longitudeOfAscendingNode: number
  argumentOfPeriapsis: number
  meanAnomalyAtEpoch: number
  epoch: number
}

export interface CelestialBody {
  id: string
  name: string
  type: 'star' | 'planet' | 'dwarf-planet' | 'moon' | 'asteroid' | 'comet' | 'nebula' | 'galaxy' | 'cluster'
  radius: number
  mass: number
  temperature?: number
  magnitude?: number
  spectralType?: string
  rotationPeriod?: number
  axialTilt?: number
  orbitalElements?: OrbitalElements
  parentBody?: string
  description?: string
  textureUrl?: string
}

interface CelestialState {
  bodies: Map<string, CelestialBody>
  focusBody: string | null
  currentDate: Date
  timeScale: number
  loaded: boolean

  registerBody: (body: CelestialBody) => void
  registerBodies: (bodies: CelestialBody[]) => void
  setFocusBody: (id: string | null) => void
  setCurrentDate: (date: Date) => void
  setTimeScale: (scale: number) => void
  setLoaded: (loaded: boolean) => void
}

export const useCelestialStore = create<CelestialState>((set) => ({
  bodies: new Map(),
  focusBody: null,
  currentDate: new Date(),
  timeScale: 1,
  loaded: false,

  registerBody: (body) =>
    set((state) => {
      const newBodies = new Map(state.bodies)
      newBodies.set(body.id, body)
      return { bodies: newBodies }
    }),
  registerBodies: (bodies) =>
    set((state) => {
      const newMap = new Map(state.bodies)
      for (const body of bodies) {
        newMap.set(body.id, body)
      }
      return { bodies: newMap }
    }),
  setFocusBody: (id) => set({ focusBody: id }),
  setCurrentDate: (date) => set({ currentDate: date }),
  setTimeScale: (scale) => set({ timeScale: scale }),
  setLoaded: (loaded) => set({ loaded }),
}))
