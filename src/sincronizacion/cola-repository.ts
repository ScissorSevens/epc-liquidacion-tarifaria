/**
 * Repository de la cola de sincronización.
 * Interface + implementación in-memory.
 * Después se enchufará una implementación SQLite (expo-sqlite) sin tocar la lógica.
 */

import type { ItemCola } from './types';

export interface ColaSincronizacion {
  guardar(item: ItemCola): Promise<void>;
  listar(): Promise<ItemCola[]>;
  listarPendientes(): Promise<ItemCola[]>;
  buscarPorId(id: string): Promise<ItemCola | null>;
}

export class InMemoryColaSincronizacion implements ColaSincronizacion {
  private items = new Map<string, ItemCola>();

  async guardar(item: ItemCola): Promise<void> {
    this.items.set(item.id, item);
  }

  async listar(): Promise<ItemCola[]> {
    return Array.from(this.items.values());
  }

  async listarPendientes(): Promise<ItemCola[]> {
    return Array.from(this.items.values()).filter((i) => i.estado === 'PENDIENTE');
  }

  async buscarPorId(id: string): Promise<ItemCola | null> {
    return this.items.get(id) ?? null;
  }
}
