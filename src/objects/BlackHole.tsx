import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { lyToRenderUnits } from '../data/cosmicScale'
import { useProximityStore } from '../stores/proximityStore'

// ===========================================================================
// BLACK HOLE — Ultimate Gravitational Lensing Edition
// ---------------------------------------------------------------------------
// The event horizon is pure black. The massive Corona acts as a true
// gravitational lens, warping the background starfield using the wormhole
// refraction math, fading into a solid black aura near the event horizon!
// ===========================================================================

const DIR: [number, number, number] = [0.4049, 0.5764, -0.7098]
const DISTANCE_LY = 7000
// Massively increased black hole radius!
const RS = 60
// Restored the gap! The disk starts further out, so it never overlaps or cuts the perfect black circle.
const DISK_INNER = RS * 1.0
// Adjusted multiplier so the black hole looks huge relative to the disk
const DISK_OUTER = RS * 2.5
const HALO_SIZE = RS * 10.0

// Beautiful diagonal 3D tilt for the accretion disk
const TILT: [number, number, number] = [1.32, 0.4, 0.0]

const NOISE = /* glsl */ `
  float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
  float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
    return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
  float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.13; a*=0.8; } return v; }
`

// ---- Flat accretion disk -------------------
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
    
    float speed = 2.0 / sqrt(t + 0.05); 
    // Super fast spin animation!
    float spin = uTime * speed * 1.0;
    
    float rings = fbm(vec2(t * 30.0, 0.0));
    float rings2 = fbm(vec2(t * 80.0, 0.0));
    float structNoise = (0.6 * rings + 0.4 * rings2);
    
    float gas = fbm(vec2(ang * 4.0 + spin, t * 6.0));
    float dens = structNoise * (0.4 + 0.6 * gas);
    
    float dopplerShift = cos(ang + 0.5); 
    float dopplerBright = 1.0 + 0.6 * dopplerShift; 
    
    vec3 core = vec3(1.0, 1.0, 1.0);     
    vec3 hot = vec3(1.0, 0.75, 0.3);     
    vec3 mid = vec3(0.9, 0.35, 0.05);    
    vec3 cool = vec3(0.3, 0.02, 0.0);    
    
    float temp = (1.0 - t) + dopplerShift * 0.15;
    vec3 col;
    if (temp > 0.7) col = mix(hot, core, (temp-0.7)/0.3);
    else if (temp > 0.3) col = mix(mid, hot, (temp-0.3)/0.4);
    else col = mix(cool, mid, temp/0.3);
    
    float edgeProfile = smoothstep(0.0, 0.02, t) * smoothstep(1.0, 0.6, t);
    float bright = dens * dopplerBright * edgeProfile * 4.5;
    
    gl_FragColor = vec4(col * bright, clamp(bright, 0.0, 1.0));
  }
`

// ---- Gravitational Lensing Corona -------------------
const HALO_VERT = /* glsl */ `
  varying vec2 vL;
  void main(){
    vL = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const HALO_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vL;
  uniform float uTime; uniform float uInner; uniform float uOuter;
  
  float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
  float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
    return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
  float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.13; a*=0.5; } return v; }

  void main(){
    float r = length(vL);
    
    // Original black corona intensity map
    float pDist = abs(r - uInner);
    float photon = 0.04 / (pDist + 0.005) * smoothstep(uInner * 1.05, uInner, r);
    float corona = exp(-pDist * 0.1) * 0.8;
    float ang = atan(vL.y, vL.x);
    float gas = fbm(vec2(ang * 3.0 - uTime * 0.1, r * 0.1));
    corona *= (0.7 + 0.3 * gas);
    
    // Overall opacity for the blending mode. 
    float a = photon * 2.5 + corona;
    a *= smoothstep(uOuter, uOuter * 0.8, r); 
    
    // Pure black "dark energy" aura!
    vec3 color = vec3(0.0, 0.0, 0.0);
    
    gl_FragColor = vec4(color, clamp(a, 0.0, 1.0));
  }
