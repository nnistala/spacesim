# ExploreSpace

A scientifically accurate, photorealistic 3D space exploration web application. Users navigate the entire known universe from any device — browser, mobile, or VR headset.

## Quality Standard

**Christopher Nolan's Interstellar. Nothing less.** Every visual, every animation, every physical interaction must meet cinematic production quality. No cartoon circles, no flat skyboxes, no ambient light cheats.

## Tech Stack

- **Framework**: React 18+ with TypeScript (strict mode)
- **3D Engine**: Three.js via React Three Fiber (`@react-three/fiber`)
- **VR**: `@react-three/xr` (WebXR API)
- **Helpers**: `@react-three/drei`, `@react-three/postprocessing`
- **State**: Zustand
- **Build**: Vite
- **Styling**: Tailwind CSS 4 (HUD/UI overlays only)
- **Data**: Static JSON + NASA public domain data

## Commands

```bash
npm run dev       # Start dev server
npm run build     # Production build
npm run preview   # Preview production build
npm run lint      # ESLint
npm run typecheck # TypeScript type checking
```

## Architecture

Multi-scale scene graph with 6 levels (surface → orbital → planetary → stellar → galactic → cosmic). Logarithmic depth buffer. Custom GLSL shaders for sun, atmospheres, rings. Instanced rendering for 100K+ stars. Kepler equation solver for real-time orbital positions.

See `docs/MASTER_PROMPT.md` for the complete specification.
See `docs/ARCHITECTURE.md` for detailed technical architecture.

## Scientific Accuracy Rules

- Sun is white (G2V, 5778K blackbody), NOT yellow
- All distances use real astronomical values
- Orbits are elliptical (Keplerian), not circular
- Lighting follows inverse-square law, single source per star system
- Space is black — no ambient light in shadows
- Star colors from spectral type via blackbody curve
- Atmosphere rendering uses Rayleigh/Mie scattering
