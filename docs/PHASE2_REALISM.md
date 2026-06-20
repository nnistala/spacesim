# Phase 2 — Photoreal Realism Pass

> Goal: true-to-life Earth, Moon, and Sun. Jaw-dropping on first sight. Real surfaces, real relief, real heat, real distances on approach.

## Decisions (locked)

- **Scale model: HYBRID** — true relative *sizes* (Sun 109× Earth, Moon 0.27×), eased *distances* (gaps log-compressed for composition + tractable travel). Real proximity readouts preserved.
- **Textures: PROGRESSIVE NASA STREAMING** — 2K instant → 8K/16K on approach.
- **First focus: ALL THREE TOGETHER** — Earth, Moon, Sun get the realism pass as one push.

## Why Hybrid (not pure real scale)

At real scale Earth + Sun are never both impressive in one frame (Sun is 0.5° from Earth). Hybrid keeps true sizes (massive-on-approach wow) but eases distances (iconic compositions + real altitude readouts via 1 unit = 6,371 km). Defers floating-origin complexity until interstellar travel.

## A. Scale & Precision Foundation

- 1 render unit = 1 Earth radius = 6,371 km (global, for size + proximity)
- True relative radii: Earth 1.0, Moon 0.2727, Sun 109.3
- Earth–Moon kept near-real (Moon ~60 units) — authentic local system
- Heliocentric distance compression: `renderUnits = EARTH_ORBIT_UNITS * AU^0.65`
- Distance HUD: render-distance × 6,371 km → km / AU / ly (accurate on approach)
- Floating origin: DEFERRED to interstellar phase

## B. Earth — real surface (NASA)

- Blue Marble diffuse (continents, oceans, ice) — real world map
- Black Marble night lights
- Specular ocean mask (sun glint on water)
- Topography normal/bump (mountain shadows at terminator)
- Real cloud layer, drifting, soft shadows
- Tuned Rayleigh atmosphere (blue limb, sunset band)

## C. Moon — real relief (NASA LRO)

- LRO albedo map (real maria + named ray craters: Tycho, Copernicus)
- LOLA elevation displacement → craters as real geometry, real shadows
- Correct dark albedo (~12%), not cartoon white
- Libration + tidal lock

## D. Sun — heat & flames

- Prominences: arcing plasma loops off the limb (the "flames")
- Spicules + chromosphere fire carpet
- Granulation (have it), sunspots, faculae, filaments
- Occasional coronal mass ejections
- Overwhelming bloom + heat shimmer on close approach

## E. Object labels

- Floating name tags, distance-fade, hover for stats

## F. Space debris

- Near-Earth satellites/debris, micrometeoroids, asteroid-belt groundwork

## G. LOD + texture streaming

- 2K instant, stream 8K/16K on approach, seamless swap, dispose far textures

## H. Keyboard fix

- Listen on window; clear keys on blur (fixes stuck/dead arrows); blur HUD buttons after click

## Sequence

1. Scale foundation + distance HUD + keyboard fix
2. Texture streaming pipeline
3. Hero-detail Earth + Moon + Sun
4. Labels + debris
