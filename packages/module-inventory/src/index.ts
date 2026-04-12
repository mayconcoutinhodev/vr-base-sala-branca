import { manifest } from './manifest';
import { InventoryStore } from './systems/InventoryStore';
import type { VRModule, VRModuleContext } from '@vr/module-sdk';

const inventoryStore = new InventoryStore();

const inventoryModule: VRModule = {
  manifest,

  setup(ctx: VRModuleContext): void {
    ctx.logger.info('[inventory] setup');
    // Register service so dependent modules can call:
    //   ctx.services.get<InventoryStore>('inventory')
    ctx.services.register('inventory', inventoryStore);
  },

  mount(ctx: VRModuleContext): void {
    ctx.logger.info('[inventory] mount');
    ctx.ui.mountPanel({
      id: 'inventory-overlay',
      title: 'Inventário',
    });
  },

  unmount(ctx: VRModuleContext): void {
    ctx.logger.info('[inventory] unmount');
    ctx.ui.unmountPanel('inventory-overlay');
  },

  dispose(ctx: VRModuleContext): void {
    ctx.logger.info('[inventory] dispose');
    inventoryStore.clear();
  },
};

export default inventoryModule;
export { manifest } from './manifest';
