import { useRef, useMemo, useCallback, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BODY_RADII } from '../data/scaleConfig';
import { useProximityStore } from '../stores/proximityStore';

// ---------------------------------------------------------------------------
// Inline shader sources (avoids Vite ?raw import issues across environments)
// ---------------------------------------------------------------------------

const sunSurfaceVert = /* glsl */ `
uniform float time;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vWorldPosition;
varying float vViewDot;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vPosition = position;

  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;

  vec3 viewDir = normalize(cameraPosition - worldPos.xyz);
  vec3 worldNormal = normalize(mat3(modelMatrix) * normal);
  vViewDot = dot(viewDir, worldNormal);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const sunSurfaceFrag = /* glsl */ `
precision highp float;

uniform float time;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vWorldPosition;
varying float vViewDot;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
  + i.y + vec4(0.0, i1.y, i2.y, 1.0))
  + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

float fbm(vec3 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  float lacunarity = 2.17;
  float gain = 0.49;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    value += amplitude * snoise(p * frequency);
    frequency *= lacunarity;
    amplitude *= gain;
  }
  return value;
}

float turbulence(vec3 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  float lacunarity = 2.13;
  float gain = 0.50;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    value += amplitude * abs(snoise(p * frequency));
    frequency *= lacunarity;
    amplitude *= gain;
  }
  return value;
}

vec3 sunColorRamp(float t) {
  // A G2V photosphere is essentially WHITE from space (5778 K blackbody),
  // with only faint warm granulation and darker, cooler sunspots.
  vec3 c0 = vec3(0.35, 0.12, 0.03);   // sunspot umbra (dark, cool)
  vec3 c1 = vec3(0.85, 0.42, 0.14);   // penumbra (warm orange)
  vec3 c2 = vec3(1.0, 0.80, 0.52);    // warm granulation low
  vec3 c3 = vec3(1.0, 0.96, 0.88);    // near white
  vec3 c4 = vec3(1.0, 1.0, 1.0);      // white hot
  if (t < 0.12) return mix(c0, c1, t / 0.12);
  if (t < 0.35) return mix(c1, c2, (t - 0.12) / 0.23);
  if (t < 0.62) return mix(c2, c3, (t - 0.35) / 0.27);
  return mix(c3, c4, clamp((t - 0.62) / 0.38, 0.0, 1.0));
}

void main() {
  vec3 pos = normalize(vPosition);
  float slowTime = time * 0.008;
  float medTime  = time * 0.025;
  float fastTime = time * 0.06;

  // Supergranulation
  vec3 convP = pos * 2.0 + vec3(slowTime * 0.3, slowTime * 0.2, slowTime * 0.15);
  float convection = fbm(convP, 4);
  float convSharp = 1.0 - smoothstep(0.0, 0.12, abs(convection));

  // Granulation
  vec3 granP = pos * 18.0 + vec3(fastTime * 0.7, fastTime * 0.5, fastTime * 0.3);
  float granNoise = snoise(granP);
  float granDetail = snoise(granP * 2.3 + vec3(fastTime * 0.4));
  float granulation = granNoise * 0.7 + granDetail * 0.3;
  float granCells = smoothstep(-0.3, 0.5, granulation);

  // Sunspots
  vec3 spotP = pos * 1.5 + vec3(slowTime * 0.1, -slowTime * 0.07, slowTime * 0.05);
  float spotNoise = snoise(spotP);
  float spotShape = snoise(spotP * 2.5 + vec3(slowTime * 0.05));
  float spotField = spotNoise * 0.65 + spotShape * 0.35;
  float sunspot = smoothstep(-0.55, -0.85, spotField);
  float penumbra = smoothstep(-0.35, -0.55, spotField) * (1.0 - sunspot);

  // Medium turbulence
  vec3 turbP = pos * 5.0 + vec3(medTime * 0.4, medTime * 0.3, -medTime * 0.2);
  float medTurb = turbulence(turbP, 5);

  // Faculae
  float faculae = smoothstep(0.35, 0.65, medTurb) * penumbra * 0.5;
  float brightPoints = smoothstep(0.65, 0.85, fbm(pos * 10.0 + vec3(medTime * 0.5), 4));
  faculae += brightPoints * 0.2;

  // Compose brightness — biased high so the disc reads as white-hot, not yellow
  float brightness = 0.72;
  brightness += convection * 0.12;
  brightness += (medTurb - 0.3) * 0.15;
  brightness += (granCells - 0.5) * 0.18;
  brightness -= sunspot * 0.55;
  brightness -= penumbra * 0.2;
  brightness += faculae * 0.25;
  brightness -= convSharp * 0.05;
  brightness = clamp(brightness, 0.0, 1.0);

  vec3 surfaceColor = sunColorRamp(brightness);

  // Limb darkening
  float mu = clamp(vViewDot, 0.0, 1.0);
  float limbU = 0.56;
  float limbV = 0.20;
  float limbDarkening = 1.0 - limbU * (1.0 - mu) - limbV * (1.0 - mu) * (1.0 - mu);
  limbDarkening = clamp(limbDarkening, 0.0, 1.0);
  float limbReddening = 1.0 - mu;
  vec3 limbRedShift = vec3(1.0, 1.0 - limbReddening * 0.25, 1.0 - limbReddening * 0.45);
  surfaceColor *= limbDarkening * limbRedShift;

  // HDR emission — push above 1.0 so bloom blows the core to brilliant white.
  surfaceColor *= 2.6;

  gl_FragColor = vec4(surfaceColor, 1.0);
}
`;

const sunCoronaVert = /* glsl */ `
uniform float time;

varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vViewPosition;
varying vec3 vNormal;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
}
`;

const sunCoronaFrag = /* glsl */ `
precision highp float;

uniform float time;
uniform vec3 sunCenter;
uniform float sunRadius;

varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vViewPosition;
varying vec3 vNormal;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
  + i.y + vec4(0.0, i1.y, i2.y, 1.0))
  + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

float fbm(vec3 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < 5; i++) {
    if (i >= octaves) break;
    value += amplitude * snoise(p * frequency);
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

void main() {
  vec3 dir = vWorldPosition - sunCenter;
  float dist = length(dir);
  vec3 dirNorm = dir / dist;
  float innerRadius = sunRadius;
  float outerRadius = sunRadius * 3.0;
  float t = (dist - innerRadius) / (outerRadius - innerRadius);
  t = clamp(t, 0.0, 1.0);

  // Radial falloff
  float radialFalloff = exp(-3.5 * t) * (1.0 - t);
  radialFalloff = max(radialFalloff, 0.0);

  // Streamers
  float theta = atan(dirNorm.z, dirNorm.x);
  float phi = asin(clamp(dirNorm.y, -1.0, 1.0));
  float slowDrift = time * 0.003;
  float streamer1 = snoise(vec3(theta * 2.0 + slowDrift, phi * 1.5, time * 0.002));
  float streamer2 = snoise(vec3(theta * 4.0 - slowDrift * 0.7, phi * 3.0, time * 0.004 + 5.0));
  float streamer3 = snoise(vec3(theta * 8.0 + slowDrift * 0.3, phi * 5.0, time * 0.006 + 10.0));
  float streamers = streamer1 * 0.5 + streamer2 * 0.3 + streamer3 * 0.2;
  float streamerMask = smoothstep(0.0, 0.3, t);
  streamers *= streamerMask;
  streamers = streamers * 0.5 + 0.5;
  streamers = pow(streamers, 1.5);

  // Helmet streamers
  float equatorial = 1.0 - abs(dirNorm.y);
  equatorial = pow(equatorial, 2.0);
  float helmetStreamer = equatorial * 0.3 * smoothstep(0.1, 0.5, t);

  // Fine structure
  vec3 fineP = dirNorm * 6.0 + vec3(time * 0.01);
  float fineNoise = fbm(fineP, 4) * 0.15;

  // Compose
  float coronaBrightness = radialFalloff * (0.6 + streamers * 0.5 + helmetStreamer + fineNoise);
  float innerGlow = exp(-8.0 * t) * 0.7;
  coronaBrightness += innerGlow;

  // Color
  vec3 coreColor = vec3(1.0, 1.0, 0.95);
  vec3 midColor  = vec3(1.0, 0.88, 0.65);
  vec3 outerColor = vec3(0.95, 0.85, 0.70);
  vec3 color = mix(coreColor, midColor, smoothstep(0.0, 0.4, t));
  color = mix(color, outerColor, smoothstep(0.3, 0.9, t));
  color = mix(color, vec3(1.0, 0.92, 0.78), streamers * 0.2);
  color *= 1.0 + innerGlow * 2.0;

  // Alpha
  float alpha = coronaBrightness;
  alpha *= smoothstep(1.0, 0.95, t);
  alpha = clamp(alpha, 0.0, 1.0);

  gl_FragColor = vec4(color * coronaBrightness, alpha);
}
`;

// Chromosphere fragment shader: semi-transparent animated reddish layer
const chromosphereFrag = /* glsl */ `
precision highp float;

uniform float time;

varying vec3 vNormal;
varying vec3 vWorldPosition;
varying float vViewDot;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
  + i.y + vec4(0.0, i1.y, i2.y, 1.0))
  + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

