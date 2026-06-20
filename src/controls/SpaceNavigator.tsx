import { useRef, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useNavigationStore } from '../stores/navigationStore';
import { useJoystickStore } from '../stores/joystickStore';
import { proximityBodies, useProximityStore } from '../stores/proximityStore';
import { formatRealSpeed } from '../data/scaleConfig';
import { COSMIC_MAX_UNITS } from '../data/cosmicScale';

/** Hard limit on how far from the origin the camera may travel (edge of the
 * observable universe) — stops endless drifting into empty black. */
const MAX_TRAVEL_RADIUS = COSMIC_MAX_UNITS * 1.02;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Damping factor applied per frame when no input (1 = no damping, 0 = instant stop). */
const VELOCITY_DAMPING = 0.95;

/** How quickly velocity builds toward the target (lower = smoother, higher = snappier). */
const ACCELERATION_LERP = 0.08;

/** Mouse sensitivity (radians per pixel of mouse movement). */
const MOUSE_SENSITIVITY = 0.002;

/** Joystick look sensitivity (radians per second at full deflection). */
const JOYSTICK_LOOK_SENSITIVITY = 2.0;

/** Scroll wheel multiplier bounds. */
const SCROLL_MIN = 0.1;
const SCROLL_MAX = 10.0;

/** Shift-boost factor. */
const BOOST_FACTOR = 5.0;

/**
 * Adaptive base speed: scene units/second scale with the distance to the
 * nearest body's surface, so you crawl near a surface and cruise across open
 * space. Clamped to a sane band.
 */
const SPEED_PER_DISTANCE = 0.3;
const MIN_BASE_SPEED = 2;
const MAX_BASE_SPEED = 8_000;

/**
 * Warp: holding forward ramps a linear multiplier on top of the base speed,
 * so a sustained press accelerates like engaging a warp drive. Releasing (or
 * braking) bleeds it off quickly.
 */
const WARP_MAX = 5; // up to (1 + 5) = 6x at full charge
const WARP_RAMP = 1.0; // charge gained per second holding forward
const WARP_DECAY = 5.0; // charge lost per second otherwise

/** Fly-to easing rates (per-second exponential approach). */
const FLY_POS_RATE = 2.2;
const FLY_LOOK_RATE = 3.5;
/**
 * Fly-to framing: camera stops this many radii from the target's CENTRE, so
 * the object fills a consistent, comfortable fraction of the view regardless of
 * size (~2.6 → object spans ~45° of a 60° FOV). For Earth this is ~10,000 km.
 */
const FLY_VIEW_FACTOR = 2.6;
/**
 * Absolute minimum standoff (~50 km) so we never end up inside a tiny object,
 * yet still get close enough to the small human-made craft (ISS, rovers, flags)
 * that their 3D models fill the view rather than reading as specks. Comfortably
 * outside the ~6.4 km near plane.
 */
const FLY_MIN_STANDOFF = 50 / 6371;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * SpaceNavigator — the main free-flight camera controller.
 *
 * This component lives INSIDE the R3F Canvas. It captures keyboard, mouse,
 * and mobile joystick input to give the player full 6-DOF flight control.
 *
 * Controls:
 *   W / Up Arrow     — forward
 *   S / Down Arrow   — backward
 *   A / Left Arrow   — strafe left
 *   D / Right Arrow  — strafe right
 *   Q               — roll left
 *   E               — roll right
 *   Shift           — boost (5x speed)
 *   Space           — brake
 *   Mouse (pointer-locked) — pitch & yaw
 *   Scroll wheel    — adjust base speed multiplier
 */
