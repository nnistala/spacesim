import { create } from 'zustand'
import { TIME_SCALE } from '../data/scaleConfig'

// TIME_SCALE (=100) is the baseline sim-seconds per real-second. The TIME panel
// multiplies it (or pauses), so users can freeze or fast-forward orbital motion.
interface TimeState {
  multiplier: number
  paused: boolean
  setMultiplier: (m: number) => void
  togglePause: () => void
}

export const useTimeStore = create<TimeState>((set) => ({
  multiplier: 1,
  paused: false,
  setMultiplier: (m) => set({ multiplier: m, paused: false }),
  togglePause: () => set((s) => ({ paused: !s.paused })),
}))

/** Non-reactive read for useFrame loops: effective sim-seconds per real-second. */
export function getTimeScale(): number {
  const s = useTimeStore.getState()
  return s.paused ? 0 : TIME_SCALE * s.multiplier
}