`

// ---- Refractive Wormhole Sphere -------------------
const WORMHOLE_VERT = /* glsl */ `
  varying vec3 vN;
  varying vec3 vWorld;
  varying vec3 vLocalPos;
  void main(){
    vN = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vLocalPos = position;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

const WORMHOLE_FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vN;
  varying vec3 vWorld;
  varying vec3 vLocalPos;
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
    // PERFECT FLUSH SLICE: Discard the bottom half of the sphere in local space.
    // Since the disk is on the local XZ plane (Y=0), this slice perfectly touches the disk!
    if (vLocalPos.y < 0.0) {
       discard;
    }

    vec3 N = normalize(vN);
    vec3 V = normalize(vWorld - uCam);
    // Refract the view into the sphere
    vec3 rd = refract(V, N, 0.62);
    if (dot(rd, rd) < 0.0001) rd = reflect(V, N);
    float fres = pow(1.0 - abs(dot(N, V)), 2.5);
    // Swirl around the view axis
    float a = (0.4 + fres) * 1.6 + uTime * 0.5;
    float cs = cos(a), sn = sin(a);
    rd.xy = mat2(cs, -sn, sn, cs) * rd.xy;

    float st = (starfield(rd * 1.7) + 0.5 * starfield(rd * 3.4 + 10.0)) * 0.7;
    vec3 col = vec3(st);
    float haze = fbm(rd.xy * 2.2 + rd.z * 1.4);
    vec3 gal = mix(vec3(0.03, 0.04, 0.08), vec3(0.30, 0.17, 0.11), smoothstep(0.5, 0.95, haze));
    col += gal * (0.18 + 0.4 * haze);
    col += vec3(0.42, 0.26, 0.18) * smoothstep(0.86, 1.0, haze); 
    col += vec3(0.4, 0.5, 0.66) * pow(fres, 3.5) * 0.55;

    gl_FragColor = vec4(col, 1.0);
  }
`

export default function BlackHole() {
  const center = useMemo(
    () => new THREE.Vector3(...DIR).normalize().multiplyScalar(lyToRenderUnits(DISTANCE_LY)),
    [],
  )
  const diskRef = useRef<THREE.ShaderMaterial>(null)
  const haloRef = useRef<THREE.ShaderMaterial>(null)
  const haloMeshRef = useRef<THREE.Mesh>(null)
  const holeMatRef = useRef<THREE.ShaderMaterial>(null)

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
        uniforms: { uTime: { value: 0 }, uInner: { value: RS * 1.02 }, uOuter: { value: HALO_SIZE * 0.5 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
        toneMapped: false,
      }),
    [],
  )

  const holeMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: WORMHOLE_VERT,
        fragmentShader: WORMHOLE_FRAG,
        uniforms: { uCam: { value: new THREE.Vector3() }, uTime: { value: 0 } },
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
    if (haloRef.current) haloRef.current.uniforms.uTime.value = state.clock.elapsedTime

    if (holeMatRef.current) {
      holeMatRef.current.uniforms.uTime.value = state.clock.elapsedTime
      holeMatRef.current.uniforms.uCam.value.copy(state.camera.position)
    }

    if (haloMeshRef.current) {
      haloMeshRef.current.quaternion.copy(state.camera.quaternion)
    }
  })

  return (
    <group position={[center.x, center.y, center.z]}>

      <group rotation={TILT}>
        {/* Event horizon — A perfect physical 3D hemisphere sitting flush on the disk! */}
        <mesh>
          <sphereGeometry args={[RS, 64, 64]} />
          <primitive object={holeMat} ref={holeMatRef} attach="material" />
        </mesh>

        {/* Accretion disk — renderOrder 2 so it draws ON TOP of the halo! */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
          <ringGeometry args={[DISK_INNER, DISK_OUTER, 256, 1]} />
          <primitive object={diskMat} ref={diskRef} attach="material" />
        </mesh>
      </group>

      {/* 
        Camera-facing Lensing Corona
        renderOrder 1 so it draws BEHIND the glowing accretion disk.
      */}
      <mesh ref={haloMeshRef} position={[0, 0, 0]} renderOrder={1}>
        <planeGeometry args={[HALO_SIZE, HALO_SIZE]} />
        <primitive object={haloMat} ref={haloRef} attach="material" />
      </mesh>
    </group>
  )
}
