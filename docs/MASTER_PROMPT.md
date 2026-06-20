# ExploreSpace — Master Implementation Prompt

> **Quality bar**: Christopher Nolan's Interstellar. Billion-dollar Marvel movie production value. Scientifically perfect. Photorealistic. Cinematic.

---

## PROJECT OVERVIEW

**ExploreSpace** is a photorealistic, scientifically accurate 3D space exploration web application where users navigate the known universe from any device — browser, mobile, or VR headset.

When launched, you start in space near Earth. You see the Earth rotating with cloud cover and city lights on the dark side, the Moon in its correct orbital position, and the Sun blazing with animated convection cells and corona. Stars surround you — not a flat skybox, but 117,955 real stars from the HYG catalog positioned in 3D space with correct colors from their spectral types. Meteors streak across the view. Asteroids tumble slowly in the distance.

You grab the joystick (on-screen, keyboard, or VR controller) and fly. As you accelerate, your speed adapts — walking pace near a surface, orbital velocity in orbit, light-speed between stars, warp speed between galaxies. You can open the Space Map, search for any known object in the universe — Mars, Proxima Centauri, the Orion Nebula, the Andromeda Galaxy — tap "Go There," and a cinematic warp animation carries you there.

Point your phone at the sky, and the app shows you exactly what's in that direction — real stars, real constellations, real deep-sky objects — like a telescope that sees the entire universe.

---

## TECH STACK (non-negotiable)

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | React 18+ TypeScript (strict) | Component architecture for complex scene graph |
| 3D Engine | Three.js via React Three Fiber | Declarative 3D, massive ecosystem, WebXR support |
| VR | @react-three/xr | WebXR for Quest, Vision Pro, etc. |
| Helpers | @react-three/drei | Stars, skybox, controls, shaders, Html overlays |
| Post-processing | @react-three/postprocessing | Bloom, GodRays, ToneMapping for cinematic look |
| State | Zustand | Lightweight, minimal boilerplate |
| Build | Vite | Fast HMR, optimized builds |
| UI Styling | Tailwind CSS 4 | HUD overlays only (not 3D) |
| Data | Static JSON + NASA APIs | No backend for MVP |

---

## ARCHITECTURE

### Project Structure

```
src/
├── main.tsx                      # Entry point
├── App.tsx                       # Canvas + HUD overlay
├── stores/
│   ├── navigationStore.ts        # Camera position, velocity, scale level, target
│   ├── celestialStore.ts         # Loaded celestial body data, focus object
│   └── uiStore.ts                # HUD state, map visibility, info panel
├── scenes/
│   ├── UniverseScene.tsx         # Root scene — manages scale transitions
│   ├── SolarSystemScene.tsx      # Sun + planets + moons + belts
│   ├── GalacticScene.tsx         # Milky Way, nearby stars, nebulae
│   └── CosmicScene.tsx           # Galaxy clusters, cosmic web
├── objects/
│   ├── Sun.tsx                   # Volumetric sun (surface + chromosphere + corona + flares)
│   ├── Planet.tsx                # Generic planet (atmosphere, rings, clouds, surface)
│   ├── Moon.tsx                  # Moon with libration, phases, craters
│   ├── StarField.tsx             # Instanced star rendering from HYG catalog
│   ├── Asteroid.tsx              # Asteroid/meteor with trajectory
│   ├── Nebula.tsx                # Volumetric nebula (particle + noise shader)
│   ├── Galaxy.tsx                # Spiral/elliptical galaxy renderer
│   └── Comet.tsx                 # Comet with animated dust + ion tail
├── shaders/
│   ├── sunSurface.vert/frag      # Animated convection, granulation noise
│   ├── sunCorona.vert/frag       # Transparent corona with streamer rays
│   ├── atmosphere.vert/frag      # Rayleigh/Mie scattering
│   ├── rings.vert/frag           # Saturn ring transparency + shadows
│   └── starGlow.vert/frag        # Point star bloom
├── controls/
│   ├── SpaceNavigator.tsx        # Main flight controller (keyboard+mouse+touch+VR)
│   ├── Joystick.tsx              # On-screen virtual joystick (mobile)
│   ├── VRControls.tsx            # VR controller mapping
│   └── GyroscopePointer.tsx      # Phone-as-telescope
├── hud/
│   ├── HUD.tsx                   # Main HUD overlay container
│   ├── SpaceMap.tsx              # Interactive map of known universe
│   ├── InfoPanel.tsx             # Object info (click any body)
│   ├── Compass.tsx               # Orientation indicator
│   ├── SpeedIndicator.tsx        # Current travel speed
│   ├── SearchBar.tsx             # Search any object by name
│   └── Minimap.tsx               # Corner minimap
├── data/
│   ├── solarSystem.ts            # Orbital parameters for planets, moons
│   ├── starCatalog.ts            # HYG database parser
│   ├── deepSkyObjects.ts         # Messier, NGC catalogs
│   ├── constellations.ts         # IAU constellation data
│   └── physicsConstants.ts       # AU, parsec, ly, G, c, solar masses
├── utils/
│   ├── coordinates.ts            # RA/Dec ↔ 3D cartesian, equatorial ↔ galactic
│   ├── scaleManager.ts           # Logarithmic scale mapping, LOD transitions
│   ├── orbitalMechanics.ts       # Kepler equation solver (Newton-Raphson)
│   ├── textureLoader.ts          # Progressive loading (low-res → high-res)
│   └── deviceOrientation.ts      # Gyroscope → celestial coordinate mapping
├── hooks/
│   ├── useAdaptiveSpeed.ts       # Speed adapts to nearest object distance
│   ├── useCelestialPosition.ts   # Real-time body position from orbital elements + date
│   └── useLOD.ts                 # Level-of-detail based on camera distance
└── assets/
    ├── textures/                 # NASA 8K+ planet textures
    ├── hdri/                     # Milky Way panorama (ESA)
    └── models/                   # ISS, Hubble, Voyager (GLTF, NASA 3D Resources)
```

