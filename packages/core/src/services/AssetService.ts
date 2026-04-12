import type { AssetController } from '@vr/module-sdk';

/**
 * Prevents duplicate fetches and provides a simple dispose mechanism.
 * Extend with Three.js TextureLoader / GLTFLoader as needed.
 */
export class AssetService implements AssetController {
  private cache = new Map<string, unknown>();
  private loading = new Map<string, Promise<unknown>>();

  async preload(path: string): Promise<void> {
    if (this.cache.has(path) || this.loading.has(path)) return;

    const promise = fetch(path)
      .then((r) => r.blob())
      .then((blob) => {
        this.cache.set(path, blob);
        this.loading.delete(path);
      });

    this.loading.set(path, promise);
    await promise;
  }

  get<T>(path: string): T | undefined {
    return this.cache.get(path) as T | undefined;
  }

  dispose(path: string): void {
    this.cache.delete(path);
    this.loading.delete(path);
  }

  disposeAll(): void {
    this.cache.clear();
    this.loading.clear();
  }
}
