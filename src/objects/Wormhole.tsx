import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { auToRenderUnits } from '../data/scaleConfig'
import { useProximityStore } from '../stores/proximityStore'

// ===========================================================================
// WORMHOLE — an Interstellar-style sphere of warped spacetime. The surface
// refracts your line of sight to a DIFFERENT starfield (the far side of the
// galaxy), so it reads as a crystal-ball "hole in space" full of distorted
// stars, ringed by a bright Einstein rim. Placed out near Saturn's distance,
// where Interstellar's wormhole sat.
// ===========================================================================

// A clear, empty patch of sky below the ecliptic — well away from the named
// galaxies/nebulae lines of sight (no overlap from the inner solar system).
const POSITION = new THREE.Vector3(0.45, -0.78, 0.43).normalize().multiplyScalar(auToRenderUnits(9.2))
const RADIUS = 220

const VERT = /* glsl */ `
  varying vec3 vN;
  varying vec3 vWorld;
  void main(){
    vN = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

const FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vN;
  varying vec3 vWorld;
  uniform vec3 uCam;
  uniform float uTime;

  float h31(vec3 p){ p = fract(p*0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y)*p.z); }
  float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
  float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
  float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<4;i++){ v+=a*n2(p); p*=2.1; a*=0.5; } return v; }

  // Sparse bright stars sampled along a 3D direction.
  float starfield(vec3 d){
    vec3 g = d * 55.0;
    vec3 i = floor(g);
    vec3 f = fract(g) - 0.5;
    float r = h31(i);
    float s = 0.0;
    if (r > 0.93) s = smoothstep(0.45, 0.0, length(f)) * (r - 0.93) * 14.0;
    return s;
  }

  void main(){
    vec3 N = normalize(vN);
    vec3 V = normalize(vWorld - uCam);
    // Refract the view into the sphere → the far-side starfield warps toward
    // the centre (the classic wormhole fish-eye). Swirl it slowly.
    vec3 rd = refract(V, N, 0.62);
    if (dot(rd, rd) < 0.0001) rd = reflect(V, N);
    float fres = pow(1.0 - abs(dot(N, V)), 2.5);
    // Swirl around the view axis, stronger toward the rim.
    float a = (0.4 + fres) * 1.6 + uTime * 0.05;
    float cs = cos(a), sn = sin(a);
    rd.xy = mat2(cs, -sn, sn, cs) * rd.xy;

    // Destination sky — DARK, blending into space: faint warped stars + dim
    // warped galaxies (warm smudges) + a thin subtle rim. No glowing blue ball.
    float st = (starfield(rd * 1.7) + 0.5 * starfield(rd * 3.4 + 10.0)) * 0.7;
    vec3 col = vec3(st);
    float haze = fbm(rd.xy * 2.2 + rd.z * 1.4);
    vec3 gal = mix(vec3(0.03, 0.04, 0.08), vec3(0.30, 0.17, 0.11), smoothstep(0.5, 0.95, haze));
    col += gal * (0.18 + 0.4 * haze);
    col += vec3(0.42, 0.26, 0.18) * smoothstep(0.86, 1.0, haze); // rare warm galaxy cores
    // Thin, subtle Einstein rim (not a bright halo).
    col += vec3(0.4, 0.5, 0.66) * pow(fres, 3.5) * 0.55;

    gl_FragColor = vec4(col, 1.0);
  }
`

export default function Wormhole() {
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: { uCam: { value: new THREE.Vector3() }, uTime: { value: 0 } },
        toneMapped: false,
      }),
    [],
  )

  useEffect(() => {
    const store = useProximityStore.getState()
    store.registerBody({
      id: 'wormhole',
      name: 'Wormhole',
      position: [POSITION.x, POSITION.y, POSITION.z],
      radius: RADIUS,
      kind: 'structure',
      labelRange: RADIUS * 40,
    })
    return () => store.unregisterBody('wormhole')
  }, [])

  useFrame((state) => {
    const m = matRef.current
    if (!m) return
    m.uniforms.uTime.value = state.clock.elapsedTime
    m.uniforms.uCam.value.copy(state.camera.position)
  })

  return (
    <mesh position={[POSITION.x, POSITION.y, POSITION.z]} frustumCulled={false}>
      <sphereGeometry args={[RADIUS, 96, 96]} />
      <primitive object={mat} ref={matRef} attach="material" />
    </mesh>
  )
}
