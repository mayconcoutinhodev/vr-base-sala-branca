import { manifest } from './manifest';
import type { VRModule, VRModuleContext } from '@vr/module-sdk';

const hubWorldModule: VRModule = {
  manifest,

  setup(ctx: VRModuleContext): void {
    ctx.logger.info('[hub-world] setup');
  },

  mount(ctx: VRModuleContext): void {
    ctx.logger.info('[hub-world] mount');

    const group = ctx.scene.createModuleGroup(manifest.id);
    ctx.scene.addToActiveGroup(group);

    ctx.ui.mountPanel({
      id: 'hub-panel',
      title: 'Hub Central',
      description: 'Escolha uma experiência para entrar.',
    });

    ctx.store.setState((s) => {
      s.activeModule = manifest.id;
    });

    ctx.events.emit('scene:change', { to: 'hub-world' });
  },

  unmount(ctx: VRModuleContext): void {
    ctx.logger.info('[hub-world] unmount');
    ctx.ui.unmountPanel('hub-panel');
    ctx.scene.removeModuleGroup(manifest.id);
  },

  dispose(ctx: VRModuleContext): void {
    ctx.logger.info('[hub-world] dispose');
  },
};

export default hubWorldModule;
export { manifest } from './manifest';
