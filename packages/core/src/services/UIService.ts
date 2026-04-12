import type { UIController, UIPanel } from '@vr/module-sdk';

/**
 * Manages panel registration from modules.
 * The React shell subscribes to panels via getPanels() or subscribe().
 */
export class UIService implements UIController {
  private panels = new Map<string, UIPanel>();
  private listeners = new Set<(panels: UIPanel[]) => void>();

  mountPanel(panel: UIPanel): void {
    this.panels.set(panel.id, panel);
    this.notify();
  }

  unmountPanel(id: string): void {
    this.panels.delete(id);
    this.notify();
  }

  getPanels(): UIPanel[] {
    return Array.from(this.panels.values());
  }

  subscribe(listener: (panels: UIPanel[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const panels = this.getPanels();
    for (const l of this.listeners) l(panels);
  }
}
