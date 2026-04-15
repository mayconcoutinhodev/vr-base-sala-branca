import { createVRPlatform } from '@vr/core';
import type { VRPlatform, ModuleImportMap } from '@vr/core';

import { manifest as hubWorldManifest }     from '@vr/module-hub-world';
import { manifest as testLabManifest }      from '@vr/module-test-lab';
import { manifest as trainingRoomManifest } from '@vr/module-training-room';
import { manifest as inventoryManifest }    from '@vr/module-inventory';

const importMap: ModuleImportMap = {
  'hub-world':     () => import('@vr/module-hub-world'),
  'test-lab':      () => import('@vr/module-test-lab'),
  'training-room': () => import('@vr/module-training-room'),
  inventory:       () => import('@vr/module-inventory'),
};

let platform: VRPlatform | null = null;

export function getPlatform(): VRPlatform {
  if (!platform) {
    platform = createVRPlatform(
      [
        hubWorldManifest,
        testLabManifest,
        inventoryManifest,
        trainingRoomManifest,
      ],
      importMap,
    );
  }
  return platform;
}
