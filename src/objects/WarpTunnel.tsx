import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { useNavigationStore } from '../stores/navigationStore'

// ===========================================================================
// WARP TUNNEL — the wormhole-jump cutscene. A full-screen shader quad pinned in
// front of the camera, shown only while navigationStore.wormholeWarp is true:
// fine lensed starlight streaks rushing past, a blue-white tunnel core, a flash
// at the jump (which hides the teleport), then a fade-out on the far side.
// Matched to the navigator's 4.6 s / teleport-at-2.1 s timing.
// ===========================================================================

const DURATION = 4.6

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uProgress;
  uniform float uTime;
  uniform float uAspect;

  float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }

  void main(){
    vec2 uv = (vUv - 0.5) * vec2(uAspect, 1.0);
    float r = length(uv);
    float ang = atan(uv.y, uv.x);
    float P = uProgress;

    // Accelerate into the tunnel, decelerate out the far side.
    float speed = smoothstep(0.0, 0.18, P) * smoothstep(1.0, 0.6, P);
    // Fisheye/lens warp of the radial coordinate.
    float rr = pow(r, 0.72);

    // Fine starlight streaks in angular bins, flowing toward the centre.
    float bins = 400.0;
    float a01 = ang / 6.28318 + 0.5;
    float id = floor(a01 * bins);
    float jit = hash(vec2(id, 7.0));
    float flow = uTime * (0.5 + speed * 3.2) * (0.6 + jit * 0.8);
    float rpos = fract(jit * 3.1 - flow);
    float len = 0.04 + speed * 0.6;                 // motion-blur length
    float seg = step(0.45, hash(vec2(id, floor(rpos * 40.0))));
    float line = smoothstep(len, 0.0, abs(rr - rpos)) * seg * smoothstep(0.0, 0.12, rr);

    vec3 streak = mix(vec3(0.55, 0.74, 1.0), vec3(1.0), jit);
    vec3 col = streak * line * 1.3;

    // Glowing tunnel mouth.
    col += vec3(0.42, 0.62, 1.0) * pow(max(0.0, 1.0 - r * 1.05), 3.0) * (0.35 + speed);

    // Chromatic aberration toward the rim for a lensed feel.
    float ca = 0.012 + speed * 0.03;
    col.r += pow(max(0.0, 1.0 - length(uv) * (1.0 + ca)), 4.0) * 0.25;
    col.b += pow(max(0.0, 1.0 - length(uv) * (1.0 - ca)), 4.0) * 0.25;

    // The jump flash (hides the teleport at ~46%).
    float flash = exp(-pow((P - 0.46) / 0.05, 2.0));
    col += vec3(1.0) * flash * 1.3;

    // Vignette + a touch of grain.
    col *= smoothstep(1.45, 0.2, r);
    col += (hash(uv * 13.0 + uTime) - 0.5) * 0.03;

    // Opaque through the middle (covers the scene + teleport); fade at the ends.
    float cover = smoothstep(0.0, 0.12, P) * smoothstep(1.0, 0.86, P);
    float alpha = clamp(max(cover, flash), 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);
  }
`

export default function WarpTunnel() {
  const meshRef = useRef<THREE.Mesh>(null)
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const startRef = useRef<number | null>(null)
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: { uProgress: { value: 0 }, uTime: { value: 0 }, uAspect: { value: 1 } },
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  )

  useFrame((state) => {
    const mesh = meshRef.current
    const m = matRef.current
    if (!mesh || !m) return
    const active = useNavigationStore.getState().wormholeWarp
    if (!active) {
      mesh.visible = false
      startRef.current = null
      return
    }
    if (startRef.current === null) startRef.current = state.clock.elapsedTime
    const p = Math.min(1, (state.clock.elapsedTime - startRef.current) / DURATION)
    m.uniforms.uProgress.value = p
    m.uniforms.uTime.value = state.clock.elapsedTime
    m.uniforms.uAspect.value = state.size.width / state.size.height

    // Pin the quad just in front of the camera, sized to fill the view.
    const cam = state.camera as THREE.PerspectiveCamera
    mesh.position.copy(cam.position)
    mesh.quaternion.copy(cam.quaternion)
    mesh.translateZ(-0.5)
    const h = 2 * 0.5 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * 1.35
    mesh.scale.set(h * (state.size.width / state.size.height), h, 1)
    mesh.visible = true
  })

  return (
    <mesh ref={meshRef} renderOrder={9999} frustumCulled={false} visible={false}>
      <primitive object={mat} ref={matRef} attach="material" />
      <planeGeometry args={[1, 1]} />
    </mesh>
  )
}
