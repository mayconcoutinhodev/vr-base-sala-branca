import { manifest } from './manifest';
import { TargetSystem } from './systems/TargetSystem';
import type { VRModule, VRModuleContext } from '@vr/module-sdk';

const targets = new TargetSystem();

const trainingRoomModule: VRModule = {
  manifest,

  setup(ctx: VRModuleContext): void {
    ctx.logger.info('[training-room] setup');
  },

  mount(ctx: VRModuleContext): void {
    ctx.logger.info('[training-room] mount');

    const group = ctx.scene.createModuleGroup(manifest.id);
    ctx.scene.addToActiveGroup(group);

    ctx.ui.mountPanel({
      id: 'training-room-panel',
      title: 'Training Room',
      description: 'Alvos ativos. Pontue!',
    });

    ctx.store.setState((s) => {
      s.activeModule = manifest.id;
      s['trainingScore'] = 0;
    });

    targets.start();
    ctx.events.emit('scene:change', { to: 'training-room' });
  },

  unmount(ctx: VRModuleContext): void {
    ctx.logger.info('[training-room] unmount');
    targets.stop();
    ctx.ui.unmountPanel('training-room-panel');
    ctx.scene.removeModuleGroup(manifest.id);
  },

  dispose(ctx: VRModuleContext): void {
    ctx.logger.info('[training-room] dispose — score was', {
      score: String(targets.getScore()),
    });
  },
};

export default trainingRoomModule;
export { manifest } from './manifest';