void main() {
  float mu = clamp(vViewDot, 0.0, 1.0);

  // Only visible at the limb (edge) of the sun
  float limbFactor = 1.0 - mu;
  float rimMask = pow(limbFactor, 3.0);

  // Animated noise for spicule-like features
  vec3 noiseP = normalize(vWorldPosition) * 8.0 + vec3(time * 0.02, time * 0.015, -time * 0.01);
  float n = snoise(noiseP) * 0.5 + 0.5;
  float spicules = smoothstep(0.3, 0.8, n);

  // Chromosphere is pinkish-red (H-alpha emission)
  vec3 chromoColor = vec3(1.0, 0.2, 0.15);
  // Mix with brighter pink in active regions
  vec3 activeColor = vec3(1.0, 0.35, 0.4);
  vec3 color = mix(chromoColor, activeColor, spicules * 0.5);

  // HDR boost for bloom
  color *= 2.0;

  float alpha = rimMask * (0.15 + spicules * 0.1);
  alpha = clamp(alpha, 0.0, 0.35);

  gl_FragColor = vec4(color, alpha);
}
`;

const chromosphereVert = /* glsl */ `
uniform float time;

varying vec3 vNormal;
varying vec3 vWorldPosition;
varying float vViewDot;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;

  vec3 viewDir = normalize(cameraPosition - worldPos.xyz);
  vec3 worldNormal = normalize(mat3(modelMatrix) * normal);
  vViewDot = dot(viewDir, worldNormal);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// HYBRID SCALE: the Sun is rendered at TRUE relative size — 109.3 Earth radii
// (1 render unit = 1 Earth radius). Approaching it should feel colossal.
const SUN_RADIUS = BODY_RADII.sun;

// Flare constants — the Sun should *always* be erupting: frequent, overlapping
// bursts of plasma popping off the limb rather than a rare event.
const MAX_FLARE_PARTICLES = 700;
const FLARE_SPAWN_MIN_INTERVAL = 0.5; // seconds
const FLARE_SPAWN_MAX_INTERVAL = 1.8; // seconds
const FLARE_DURATION_MIN = 2.5; // seconds
const FLARE_DURATION_MAX = 6; // seconds

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SunProps {
  position?: [number, number, number];
  scale?: number | [number, number, number];
}

interface FlareParticle {
  startTime: number;
  duration: number;
  // Control points for cubic Bezier curve
  p0: THREE.Vector3; // surface point
  p1: THREE.Vector3; // control point 1
  p2: THREE.Vector3; // control point 2
  p3: THREE.Vector3; // end point
  active: boolean;
}

// ---------------------------------------------------------------------------
// SolarFlares sub-component
// ---------------------------------------------------------------------------

