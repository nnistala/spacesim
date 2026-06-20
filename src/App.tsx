import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { XR } from '@react-three/xr'
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
import Cosmos from './objects/Cosmos'
import SpaceNavigator from './controls/SpaceNavigator'
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
      {/* Everything beyond — Oort, Milky Way, cosmic web, observable edge. */}
      <Cosmos />
    </>
  )
}

function Scene() {
  return (
    <>
      <color attach="background" args={['#000000']} />
      <SpaceNavigator />
      <Suspense fallback={null}>
        <SolarSystemScene />
        <ObjectLabels />
      </Suspense>
      <EffectComposer multisampling={0}>
        <Bloom
          intensity={1.2}
          luminanceThreshold={0.6}
          luminanceSmoothing={0.3}
          mipmapBlur
        />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </>
  )
}

export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <Canvas
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
