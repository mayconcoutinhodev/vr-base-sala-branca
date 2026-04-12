export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
}

/**
 * In-memory inventory store.
 * Exposed via ctx.services.get<InventoryStore>('inventory') by other modules.
 */
export class InventoryStore {
  private items = new Map<string, InventoryItem>();

  add(item: InventoryItem): void {
    const existing = this.items.get(item.id);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      this.items.set(item.id, { ...item });
    }
  }

  remove(id: string, quantity = 1): boolean {
    const item = this.items.get(id);
    if (!item || item.quantity < quantity) return false;
    item.quantity -= quantity;
    if (item.quantity === 0) this.items.delete(id);
    return true;
  }

  get(id: string): InventoryItem | undefined {
    return this.items.get(id);
  }

  getAll(): InventoryItem[] {
    return Array.from(this.items.values());
  }

  clear(): void {
    this.items.clear();
  }
}
