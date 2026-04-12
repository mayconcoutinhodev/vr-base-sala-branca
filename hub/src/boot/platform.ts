import { createVRPlatform } from '@vr/core';
import type { VRPlatform, ModuleImportMap } from '@vr/core';

import { manifest as hubWorldManifest } from '@vr/module-hub-world';
import { manifest as trainingRoomManifest } from '@vr/module-training-room';
import { manifest as inventoryManifest } from '@vr/module-inventory';

/**
 * Dynamic import map — the hub app (not the core) owns which modules exist.
 * Core only knows about the abstract contract (architecture §3.1).
 */
const importMap: ModuleImportMap = {
  'hub-world': () => import('@vr/module-hub-world'),
  'training-room': () => import('@vr/module-training-room'),
  inventory: () => import('@vr/module-inventory'),
};

/**
 * Singleton platform instance.
 * Initialized once during app boot — never recreated.
 */
let platform: VRPlatform | null = null;

export function getPlatform(): VRPlatform {
  if (!platform) {
    platform = createVRPlatform(
      [
        hubWorldManifest,
        inventoryManifest,     // inventory before training-room (is a dependency)
        trainingRoomManifest,
      ],
      importMap,
    );
  }
  return platform;
}
