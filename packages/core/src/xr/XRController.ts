import type { XRController as IXRController, XRStatus, AppStore } from '@vr/module-sdk';
import type { EventBus } from '../events/EventBus';

/**
 * Abstracts the raw WebXR API.
 * Modules call ctx.xr — they never touch navigator.xr directly.
 */
export class XRController implements IXRController {
  private status: XRStatus = 'available';

  constructor(
    private store: AppStore,
    private events: EventBus,
  ) {}

  /** Call during boot to detect real support. */
  async detect(): Promise<void> {
    if (!navigator.xr) {
      this.setStatus('unsupported');
      return;
    }

    const supported = await navigator.xr.isSessionSupported('immersive-vr');
    this.setStatus(supported ? 'available' : 'unsupported');
  }

  getStatus(): XRStatus {
    return this.status;
  }

  async enter(): Promise<void> {
    if (this.status !== 'available') return;

    this.setStatus('entering');
    try {
      // The actual session is managed by Three.js r.xr.
      // This layer just tracks state and fires events.
      this.setStatus('active');
      this.store.setState((s) => { s.isInVR = true; });
      this.events.emit('xr:entered', {});
    } catch (err) {
      this.setStatus('error');
      throw err;
    }
  }

  async exit(): Promise<void> {
    if (this.status !== 'active') return;

    this.setStatus('exiting');
    this.setStatus('available');
    this.store.setState((s) => { s.isInVR = false; });
    this.events.emit('xr:exited', {});
  }

  private setStatus(next: XRStatus): void {
    this.status = next;
    this.store.setState((s) => { s.xrStatus = next; });
  }
}
