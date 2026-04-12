import type { VRModuleManifest } from '@vr/module-sdk';

export const manifest: VRModuleManifest = {
  id: 'inventory',
  name: 'Inventory',
  version: '1.0.0',
  type: 'system',
  description: 'Sistema de inventário transversal. Outros módulos podem declarar dependência aqui.',
  entry: 'inventory',
  enabledByDefault: true,
};