### Multi-Scale Scene Graph

The universe spans ~93 billion light-years. A single float coordinate system breaks at interstellar distances. Implement 6 scale levels:

| Level | 1 Unit = | Use Case |
|-------|----------|----------|
| SURFACE | 1 meter | Standing on planet/moon |
| ORBITAL | 1,000 km | Viewing planet from orbit |
| PLANETARY | 1 AU (149,597,870.7 km) | Solar system view |
| STELLAR | 1 parsec (3.26 ly) | Nearby stars |
| GALACTIC | 1 kiloparsec | Galaxy structure |
| COSMIC | 1 megaparsec | Galaxy clusters, cosmic web |

- Use `THREE.Camera` with logarithmic depth buffer: `<Canvas gl={{ logarithmicDepthBuffer: true }}>`
- Camera.near = 0.001, Camera.far = 1e15
- Smooth 1.5-second animation when transitioning between scales
- Objects in non-current scales rendered as imposters/sprites
- Position stored as: `{ scaleLevel, x, y, z, referenceBody? }`

---

## DETAILED OBJECT SPECIFICATIONS

### The Sun (most complex single object)

The Sun MUST NOT be a glowing sphere. It must look like a real star, like what you see in Interstellar or NASA SDO imagery.

**Surface Layer:**
- Custom fragment shader using 3D Simplex noise at 4+ octaves
- Animate noise offset over time to simulate convection cells (granulation)
- Color gradient: dark red (sunspot) → orange → yellow → white (hot spots)
- Normal-mapped surface for depth illusion
- Temperature mapped to blackbody radiation color (5,778K average)

**Chromosphere:**
- Semi-transparent shell slightly larger than surface
- Reddish hue (H-alpha emission, 656.3nm)
- Animated prominence tendrils using vertex displacement

**Corona:**
- Large transparent mesh (2-3x solar radius)
- Custom shader: radial falloff with streamer patterns
- Animated using rotating noise field
- Visible when camera is at sufficient distance
- Bloom post-processing adds natural glow

**Solar Flares:**
- Particle system eruptions every 30-120 seconds (random)
- Particles follow magnetic field line curves (Bezier paths)
- Color: orange → white → transparent over lifetime

**Light Emission:**
- Primary PointLight source in solar system
- Casts shadows on all planets/moons
- Intensity follows inverse-square law
- HDR rendering with tone mapping

### Planets (each unique)

