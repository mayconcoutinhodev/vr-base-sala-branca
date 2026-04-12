import {
  validateManifest,
  detectCircularDependency,
} from '@vr/module-sdk';
import type {
  VRModuleManifest,
  VRModule,
  VRModuleContext,
  RegisteredModule,
  ModuleStatus,
} from '@vr/module-sdk';

/**
 * Heart of the pluggable system.
 *
 * Responsibilities:
 * - receive and validate manifests
 * - prevent duplicate IDs
 * - resolve & validate dependencies
 * - track module status
 * - block invalid/broken modules from affecting others
 */
export class ModuleRegistry {
  private modules = new Map<string, RegisteredModule>();

  // ─── Registration ─────────────────────────────────────────────────────────

  register(rawManifest: unknown): void {
    const manifest = validateManifest(rawManifest);

    if (this.modules.has(manifest.id)) {
      throw new Error(`Module already registered: ${manifest.id}`);
    }

    this.modules.set(manifest.id, { manifest, status: 'discovered' });
  }

  // ─── Dependency resolution ────────────────────────────────────────────────

  resolveDependencies(): void {
    const depMap = new Map<string, string[]>();

    for (const [id, mod] of this.modules) {
      depMap.set(id, mod.manifest.dependencies ?? []);
    }

    for (const [id] of this.modules) {
      const cycle = detectCircularDependency(id, depMap);
      if (cycle) {
        this.setError(id, new Error(`Circular dependency: ${cycle}`));
      }
    }

    // Check for missing deps
    for (const [id, mod] of this.modules) {
      if (mod.status === 'error') continue;
      for (const dep of mod.manifest.dependencies ?? []) {
        const depMod = this.modules.get(dep);
        if (!depMod || depMod.status === 'error') {
          this.setError(
            id,
            new Error(`Missing or broken dependency: ${dep}`),
          );
          break;
        }
      }
    }
  }

  // ─── Instantiation ────────────────────────────────────────────────────────

  async instantiate(
    moduleId: string,
    importer: () => Promise<{ default: VRModule }>,
  ): Promise<void> {
    const entry = this.getOrThrow(moduleId);
    if (entry.status === 'error') return;

    try {
      const imported = await importer();
      entry.instance = imported.default;
      entry.status = 'loaded';
    } catch (err) {
      this.setError(moduleId, err);
      throw err;
    }
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  async setup(moduleId: string, ctx: VRModuleContext): Promise<void> {
    const entry = this.getOrThrow(moduleId);
    if (!entry.instance) throw new Error(`Module not loaded: ${moduleId}`);

    try {
      await entry.instance.setup?.(ctx);
      entry.status = 'setup';
    } catch (err) {
      this.setError(moduleId, err);
      throw err;
    }
  }

  async mount(moduleId: string, ctx: VRModuleContext): Promise<void> {
    const entry = this.getOrThrow(moduleId);
    if (!entry.instance) throw new Error(`Module not loaded: ${moduleId}`);

    try {
      await entry.instance.mount?.(ctx);
      entry.status = 'mounted';
    } catch (err) {
      this.setError(moduleId, err);
      throw err;
    }
  }

  async unmount(moduleId: string, ctx: VRModuleContext): Promise<void> {
    const entry = this.modules.get(moduleId);
    if (!entry?.instance) return;

    try {
      await entry.instance.unmount?.(ctx);
      entry.status = 'unmounted';
    } catch (err) {
      this.setError(moduleId, err);
    }
  }

  async dispose(moduleId: string, ctx: VRModuleContext): Promise<void> {
    const entry = this.modules.get(moduleId);
    if (!entry?.instance) return;

    try {
      await entry.instance.dispose?.(ctx);
      entry.status = 'disposed';
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (entry as Partial<typeof entry>).instance;
    } catch (err) {
      this.setError(moduleId, err);
    }
  }

  // ─── Queries ──────────────────────────────────────────────────────────────

  getAll(): RegisteredModule[] {
    return Array.from(this.modules.values());
  }

  get(moduleId: string): RegisteredModule | undefined {
    return this.modules.get(moduleId);
  }

  getEnabled(): VRModuleManifest[] {
    return Array.from(this.modules.values())
      .filter(
        (m) => m.manifest.enabledByDefault && m.status !== 'error',
      )
      .map((m) => m.manifest);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private getOrThrow(moduleId: string): RegisteredModule {
    const entry = this.modules.get(moduleId);
    if (!entry) throw new Error(`Module not found: ${moduleId}`);
    return entry;
  }

  private setError(moduleId: string, err: unknown): void {
    const entry = this.modules.get(moduleId);
    if (entry) {
      entry.status = 'error' as ModuleStatus;
      entry.error = err;
    }
  }
}
