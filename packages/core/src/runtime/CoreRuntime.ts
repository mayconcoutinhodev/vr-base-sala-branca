import type { VRModuleContext } from '@vr/module-sdk';
import type { ModuleRegistry } from './ModuleRegistry';
import type { ServiceRegistry } from '../services/ServiceRegistry';
import type { ModuleImportMap } from './ModuleLoader';

/**
 * Boot sequence and public API for activating/deactivating modules.
 *
 * Boot order (from architecture doc §9.1):
 *  1  React/Next shell initializes
 *  2  CoreRuntime.boot()
 *  3  ServiceRegistry.initBase()
 *  4  XR detection
 *  5  Manifest loading
 *  6  Dependency resolution
 *  7  Instantiate + setup enabled modules
 *  8  Mount hub-world
 *  9  User activates modules on demand
 */
export class CoreRuntime {
  private booted = false;

  constructor(
    private modules: ModuleRegistry,
    private services: ServiceRegistry,
    private ctx: VRModuleContext,
    private importMap: ModuleImportMap = {},
  ) {}

  async boot(): Promise<void> {
    if (this.booted) return;
    this.booted = true;

    // Step 3: base services are already registered by the caller before boot()
    // Step 4: XR detection
    const xr = this.ctx.xr;
    await (xr as unknown as { detect?: () => Promise<void> }).detect?.();

    // Steps 5-7: resolve deps then setup enabled modules
    this.modules.resolveDependencies();

    const enabled = this.modules.getEnabled();
    for (const manifest of enabled) {
      await this.loadAndSetup(manifest.id);
    }

    // Step 8: mount hub-world
    if (this.modules.get('hub-world')?.status === 'setup') {
      await this.activateModule('hub-world');
    }
  }

  async activateModule(moduleId: string): Promise<void> {
    const entry = this.modules.get(moduleId);
    if (!entry) throw new Error(`Unknown module: ${moduleId}`);
    if (entry.status === 'error') {
      this.ctx.logger.error(`Cannot activate broken module: ${moduleId}`);
      return;
    }

    // Lazy load if not yet instantiated
    if (entry.status === 'discovered') {
      await this.loadAndSetup(moduleId);
    }

    this.ctx.store.setState((s) => { s.isLoading = true; });
    try {
      await this.modules.mount(moduleId, this.ctx);
      this.ctx.store.setState((s) => {
        s.activeModule = moduleId;
        s.isLoading = false;
      });
      this.ctx.events.emit('module:mounted', { moduleId });
    } catch (err) {
      this.ctx.store.setState((s) => { s.isLoading = false; });
      this.ctx.events.emit('module:error', { moduleId, error: err });
      this.ctx.logger.error(`Failed to mount module: ${moduleId}`, {
        err: String(err),
      });
    }
  }

  async deactivateModule(moduleId: string): Promise<void> {
    try {
      await this.modules.unmount(moduleId, this.ctx);
      this.ctx.store.setState((s) => {
        if (s.activeModule === moduleId) s.activeModule = null;
      });
      this.ctx.events.emit('module:unmounted', { moduleId });
    } catch (err) {
      this.ctx.events.emit('module:error', { moduleId, error: err });
      this.ctx.logger.error(`Failed to unmount module: ${moduleId}`, {
        err: String(err),
      });
    }
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private async loadAndSetup(moduleId: string): Promise<void> {
    const importer = this.importMap[moduleId];
    if (!importer) {
      this.ctx.logger.warn(`No importer found for: ${moduleId}`);
      return;
    }

    try {
      await this.modules.instantiate(moduleId, importer);
      await this.modules.setup(moduleId, this.ctx);
    } catch (err) {
      this.ctx.logger.error(`Failed to load/setup module: ${moduleId}`, {
        err: String(err),
      });
    }
  }
}
