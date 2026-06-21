import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { XROrigin, useXR, useXRInputSourceState } from '@react-three/xr'
import * as THREE from 'three'
import { useNavigationStore } from '../stores/navigationStore'
import { useProximityStore } from '../stores/proximityStore'
import { formatRealSpeed } from '../data/scaleConfig'
import { COSMIC_MAX_UNITS } from '../data/cosmicScale'

// Adaptive-speed band — mirrors the desktop SpaceNavigator so VR flight feels
// the same: you crawl near a surface and cruise across open space.
const SPEED_PER_DISTANCE = 0.3
const MIN_BASE_SPEED = 2
const MAX_BASE_SPEED = 8_000
const BOOST_FACTOR = 5
const MAX_TRAVEL_RADIUS = COSMIC_MAX_UNITS * 1.02

const STICK_DEADZONE = 0.12
const SNAP_DEADZONE = 0.6
const SNAP_DEGREES = 30

// Hero start, just off Earth (Earth sits at x≈2000; 1 unit = 1 Earth radius).
const START = new THREE.Vector3(2005, 1.2, 6)

/**
 * XRFlight — immersive (WebXR) locomotion for headsets like the Quest.
 *
 * The headset drives the camera's head pose; we fly by translating the
 * <XROrigin> rig. Left stick = fly where you're looking (full 3D, pitch
 * included); right stick = snap-turn; either trigger/grip = boost. Speed scales
 * with the distance to the nearest body so the same stick deflection crawls you
 * up to the ISS and warps you between galaxies.
 *
 * Only active inside an XR session — the desktop SpaceNavigator yields the
 * camera to us then (see its `inXR` guard).
 */
export default function XRFlight() {
  const originRef = useRef<THREE.Group>(null)
  const session = useXR((s) => s.session)
  const left = useXRInputSourceState('controller', 'left')
  const right = useXRInputSourceState('controller', 'right')

  // Critical for a space scene: on entering XR, WebXR resets the camera clip
  // range to the session default (~1–2 km of render units), which clips
  // everything past the Sun — so only Earth and the Sun were visible. The whole
  // log-compressed universe fits inside COSMIC_MAX_UNITS, so widen the far plane
  // to take it all in. (The desktop view relies on a logarithmic depth buffer,
  // which WebXR's device-supplied projection can't use, hence the linear range.)
  useEffect(() => {
    if (!session) return
    session.updateRenderState({ depthNear: 0.1, depthFar: COSMIC_MAX_UNITS * 1.1 })
  }, [session])

  const inited = useRef(false)
  const snapLatched = useRef(false)
  const _fwd = useRef(new THREE.Vector3())
  const _right = useRef(new THREE.Vector3())
  const _up = useRef(new THREE.Vector3(0, 1, 0))
  const _head = useRef(new THREE.Vector3())
  const _prevHead = useRef(START.clone())

  useFrame((state, dtRaw) => {
    const origin = originRef.current
    if (!origin) return

    // Set the start pose once (not via the position prop, which would snap us
    // back to start whenever a controller (re)connects and re-renders).
    if (!inited.current) {
      origin.position.copy(START)
      state.camera.getWorldPosition(_prevHead.current)
      inited.current = true
    }

    const dt = Math.min(dtRaw, 0.1)
    const cam = state.camera

    const lts = left?.gamepad?.['xr-standard-thumbstick']
    const rts = right?.gamepad?.['xr-standard-thumbstick']
    let lx = lts?.xAxis ?? 0
    let ly = lts?.yAxis ?? 0
    const rx = rts?.xAxis ?? 0
    if (Math.abs(lx) < STICK_DEADZONE) lx = 0
    if (Math.abs(ly) < STICK_DEADZONE) ly = 0

    // Adaptive base speed from the nearest body (published by SpaceNavigator).
    const nearDist = useProximityStore.getState().nearest?.distanceUnits ?? 100
    let speed = THREE.MathUtils.clamp(
      nearDist * SPEED_PER_DISTANCE,
      MIN_BASE_SPEED,
      MAX_BASE_SPEED,
    )
    const pressed = (s?: { state: string }) => s?.state === 'pressed'
    if (
      pressed(left?.gamepad?.['xr-standard-squeeze']) ||
      pressed(right?.gamepad?.['xr-standard-squeeze']) ||
      pressed(left?.gamepad?.['xr-standard-trigger']) ||
      pressed(right?.gamepad?.['xr-standard-trigger'])
    ) {
      speed *= BOOST_FACTOR
    }

    // Fly where you look: forward along the headset gaze (includes pitch).
    if (lx !== 0 || ly !== 0) {
      cam.getWorldDirection(_fwd.current) // -Z forward, in world space
      _right.current.crossVectors(_fwd.current, _up.current).normalize()
      // Push the stick up (yAxis < 0) to go forward.
      origin.position.addScaledVector(_fwd.current, -ly * speed * dt)
      origin.position.addScaledVector(_right.current, lx * speed * dt)
    }

    // Snap-turn on the right stick, pivoting around the head so you don't lurch.
    if (Math.abs(rx) > SNAP_DEADZONE) {
      if (!snapLatched.current) {
        snapLatched.current = true
        const angle = THREE.MathUtils.degToRad(SNAP_DEGREES) * (rx > 0 ? -1 : 1)
        cam.getWorldPosition(_head.current)
        const dx = origin.position.x - _head.current.x
        const dz = origin.position.z - _head.current.z
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)
        origin.position.x = _head.current.x + dx * cos - dz * sin
        origin.position.z = _head.current.z + dx * sin + dz * cos
        origin.rotateY(angle)
      }
    } else {
      snapLatched.current = false
    }

    // Don't fly off the edge of the observable universe.
    const rSq = origin.position.lengthSq()
    if (rSq > MAX_TRAVEL_RADIUS * MAX_TRAVEL_RADIUS) {
      origin.position.multiplyScalar(MAX_TRAVEL_RADIUS / Math.sqrt(rSq))
    }

    // Publish the head's real speed to the HUD (mirrored to the desktop screen).
    cam.getWorldPosition(_head.current)
    const moved = _head.current.distanceTo(_prevHead.current)
    _prevHead.current.copy(_head.current)
    const spd = dt > 0 ? moved / dt : 0
    const { display, unit } = formatRealSpeed(spd)
    useNavigationStore.getState().setSpeed(spd, unit, display)
  })

  return <XROrigin ref={originRef} />
}
