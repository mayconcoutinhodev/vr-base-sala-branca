import type { VRModule } from '@vr/module-sdk';

/**
 * Type alias for a lazy module importer.
 * The concrete import map lives in the hub app — core has no knowledge of
 * specific modules (architecture §3.1).
 */
export type ModuleImporter = () => Promise<{ default: VRModule }>;
export type ModuleImportMap = Record<string, ModuleImporter>;
