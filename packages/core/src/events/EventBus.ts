import type {
  AppEventName,
  AppEvents,
  EventBus as IEventBus,
} from '@vr/module-sdk';

type Handler<K extends AppEventName> = (payload: AppEvents[K]) => void;

/**
 * Typed event bus for core ↔ module communication.
 * Modules communicate through events, never through direct imports.
 */
export class EventBus implements IEventBus {
  private listeners = new Map<AppEventName, Set<Handler<AppEventName>>>();

  emit<K extends AppEventName>(event: K, payload: AppEvents[K]): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    for (const handler of handlers) {
      try {
        (handler as Handler<K>)(payload);
      } catch (err) {
        console.error(`[EventBus] Error in handler for "${event}":`, err);
      }
    }
  }

  on<K extends AppEventName>(
    event: K,
    handler: Handler<K>,
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as Handler<AppEventName>);
    return () => this.off(event, handler);
  }

  off<K extends AppEventName>(event: K, handler: Handler<K>): void {
    this.listeners.get(event)?.delete(handler as Handler<AppEventName>);
  }

  /** Remove all listeners. Call on app teardown. */
  clear(): void {
    this.listeners.clear();
  }
}
