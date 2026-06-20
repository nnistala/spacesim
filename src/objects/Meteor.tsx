import type { RefObject } from 'react';
import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Maximum number of simultaneously active meteors. */
const MAX_ACTIVE = 3;

/** Minimum seconds between meteor spawns. */
const MIN_INTERVAL = 10;

/** Maximum seconds between meteor spawns. */
const MAX_INTERVAL = 30;

/** Minimum meteor lifetime in seconds. */
const MIN_LIFETIME = 0.3;

/** Maximum meteor lifetime in seconds. */
const MAX_LIFETIME = 1.5;

/** Number of trail segments per meteor. */
const TRAIL_SEGMENTS = 32;

/** Distance from the camera at which meteors appear. */
const SPAWN_DISTANCE = 800;

/** Angular length of trail in radians (5..20 degrees). */
const MIN_ARC = (5 * Math.PI) / 180;
const MAX_ARC = (20 * Math.PI) / 180;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MeteorState {
  active: boolean;
  startPos: THREE.Vector3;
  direction: THREE.Vector3;
  arcLength: number;
  speed: number;
  lifetime: number;
  elapsed: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomMeteorDirection(target: THREE.Vector3): void {
  const azimuth = Math.random() * Math.PI * 2;
  const elevation = (Math.random() - 0.5) * 0.6;
  target.set(
    Math.cos(elevation) * Math.cos(azimuth),
    Math.sin(elevation),
    Math.cos(elevation) * Math.sin(azimuth),
  );
  target.normalize();
}

function spawnMeteor(
  cameraPos: THREE.Vector3,
  state: MeteorState,
): void {
  const phi = Math.random() * Math.PI * 2;
  const theta = Math.acos(2 * Math.random() - 1);

  state.startPos.set(
    cameraPos.x + SPAWN_DISTANCE * Math.sin(theta) * Math.cos(phi),
    cameraPos.y + SPAWN_DISTANCE * Math.sin(theta) * Math.sin(phi),
    cameraPos.z + SPAWN_DISTANCE * Math.cos(theta),
  );

  randomMeteorDirection(state.direction);

  state.arcLength = randomRange(MIN_ARC, MAX_ARC);
  state.lifetime = randomRange(MIN_LIFETIME, MAX_LIFETIME);

  const travelDistance = SPAWN_DISTANCE * state.arcLength;
  state.speed = travelDistance / state.lifetime;

  state.elapsed = 0;
  state.active = true;
}

// ---------------------------------------------------------------------------
// Single Meteor Line — imperative THREE.Line managed via ref
// ---------------------------------------------------------------------------

function MeteorLine({ index, poolRef }: {
  index: number;
  poolRef: RefObject<MeteorState[]>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const lineRef = useRef<THREE.Line | null>(null);

  const { geometry, material } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(TRAIL_SEGMENTS * 3);
    const colors = new Float32Array(TRAIL_SEGMENTS * 4);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 4));

    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    return { geometry: geo, material: mat };
  }, []);

  // Create the THREE.Line imperatively and add it to the group
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const line = new THREE.Line(geometry, material);
    line.visible = false;
    line.frustumCulled = false;
    group.add(line);
    lineRef.current = line;

    return () => {
      group.remove(line);
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame((_state, delta) => {
    const dt = Math.min(delta, 0.1);
    const pool = poolRef.current;
    if (!pool) return;

    const meteor = pool[index];
    const line = lineRef.current;
    if (!line) return;

    if (!meteor.active) {
      line.visible = false;
      return;
    }

    meteor.elapsed += dt;
    const t = meteor.elapsed / meteor.lifetime;

    if (t >= 1) {
      meteor.active = false;
      line.visible = false;
      return;
    }

    line.visible = true;

    const headDistance = meteor.speed * meteor.elapsed;

    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geometry.getAttribute('color') as THREE.BufferAttribute;
    const positions = posAttr.array as Float32Array;
    const colors = colAttr.array as Float32Array;

    const trailFraction = Math.min(t * 3, 1.0);
    const fadeFraction = t > 0.7 ? (t - 0.7) / 0.3 : 0;
    const trailLength = meteor.speed * meteor.lifetime * 0.3 * trailFraction;

    for (let s = 0; s < TRAIL_SEGMENTS; s++) {
      const segT = s / (TRAIL_SEGMENTS - 1);

      const segDist = headDistance - trailLength * (1 - segT);
      const clampedDist = Math.max(0, segDist);

      positions[s * 3] = meteor.startPos.x + meteor.direction.x * clampedDist;
      positions[s * 3 + 1] = meteor.startPos.y + meteor.direction.y * clampedDist;
      positions[s * 3 + 2] = meteor.startPos.z + meteor.direction.z * clampedDist;

      const alpha = segT * segT * (1 - fadeFraction);
      const warmth = 1 - segT;
      colors[s * 4] = 1.0;
      colors[s * 4 + 1] = 1.0 - warmth * 0.15;
      colors[s * 4 + 2] = 1.0 - warmth * 0.4;
      colors[s * 4 + 3] = alpha;
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    geometry.setDrawRange(0, TRAIL_SEGMENTS);
  });

  return <group ref={groupRef} />;
}

// ---------------------------------------------------------------------------
// Meteors — main export
// ---------------------------------------------------------------------------

/**
 * Periodic shooting stars for visual delight.
 *
 * A pool of meteor objects is pre-allocated and recycled. Each meteor is
 * rendered as a line strip with fading opacity from head to tail.
 *
 * Meteors spawn every 10-30 seconds at random, streak across the sky in
 * 0.3-1.5 seconds, then fade away. Maximum 3 active at once.
 */
export default function Meteors() {
  const { camera } = useThree();

  const poolRef = useRef<MeteorState[]>(
    Array.from({ length: MAX_ACTIVE }, () => ({
      active: false,
      startPos: new THREE.Vector3(),
      direction: new THREE.Vector3(),
      arcLength: 0,
      speed: 0,
      lifetime: 1,
      elapsed: 0,
    })),
  );

  const nextSpawnRef = useRef(randomRange(MIN_INTERVAL * 0.3, MIN_INTERVAL));

  // Spawn logic runs once per frame at the parent level
  useFrame((_state, delta) => {
    const dt = Math.min(delta, 0.1);

    nextSpawnRef.current -= dt;
    if (nextSpawnRef.current <= 0) {
      const slot = poolRef.current.find((m) => !m.active);
      if (slot) {
        spawnMeteor(camera.position, slot);
      }
      nextSpawnRef.current = randomRange(MIN_INTERVAL, MAX_INTERVAL);
    }
  });

  // Each pool slot gets its own MeteorLine for independent animation
  const indices = useMemo(() => Array.from({ length: MAX_ACTIVE }, (_, i) => i), []);

  return (
    <group>
      {indices.map((i) => (
        <MeteorLine key={i} index={i} poolRef={poolRef} />
      ))}
    </group>
  );
}
