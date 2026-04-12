import type { VRModuleContext } from '@vr/module-sdk';
import { EventBus } from '../events/EventBus';
import { AppStore } from '../store/AppStore';
import { ServiceRegistry } from '../services/ServiceRegistry';
import { LoggerService } from '../services/LoggerService';
import { AssetService } from '../services/AssetService';
import { UIService } from '../services/UIService';
import { SceneController } from '../scene/SceneController';
import { XRController } from '../xr/XRController';
import { ModuleRegistry } from '../runtime/ModuleRegistry';
import { CoreRuntime } from '../runtime/CoreRuntime';
import type { ModuleImportMap } from '../runtime/ModuleLoader';

export interface VRPlatform {
  runtime: CoreRuntime;
  scene: SceneController;
  store: AppStore;
  events: EventBus;
  modules: ModuleRegistry;
  services: ServiceRegistry;
  ui: UIService;
}

/**
 * Factory that wires every core piece together and returns the platform.
 * Called once from the Next.js boot entry.
 */
export function createVRPlatform(
  manifests: unknown[],
  importMap: ModuleImportMap = {},
): VRPlatform {
  // ── Infrastructure ────────────────────────────────────────────────────────
  const events = new EventBus();
  const store = new AppStore();
  const services = new ServiceRegistry();
  const logger = new LoggerService('[VR]');
  const assets = new AssetService();
  const scene = new SceneController();
  const xr = new XRController(store, events);
  const ui = new UIService();

  // Register services so modules can resolve them by name
  services.register('logger', logger);
  services.register('assets', assets);
  services.register('scene', scene);
  services.register('xr', xr);
  services.register('ui', ui);
  services.register('store', store);
  services.register('events', events);

  // ── Module registry ───────────────────────────────────────────────────────
  const modules = new ModuleRegistry();
  for (const m of manifests) {
    try {
      modules.register(m);
    } catch (err) {
      logger.warn(`Failed to register manifest: ${String(err)}`);
    }
  }

  // ── Shared context object passed to every module lifecycle ────────────────
  const ctx: VRModuleContext = {
    services,
    events,
    store,
    scene,
    ui,
    xr,
    assets,
    logger,
  };

  const runtime = new CoreRuntime(modules, services, ctx, importMap);

  return { runtime, scene, store, events, modules, services, ui };
}
