# ExploreSpace — Technical Architecture

## Rendering Pipeline

```
Canvas (R3F)
├── logarithmicDepthBuffer: true
├── toneMapping: ACESFilmicToneMapping
├── outputColorSpace: SRGBColorSpace
│
├── UniverseScene (root)
│   ├── ScaleManager (determines active scale level)
│   ├── Lighting (Sun as PointLight, shadows enabled)
│   │
│   ├── SolarSystemScene (when scale = PLANETARY or closer)
│   │   ├── Sun (ShaderMaterial: surface + chromosphere + corona)
│   │   ├── Planet[] (each with atmosphere, clouds, rings, moons)
│   │   ├── AsteroidBelt (InstancedMesh)
│   │   └── Comets (particle systems)
│   │
│   ├── GalacticScene (when scale = STELLAR or GALACTIC)
│   │   ├── StarField (InstancedMesh from HYG data + procedural background)
│   │   ├── Nebulae (volumetric/billboard)
│   │   ├── Constellations (LineSegments overlay)
│   │   └── MilkyWayStructure (particle arms)
│   │
│   └── CosmicScene (when scale = COSMIC)
│       ├── Galaxies (sprites/particle systems)
│       └── CosmicWeb (particle filaments)
│
├── EffectComposer (postprocessing)
│   ├── Bloom (sun glow, star glow)
│   ├── ToneMapping (ACES Filmic)
│   └── Vignette (VR comfort, cinematic framing)
│
└── SpaceNavigator (camera controller)
```

## State Architecture (Zustand)

```typescript
// navigationStore
{
  position: { scaleLevel, x, y, z, referenceBody? },
  velocity: Vector3,
  rotation: Euler,
  speed: number,           // current speed magnitude
  speedUnit: string,       // auto-scaling display unit
  mode: 'free' | 'orbit' | 'follow' | 'warp',
  warpTarget: CelestialBody | null,
  warpProgress: number     // 0-1 animation progress
}

// celestialStore
{
  bodies: Map<string, CelestialBody>,
  focusBody: string | null,
  currentDate: Date,       // for orbital mechanics
  timeScale: number,       // 1 = realtime, >1 = fast forward
  loaded: boolean
}

// uiStore
{
  mapOpen: boolean,
  mapZoomLevel: 'solar' | 'stellar' | 'galactic' | 'cosmic',
  infoPanelBody: string | null,
  searchQuery: string,
  searchResults: CelestialBody[],
  showConstellations: boolean,
  showOrbits: boolean,
  arMode: boolean,
  vrMode: boolean
}
```

## Data Flow

```
NASA Data (build-time)          Runtime
─────────────────────          ─────────
HYG CSV ──parse──→ stars.json ──→ StarField (InstancedMesh)
JPL Elements ────→ orbits.json ─→ KeplerSolver ──→ Planet positions
Textures ────────→ /public/tex ─→ Progressive TextureLoader
Messier CSV ─────→ dso.json ───→ DeepSkyObjects
```

## Scale Transition Algorithm

```
1. Detect: camera approaches scale boundary (e.g., leaving solar system)
2. Fade: current scale objects alpha → 0 over 1.5s
3. Transform: remap camera position to new scale coordinates
4. Spawn: new scale objects at correct positions
5. Fade: new objects alpha 0 → 1 over 1.5s
6. Cleanup: dispose old scale meshes/textures
```

## Performance Strategy

| Technique | What | Target |
|-----------|------|--------|
| InstancedMesh | Stars, asteroids | 100K+ objects at 60fps |
| Octree culling | Star catalog | Only render visible stars |
| LOD | Stars, planets, galaxies | Detail scales with distance |
| Texture streaming | Planet surfaces | Load 2K first, swap to 8K |
| Shader LOD | Sun, atmospheres | Simplified shaders on mobile |
| Object pooling | Meteors, particles | Reuse particle systems |
| Web Workers | Kepler solving, data parsing | Off main thread |
