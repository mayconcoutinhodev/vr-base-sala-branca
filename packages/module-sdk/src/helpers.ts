import type { VRModuleManifest } from './types';

/**
 * Type guard — checks if an object satisfies the minimum VRModule shape.
 */
export function isValidModule(mod: unknown): mod is { manifest: VRModuleManifest } {
  if (typeof mod !== 'object' || mod === null) return false;
  const m = mod as Record<string, unknown>;
  if (typeof m['manifest'] !== 'object' || m['manifest'] === null) return false;
  const manifest = m['manifest'] as Record<string, unknown>;
  return (
    typeof manifest['id'] === 'string' &&
    typeof manifest['name'] === 'string' &&
    typeof manifest['version'] === 'string' &&
    typeof manifest['type'] === 'string' &&
    typeof manifest['entry'] === 'string'
  );
}

/**
 * Validates a manifest object at runtime.
 * Throws if required fields are missing or invalid.
 */
export function validateManifest(manifest: unknown): VRModuleManifest {
  if (typeof manifest !== 'object' || manifest === null) {
    throw new Error('Manifest must be an object');
  }

  const m = manifest as Record<string, unknown>;

  const required = ['id', 'name', 'version', 'type', 'entry'] as const;
  for (const field of required) {
    if (typeof m[field] !== 'string' || m[field] === '') {
      throw new Error(`Manifest is missing required field: ${field}`);
    }
  }

  const validTypes = ['experience', 'system', 'hybrid'];
  if (!validTypes.includes(m['type'] as string)) {
    throw new Error(`Invalid module type: ${String(m['type'])}`);
  }

  if (m['dependencies'] !== undefined && !Array.isArray(m['dependencies'])) {
    throw new Error('Manifest dependencies must be an array');
  }

  return manifest as VRModuleManifest;
}

/**
 * Detects circular dependencies using DFS.
 * Returns the cycle path as a string if one is found, or null.
 */
export function detectCircularDependency(
  id: string,
  deps: Map<string, string[]>,
  visited = new Set<string>(),
  path: string[] = [],
): string | null {
  if (visited.has(id)) {
    const cycleStart = path.indexOf(id);
    return path.slice(cycleStart).concat(id).join(' → ');
  }

  visited.add(id);
  path.push(id);

  for (const dep of deps.get(id) ?? []) {
    const cycle = detectCircularDependency(dep, deps, visited, path);
    if (cycle) return cycle;
  }

  path.pop();
  visited.delete(id);
  return null;
}