**Generic Planet Renderer** accepts:
- `diffuseMap` — surface color texture (8K minimum)
- `normalMap` — surface relief
- `specularMap` — reflectivity (ocean vs land) [Earth]
- `nightMap` — city lights on dark side [Earth]
- `cloudsMap` — animated cloud layer [Earth, Venus, Jupiter, Saturn, Neptune]
- `atmosphereColor` + `density` — Rayleigh scattering shader
- `ringSystem` — inner/outer radius, texture, transparency [Saturn, Uranus, Jupiter, Neptune]
- `rotationPeriod` — axial rotation in hours
- `axialTilt` — obliquity in degrees
- `orbitalParameters` — full Keplerian elements

**Earth specifics:**
- Day: NASA Blue Marble Next Generation (8K+)
- Night: NASA Black Marble (city lights on dark side)
- Clouds: Separate sphere, semi-transparent, slowly rotating independently
- Atmosphere: Rayleigh scattering (blue limb from space, red at grazing angles)
- Specular highlights on oceans
- Moon at correct orbital distance with proper phase illumination

**Mars specifics:**
- MOLA elevation data for terrain displacement
- Olympus Mons and Valles Marineris identifiable
- Thin atmosphere (barely visible dusty haze at limb)
- Phobos and Deimos as small irregular meshes

**Gas Giants (Jupiter, Saturn, Neptune, Uranus):**
- Animated band structure (scrolling texture layers at different speeds)
- Jupiter: Great Red Spot as persistent storm
- Saturn: Ring system with Cassini division, ring shadows on planet, planet shadow on rings, semi-transparency, opposition surge
- Major moons for each planet

### Star Field (performance-critical)

**Data:** HYG Star Database v3.0 — 117,955 stars with RA, Dec, Distance, Magnitude, SpectralType, ProperName

**Rendering strategy (LOD):**
- Stars > 100 pc from camera → `THREE.Points` (GPU particles)
- Stars 5-100 pc → billboard sprites with glow
- Stars < 5 pc → sphere mesh with glow shader
- Background: additional 100,000+ procedural dim stars (Gaussian toward galactic plane) for Milky Way band
- Spatial octree for frustum culling and LOD selection

