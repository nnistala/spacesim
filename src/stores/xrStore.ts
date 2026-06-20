import { createXRStore } from '@react-three/xr'

// Shared WebXR store. The Canvas wraps the scene in <XR store={xrStore}> and the
// HUD VR button calls xrStore.enterVR(). Kept in its own module so both the
// Canvas (App) and the DOM HUD can import it without a circular dependency.
export const xrStore = createXRStore()
