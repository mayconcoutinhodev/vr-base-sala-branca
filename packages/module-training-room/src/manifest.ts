import type { VRModuleManifest } from '@vr/module-sdk';

export const manifest: VRModuleManifest = {
  id: 'training-room',
  name: 'Training Room',
  version: '1.0.0',
  type: 'experience',
  description: 'Sala de treino com alvos e pontuação.',
  dependencies: ['inventory'],
  entry: 'training-room',
  enabledByDefault: false,
};
