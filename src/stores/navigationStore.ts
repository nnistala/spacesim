import { create } from 'zustand';
import * as THREE from 'three';

export type NavigationMode = 'free' | 'orbit' | 'follow' | 'warp';

export type ScaleLevel =
  | 'SURFACE'
  | 'ORBITAL'
  | 'PLANETARY'
  | 'STELLAR'
  | 'GALACTIC'
  | 'COSMIC';

export interface NavigationState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: THREE.Euler;
  speed: number;
  speedUnit: string;
  displaySpeed: string;
  mode: NavigationMode;
  scaleLevel: ScaleLevel;
  warpTarget: string | null;
  warpProgress: number;
  /** Name of the body currently under the targeting reticle (or null). */
  crosshairName: string | null;

  setPosition: (pos: THREE.Vector3) => void;
  setVelocity: (vel: THREE.Vector3) => void;
  setRotation: (rot: THREE.Euler) => void;
  setSpeed: (speed: number, unit: string, display: string) => void;
  setMode: (mode: NavigationMode) => void;
  setScaleLevel: (level: ScaleLevel) => void;
  setWarpTarget: (target: string | null) => void;
  setWarpProgress: (progress: number) => void;
  setCrosshairName: (name: string | null) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  position: new THREE.Vector3(0, 0, 50),
  velocity: new THREE.Vector3(),
  rotation: new THREE.Euler(),
  speed: 0,
  speedUnit: 'm/s',
  displaySpeed: '0 m/s',
  mode: 'free',
  scaleLevel: 'PLANETARY',
  warpTarget: null,
  warpProgress: 0,
  crosshairName: null,

  setPosition: (position) => set({ position }),
  setVelocity: (velocity) => set({ velocity }),
  setRotation: (rotation) => set({ rotation }),
  setSpeed: (speed, speedUnit, displaySpeed) =>
    set({ speed, speedUnit, displaySpeed }),
  setMode: (mode) => set({ mode }),
  setScaleLevel: (scaleLevel) => set({ scaleLevel }),
  setWarpTarget: (warpTarget) => set({ warpTarget }),
  setWarpProgress: (warpProgress) => set({ warpProgress }),
  setCrosshairName: (crosshairName) => set({ crosshairName }),
}));
