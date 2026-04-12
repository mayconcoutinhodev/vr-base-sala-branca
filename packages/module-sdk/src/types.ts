// ─── Module types ────────────────────────────────────────────────────────────

export type ModuleType = 'experience' | 'system' | 'hybrid';

export type ModuleStatus =
  | 'discovered'
  | 'loaded'
  | 'setup'
  | 'mounted'
  | 'unmounted'
  | 'disposed'
  | 'error';

// ─── Manifest ────────────────────────────────────────────────────────────────

export interface VRModuleManifest {
  id: string;
  name: string;
  version: string;
  type: ModuleType;
  description?: string;
  author?: string;
  dependencies?: string[];
  entry: string;
  enabledByDefault?: boolean;
}

// ─── Context services (passed to every lifecycle hook) ────────────────────────

export interface SceneController {
  createModuleGroup(moduleId: string): unknown;
  addToActiveGroup(group: unknown): void;
  removeModuleGroup(moduleId: string): void;
}

export interface UIPanel {
  id: string;
  title: string;
  [key: string]: unknown;
}

export interface UIController {
  mountPanel(panel: UIPanel): void;
  unmountPanel(id: string): void;
}

export interface XRController {
  getStatus(): XRStatus;
  enter(): Promise<void>;
  exit(): Promise<void>;
}

export type XRStatus =
  | 'unsupported'
  | 'available'
  | 'entering'
  | 'active'
  | 'exiting'
  | 'error';

export interface AssetController {
  preload(path: string): Promise<void>;
  get<T>(path: string): T | undefined;
  dispose(path: string): void;
}

export interface Logger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

export interface ServiceRegistry {
  get<T>(name: string): T;
  register<T>(name: string, service: T): void;
}

export interface AppStore {
  getState(): AppState;
  setState(updater: (state: AppState) => void): void;
  subscribe(listener: (state: AppState) => void): () => void;
}

export interface AppState {
  activeModule: string | null;
  xrStatus: XRStatus;
  isInVR: boolean;
  isLoading: boolean;
  globalError: string | null;
  [key: string]: unknown;
}

// ─── Event bus ────────────────────────────────────────────────────────────────

export interface AppEvents {
  'module:mounted': { moduleId: string };
  'module:unmounted': { moduleId: string };
  'module:error': { moduleId: string; error: unknown };
  'scene:change': { from?: string; to: string };
  'xr:entered': Record<string, never>;
  'xr:exited': Record<string, never>;
  'loading:start': { label?: string };
  'loading:end': { label?: string };
}

export type AppEventName = keyof AppEvents;
export type AppEventPayload<K extends AppEventName> = AppEvents[K];

export interface EventBus {
  emit<K extends AppEventName>(event: K, payload: AppEvents[K]): void;
  on<K extends AppEventName>(
    event: K,
    handler: (payload: AppEvents[K]) => void,
  ): () => void;
  off<K extends AppEventName>(
    event: K,
    handler: (payload: AppEvents[K]) => void,
  ): void;
}

// ─── Input ───────────────────────────────────────────────────────────────────

export type InputAction =
  | 'grab'
  | 'release'
  | 'teleport'
  | 'openMenu'
  | 'interact'
  | 'confirm'
  | 'cancel';

// ─── Module contract ──────────────────────────────────────────────────────────

export interface VRModuleContext {
  services: ServiceRegistry;
  events: EventBus;
  store: AppStore;
  scene: SceneController;
  ui: UIController;
  xr: XRController;
  assets: AssetController;
  logger: Logger;
}

export interface VRModule {
  manifest: VRModuleManifest;
  setup?(ctx: VRModuleContext): Promise<void> | void;
  mount?(ctx: VRModuleContext): Promise<void> | void;
  unmount?(ctx: VRModuleContext): Promise<void> | void;
  dispose?(ctx: VRModuleContext): Promise<void> | void;
}

// ─── Registry entry ───────────────────────────────────────────────────────────

export interface RegisteredModule {
  manifest: VRModuleManifest;
  status: ModuleStatus;
  instance?: VRModule;
  error?: unknown;
}
