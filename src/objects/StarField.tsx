import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import starFieldVert from '../shaders/starField.vert?raw';
import starFieldFrag from '../shaders/starField.frag?raw';

// ---------------------------------------------------------------------------
// Types & Props
// ---------------------------------------------------------------------------

interface StarFieldProps {
  /** Number of background stars (Layer 1). Default 120,000. */
  backgroundCount?: number;
  /** Number of bright stars (Layer 2). Default 2,000. */
  brightCount?: number;
  /** Radius of the star sphere. Default 10,000. */
  radius?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Standard deviation for galactic latitude concentration (radians). */
const GALACTIC_SIGMA = (20 * Math.PI) / 180; // 20 degrees

/** Spectral type distribution (cumulative) — maps to colors.
 *  Real distribution: M ~76%, K ~12%, G ~8%, F ~3%, A+B+O ~1%
 *  We skew a bit brighter for visual appeal while staying realistic. */
const SPECTRAL_CUMULATIVE = [
  { cdf: 0.60, color: new THREE.Color(1.0, 0.7, 0.5) },    // M — red/orange
  { cdf: 0.76, color: new THREE.Color(1.0, 0.82, 0.62) },   // K — orange
  { cdf: 0.86, color: new THREE.Color(1.0, 0.96, 0.84) },   // G — yellow-white
  { cdf: 0.93, color: new THREE.Color(0.97, 0.97, 1.0) },   // F — white
  { cdf: 0.97, color: new THREE.Color(0.85, 0.9, 1.0) },    // A — blue-white
  { cdf: 0.99, color: new THREE.Color(0.7, 0.8, 1.0) },     // B — blue
  { cdf: 1.00, color: new THREE.Color(0.6, 0.7, 1.0) },     // O — deep blue
];

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

/**
 * Box-Muller transform: generate a normally distributed random number
 * with mean 0 and standard deviation `sigma`.
 */
function gaussianRandom(sigma: number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return sigma * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Pick a star color based on spectral type distribution.
 * Returns a slightly randomized variation of the spectral color.
 */
function randomStarColor(target: THREE.Color): THREE.Color {
  const r = Math.random();
  let base = SPECTRAL_CUMULATIVE[SPECTRAL_CUMULATIVE.length - 1].color;
  for (const entry of SPECTRAL_CUMULATIVE) {
    if (r <= entry.cdf) {
      base = entry.color;
      break;
    }
  }
  // Add slight random variation (up to +/-5%)
  const vary = () => 1.0 + (Math.random() - 0.5) * 0.1;
  target.setRGB(
    THREE.MathUtils.clamp(base.r * vary(), 0, 1),
    THREE.MathUtils.clamp(base.g * vary(), 0, 1),
    THREE.MathUtils.clamp(base.b * vary(), 0, 1),
  );
  return target;
}

/**
 * Generate a random position on a sphere with galactic plane concentration.
 *
 * The galactic plane lies along the XZ plane (Y=0).
 * Stars are concentrated near the plane following a Gaussian in latitude.
 */
function randomStarPosition(radius: number, target: THREE.Vector3): void {
  // Galactic latitude: Gaussian centered on 0 (the plane)
  const lat = gaussianRandom(GALACTIC_SIGMA);
  // Galactic longitude: uniform
  const lon = Math.random() * Math.PI * 2;

  const cosLat = Math.cos(lat);
  target.set(
    radius * cosLat * Math.cos(lon),
    radius * Math.sin(lat),
    radius * cosLat * Math.sin(lon),
  );

  // Add a small random radial offset so stars aren't all at exactly the same distance
  const radialJitter = 1.0 + (Math.random() - 0.5) * 0.1;
  target.multiplyScalar(radialJitter);
}

// ---------------------------------------------------------------------------
// Layer 1 — Background Stars (Points)
// ---------------------------------------------------------------------------

function BackgroundStars({
  count,
  radius,
}: {
  count: number;
  radius: number;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { gl } = useThree();

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();

    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const colors = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const frequencies = new Float32Array(count);

    const tmpPos = new THREE.Vector3();
    const tmpColor = new THREE.Color();

    for (let i = 0; i < count; i++) {
      randomStarPosition(radius, tmpPos);
      positions[i * 3] = tmpPos.x;
      positions[i * 3 + 1] = tmpPos.y;
      positions[i * 3 + 2] = tmpPos.z;

      // Size: power-law distribution — most stars tiny, few large.
      // Using inverse power law: size ~ 1 / (random^0.7)
      // But clamped for sanity.
      const rawSize = Math.pow(Math.random(), 3.0); // 0..1 heavily weighted toward 0
      sizes[i] = 0.8 + rawSize * 4.0; // 0.8 .. 4.8

      randomStarColor(tmpColor);
      colors[i * 3] = tmpColor.r;
      colors[i * 3 + 1] = tmpColor.g;
      colors[i * 3 + 2] = tmpColor.b;

      phases[i] = Math.random() * Math.PI * 2;
      frequencies[i] = 0.5 + Math.random() * 3.0; // 0.5 to 3.5 Hz
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aFrequency', new THREE.BufferAttribute(frequencies, 1));

    // Bounding sphere for frustum culling
    geo.computeBoundingSphere();

    return geo;
  }, [count, radius]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: gl.getPixelRatio() },
      uSizeScale: { value: 1.0 },
    }),
    [gl],
  );

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <primitive object={geometry} attach="geometry" />
      <shaderMaterial
        ref={materialRef}
        vertexShader={starFieldVert}
        fragmentShader={starFieldFrag}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// ---------------------------------------------------------------------------
