import { create } from 'zustand';

export type SceneName = 'hub' | 'test-lab' | 'training-room' | 'inventory';

interface SceneStore {
  active: SceneName;
  setActive: (scene: SceneName) => void;
}

export const useSceneStore = create<SceneStore>((set) => ({
  active: 'hub',
  setActive: (scene) => set({ active: scene }),
}));