**Star colors from spectral type:**
- O → blue (#9bb0ff)
- B → blue-white (#aabfff)
- A → white (#cad7ff)
- F → yellow-white (#f8f7ff)
- G → yellow (#fff4ea) [Sun]
- K → orange (#ffd2a1)
- M → red (#ffcc6f)

**Constellations (toggle overlay):**
- IAU boundary lines
- Traditional asterism line patterns
- Labels at constellation centers

### Deep Sky Objects

**Nebulae** (Orion M42, Eagle M16, etc.):
- Volumetric raymarched 3D noise, OR
- Billboard sprites with NASA/ESA high-res imagery
- Emission nebulae: self-luminous colored glow
- Particle systems for dense regions

**Galaxies** (Andromeda M31, Triangulum M33, etc.):
- Distant: 2D sprite with real photograph
- Medium: Particle system with spiral arm structure
- Close: Full 3D model (star particles, dust lanes, central bulge)
- Milky Way: rendered from inside with visible structure

**Star Clusters:**
- Globular (M13): dense sphere of point stars
- Open (Pleiades): loose grouping with nebulosity

### Dynamic Objects

**Meteors/Shooting Stars:**
- Random streaks every 10-30 seconds (near planetary bodies)
- Particle trail with fade-out, bright head + dimming tail
- 0.5-2 second lifetime
- Occasional slow fireballs with fragmentation

**Asteroids:**
- Main belt (Mars-Jupiter): instanced irregular rocks with tumbling rotation
- Kuiper belt beyond Neptune
- Near-Earth asteroids with labeled orbits (optional)

**Comets:**
- Famous comets (Halley, Hale-Bopp) with computed orbits
- Dust tail (curved, follows orbit) + ion tail (straight, away from Sun)
- Coma glow near perihelion

---

## NAVIGATION SYSTEM

### Movement Modes

**a) FREE FLY:**
- Desktop: WASD + mouse look
- Mobile: virtual joystick + gyroscope
- VR: thumbstick navigation
- Adaptive speed based on nearest object:
  - Near surface: 10 m/s
  - In orbit: 1,000 km/s
  - Solar system: 1 AU/s
  - Interstellar: 100 ly/s
  - Intergalactic: 10 Mpc/s
- Speed transitions smoothly

**b) ORBIT MODE:** Double-click/tap object → camera orbits it. Scroll to zoom.

**c) TELEPORT:** Space Map → select destination → warp animation → arrive.

**d) FOLLOW:** Lock camera to follow a body along its orbit.

### Warp Animation
- Stars stretch into lines (vertex shader elongation along velocity)
- Blue/white color shift (blue-shift simulation)
- 2-3 second duration regardless of distance
- Smooth deceleration with camera settling at destination

---

## SPACE MAP

Interactive 2D/3D map overlay for navigating the known universe.

**Rendered as HTML overlay** (not inside 3D canvas) using drei's `<Html>`.

**Four zoom levels:**
1. Solar System (planets, belts)
2. Stellar neighborhood (~100 ly)
3. Galactic (Milky Way top-down, arm labels)
4. Cosmic (local group, superclusters, observable universe boundary)

**Features:**
- Click object → "Go There" → triggers warp
- Search bar: type any name/catalog ID
- Current position indicator (pulsing dot)
- Color coding: stars by spectral type, planets by type

---

## HUD (Heads-Up Display)

HTML overlay on 3D canvas. Semi-transparent dark panels, Orbitron font, white text, blue accent (#0088ff).

| Position | Element |
|----------|---------|
| Top-left | Current location breadcrumb |
| Top-right | Speed indicator (auto-scaling units) |
| Top-center | Hovered object name + distance |
| Bottom-left | Virtual joystick (mobile only) |
| Bottom-right | Minimap radar |
| Bottom-center | Action buttons: Map, Search, Time, AR, VR, Settings |
| Right slide-in | Info panel on object click (name, type, mass, radius, temp, photo, description, "Go There") |

---

## PHONE-AS-TELESCOPE (AR Feature)

1. Request `DeviceOrientationEvent` permission
2. Read alpha (compass), beta (tilt), gamma (rotation)
3. Get GPS coordinates for observer position
4. Compute Local Sidereal Time from GPS longitude + UTC
5. Convert device orientation (azimuth, altitude) → celestial (RA, Dec)
6. Map to 3D scene camera orientation
7. View shows what's actually in that direction
8. Overlay constellation lines and object labels

---

## VR MODE (WebXR)

- `<XR>` wrapper around scene
- Left thumbstick: fly direction
- Right thumbstick: snap/smooth turn
- Trigger: select object
- Grip: open space map (floating VR panel)
- 72fps minimum (Quest)
- Comfort: no involuntary roll, optional teleport, vignette during warp

---

## SCIENTIFIC ACCURACY (non-negotiable)

### Distances
- Earth-Moon: 384,400 km
- Earth-Sun: 1 AU = 149,597,870.7 km
- Sun-Jupiter: 5.2044 AU
- Sun-Neptune: 30.07 AU
- Proxima Centauri: 4.2465 ly (1.3 pc)
- Milky Way diameter: ~100,000 ly (30 kpc)
- Andromeda: 2.537 Mly (778 kpc)

### Sizes (to scale within each scale level)
- Sun: 696,340 km radius
- Earth: 6,371 km radius
- Jupiter: 69,911 km radius
- Moon: 1,737.4 km radius

### Colors (scientifically correct)
- Sun: nearly white (G2V, 5,778K blackbody) — NOT bright yellow
- Star colors from spectral type blackbody curve
- Mars: rusty red-orange, NOT bright red
- Venus: pale yellow cloud cover

### Orbital Mechanics
- All orbits are ellipses (Kepler's 1st law)
- Speed varies: faster near perihelion (Kepler's 2nd law)
- Period² ∝ semi-major axis³ (Kepler's 3rd law)
- Elements from JPL Horizons (J2000 epoch)
- Kepler equation solved via Newton-Raphson iteration

### Lighting
- Single primary light (Sun) for solar system
- Shadows: moons on planets (eclipses), planets on rings
- No ambient light (space is dark, unlit sides are black)
- Earthshine on Moon's dark side (subtle blue)
- Inverse-square falloff

### Atmospheres
- Earth: Rayleigh scattering (blue limb, red at grazing angle)
- Mars: thin dusty salmon haze
- Titan: thick orange haze
- Moon/Mercury: no atmosphere (sharp terminator)

---

## TEXTURE & ASSET SOURCES (free/public domain)

| Asset | Source |
|-------|--------|
| Earth day | NASA Blue Marble Next Generation (8K+) |
| Earth night | NASA Black Marble |
| Earth clouds | NASA Visible Earth |
| All planets | Solar System Scope (CC-BY) |
| Mars elevation | NASA MOLA |
| Star positions | HYG Database v3.0 (github.com/astronexus/HYG-Database) |
| Deep sky images | NASA/ESA Hubble Heritage (public domain) |
| Milky Way HDRI | ESA/Gaia sky survey |
| 3D models | NASA 3D Resources (ISS, Hubble, Voyager) |

---

## IMPLEMENTATION PHASES

### Phase 1 — Foundation
1. Vite + React + TypeScript + Tailwind project setup
2. Install R3F ecosystem packages
3. Canvas with logarithmic depth buffer + HDR tone mapping
4. Milky Way skybox (HDRI)
5. Sun with animated surface shader + corona + bloom
6. Earth with day/night/clouds/atmosphere/specular
7. Moon with correct position
8. Kepler equation solver for orbital mechanics
9. Free-fly camera controls (desktop)
10. Basic HUD (location, speed)

### Phase 2 — Solar System
11. All 8 planets with textures, sizes, orbits
12. Major moons (27+)
13. Saturn rings with shader
14. Asteroid belt (instanced)
15. Dwarf planets
16. Orbit trails (toggle)
17. Time controls
18. Object click → info panel

### Phase 3 — Stars & Deep Sky
19. HYG catalog → instanced star rendering
20. Spectral type colors
21. LOD system (points → sprites → meshes)
22. Constellations (toggle)
23. Messier objects
24. Scale transitions
25. Milky Way structure from galactic scale

### Phase 4 — Navigation & Map
26. Space Map (multi-zoom)
27. Search functionality
28. Warp/teleport animation
29. Adaptive speed system
30. Orbit mode

### Phase 5 — Mobile & VR
31. Virtual joystick
32. Responsive HUD
33. WebXR VR mode
34. Performance optimization for mobile
35. Touch gestures

### Phase 6 — Dynamic Effects
36. Meteor/shooting star system
37. Comet tails
38. Asteroid tumbling
39. Solar flare eruptions
40. Earthshine

### Phase 7 — AR & Polish
41. Phone-as-telescope
42. GPS observer position
43. Performance profiling
44. Progressive texture loading
45. Audio (ambient space music)
46. Tutorial/onboarding
47. PWA manifest

---

## PERFORMANCE TARGETS

| Platform | Target |
|----------|--------|
| Desktop | 60 fps at 1080p, all effects |
| Mobile | 30 fps minimum, reduced quality |
| VR | 72 fps minimum (Quest 2/3) |
| Initial load | < 15 seconds on 4G |
| Stars | 100,000+ at 60fps (instancing + culling) |
| Memory | < 2GB GPU on mobile |

---

## KEY SHADER SIGNATURES

**Sun surface:** Layered simplex noise (4 octaves), blackbody color ramp, animated time uniform. Bright faculae + dark sunspots.

**Atmosphere:** Single-pass fragment. Ray through atmosphere shell. Optical depth along ray. `exp(-opticalDepth * scatterCoeff)`. Rayleigh: λ⁻⁴ (blue scatters more). Blue limb from space, red at grazing angles.

**Star glow:** Billboard quad. Radial gradient, exponential falloff. Color from temperature. Additive alpha blending.

**Ring system:** Flat disc mesh with hole. Texture lookup by radius (Cassini division = transparent). Planet shadow (sphere intersection). Opposition surge (back-scatter brightening).

---

## CRITICAL CONSTRAINTS

- **NO** cartoon/stylized rendering. Photorealistic only.
- **NO** 2D circles for planets. Full 3D spheres with proper textures.
- **NO** flat star skybox. Stars are 3D-positioned with parallax.
- **Space is BLACK.** No gradient backgrounds, no ambient light filling shadows.
- Sizes and distances **MUST** be astronomically correct.
- Orbital mechanics **MUST** use real Keplerian elements, not circular approximations.
- The Sun **MUST** have animated surface detail, not a solid color with glow.
- Quality bar: **Interstellar (Christopher Nolan)**. Every frame must be cinematic.