function SolarFlares({ sunRadius: radius }: { sunRadius: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const particlesRef = useRef<(FlareParticle | null)[]>([]);
  const nextSpawnRef = useRef(0);
  const clockRef = useRef(0);

  const { geometry, colorAttr, sizeAttr } = useMemo(() => {
    const positions = new Float32Array(MAX_FLARE_PARTICLES * 3);
    const colors = new Float32Array(MAX_FLARE_PARTICLES * 3);
    const sizes = new Float32Array(MAX_FLARE_PARTICLES);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    return {
      geometry: geo,
      colorAttr: geo.getAttribute('color') as THREE.BufferAttribute,
      sizeAttr: geo.getAttribute('size') as THREE.BufferAttribute,
    };
  }, []);

  const spawnFlare = useCallback(
    (currentTime: number) => {
      const particleCount = 22 + Math.floor(Math.random() * 22);
      const particles = particlesRef.current;

      // Random point on the sun surface
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const surfacePoint = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.sin(phi) * Math.sin(theta),
        Math.cos(phi)
      ).multiplyScalar(radius);

      const surfaceNormal = surfacePoint.clone().normalize();

      // Orthonormal basis around the outward normal for a spray cone.
      const tangent = new THREE.Vector3().crossVectors(
        surfaceNormal,
        new THREE.Vector3(0, 1, 0),
      );
      if (tangent.lengthSq() < 1e-3) {
        tangent.crossVectors(surfaceNormal, new THREE.Vector3(1, 0, 0));
      }
      tangent.normalize();
      const binormal = new THREE.Vector3()
        .crossVectors(surfaceNormal, tangent)
        .normalize();

      for (let i = 0; i < particleCount; i++) {
        // Find an inactive slot
        let slot = -1;
        for (let j = 0; j < MAX_FLARE_PARTICLES; j++) {
          if (!particles[j] || !particles[j]!.active) {
            slot = j;
            break;
          }
        }
        if (slot === -1) break;

        const duration =
          FLARE_DURATION_MIN + Math.random() * (FLARE_DURATION_MAX - FLARE_DURATION_MIN);

        // Each particle is its OWN little ballistic streak in a spray cone around
        // the outward normal — a crisp burst of sparks, not a soft gas cloud.
        const az = Math.random() * Math.PI * 2;
        const cone = Math.random() * 0.5; // up to ~29° off vertical
        const dir = surfaceNormal
          .clone()
          .addScaledVector(tangent, Math.cos(az) * cone)
          .addScaledVector(binormal, Math.sin(az) * cone)
          .normalize();
        const reach = radius * (0.06 + Math.random() * 0.45);
        // Slight sideways lean so streaks arc rather than fire dead-straight.
        const side = tangent.clone().multiplyScalar((Math.random() - 0.5) * reach * 0.35);

        const p0 = surfacePoint.clone();
        const p1 = surfacePoint.clone().addScaledVector(dir, reach * 0.45).addScaledVector(side, 0.3);
        const p2 = surfacePoint.clone().addScaledVector(dir, reach * 0.8).addScaledVector(side, 0.7);
        const p3 = surfacePoint.clone().addScaledVector(dir, reach).add(side);

        particles[slot] = {
          startTime: currentTime + i * 0.015, // tight stagger → a popping burst
          duration,
          p0,
          p1,
          p2,
          p3,
          active: true,
        };
      }
    },
    [radius]
  );

  useFrame((_, delta) => {
    clockRef.current += delta;
    const currentTime = clockRef.current;
    const particles = particlesRef.current;
    const positionAttr = geometry.getAttribute('position') as THREE.BufferAttribute;

    // Spawn new flares on schedule
    if (currentTime >= nextSpawnRef.current) {
      spawnFlare(currentTime);
      nextSpawnRef.current =
        currentTime +
        FLARE_SPAWN_MIN_INTERVAL +
        Math.random() * (FLARE_SPAWN_MAX_INTERVAL - FLARE_SPAWN_MIN_INTERVAL);
    }

    // Update particles
    for (let i = 0; i < MAX_FLARE_PARTICLES; i++) {
      const p = particles[i];
      if (!p || !p.active) {
        positionAttr.setXYZ(i, 0, 0, 0);
        sizeAttr.setX(i, 0);
        colorAttr.setXYZ(i, 0, 0, 0);
        continue;
      }

      const age = currentTime - p.startTime;
      if (age < 0) {
        // Not yet born
        positionAttr.setXYZ(i, 0, 0, 0);
        sizeAttr.setX(i, 0);
        continue;
      }

      const lifeT = age / p.duration;
      if (lifeT > 1.0) {
        p.active = false;
        positionAttr.setXYZ(i, 0, 0, 0);
        sizeAttr.setX(i, 0);
        colorAttr.setXYZ(i, 0, 0, 0);
        continue;
      }

      // Cubic Bezier interpolation
      const t = lifeT;
      const omt = 1 - t;
      const omt2 = omt * omt;
      const omt3 = omt2 * omt;
      const t2 = t * t;
      const t3 = t2 * t;

      const x = omt3 * p.p0.x + 3 * omt2 * t * p.p1.x + 3 * omt * t2 * p.p2.x + t3 * p.p3.x;
      const y = omt3 * p.p0.y + 3 * omt2 * t * p.p1.y + 3 * omt * t2 * p.p2.y + t3 * p.p3.y;
      const z = omt3 * p.p0.z + 3 * omt2 * t * p.p1.z + 3 * omt * t2 * p.p2.z + t3 * p.p3.z;

      positionAttr.setXYZ(i, x, y, z);

      // Size: grow then shrink (world units — read by the flare shader). Small
      // so each reads as a discrete spark rather than a soft gas blob.
      const glow = Math.sin(lifeT * Math.PI);
      sizeAttr.setX(i, glow * radius * 0.03);

      // Fiery plasma: deep orange, brightest mid-arc, fading in and out — the
      // additive blend + Bloom give the hot white-orange core of real Hα loops.
      colorAttr.setXYZ(i, glow, (0.42 + 0.32 * glow) * glow, (0.1 + 0.14 * glow) * glow);
    }

    positionAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
  });

  // Size-aware additive shader: each particle's world-space `size` attribute
  // drives its on-screen size (perspective-attenuated), so eruptions visibly
  // swell and fade as soft glowing blobs.
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uHeight: { value: 800 } },
        vertexShader: /* glsl */ `
          attribute float size;
          attribute vec3 color;
          uniform float uHeight;
          varying vec3 vColor;
          void main() {
            vColor = color;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = clamp(size * uHeight / max(-mv.z, 0.001), 1.0, 700.0);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          precision highp float;
          varying vec3 vColor;
          void main() {
            vec2 c = gl_PointCoord - vec2(0.5);
            float d = length(c);
            if (d > 0.5) discard;
            // Bright tight core with a quick falloff → a crisp spark.
            float a = pow(smoothstep(0.5, 0.0, d), 2.6);
            gl_FragColor = vec4(vColor, a);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    []
  );

  useFrame(({ gl }) => {
    material.uniforms.uHeight.value = gl.domElement.height * 0.6;
  });

  // Initialize the particle array
  useMemo(() => {
    particlesRef.current = new Array(MAX_FLARE_PARTICLES).fill(null);
    // Trigger first flare quickly for visual feedback
    nextSpawnRef.current = 2 + Math.random() * 5;
  }, []);

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}

// ---------------------------------------------------------------------------
// SolarProminences — great arcing loops of plasma off the limb (the "flames")
// ---------------------------------------------------------------------------

const PROMINENCE_COUNT = 18;

interface ProminenceState {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  height: number;
  bornAt: number;
  riseDur: number;
  holdDur: number;
  fadeDur: number;
  deadUntil: number;
  alive: boolean;
}

function randUnitVec(): THREE.Vector3 {
  // Uniformly distributed point on the unit sphere
  const u = Math.random() * 2 - 1;
  const theta = Math.random() * Math.PI * 2;
  const r = Math.sqrt(1 - u * u);
  return new THREE.Vector3(r * Math.cos(theta), u, r * Math.sin(theta));
}

function buildProminenceGeometry(radius: number): { geo: THREE.BufferGeometry; height: number } {
  const base = randUnitVec();
  // A tangent direction along the surface for the loop to span
  let tangent = new THREE.Vector3().crossVectors(base, randUnitVec());
  if (tangent.lengthSq() < 1e-4) tangent = new THREE.Vector3().crossVectors(base, new THREE.Vector3(0, 1, 0));
  tangent.normalize();

  const sep = 0.10 + Math.random() * 0.20; // angular footpoint separation (radians)
  const footA = base.clone().applyAxisAngle(tangent, -sep).multiplyScalar(radius);
  const footB = base.clone().applyAxisAngle(tangent, sep).multiplyScalar(radius);

  // Apex rises many Earth radii above the limb — big, dramatic arcing loops.
  const height = radius * (0.12 + Math.random() * 0.4);
  const skew = (Math.random() - 0.5) * radius * 0.12;
  const apex = base
    .clone()
    .multiplyScalar(radius + height)
    .add(tangent.clone().multiplyScalar(skew));

  const curve = new THREE.QuadraticBezierCurve3(footA, apex, footB);
  const tubeR = radius * (0.008 + Math.random() * 0.014);
  const geo = new THREE.TubeGeometry(curve, 64, tubeR, 10, false);

  // Vertex colours: white-hot/orange at the feet -> deep red toward the apex
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    const dist = Math.sqrt(px * px + py * py + pz * pz);
    const t = THREE.MathUtils.clamp((dist - radius) / Math.max(height, 1e-3), 0, 1);
    // White-hot at the footpoints, glowing orange along the arch (matches SDO
    // Hα prominences — bright, not a dark red at the apex).
    colors[i * 3] = 1.0;
    colors[i * 3 + 1] = 0.55 * (1 - t) + 0.4;
    colors[i * 3 + 2] = 0.28 * (1 - t) + 0.08;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return { geo, height };
}

function SolarProminences({ sunRadius: radius }: { sunRadius: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const clockRef = useRef(0);
  const stateRef = useRef<ProminenceState[]>([]);

  const meshes = useMemo(() => {
    const arr: THREE.Mesh[] = [];
    const states: ProminenceState[] = [];
    for (let i = 0; i < PROMINENCE_COUNT; i++) {
      const { geo, height } = buildProminenceGeometry(radius);
      const material = new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      const mesh = new THREE.Mesh(geo, material);
      mesh.frustumCulled = false;
      arr.push(mesh);
      states.push({
        mesh,
        material,
        height,
        bornAt: Math.random() * 6, // stagger initial appearances
        riseDur: 1.2 + Math.random() * 1.5,
        holdDur: 3 + Math.random() * 6,
        fadeDur: 1.2 + Math.random() * 1.8,
        deadUntil: 0,
        alive: true,
      });
    }
    stateRef.current = states;
    return arr;
  }, [radius]);

  useFrame((_, delta) => {
    clockRef.current += delta;
    const now = clockRef.current;
    for (const p of stateRef.current) {
      if (!p.alive) {
        if (now >= p.deadUntil) {
          // Respawn at a fresh location
          const { geo, height } = buildProminenceGeometry(radius);
          p.mesh.geometry.dispose();
          p.mesh.geometry = geo;
          p.height = height;
          p.bornAt = now;
          p.riseDur = 1.2 + Math.random() * 1.5;
          p.holdDur = 3 + Math.random() * 6;
          p.fadeDur = 1.2 + Math.random() * 1.8;
          p.alive = true;
        } else {
          p.material.opacity = 0;
          continue;
        }
      }

      const age = now - p.bornAt;
      const total = p.riseDur + p.holdDur + p.fadeDur;
      let envelope: number;
      if (age < p.riseDur) {
        envelope = age / p.riseDur;
      } else if (age < p.riseDur + p.holdDur) {
        envelope = 1;
      } else if (age < total) {
        envelope = 1 - (age - p.riseDur - p.holdDur) / p.fadeDur;
      } else {
        p.alive = false;
        p.deadUntil = now + 0.5 + Math.random() * 2.5;
        p.material.opacity = 0;
        continue;
      }

      // Flicker like turbulent plasma
      const flicker = 0.8 + 0.2 * Math.sin(now * 9 + p.bornAt * 5) * Math.cos(now * 3.3 + p.bornAt);
      p.material.opacity = Math.max(envelope, 0) * (0.7 + 0.3 * flicker);
    }
  });

  return (
    <group ref={groupRef}>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Sun component
// ---------------------------------------------------------------------------

export default function Sun({ position = [0, 0, 0], scale }: SunProps) {
  const surfaceMatRef = useRef<THREE.ShaderMaterial>(null);
  const chromoMatRef = useRef<THREE.ShaderMaterial>(null);
  const coronaMatRef = useRef<THREE.ShaderMaterial>(null);
  const groupRef = useRef<THREE.Group>(null);

  // Surface shader material
  const surfaceMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: sunSurfaceVert,
        fragmentShader: sunSurfaceFrag,
        uniforms: {
          time: { value: 0 },
        },
      }),
    []
  );

  // Chromosphere shader material
  const chromosphereMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: chromosphereVert,
        fragmentShader: chromosphereFrag,
        uniforms: {
          time: { value: 0 },
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.FrontSide,
      }),
    []
  );

  // Corona shader material
  const coronaMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: sunCoronaVert,
        fragmentShader: sunCoronaFrag,
        uniforms: {
          time: { value: 0 },
          sunCenter: { value: new THREE.Vector3(...position) },
          sunRadius: { value: SUN_RADIUS },
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.BackSide,
      }),
    [position]
  );

  // Assign refs after mount
  useEffect(() => {
    surfaceMatRef.current = surfaceMaterial;
    chromoMatRef.current = chromosphereMaterial;
    coronaMatRef.current = coronaMaterial;
  }, [surfaceMaterial, chromosphereMaterial, coronaMaterial]);

  // Register with the proximity system for the distance HUD
  useEffect(() => {
    const store = useProximityStore.getState();
    store.registerBody({
      id: 'sun',
      name: 'Sun',
      position: [position[0], position[1], position[2]],
      radius: SUN_RADIUS,
      kind: 'star',
    });
    return () => store.unregisterBody('sun');
  }, [position]);

  // Update time uniforms every frame
  useFrame((state) => {
    const elapsed = state.clock.getElapsedTime();

    if (surfaceMatRef.current) {
      surfaceMatRef.current.uniforms.time.value = elapsed;
    }
    if (chromoMatRef.current) {
      chromoMatRef.current.uniforms.time.value = elapsed;
    }
    if (coronaMatRef.current) {
      coronaMatRef.current.uniforms.time.value = elapsed;
      // Update sun center in case position changes
      coronaMatRef.current.uniforms.sunCenter.value.set(...position);
    }
  });

  return (
    <group ref={groupRef} position={position} scale={scale}>
      {/* Core photosphere surface */}
      <mesh>
        <sphereGeometry args={[SUN_RADIUS, 128, 128]} />
        <primitive object={surfaceMaterial} attach="material" />
      </mesh>

      {/* Chromosphere — thin reddish layer, visible at limb */}
      <mesh>
        <sphereGeometry args={[SUN_RADIUS * 1.005, 64, 64]} />
        <primitive object={chromosphereMaterial} attach="material" />
      </mesh>

      {/* Corona — large transparent envelope with streamers */}
      <mesh>
        <sphereGeometry args={[SUN_RADIUS * 3, 64, 64]} />
        <primitive object={coronaMaterial} attach="material" />
      </mesh>

      {/* Solar flares — particle system */}
      <SolarFlares sunRadius={SUN_RADIUS} />

      {/* Solar prominences — arcing plasma loops off the limb */}
      <SolarProminences sunRadius={SUN_RADIUS} />

      {/* The Sun is the primary light source of the solar system.
          decay=0 (no inverse-square falloff) so distant planets stay lit at
          compressed hybrid distances; the day/night terminator on each body is
          driven by its own sunDirection shader, not this light's shadows. */}
      <pointLight
        intensity={2.0}
        distance={0}
        decay={0}
        color="#FFF5E6"
      />
    </group>
  );
}
