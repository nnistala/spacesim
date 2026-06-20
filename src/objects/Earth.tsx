import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import Planet from './Planet';
import Moon from './Moon';
import { useUIStore } from '../stores/uiStore';
import { EARTH_POSITION as EARTH_POSITION_CONFIG, BODY_RADII } from '../data/scaleConfig';
import { useProximityStore } from '../stores/proximityStore';

// ---------------------------------------------------------------------------
// Inline Earth surface shaders (day/night blending with city lights)
// ---------------------------------------------------------------------------

const earthSurfaceVert = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;
varying vec3 vViewDir;

void main() {
  vUv = uv;

  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;

  // World-space normal for lighting calculations
  vWorldNormal = normalize(mat3(modelMatrix) * normal);

  // View direction (world space)
  vViewDir = normalize(cameraPosition - worldPos.xyz);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const earthSurfaceFrag = /* glsl */ `
precision highp float;

uniform sampler2D dayMap;
uniform sampler2D nightMap;
uniform sampler2D specularMap;
uniform vec3 sunDirection;

varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;
varying vec3 vViewDir;

void main() {
  vec3 normal = normalize(vWorldNormal);
  vec3 sunDir = normalize(sunDirection);
  vec3 viewDir = normalize(vViewDir);

  // --- Solar illumination ---
  float NdotL = dot(normal, sunDir);

  // Smooth day/night transition over ~10 degrees of solar angle
  float dayFactor = smoothstep(-0.1, 0.15, NdotL);

  // --- Texture sampling ---
  vec4 dayColor = texture2D(dayMap, vUv);
  vec4 nightColor = texture2D(nightMap, vUv);
  vec4 specData = texture2D(specularMap, vUv);

  // --- City lights on the dark side ---
  // Warm amber/orange tint
  vec3 cityLights = nightColor.rgb;
  cityLights *= vec3(1.0, 0.85, 0.6);
  cityLights *= 0.7;

  // --- Day side lighting ---
  float diffuse = max(NdotL, 0.0);
  vec3 litDay = dayColor.rgb * diffuse;

  // --- Specular highlights on oceans ---
  vec3 halfVec = normalize(sunDir + viewDir);
  float NdotH = max(dot(normal, halfVec), 0.0);
  float specIntensity = pow(NdotH, 64.0);

  // Only where specularMap indicates water (> 0.5)
  float waterMask = step(0.5, specData.r);
  vec3 specular = vec3(1.0, 0.98, 0.95) * specIntensity * waterMask * 0.5;
  specular *= smoothstep(0.0, 0.2, NdotL);

  // --- Limb darkening ---
  float limbDarkening = pow(max(dot(normal, viewDir), 0.0), 0.3);
  limbDarkening = mix(0.6, 1.0, limbDarkening);

  // --- Combine day and night ---
  vec3 finalColor = mix(cityLights * (1.0 - dayFactor), litDay + specular, dayFactor);

  // Apply limb darkening to the day side
  finalColor *= mix(1.0, limbDarkening, dayFactor);

  // Minimal ambient to prevent pure black
  finalColor += dayColor.rgb * 0.005;

  gl_FragColor = vec4(finalColor, 1.0);
}
`;

// ---------------------------------------------------------------------------
// Scale constants
// ---------------------------------------------------------------------------
// HYBRID SCALE: Earth radius = 1 render unit = 6,371 km. Earth sits at the
// anchor orbit distance from the Sun (see scaleConfig).
const EARTH_RADIUS = BODY_RADII.earth;
const EARTH_POSITION: [number, number, number] = EARTH_POSITION_CONFIG;

// Physical constants
const AXIAL_TILT = 23.44;           // degrees
const ROTATION_PERIOD = 23.934;     // hours (sidereal day)

// ---------------------------------------------------------------------------
// Earth props
// ---------------------------------------------------------------------------
interface EarthProps {
  /** Override Earth position (default: 1 AU on x-axis) */
  position?: [number, number, number];
  /** Direction *toward* the Sun in world space (default: computed from position) */
  sunDirection?: [number, number, number];
}

// ---------------------------------------------------------------------------
// Earth Component
// ---------------------------------------------------------------------------
function Earth({
  position = EARTH_POSITION,
  sunDirection: sunDirProp,
}: EarthProps) {
  const setInfoPanelBody = useUIStore((s) => s.setInfoPanelBody);

  // Register with the proximity system for the distance HUD
  useEffect(() => {
    const store = useProximityStore.getState();
    store.registerBody({
      id: 'earth',
      name: 'Earth',
      position: [position[0], position[1], position[2]],
      radius: EARTH_RADIUS,
      kind: 'planet',
    });
    return () => store.unregisterBody('earth');
  }, [position]);

  // Compute sun direction: from Earth toward the Sun (assumed at origin)
  const sunDirection = useMemo<[number, number, number]>(() => {
    if (sunDirProp) return sunDirProp;
    const len = Math.sqrt(
      position[0] * position[0] +
      position[1] * position[1] +
      position[2] * position[2],
    );
    if (len === 0) return [1, 0, 0];
    return [
      -position[0] / len,
      -position[1] / len,
      -position[2] / len,
    ];
  }, [position, sunDirProp]);

  // ---- Real NASA textures (vendored locally, loaded via Suspense) ----
  // 8K Blue Marble day, 8K Black Marble night lights, 8K clouds, 2K ocean mask.
  const [dayMap, nightMap, specularMap, cloudsMap] = useTexture([
    '/textures/earth_day_8k.jpg',
    '/textures/earth_night_8k.jpg',
    '/textures/earth_specular_2k.jpg',
    '/textures/earth_clouds_8k.jpg',
  ]);

  useMemo(() => {
    dayMap.colorSpace = THREE.SRGBColorSpace;
    nightMap.colorSpace = THREE.SRGBColorSpace;
    cloudsMap.colorSpace = THREE.SRGBColorSpace;
    specularMap.colorSpace = THREE.NoColorSpace; // data map, not colour
    for (const t of [dayMap, nightMap, specularMap, cloudsMap]) {
      t.anisotropy = 16;
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.ClampToEdgeWrapping;
      t.needsUpdate = true;
    }
  }, [dayMap, nightMap, specularMap, cloudsMap]);

  // ---- Custom Earth surface ShaderMaterial (day/night blending) ----
  const surfaceMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: earthSurfaceVert,
      fragmentShader: earthSurfaceFrag,
      uniforms: {
        dayMap: { value: dayMap },
        nightMap: { value: nightMap },
        specularMap: { value: specularMap },
        sunDirection: { value: new THREE.Vector3(...sunDirection).normalize() },
      },
    });
  }, [dayMap, nightMap, specularMap, sunDirection]);

  return (
    <Planet
      name="Earth"
      radius={EARTH_RADIUS}
      position={position}
      surfaceMaterial={surfaceMaterial}
      cloudsTexture={cloudsMap}
      hasAtmosphere
      atmosphereColor={[0.35, 0.6, 1.0]}
      atmosphereDensity={1.6}
      atmosphereScale={1.08}
      rotationPeriod={ROTATION_PERIOD}
      axialTilt={AXIAL_TILT}
      sunDirection={sunDirection}
      onClick={() => {
        setInfoPanelBody('earth');
      }}
    >
      {/* Moon orbits Earth */}
      <Moon sunDirection={sunDirection} />
    </Planet>
  );
}

export default Earth;
export { EARTH_RADIUS, EARTH_POSITION };
