import { create } from 'zustand';

export interface JoystickValues {
  moveX: number;
  moveY: number;
  lookX: number;
  lookY: number;
}

interface JoystickState extends JoystickValues {
  setMove: (x: number, y: number) => void;
  setLook: (x: number, y: number) => void;
  reset: () => void;
}

export const useJoystickStore = create<JoystickState>((set) => ({
  moveX: 0,
  moveY: 0,
  lookX: 0,
  lookY: 0,
  setMove: (moveX, moveY) => set({ moveX, moveY }),
  setLook: (lookX, lookY) => set({ lookX, lookY }),
  reset: () => set({ moveX: 0, moveY: 0, lookX: 0, lookY: 0 }),
}));
