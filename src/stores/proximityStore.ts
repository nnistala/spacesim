import { create } from 'zustand'
import type { MeasurableBody, BodyKind } from '../data/scaleConfig'

export interface NearestBody {
  id: string
  name: string
  /** Distance from the camera to the body's SURFACE, in render units. */
  distanceUnits: number
}

/** Lightweight, reactive descriptor used to render labels for every body. */
export interface BodyTag {
  id: string
  name: string
  kind: BodyKind
  noLabel?: boolean
}

interface ProximityState {
  bodies: Map<string, MeasurableBody>
  /** Reactive list of registered bodies — drives the label markers. */
  bodyList: BodyTag[]
  nearest: NearestBody | null

  registerBody: (body: MeasurableBody) => void
  updateBodyPosition: (id: string, position: [number, number, number]) => void
  unregisterBody: (id: string) => void
  setNearest: (nearest: NearestBody | null) => void
}

// Non-reactive ref to the body map for high-frequency reads inside useFrame.
export const proximityBodies = new Map<string, MeasurableBody>()

export const useProximityStore = create<ProximityState>((set) => ({
  bodies: proximityBodies,
  bodyList: [],
  nearest: null,

  registerBody: (body) => {
    proximityBodies.set(body.id, body)
    set((s) =>
      s.bodyList.some((b) => b.id === body.id)
        ? s
        : {
            bodyList: [
              ...s.bodyList,
              {
                id: body.id,
                name: body.name,
                kind: body.kind ?? 'planet',
                noLabel: body.noLabel,
              },
            ],
          },
    )
  },
  updateBodyPosition: (id, position) => {
    const b = proximityBodies.get(id)
    if (b) b.position = position
  },
  unregisterBody: (id) => {
    proximityBodies.delete(id)
    set((s) => ({ bodyList: s.bodyList.filter((b) => b.id !== id) }))
  },
  setNearest: (nearest) =>
    set((s) => {
      // Avoid churn: only update when the readout meaningfully changes.
      if (
        s.nearest?.id === nearest?.id &&
        Math.abs((s.nearest?.distanceUnits ?? 0) - (nearest?.distanceUnits ?? 0)) < 0.01
      ) {
        return s
      }
      return { nearest }
    }),
}))
