import { createXRStore } from '@react-three/xr'

// Shared WebXR store. The Canvas wraps the scene in <XR store={xrStore}> and the
// HUD VR button calls xrStore.enterVR(). Kept in its own module so both the
// Canvas (App) and the DOM HUD can import it without a circular dependency.
// `emulate: false` removes the iwer WebXR emulator's auto-injected "Enter XR"
// DOM button (we drive VR from the HUD's own button instead).
export const xrStore = createXRStore({ emulate: false })
