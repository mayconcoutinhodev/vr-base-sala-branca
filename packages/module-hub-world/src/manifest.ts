import type { VRModuleManifest } from '@vr/module-sdk';

export const manifest: VRModuleManifest = {
  id: 'hub-world',
  name: 'Hub World',
  version: '1.0.0',
  type: 'experience',
  description: 'Sala central que lista e dá acesso a todos os módulos.',
  entry: 'hub-world',
  enabledByDefault: true,
};
