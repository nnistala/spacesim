<div align="center">

# 🪐 SpaceSim

### A scientifically accurate, cinematic 3D journey through the known universe — in your browser.

![SpaceSim hero](docs/screenshots/hero.png)

[**▶ Launch the live demo**](https://nnistala.github.io/spacesim/) · [Features](#-features) · [Gallery](#-gallery) · [Getting started](#-getting-started) · [Roadmap](#-roadmap)

</div>

---

## ✨ The ambition

SpaceSim is an attempt to build a **real, explorable universe** — one you can fly through from the surface of Earth to the edge of the observable cosmos, on any device, with nothing but a web browser.

The bar is **_Interstellar_**. Every star, planet, moon, and nebula should look like it belongs in a Christopher Nolan film *and* be where it actually is in the sky, at the size and color it actually is. No cartoon circles. No flat skyboxes. No ambient-light cheats. Space is black, the Sun is white-hot (not yellow), light obeys the inverse-square law, and orbits are real Keplerian ellipses.

It should be **beautiful, mesmerizing — and, when you get close to a dying star or a supernova remnant, a little bit terrifying.**

## 🌌 What it is

A free-flight space simulator spanning **six scales** — surface → orbital → planetary → stellar → galactic → cosmic — stitched together with a hybrid logarithmic scale so the whole universe fits in one continuous, float-safe scene. Fly anywhere, search for any object, and let the targeting scope name whatever you point at.

## 🚀 Features

- **The Solar System, to scale** — the Sun (white G2V blackbody with constantly erupting flares & prominences), all eight planets at true relative size on real elliptical orbits, Saturn's rings, and procedural NASA-derived textures.
- **18 natural satellites** — the Galilean moons of Jupiter, Titan and friends at Saturn, the moons of Mars, Uranus and Neptune (including retrograde Triton), each correctly sun-lit with real orbital-period ratios.
- **Human-made objects** — fly up to **real public-domain NASA 3D models** of the ISS, Hubble, the Mars rovers (Perseverance, Curiosity), LRO, MRO, MAVEN and GOES, plus Tiangong, GPS and the Apollo flags.
- **Minor bodies** — the asteroid belt, comets with ion + dust tails, and shooting-star meteors streaking across the sky.
- **Deep sky** — our nearest neighbour **Alpha Centauri** (a real triple-star system), an Interstellar-style **black hole** (Cygnus X-1) with a lensed accretion disk, a **wormhole** out near Saturn, the **Milky Way**, the **Andromeda**, **Triangulum**, **Whirlpool** and edge-on **Sombrero** galaxies, the **Crab Nebula** supernova remnant, the **Carina**, **Orion**, **Eagle/Pillars** and **Lagoon** nebulae, the **Ring** and **Helix** planetary nebulae, the **Local Group**, the **Virgo Cluster**, and the cosmic web out to the observable edge.
- **Targeting scope** — a reticle that locks onto and names whatever body is in your sights.
- **Search & fly-to** — press `/`, type any object's name, and warp straight to a perfectly framed view.
- **Time controls** — pause or speed up the simulation to watch moons and satellites orbit.
- **WebXR / VR ready** — enter VR on a headset with one click.

## 🖼 Gallery

| | |
|---|---|
| ![Black Hole](docs/screenshots/black-hole.png) **Black Hole (Cygnus X-1)** — lensed accretion disk & photon ring | ![Wormhole](docs/screenshots/wormhole.png) **Wormhole** — a refracting hole in spacetime, near Saturn |
| ![Crab Nebula](docs/screenshots/crab-nebula.png) **Crab Nebula (M1)** — supernova remnant, Hubble palette | ![Whirlpool Galaxy](docs/screenshots/whirlpool-galaxy.png) **Whirlpool Galaxy (M51)** — a grand-design spiral |
| ![Alpha Centauri](docs/screenshots/alpha-centauri.png) **Alpha Centauri** — our nearest stellar neighbours | ![ISS](docs/screenshots/iss.png) **ISS** — the real NASA 3D model, up close |

## 🔬 Scientific accuracy

SpaceSim deliberately favours real physics and real data:

- The **Sun is white** (G2V, ~5778 K blackbody), not yellow.
- **Distances** use real astronomical values; only the empty gaps are log-compressed so travel stays tractable.
- **Orbits** are elliptical (Keplerian), solved with a real Kepler-equation solver, at each body's true position for today's date.
- **Lighting** is a single source per star system following the inverse-square law; shadows are truly black (no fake ambient).
- **Star and nebula colors** come from spectral type / emission-line physics (e.g. the Crab's orange hydrogen, green sulfur, blue oxygen, blue-white synchrotron core).
- Positions of deep-sky objects use their **real sky coordinates** (RA/Dec).

## 🎮 Controls

| Input | Action |
|---|---|
| `W` `A` `S` `D` | Move (forward / strafe) |
| Mouse | Look (click canvas to lock pointer) |
| Hold `W` | Charge warp speed |
| `Shift` | Boost · `Space` Brake |
| Scroll | Adjust speed |
| `/` | Search the universe → fly to any object |
| Targeting scope | Auto-names the body in your sights |

## 🧰 Tech stack

- **React 19** + **TypeScript** (strict)
- **Three.js** via **React Three Fiber** + **drei** + **postprocessing**
- **WebXR** via `@react-three/xr`
- **Zustand** state · **Vite** build · **Tailwind CSS** (HUD overlays)
- Custom **GLSL** shaders for the Sun, atmospheres, star fields and galaxies
- Public-domain **NASA** imagery and astronomical data

## 🏁 Getting started

```bash
git clone https://github.com/nnistala/spacesim.git
cd spacesim
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

```bash
npm run build      # production build (type-checks + bundles)
npm run preview    # preview the production build
npm run lint       # ESLint
```

## ☁️ Deployment

The live site is hosted on **GitHub Pages** at **https://nnistala.github.io/spacesim/** (served from the `gh-pages` branch).

A ready-to-use GitHub Actions workflow for automated build-and-deploy on every push is included at `.github/workflows/deploy.yml`. To enable it, grant the `workflow` scope once (`gh auth refresh -h github.com -s workflow`), commit the `.github/` folder, and switch the Pages source to "GitHub Actions".

## 🗺 Roadmap

- More NASA showpieces: Pillars of Creation / Eagle Nebula, Ring, Helix, Lagoon, Horsehead, Pleiades
- Planetary surface landing & terrain
- Black holes with accretion disks, pulsars, and more named galaxies
- Distinct Laniakea Supercluster flow structure
- Progressive 2K→8K texture streaming
- Magnetic-field visualizations around the Sun

## 🙏 Credits & data

Imagery and astronomical data courtesy of **NASA / ESA / Hubble / JWST / SDO** (public domain). Built with the open-source React Three Fiber ecosystem.

---

<div align="center">
<sub>Made with a telescope-sized dose of wonder. Pull requests and star-gazers welcome. ⭐</sub>
</div>
