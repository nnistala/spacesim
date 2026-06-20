import { useRef, useMemo, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { tryLoadTexture } from '../utils/textureLoader';
import { getTimeScale } from '../stores/timeStore';

// ---------------------------------------------------------------------------
// Inline atmosphere shaders (matches Sun.tsx pattern — avoids ?raw import issues)
// ---------------------------------------------------------------------------

const atmosphereVert = /* glsl */ `
uniform float atmosphereScale;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec3 vViewDir;

void main() {
  // The geometry is already the shell sphere (radius * atmosphereScale); use it
  // as-is. (Previously it was ALSO inflated here, double-scaling the shell into
  // a far-off "bubble" around the planet.)
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;

  // Transform normal to world space
  vWorldNormal = normalize(mat3(modelMatrix) * normal);

  // View direction from camera to fragment (world space)
  vViewDir = normalize(worldPos.xyz - cameraPosition);

  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const atmosphereFrag = /* glsl */ `
precision highp float;

uniform vec3 atmosphereColor;
uniform float atmosphereDensity;
uniform float atmosphereScale;
uniform vec3 sunDirection;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec3 vViewDir;

void main() {
  vec3 normal = normalize(vWorldNormal);
  vec3 toCamera = -normalize(vViewDir);
  vec3 sunDir = normalize(sunDirection);

  // Front-facing shell: facing ~1 at the disc centre, ~0 at the silhouette.
  float facing = clamp(dot(normal, toCamera), 0.0, 1.0);

  // edge = the facing value where the shell grazes the planet's limb (the
  // horizon). The glow is BRIGHTEST there and fades to black going outward to
  // the silhouette (blue to black, not black to blue) and softly onto the disc
  // so it reads as a band hugging the surface, not a detached bubble.
  float edge = sqrt(max(1.0 - 1.0 / (atmosphereScale * atmosphereScale), 1e-4));
  float toSpace = smoothstep(0.0, edge * 0.92, facing); // 0 at silhouette → 1 at horizon
  float ontoDisc = pow(1.0 - facing, 2.0);              // fade across the disc
  float glow = toSpace * ontoDisc * atmosphereDensity;

  // Only the sunlit side scatters.
  float sunlit = dot(normal, sunDir);
  float dayFactor = smoothstep(-0.15, 0.45, sunlit);

  // Warm "sunset" tint where the line of sight points toward the Sun.
  float cosTheta = clamp(dot(toCamera, sunDir), 0.0, 1.0);
  vec3 col = mix(atmosphereColor, atmosphereColor * vec3(1.4, 0.92, 0.65), pow(cosTheta, 4.0) * 0.7);

  float intensity = glow * dayFactor;
  gl_FragColor = vec4(col * intensity, clamp(intensity, 0.0, 0.95));
}
`;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface PlanetProps {
  name: string;
  radius: number;
  position: [number, number, number];

  // Textures (all optional -- falls back to procedural / solid color)
  diffuseMapUrl?: string;
  normalMapUrl?: string;
  specularMapUrl?: string;
  nightMapUrl?: string;
  cloudsMapUrl?: string;

  // Pre-generated procedural textures (preferred over URL loading)
  diffuseTexture?: THREE.Texture;
  normalTexture?: THREE.Texture;
  specularTexture?: THREE.Texture;
  nightTexture?: THREE.Texture;
  cloudsTexture?: THREE.Texture;

  // Custom ShaderMaterial for the surface (overrides default MeshStandardMaterial)
  surfaceMaterial?: THREE.ShaderMaterial;

  // Atmosphere
  hasAtmosphere?: boolean;
  atmosphereColor?: [number, number, number];
  atmosphereDensity?: number;
  atmosphereScale?: number;

  // Ring system
  hasRings?: boolean;
  ringInnerRadius?: number;
  ringOuterRadius?: number;
  ringMapUrl?: string;

  // Physics
  rotationPeriod?: number;   // hours per full rotation
  axialTilt?: number;        // degrees

  // Lighting
  sunDirection?: [number, number, number];

  // Interaction
  onClick?: () => void;

  children?: ReactNode; // moons as children of the group
}

// ---------------------------------------------------------------------------
// Sphere geometry detail
// ---------------------------------------------------------------------------
const SPHERE_SEGMENTS = 128;

// ---------------------------------------------------------------------------
// Planet Component
// ---------------------------------------------------------------------------
function Planet({
  name,
  radius,
  position,
  diffuseMapUrl,
  normalMapUrl,
  specularMapUrl,
  cloudsMapUrl,
  diffuseTexture,
  normalTexture,
  specularTexture,
  cloudsTexture,
  surfaceMaterial,
  hasAtmosphere = false,
  atmosphereColor = [0.3, 0.6, 1.0],
  atmosphereDensity = 1.0,
  atmosphereScale = 1.07,
  hasRings = false,
  ringInnerRadius,
  ringOuterRadius,
  ringMapUrl,
  rotationPeriod = 24,
  axialTilt = 0,
  sunDirection = [1, 0, 0],
  onClick,
  children,
}: PlanetProps) {
  const groupRef = useRef<THREE.Group>(null);
  const planetRef = useRef<THREE.Mesh>(null);
  const cloudRef = useRef<THREE.Mesh>(null);

  // ---- Load textures (URL-based with fallback) ----
  const diffuseMap = useMemo(() => {
    if (diffuseTexture) return diffuseTexture;
    if (diffuseMapUrl) return tryLoadTexture(diffuseMapUrl, '#4488aa');
    return null;
  }, [diffuseMapUrl, diffuseTexture]);

  const normalMap = useMemo(() => {
    if (normalTexture) return normalTexture;
    if (normalMapUrl) return tryLoadTexture(normalMapUrl, '#8080ff');
    return null;
  }, [normalMapUrl, normalTexture]);

  const specularMap = useMemo(() => {
    if (specularTexture) return specularTexture;
    if (specularMapUrl) return tryLoadTexture(specularMapUrl, '#000000');
    return null;
  }, [specularMapUrl, specularTexture]);

  const cloudsMap = useMemo(() => {
    if (cloudsTexture) return cloudsTexture;
    if (cloudsMapUrl) return tryLoadTexture(cloudsMapUrl, '#ffffff');
    return null;
  }, [cloudsMapUrl, cloudsTexture]);

  const ringMap = useMemo(() => {
    if (ringMapUrl) return tryLoadTexture(ringMapUrl, '#aa9977');
    return null;
  }, [ringMapUrl]);

  // ---- Axial tilt (applied to the entire planet group) ----
  const tiltRadians = useMemo(() => (axialTilt * Math.PI) / 180, [axialTilt]);

  // ---- Atmosphere shader material ----
  const atmosphereMaterial = useMemo(() => {
    if (!hasAtmosphere) return null;
    return new THREE.ShaderMaterial({
      vertexShader: atmosphereVert,
      fragmentShader: atmosphereFrag,
      uniforms: {
        atmosphereColor: { value: new THREE.Vector3(...atmosphereColor) },
        atmosphereDensity: { value: atmosphereDensity },
        atmosphereScale: { value: atmosphereScale },
        sunDirection: { value: new THREE.Vector3(...sunDirection).normalize() },
      },
      transparent: true,
      side: THREE.FrontSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, [hasAtmosphere, atmosphereColor, atmosphereDensity, atmosphereScale, sunDirection]);

  // ---- Per-frame rotation ----
  useFrame((_, delta) => {
    if (!planetRef.current) return;

    // Rotation speed: full rotation in `rotationPeriod` hours
    const radiansPerSecond = (2 * Math.PI) / (rotationPeriod * 3600);

    // Shared, adjustable simulation clock (sim-seconds per real-second).
    const timeScale = getTimeScale();
    planetRef.current.rotation.y += radiansPerSecond * timeScale * delta;

    // Clouds rotate slightly faster (differential rotation)
    if (cloudRef.current) {
      const cloudSpeed = radiansPerSecond * 1.15;
      cloudRef.current.rotation.y += cloudSpeed * timeScale * delta;
    }

    // Update sun direction uniform on atmosphere
    if (atmosphereMaterial) {
      atmosphereMaterial.uniforms.sunDirection.value.set(...sunDirection).normalize();
    }

    // Update sun direction on surface material if it's a ShaderMaterial
    if (surfaceMaterial && surfaceMaterial.uniforms?.sunDirection) {
      surfaceMaterial.uniforms.sunDirection.value.set(...sunDirection).normalize();
    }
  });

  // ---- Ring geometry ----
  const ringGeometry = useMemo(() => {
    if (!hasRings || !ringInnerRadius || !ringOuterRadius) return null;
    const geo = new THREE.RingGeometry(ringInnerRadius, ringOuterRadius, 128);
    // Remap UVs for ring texture (radial mapping)
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const dist = Math.sqrt(x * x + y * y);
      const t = (dist - ringInnerRadius) / (ringOuterRadius - ringInnerRadius);
      uv.setXY(i, t, 0.5);
    }
    return geo;
  }, [hasRings, ringInnerRadius, ringOuterRadius]);

  return (
    <group ref={groupRef} position={position}>
      {/* Apply axial tilt to an inner group so children (moons) are NOT tilted */}
      <group rotation={[tiltRadians, 0, 0]}>
        {/* ---- Main planet surface ---- */}
        <mesh
          ref={planetRef}
          name={name}
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
        >
          <sphereGeometry args={[radius, SPHERE_SEGMENTS, SPHERE_SEGMENTS / 2]} />
          {surfaceMaterial ? (
            <primitive object={surfaceMaterial} attach="material" />
          ) : (
            <meshStandardMaterial
              map={diffuseMap}
              normalMap={normalMap}
              metalnessMap={specularMap}
              metalness={0}
              roughness={0.8}
            />
          )}
        </mesh>

        {/* ---- Cloud layer ---- */}
        {cloudsMap && (
          <mesh ref={cloudRef}>
            <sphereGeometry
              args={[radius * 1.005, SPHERE_SEGMENTS, SPHERE_SEGMENTS / 2]}
            />
            <meshStandardMaterial
              map={cloudsMap}
              transparent
              opacity={0.6}
              depthWrite={false}
              side={THREE.FrontSide}
            />
          </mesh>
        )}

        {/* ---- Atmosphere shell ---- */}
        {hasAtmosphere && atmosphereMaterial && (
          <mesh>
            <sphereGeometry
              args={[radius * atmosphereScale, 64, 32]}
            />
            <primitive object={atmosphereMaterial} attach="material" />
          </mesh>
        )}

        {/* ---- Ring system ---- */}
        {hasRings && ringGeometry && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} geometry={ringGeometry}>
            {ringMap ? (
              // The ring is a thin disc; a Sun nearly in its plane gives near-zero
              // diffuse, so we drive brightness from an emissive map (always
              // visible) and let diffuse add subtle sun-side shading on top.
              <meshStandardMaterial
                map={ringMap}
                emissiveMap={ringMap}
                emissive="#ffffff"
                emissiveIntensity={0.55}
                roughness={1}
                metalness={0}
                transparent
                opacity={0.95}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            ) : (
              <meshBasicMaterial
                color="#b9a47e"
                transparent
                opacity={0.6}
                side={THREE.DoubleSide}
                depthWrite={false}
                toneMapped={false}
              />
            )}
          </mesh>
        )}
      </group>

      {/* ---- Children (moons) sit outside the tilt group ---- */}
      {children}
    </group>
  );
}

export default Planet;
