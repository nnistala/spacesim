import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useUIStore } from '../stores/uiStore';
import { BODY_RADII, MOON_DISTANCE_UNITS } from '../data/scaleConfig';
import { getTimeScale } from '../stores/timeStore';
import { useProximityStore, proximityBodies } from '../stores/proximityStore';
import { useTexture } from '@react-three/drei';
import { assetPath } from '../utils/assetPath';

// ---------------------------------------------------------------------------
// Scale constants (relative to Earth radius = 1 unit)
// ---------------------------------------------------------------------------
// HYBRID SCALE: true relative size (1,737.4 / 6,371 = 0.2727 Earth radii)
const MOON_RADIUS = BODY_RADII.moon;

// Earth-Moon distance kept near-real (60.3 Earth radii) for an authentic
// local system. The full 384,400 km reads out correctly on the HUD.
const MOON_DISTANCE = MOON_DISTANCE_UNITS;

// Orbital period: 27.322 days = 655.7 hours
const ORBITAL_PERIOD_HOURS = 655.7;

// Orbital inclination to the ecliptic: 5.145 degrees
const ORBITAL_INCLINATION = 5.145;

// ---------------------------------------------------------------------------
// Inline Moon surface shader (sharp terminator + earthshine)
// ---------------------------------------------------------------------------

const moonSurfaceVert = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;

void main() {
  vUv = uv;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const moonSurfaceFrag = /* glsl */ `
precision highp float;

uniform sampler2D moonMap;
uniform vec3 sunDirection;
uniform vec3 earthPosition;

varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;

void main() {
  vec3 normal = normalize(vWorldNormal);
  vec3 sunDir = normalize(sunDirection);

  // Surface color from texture
  vec3 surfaceColor = texture2D(moonMap, vUv).rgb;

  // --- Direct solar illumination ---
  float NdotL = dot(normal, sunDir);

  // Moon has no atmosphere: sharper terminator than Earth
  // but still slightly soft due to surface roughness
  float sunLight = smoothstep(-0.02, 0.04, NdotL);
  float diffuse = max(NdotL, 0.0);

  // Lit side
  vec3 litColor = surfaceColor * diffuse;

  // --- Earthshine ---
  // Faint blue-ish light reflected from Earth onto Moon's dark side
  vec3 toEarth = normalize(earthPosition - vWorldPosition);
  float earthFacing = max(dot(normal, toEarth), 0.0);
  vec3 earthshineColor = vec3(0.15, 0.2, 0.35);
  vec3 earthshine = earthshineColor * earthFacing * 0.03;

  // --- Combine ---
  vec3 finalColor = litColor * sunLight + earthshine * (1.0 - sunLight);

  // Tiny ambient so it's not pure black (starlight exists)
  finalColor += surfaceColor * 0.003;

  gl_FragColor = vec4(finalColor, 1.0);
}
`;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface MoonProps {
  /** Direction toward the Sun (world space, normalised) */
  sunDirection?: [number, number, number];
  /** Override orbital distance */
  distance?: number;
}

// ---------------------------------------------------------------------------
// Moon Component
// ---------------------------------------------------------------------------
function Moon({
  sunDirection = [-1, 0, 0],
  distance = MOON_DISTANCE,
}: MoonProps) {
  const moonGroupRef = useRef<THREE.Group>(null);
  const moonMeshRef = useRef<THREE.Mesh>(null);
  const orbitAngleRef = useRef(0);
  const setInfoPanelBody = useUIStore((s) => s.setInfoPanelBody);

  // Reusable vectors to avoid allocations in the render loop
  const earthWorldPosVec = useMemo(() => new THREE.Vector3(), []);
  const moonWorldPosVec = useMemo(() => new THREE.Vector3(), []);

  // Register with the proximity system (position updated each frame as it orbits)
  useEffect(() => {
    const store = useProximityStore.getState();
    store.registerBody({
      id: 'moon',
      name: 'Moon',
      position: [0, 0, 0],
      radius: MOON_RADIUS,
      kind: 'moon',
    });
    return () => store.unregisterBody('moon');
  }, []);

  // ---- Real Moon albedo (8K Solar System Scope, vendored locally) ----
  const moonMap = useTexture(assetPath('/textures/moon_8k.jpg'));
  useMemo(() => {
    moonMap.colorSpace = THREE.SRGBColorSpace;
    moonMap.anisotropy = 16;
    moonMap.wrapS = THREE.RepeatWrapping;
    moonMap.wrapT = THREE.ClampToEdgeWrapping;
    moonMap.needsUpdate = true;
  }, [moonMap]);

  // ---- Moon surface material ----
  const moonMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: moonSurfaceVert,
      fragmentShader: moonSurfaceFrag,
      uniforms: {
        moonMap: { value: moonMap },
        sunDirection: { value: new THREE.Vector3(...sunDirection).normalize() },
        earthPosition: { value: new THREE.Vector3(0, 0, 0) },
      },
    });
  }, [moonMap, sunDirection]);

  // ---- Orbital inclination ----
  const inclinationRad = useMemo(
    () => (ORBITAL_INCLINATION * Math.PI) / 180,
    [],
  );

  // ---- Animation: orbit + tidal lock ----
  useFrame((_, delta) => {
    if (!moonGroupRef.current || !moonMeshRef.current) return;

    // Shared, adjustable simulation clock (matches Planet.tsx).
    const scaledDelta = delta * getTimeScale();

    // Orbital angular velocity (radians per second of real time)
    const orbitalAngularVelocity = (2 * Math.PI) / (ORBITAL_PERIOD_HOURS * 3600);
    orbitAngleRef.current += orbitalAngularVelocity * scaledDelta;

    // Position on circular orbit
    const angle = orbitAngleRef.current;
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    // Slight y oscillation from orbital inclination
    const y = Math.sin(angle) * distance * Math.sin(inclinationRad);
    const adjustedZ = z * Math.cos(inclinationRad);

    moonGroupRef.current.position.set(x, y, adjustedZ);

    // Tidal lock: Moon always shows same face toward Earth (parent origin)
    moonMeshRef.current.rotation.y = -angle + Math.PI;

    // Update uniforms
    if (moonMaterial.uniforms) {
      moonMaterial.uniforms.sunDirection.value
        .set(...sunDirection)
        .normalize();

      // Earth position in world space for earthshine calculation
      if (moonGroupRef.current.parent) {
        moonGroupRef.current.parent.getWorldPosition(earthWorldPosVec);
        moonMaterial.uniforms.earthPosition.value.copy(earthWorldPosVec);
      }
    }

    // Update the Moon's world position in the proximity system
    moonGroupRef.current.getWorldPosition(moonWorldPosVec);
    const moonBody = proximityBodies.get('moon');
    if (moonBody) {
      moonBody.position[0] = moonWorldPosVec.x;
      moonBody.position[1] = moonWorldPosVec.y;
      moonBody.position[2] = moonWorldPosVec.z;
    }
  });

  return (
    <group ref={moonGroupRef}>
      <mesh
        ref={moonMeshRef}
        name="Moon"
        onClick={(e) => {
          e.stopPropagation();
          setInfoPanelBody('moon');
        }}
      >
        <sphereGeometry args={[MOON_RADIUS, 64, 32]} />
        <primitive object={moonMaterial} attach="material" />
      </mesh>
    </group>
  );
}

export default Moon;
export { MOON_RADIUS, MOON_DISTANCE };