// Bright star shaders (inline — these are small and tightly coupled)
// ---------------------------------------------------------------------------

const BRIGHT_STAR_VERT = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
attribute float aPhase;
attribute float aFrequency;

uniform float uTime;
uniform float uPixelRatio;

varying vec3 vColor;
varying float vAlpha;

void main() {
  vColor = aColor;

  // Twinkle — more pronounced for bright stars
  float twinkle = 0.7 + 0.3 * sin(uTime * aFrequency + aPhase);
  // Secondary beat for scintillation
  twinkle *= 0.9 + 0.1 * sin(uTime * aFrequency * 1.73 + aPhase * 2.71);
  vAlpha = twinkle;

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

  // No distance attenuation for bright stars — they should always be visible
  gl_PointSize = aSize * uPixelRatio;
  gl_Position = projectionMatrix * mvPosition;
}
`;

const BRIGHT_STAR_FRAG = /* glsl */ `
precision highp float;

varying vec3 vColor;
varying float vAlpha;

void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  float distSq = dot(coord, coord);
  if (distSq > 0.25) discard;

  float dist = sqrt(distSq) * 2.0;

  // Intense bright core
  float core = exp(-dist * dist * 18.0);
  // Soft wide glow
  float glow = exp(-dist * dist * 3.0) * 0.35;

  // Subtle 4-point diffraction spikes
  float angle = atan(coord.y, coord.x);
  float spike = pow(abs(cos(angle * 2.0)), 32.0) * exp(-dist * 4.0) * 0.2;

  float brightness = core + glow + spike;

  vec3 color = vColor * brightness;
  // White-out the core center regardless of star color
  color = mix(color, vec3(brightness), core * 0.7);

  float alpha = brightness * vAlpha;
  gl_FragColor = vec4(color, alpha);
}
`;

// ---------------------------------------------------------------------------
// Layer 2 — Bright Stars (Points with larger sizes and glow shader)
// ---------------------------------------------------------------------------

function BrightStars({
  count,
  radius,
}: {
  count: number;
  radius: number;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { gl } = useThree();

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();

    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const colors = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const frequencies = new Float32Array(count);

    const tmpPos = new THREE.Vector3();
    const tmpColor = new THREE.Color();

    for (let i = 0; i < count; i++) {
      // Position: slightly wider galactic spread than background
      const lat = gaussianRandom(GALACTIC_SIGMA * 1.5);
      const lon = Math.random() * Math.PI * 2;
      const cosLat = Math.cos(lat);
      const r = radius * (0.95 + Math.random() * 0.1);
      tmpPos.set(
        r * cosLat * Math.cos(lon),
        r * Math.sin(lat),
        r * cosLat * Math.sin(lon),
      );

      positions[i * 3] = tmpPos.x;
      positions[i * 3 + 1] = tmpPos.y;
      positions[i * 3 + 2] = tmpPos.z;

      // Bright stars are larger (6..24 px range)
      sizes[i] = 6.0 + Math.pow(Math.random(), 2.0) * 18.0;

      // Color biased toward hotter spectral types (skip most M stars)
      const rand = Math.random() * 0.5 + 0.5;
      let base = SPECTRAL_CUMULATIVE[SPECTRAL_CUMULATIVE.length - 1].color;
      for (const entry of SPECTRAL_CUMULATIVE) {
        if (rand <= entry.cdf) {
          base = entry.color;
          break;
        }
      }
      const vary = () => 1.0 + (Math.random() - 0.5) * 0.1;
      tmpColor.setRGB(
        THREE.MathUtils.clamp(base.r * vary(), 0, 1),
        THREE.MathUtils.clamp(base.g * vary(), 0, 1),
        THREE.MathUtils.clamp(base.b * vary(), 0, 1),
      );
      colors[i * 3] = tmpColor.r;
      colors[i * 3 + 1] = tmpColor.g;
      colors[i * 3 + 2] = tmpColor.b;

      phases[i] = Math.random() * Math.PI * 2;
      frequencies[i] = 0.3 + Math.random() * 2.5;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aFrequency', new THREE.BufferAttribute(frequencies, 1));

    geo.computeBoundingSphere();
    return geo;
  }, [count, radius]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: gl.getPixelRatio() },
    }),
    [gl],
  );

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <primitive object={geometry} attach="geometry" />
      <shaderMaterial
        ref={materialRef}
        vertexShader={BRIGHT_STAR_VERT}
        fragmentShader={BRIGHT_STAR_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// ---------------------------------------------------------------------------
// Layer 3 — Milky Way Band (procedural texture on a cylinder)
// ---------------------------------------------------------------------------

/**
 * Generate a Milky Way band texture using procedural noise on a Canvas.
 * Returns a canvas-based texture with a warm diffuse glow concentrated
 * in a band, with dust lane features.
 */
function generateMilkyWayTexture(
  width: number,
  height: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Fill with transparent black
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Seed a simple hash-based pseudo-random for deterministic noise
  function hash(x: number, y: number): number {
    let h = x * 374761393 + y * 668265263;
    h = ((h ^ (h >> 13)) * 1274126177) | 0;
    return ((h ^ (h >> 16)) >>> 0) / 4294967296;
  }

  // Simple value noise
  function valueNoise(x: number, y: number): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    // Smoothstep
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);

    const n00 = hash(ix, iy);
    const n10 = hash(ix + 1, iy);
    const n01 = hash(ix, iy + 1);
    const n11 = hash(ix + 1, iy + 1);

    const nx0 = n00 + (n10 - n00) * sx;
    const nx1 = n01 + (n11 - n01) * sx;
    return nx0 + (nx1 - nx0) * sy;
  }

  // FBM (fractal Brownian motion)
  function fbm(x: number, y: number, octaves: number): number {
    let value = 0;
    let amplitude = 0.5;
    let frequency = 1;
    for (let i = 0; i < octaves; i++) {
      value += amplitude * valueNoise(x * frequency, y * frequency);
      amplitude *= 0.5;
      frequency *= 2.1;
    }
    return value;
  }

  for (let py = 0; py < height; py++) {
    // Normalized Y: 0 at center, 1 at edges
    const ny = (py / height - 0.5) * 2.0; // -1..1
    const absY = Math.abs(ny);

    // Gaussian band profile — concentrated at center
    const bandProfile = Math.exp(-(absY * absY) / (2 * 0.08 * 0.08));

    for (let px = 0; px < width; px++) {
      const nx = px / width; // 0..1

      // Large-scale noise for cloud structure
      const cloud1 = fbm(nx * 6, ny * 3 + 100, 6);
      const cloud2 = fbm(nx * 12 + 50, ny * 6 + 200, 5);

      // Dust lanes: darker streaks within the band
      const dust = fbm(nx * 8 + 300, ny * 4 + 400, 4);
      const dustLane = Math.max(0, dust - 0.45) * 2.5;

      // Combined brightness
      let brightness = bandProfile * (0.4 + cloud1 * 0.6);
      brightness += bandProfile * cloud2 * 0.15;

      // Subtract dust lanes
      brightness *= 1.0 - dustLane * 0.6 * bandProfile;

      // Fine-grain star-like noise (the unresolved stars of the Milky Way)
      const fineNoise = fbm(nx * 40 + 500, ny * 20 + 600, 3);
      brightness += fineNoise * 0.08 * bandProfile;

      brightness = Math.max(0, Math.min(1, brightness));

      // Color: warm white with hints of brown in dust regions
      const dustTint = dustLane * bandProfile;
      const r = brightness * (0.95 - dustTint * 0.15);
      const g = brightness * (0.92 - dustTint * 0.2);
      const b = brightness * (0.88 + (1 - dustTint) * 0.05);

      const idx = (py * width + px) * 4;
      data[idx] = Math.min(255, r * 255);
      data[idx + 1] = Math.min(255, g * 255);
      data[idx + 2] = Math.min(255, b * 255);
      data[idx + 3] = Math.min(255, brightness * 80); // subtle alpha
    }
  }

  ctx.putImageData(imageData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  return texture;
}

function MilkyWayBand({ radius }: { radius: number }) {
  const texture = useMemo(() => generateMilkyWayTexture(2048, 512), []);

  // The Milky Way is a large cylinder around the scene,
  // oriented along the galactic plane (XZ plane).
  const cylinderRadius = radius * 0.98;
  const cylinderHeight = radius * 0.6;

  return (
    <mesh frustumCulled={false}>
      <cylinderGeometry
        args={[cylinderRadius, cylinderRadius, cylinderHeight, 64, 1, true]}
      />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={0.6}
        depthWrite={false}
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// StarField — main export
// ---------------------------------------------------------------------------

/**
 * Complete star field with three layers:
 *
 * 1. **Background stars** — 100K+ tiny point sprites with realistic
 *    spectral color distribution, concentrated along the galactic plane.
 *
 * 2. **Bright stars** — 2K camera-facing billboard quads with glow,
 *    visible color, and pronounced twinkle.
 *
 * 3. **Milky Way band** — procedural noise texture on a cylinder,
 *    creating the diffuse glow of unresolved stars and dust lanes.
 *
 * All layers are positioned at extreme distance (radius 10,000) so they
 * don't exhibit parallax at solar-system scales.
 */
export default function StarField({
  backgroundCount = 120_000,
  brightCount = 2_000,
  radius = 10_000,
}: StarFieldProps) {
  return (
    <group>
      <BackgroundStars count={backgroundCount} radius={radius} />
      <BrightStars count={brightCount} radius={radius} />
      <MilkyWayBand radius={radius} />
    </group>
  );
}
