import { createStore } from 'zustand/vanilla';
import type { AppState, AppStore as IAppStore, XRStatus } from '@vr/module-sdk';

const initialState: AppState = {
  activeModule: null,
  xrStatus: 'available' as XRStatus,
  isInVR: false,
  isLoading: false,
  globalError: null,
};

/**
 * Thin Zustand-backed store exposed as the AppStore interface.
 * Modules receive this via VRModuleContext and must not bypass it.
 */
export class AppStore implements IAppStore {
  private store = createStore<AppState>(() => ({ ...initialState }));

  getState(): AppState {
    return this.store.getState();
  }

  setState(updater: (state: AppState) => void): void {
    this.store.setState((prev) => {
      const draft = { ...prev };
      updater(draft);
      return draft;
    });
  }

  subscribe(listener: (state: AppState) => void): () => void {
    return this.store.subscribe(listener);
  }

  /** Reset to initial values — useful for testing. */
  reset(): void {
    this.store.setState({ ...initialState });
  }
}
