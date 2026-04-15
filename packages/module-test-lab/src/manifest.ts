import type { VRModuleManifest } from '@vr/module-sdk';

export const manifest: VRModuleManifest = {
  id: 'test-lab',
  name: 'Test Lab',
  version: '1.0.0',
  type: 'experience',
  description: 'Sala de testes de interação — hand tracking, gestos, toque.',
  entry: 'test-lab',
  enabledByDefault: true,
};
