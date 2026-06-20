import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { lyToRenderUnits } from '../data/cosmicScale'
import { useProximityStore } from '../stores/proximityStore'

// ===========================================================================
// BLACK HOLE — Interstellar "Gargantua" style.
// ---------------------------------------------------------------------------
// A pitch-black event-horizon sphere, a hot rotating accretion disk (smooth
// shader, white-hot inner → orange → red outer, with turbulence + Doppler
// beaming), and a camera-facing halo that supplies the searing photon ring and
// the lensed glow arcing around the shadow. Cygnus X-1 sky direction.
// ===========================================================================

const DIR: [number, number, number] = [0.4049, 0.5764, -0.7098]
const DISTANCE_LY = 7000
const RS = 40 // event-horizon radius
const DISK_INNER = RS * 1.6
const DISK_OUTER = RS * 5.5
const TILT: [number, number, number] = [1.32, 0.5, 0.0] // near edge-on, dramatic

const NOISE = /* glsl */ `
  float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
  float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
    return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
  float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.13; a*=0.5; } return v; }
`

// ---- Flat accretion disk (RingGeometry in its own plane) -------------------
const DISK_VERT = /* glsl */ `
  varying vec2 vL;
  void main(){ vL = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const DISK_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vL;
  uniform float uTime; uniform float uInner; uniform float uOuter;
  ${NOISE}
  void main(){
    float r = length(vL);
    float t = clamp((r - uInner)/(uOuter - uInner), 0.0, 1.0);
    float ang = atan(vL.y, vL.x);
    // Differential rotation: inner orbits faster.
    float spin = uTime * (0.9 - 0.6*t);
    float nz = fbm(vec2(ang*3.0 + spin, t*6.0 + 1.0));
    float nz2 = fbm(vec2(ang*7.0 - spin*1.6, t*12.0));
    float dens = (0.45 + 0.75*nz) * (0.7 + 0.5*nz2);
    // Temperature: white-hot inner → orange → deep red.
    vec3 hot = vec3(1.0, 0.97, 0.88);
    vec3 mid = vec3(1.0, 0.66, 0.32);
    vec3 cool = vec3(0.95, 0.30, 0.12);
    vec3 col = t < 0.5 ? mix(hot, mid, t/0.5) : mix(mid, cool, (t-0.5)/0.5);
    // Doppler beaming — one side much brighter.
    float dop = 0.4 + 1.25 * pow(max(0.0, cos(ang - 1.2)), 1.5);
    float bright = (1.15 - t) * dens * dop;
    // Soft inner/outer falloff.
    bright *= smoothstep(0.0, 0.06, t) * smoothstep(1.0, 0.8, t);
    gl_FragColor = vec4(col * bright, clamp(bright, 0.0, 1.0));
  }
`

// ---- Camera-facing halo: photon ring + lensed glow round the shadow --------
const HALO_VERT = DISK_VERT
const HALO_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vL;
  uniform float uInner; uniform float uOuter;
  void main(){
    float r = length(vL);
    float t = clamp((r - uInner)/(uOuter - uInner), 0.0, 1.0);
    // Searing thin photon ring near the inner edge.
    float ring = smoothstep(0.10, 0.0, abs(t - 0.06));
    // Soft halo falling off outward, brighter top & bottom (lensed disk arc).
    float ang = atan(vL.y, vL.x);
    float arc = 0.55 + 0.45 * abs(sin(ang));
    float halo = pow(1.0 - t, 2.2) * 0.5 * arc;
    float a = ring * 1.6 + halo;
    vec3 c = mix(vec3(1.0, 0.93, 0.78), vec3(1.0, 0.5, 0.22), t);
    gl_FragColor = vec4(c * a, clamp(a, 0.0, 1.0));
  }
`

export default function BlackHole() {
  const center = useMemo(
    () => new THREE.Vector3(...DIR).normalize().multiplyScalar(lyToRenderUnits(DISTANCE_LY)),
    [],
  )
  const diskRef = useRef<THREE.ShaderMaterial>(null)
  const haloRef = useRef<THREE.Mesh>(null)

  const diskMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: DISK_VERT,
        fragmentShader: DISK_FRAG,
        uniforms: { uTime: { value: 0 }, uInner: { value: DISK_INNER }, uOuter: { value: DISK_OUTER } },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  )
  const haloMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: HALO_VERT,
        fragmentShader: HALO_FRAG,
        uniforms: { uInner: { value: RS * 1.15 }, uOuter: { value: RS * 3.4 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  )

  useEffect(() => {
    const store = useProximityStore.getState()
    store.registerBody({
      id: 'cygnus-x1',
      name: 'Black Hole (Cygnus X-1)',
      position: [center.x, center.y, center.z],
      radius: DISK_OUTER,
      kind: 'structure',
      labelRange: DISK_OUTER * 16,
    })
    return () => store.unregisterBody('cygnus-x1')
  }, [center])

  useFrame((state) => {
    if (diskRef.current) diskRef.current.uniforms.uTime.value = state.clock.elapsedTime
    if (haloRef.current) haloRef.current.quaternion.copy(state.camera.quaternion)
  })

  return (
    <group position={[center.x, center.y, center.z]}>
      <group rotation={TILT}>
        {/* Event horizon — pure black, occludes everything behind it. */}
        <mesh>
          <sphereGeometry args={[RS, 64, 64]} />
          <meshBasicMaterial color="#000000" toneMapped={false} />
        </mesh>
        {/* Accretion disk, flat in this plane. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[DISK_INNER, DISK_OUTER, 160, 1]} />
          <primitive object={diskMat} ref={diskRef} attach="material" />
        </mesh>
      </group>
      {/* Photon ring + lensed halo — always faces the camera. */}
      <mesh ref={haloRef}>
        <ringGeometry args={[RS * 1.15, RS * 3.4, 96, 1]} />
        <primitive object={haloMat} attach="material" />
      </mesh>
    </group>
  )
}