export default function SpaceNavigator() {
  const { camera, gl } = useThree();

  // ---- Refs for frame-persistent state (no re-renders) ----
  const keysRef = useRef<Set<string>>(new Set());
  const mouseDeltaRef = useRef({ x: 0, y: 0 });
  const scrollMultiplierRef = useRef(1.0);
  const velocityRef = useRef(new THREE.Vector3());
  const isPointerLockedRef = useRef(false);
  const warpChargeRef = useRef(0);

  // Scratch vectors — allocated once, reused every frame.
  const _forward = useRef(new THREE.Vector3());
  const _right = useRef(new THREE.Vector3());
  const _targetVelocity = useRef(new THREE.Vector3());
  const _euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const _bodyPos = useRef(new THREE.Vector3());
  const _standoff = useRef(new THREE.Vector3());
  const _targetPos = useRef(new THREE.Vector3());
  const _lookMat = useRef(new THREE.Matrix4());
  const _lookQuat = useRef(new THREE.Quaternion());
  const _camFwd = useRef(new THREE.Vector3());
  const crosshairNameRef = useRef<string | null>(null);

  // ---- Zustand selectors (non-reactive reads in the frame loop) ----
  const navStore = useNavigationStore;

  // ---- Keyboard ----
  const onKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't hijack keys while typing in a text field (e.g. the search box).
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    ) {
      return;
    }
    keysRef.current.add(e.code);
    // Prevent default for game keys so the page doesn't scroll etc.
    if (
      [
        'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE',
        'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
        'ShiftLeft', 'ShiftRight', 'Space',
      ].includes(e.code)
    ) {
      e.preventDefault();
    }
  }, []);

  const onKeyUp = useCallback((e: KeyboardEvent) => {
    keysRef.current.delete(e.code);
  }, []);

  // ---- Mouse look (pointer lock) ----
  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isPointerLockedRef.current) return;
    mouseDeltaRef.current.x += e.movementX;
    mouseDeltaRef.current.y += e.movementY;
  }, []);

  const onPointerLockChange = useCallback(() => {
    isPointerLockedRef.current =
      document.pointerLockElement === gl.domElement;
  }, [gl.domElement]);

  const onCanvasClick = useCallback(() => {
    if (!isPointerLockedRef.current) {
      gl.domElement.requestPointerLock();
    }
  }, [gl.domElement]);

  // ---- Scroll wheel — adjust speed multiplier ----
  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const direction = e.deltaY > 0 ? -1 : 1;
    const step = 1.15; // multiplicative step
    let mult = scrollMultiplierRef.current;
    if (direction > 0) {
      mult *= step;
    } else {
      mult /= step;
    }
    scrollMultiplierRef.current = THREE.MathUtils.clamp(
      mult,
      SCROLL_MIN,
      SCROLL_MAX,
    );
  }, []);

  // ---- Clear all held keys when the window loses focus ----
  // Fixes "stuck" or dead arrow keys: if you alt-tab while holding a key,
  // the keyup never fires, leaving stale state. Also fires if a HUD button
  // steals focus. We listen on window (not document) so keys register even
  // when focus is on an overlay element.
  const onBlur = useCallback(() => {
    keysRef.current.clear();
  }, []);

  // ---- Set up / tear down event listeners ----
  useEffect(() => {
    const canvas = gl.domElement;

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('mousemove', onMouseMove);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    canvas.addEventListener('click', onCanvasClick);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      canvas.removeEventListener('click', onCanvasClick);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [gl.domElement, onKeyDown, onKeyUp, onBlur, onMouseMove, onPointerLockChange, onCanvasClick, onWheel]);

  // ---- Per-frame update ----
  useFrame((_state, delta) => {
    // Cap delta to prevent huge jumps when tab is inactive.
    const dt = Math.min(delta, 0.1);

    const keys = keysRef.current;
    const navState = navStore.getState();

    // ---------------------------------------------------------------
    // 0. NEAREST BODY — surface distance (drives adaptive speed + HUD)
    // ---------------------------------------------------------------
    let nearestId: string | null = null;
    let nearestName = '';
    let nearestDist = Infinity;
    // Targeting reticle: body whose direction is closest to where we're looking.
    const fwd = _camFwd.current.set(0, 0, -1).applyQuaternion(camera.quaternion);
    const CROSSHAIR_COS = 0.99892; // within ~2.66° of screen centre
    let bestDot = CROSSHAIR_COS;
    let crosshairName: string | null = null;
    for (const body of proximityBodies.values()) {
      if (body.excludeFromNearest) continue;
      const dx = camera.position.x - body.position[0];
      const dy = camera.position.y - body.position[1];
      const dz = camera.position.z - body.position[2];
      const centerDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const surfaceDist = Math.max(centerDist - body.radius, 0);
      if (surfaceDist < nearestDist) {
        nearestDist = surfaceDist;
        nearestId = body.id;
        nearestName = body.name;
      }
      // Angle between forward and the direction TO the body (= -(dx,dy,dz)).
      if (centerDist > 1e-4) {
        const dot = -(dx * fwd.x + dy * fwd.y + dz * fwd.z) / centerDist;
        if (dot > bestDot) {
          bestDot = dot;
          crosshairName = body.name;
        }
      }
    }
    if (!isFinite(nearestDist)) nearestDist = 0;
    if (crosshairName !== crosshairNameRef.current) {
      crosshairNameRef.current = crosshairName;
      navStore.getState().setCrosshairName(crosshairName);
    }

    // ---------------------------------------------------------------
    // 1. GATHER INPUT (movement + look)
    // ---------------------------------------------------------------
    const mdx = mouseDeltaRef.current.x;
    const mdy = mouseDeltaRef.current.y;
    mouseDeltaRef.current.x = 0;
    mouseDeltaRef.current.y = 0;

    const jLookX = useJoystickStore.getState().lookX;
    const jLookY = useJoystickStore.getState().lookY;
    const lookX = mdx * MOUSE_SENSITIVITY + jLookX * JOYSTICK_LOOK_SENSITIVITY * dt;
    const lookY = mdy * MOUSE_SENSITIVITY + jLookY * JOYSTICK_LOOK_SENSITIVITY * dt;

    let inputZ = 0; // forward/back
    let inputX = 0; // strafe
    if (keys.has('KeyW') || keys.has('ArrowUp')) inputZ += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) inputZ -= 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) inputX -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) inputX += 1;
    const jMoveX = useJoystickStore.getState().moveX;
    const jMoveY = useJoystickStore.getState().moveY;
    inputZ += jMoveY;
    inputX += jMoveX;
    const inputLen = Math.sqrt(inputX * inputX + inputZ * inputZ);
    if (inputLen > 1) {
      inputX /= inputLen;
      inputZ /= inputLen;
    }
    const hasInput = inputLen > 0.01;
    const braking = keys.has('Space');

    const vel = velocityRef.current;
    const euler = _euler.current;
    let currentSpeed: number;

    // ===============================================================
    // FLY-TO — auto-navigate to navState.warpTarget (search/select).
    // Manual movement or braking cancels it.
    // ===============================================================
    const target = navState.warpTarget;
    if (target && !hasInput && !braking) {
      const body = proximityBodies.get(target);
      // Wait (don't cancel) if the target isn't registered yet, or hasn't been
      // positioned this session (orbiters start at the origin until their first
      // frame) — otherwise we'd briefly fly toward the Sun at [0,0,0].
      // `originAnchored` shells (cosmic scales centred on the observer) and the
      // Sun legitimately live at the origin, so they are exempt from the wait.
      if (
        !body ||
        (target !== 'sun' &&
          !body.originAnchored &&
          body.position[0] === 0 &&
          body.position[1] === 0 &&
          body.position[2] === 0)
      ) {
        currentSpeed = 0;
        vel.set(0, 0, 0);
      } else {
        const before = _forward.current.copy(camera.position);
        const bp = _bodyPos.current.set(
          body.position[0],
          body.position[1],
          body.position[2],
        );
        // Distance from the target centre, sized to the object so it's nicely
        // framed (not a speck, not clipping) — computed from its own radius.
        const standoffDist = Math.max(body.radius * FLY_VIEW_FACTOR, FLY_MIN_STANDOFF);
        // Approach from the camera's current side of the body.
        const dir = _standoff.current.copy(camera.position).sub(bp);
        const d = dir.length();
        if (d < 1e-4) dir.set(0, 0, 1);
        else dir.divideScalar(d);
        // NB: use a SEPARATE scratch vector for the destination — `dir` aliases
        // `_standoff`, so reusing it here would overwrite dir mid-expression and
        // place the camera at bp*(1+standoffDist) (far out / inside the Sun).
        const targetPos = _targetPos.current.copy(bp).addScaledVector(dir, standoffDist);

        camera.position.lerp(targetPos, 1 - Math.exp(-FLY_POS_RATE * dt));

        _lookMat.current.lookAt(camera.position, bp, camera.up);
        _lookQuat.current.setFromRotationMatrix(_lookMat.current);
        camera.quaternion.slerp(_lookQuat.current, 1 - Math.exp(-FLY_LOOK_RATE * dt));

        currentSpeed = dt > 0 ? before.distanceTo(camera.position) / dt : 0;
        vel.set(0, 0, 0);

        // Don't clear the target on arrival — keep locked on and FOLLOW the
        // (possibly orbiting) body so it stays framed and readable. Any manual
        // movement (handled in the else branch) releases the lock.
        const remaining = camera.position.distanceTo(targetPos);
        navState.setWarpProgress(remaining > standoffDist * 0.1 ? 1 : 0);
      }
      euler.setFromQuaternion(camera.quaternion, 'YXZ');
    } else {
      if (target) {
        // Manual input interrupted the fly-to.
        navState.setWarpTarget(null);
      }

      // ----- LOOK -----
      euler.setFromQuaternion(camera.quaternion, 'YXZ');
      euler.y -= lookX;
      euler.x -= lookY;
      euler.x = THREE.MathUtils.clamp(euler.x, -Math.PI * 0.495, Math.PI * 0.495);
      const rollSpeed = 1.5;
      if (keys.has('KeyQ')) euler.z += rollSpeed * dt;
      if (keys.has('KeyE')) euler.z -= rollSpeed * dt;
      camera.quaternion.setFromEuler(euler);

      // ----- ADAPTIVE BASE SPEED + WARP RAMP -----
      const adaptiveBase = THREE.MathUtils.clamp(
        nearestDist * SPEED_PER_DISTANCE,
        MIN_BASE_SPEED,
        MAX_BASE_SPEED,
      );
      const movingForward = inputZ > 0.1 && !braking;
      if (movingForward) {
        warpChargeRef.current = Math.min(WARP_MAX, warpChargeRef.current + WARP_RAMP * dt);
      } else {
        warpChargeRef.current = Math.max(0, warpChargeRef.current - WARP_DECAY * dt);
      }
      const warpMult = 1 + warpChargeRef.current;
      const boosting = keys.has('ShiftLeft') || keys.has('ShiftRight');
      const scrollMult = scrollMultiplierRef.current;
      const effectiveSpeed =
        adaptiveBase * scrollMult * (boosting ? BOOST_FACTOR : 1.0) * warpMult;
      navState.setWarpProgress(warpChargeRef.current / WARP_MAX);

      // ----- MOVEMENT DIRECTION -----
      const forward = _forward.current.set(0, 0, -1).applyQuaternion(camera.quaternion);
      const right = _right.current.set(1, 0, 0).applyQuaternion(camera.quaternion);
      const targetVel = _targetVelocity.current.set(0, 0, 0);
      if (hasInput) {
        targetVel
          .addScaledVector(forward, inputZ * effectiveSpeed)
          .addScaledVector(right, inputX * effectiveSpeed);
      }

      // ----- VELOCITY UPDATE (accel + damping) -----
      if (braking) {
        vel.multiplyScalar(0.85);
        if (vel.length() < effectiveSpeed * 0.001) vel.set(0, 0, 0);
      } else if (hasInput) {
        vel.lerp(targetVel, ACCELERATION_LERP);
      } else {
        vel.multiplyScalar(VELOCITY_DAMPING);
        if (vel.length() < effectiveSpeed * 0.0001) vel.set(0, 0, 0);
      }

      camera.position.addScaledVector(vel, dt);
      currentSpeed = vel.length();
    }

    // Clamp to the edge of the observable universe — no flying off into the void.
    const rSq = camera.position.lengthSq();
    if (rSq > MAX_TRAVEL_RADIUS * MAX_TRAVEL_RADIUS) {
      camera.position.multiplyScalar(MAX_TRAVEL_RADIUS / Math.sqrt(rSq));
    }

    // ---------------------------------------------------------------
    // PUBLISH STATE (HUD + consumers)
    // ---------------------------------------------------------------
    if (!isFinite(currentSpeed)) currentSpeed = 0;
    const { display, unit } = formatRealSpeed(currentSpeed);
    navState.setPosition(camera.position.clone());
    navState.setVelocity(vel.clone());
    navState.setRotation(euler.clone());
    navState.setSpeed(currentSpeed, unit, display);

    if (nearestId) {
      useProximityStore.getState().setNearest({
        id: nearestId,
        name: nearestName,
        distanceUnits: nearestDist,
      });
    }
  });

  // This component renders nothing — it's purely a controller.
  return null;
}
