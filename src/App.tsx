import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { XR, useXR } from '@react-three/xr'
import * as THREE from 'three'

import { xrStore } from './stores/xrStore'

import Sun from './objects/Sun'
import Earth from './objects/Earth'
import SolarSystem from './objects/SolarSystem'
import Moons from './objects/Moons'
import MinorBodies from './objects/MinorBodies'
import Meteors from './objects/Meteor'
import SpaceObjects from './objects/SpaceObjects'
import SpaceObjectModels from './objects/SpaceObjectModels'
import StarField from './objects/StarField'
import AlphaCentauri from './objects/AlphaCentauri'
import BlackHole from './objects/BlackHole'
import Wormhole from './objects/Wormhole'
import WarpTunnel from './objects/WarpTunnel'
import Cosmos from './objects/Cosmos'
import SpaceNavigator from './controls/SpaceNavigator'
import XRFlight from './controls/XRFlight'
import Joystick from './controls/Joystick'
import HUD from './hud/HUD'
import SearchPanel from './hud/SearchPanel'
import TimePanel from './hud/TimePanel'
import ObjectLabels from './hud/ObjectLabels'

function SolarSystemScene() {
  return (
    <>
      <Sun position={[0, 0, 0]} />
      <Earth />
      <SolarSystem />
      <Moons />
      <MinorBodies />
      <Meteors />
      <SpaceObjects />
      <SpaceObjectModels />
      {/* Nearby resolved stars, sitting in the stellar shell beyond the planets.
          Fewer background stars so space reads as a colourful deep field rather
          than a dense wall of white dots. */}
      <StarField radius={85_000} backgroundCount={55_000} />
      {/* Our nearest neighbour — a real, fly-to-able triple-star system. */}
      <AlphaCentauri />
      {/* A stellar-mass black hole with accretion disk + jets. */}
      <BlackHole />
      {/* An Interstellar-style wormhole out near Saturn's distance. */}
      <Wormhole />
      {/* Everything beyond — Oort, Milky Way, cosmic web, observable edge. */}
      <Cosmos />
    </>
  )
}

// Bloom + tone-mapping composer. Disabled inside an immersive XR session:
// the postprocessing EffectComposer renders a single fullscreen pass and breaks
// WebXR's stereo (per-eye) rendering, so in VR we fall back to the plain
// pipeline. (Re-enable later via a WebXR-aware composer.)
function PostFX() {
  const inXR = useXR((s) => s.session != null)
  if (inXR) return null
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={0.7}
        luminanceThreshold={0.78}
        luminanceSmoothing={0.25}
        mipmapBlur
      />
      {/* PBR Neutral preserves colour saturation instead of crushing bright
          additive points (stars/galaxies/nebulae) to white like ACES does. */}
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
    </EffectComposer>
  )
}

function Scene() {
  return (
    <>
      <color attach="background" args={['#000000']} />
      <SpaceNavigator />
      {/* VR locomotion — only does anything inside an immersive session. */}
      <XRFlight />
      <Suspense fallback={null}>
        <SolarSystemScene />
        <ObjectLabels />
      </Suspense>
      {/* Wormhole-jump cutscene overlay (shown only mid-jump). */}
      <WarpTunnel />
      <PostFX />
    </>
  )
}

export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <Canvas
        // Cap the device pixel ratio: uncapped, high-DPI phones render the
        // additive point sprites huge → dense overlap blooms into white
        // "floodlights" (and tanks perf). 2 is plenty crisp.
        dpr={[1, 2]}
        gl={{
          logarithmicDepthBuffer: true,
          antialias: true,
          toneMapping: THREE.NoToneMapping,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        camera={{
          fov: 60,
          near: 0.001,
          far: 1e12,
          // Hero opening: just off Earth (at x=2000), Sun lighting it from the
          // far side for a crescent + atmosphere-glow composition.
          position: [2005, 1.2, 4],
        }}
        onCreated={({ camera }) => camera.lookAt(2000, 0, 0)}
        shadows
      >
        <XR store={xrStore}>
          <Scene />
        </XR>
      </Canvas>
      <HUD />
      <SearchPanel />
      <TimePanel />
      <Joystick />
    </div>
  )
}
