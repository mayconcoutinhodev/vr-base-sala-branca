import type { ServiceRegistry as IServiceRegistry } from '@vr/module-sdk';

/**
 * Central registry for all core services.
 * Modules call ctx.services.get<T>(name) — never import internals directly.
 */
export class ServiceRegistry implements IServiceRegistry {
  private registry = new Map<string, unknown>();

  register<T>(name: string, service: T): void {
    if (this.registry.has(name)) {
      throw new Error(`Service already registered: ${name}`);
    }
    this.registry.set(name, service);
  }

  get<T>(name: string): T {
    const service = this.registry.get(name);
    if (!service) throw new Error(`Service not found: ${name}`);
    return service as T;
  }

  has(name: string): boolean {
    return this.registry.has(name);
  }
}
