import { manifest } from './manifest';
import type { VRModule, VRModuleContext } from '@vr/module-sdk';

const testLabModule: VRModule = {
  manifest,

  setup(ctx: VRModuleContext): void {
    ctx.logger.info('[test-lab] setup');
  },

  mount(ctx: VRModuleContext): void {
    ctx.logger.info('[test-lab] mount');
    ctx.store.setState((s) => { s.activeModule = manifest.id; });
    ctx.events.emit('scene:change', { to: 'test-lab' });
  },

  unmount(ctx: VRModuleContext): void {
    ctx.logger.info('[test-lab] unmount');
    ctx.scene.removeModuleGroup(manifest.id);
  },

  dispose(ctx: VRModuleContext): void {
    ctx.logger.info('[test-lab] dispose');
  },
};

export default testLabModule;
export { manifest } from './manifest';
