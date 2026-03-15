/**
 * DataStreamEngine: Unified data aggregation engine
 *
 * Orchestrates all adapters, manages refresh cycles,
 * and exposes a single reactive state for the OSINT dashboard.
 */

import {
  EntityType,
  type DataAdapter,
  type SituationalEntity,
  type DataStreamState,
} from "./types";

type Listener = (state: DataStreamState) => void;

export class DataStreamEngine {
  private adapters: Map<string, DataAdapter> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private state: DataStreamState;
  private listeners: Set<Listener> = new Set();
  private running = false;

  constructor() {
    this.state = {
      entities: new Map(),
      lastUpdate: {} as Record<EntityType, number>,
      errors: {},
      adapterHealth: {},
    };
  }

  /** Register a data adapter */
  register(adapter: DataAdapter): this {
    this.adapters.set(adapter.name, adapter);
    return this;
  }

  /** Start all adapter polling loops */
  start(): void {
    if (this.running) return;
    this.running = true;

    for (const [name, adapter] of this.adapters) {
      // Immediate first fetch
      this.fetchAdapter(name, adapter);

      // Set up interval
      const timer = setInterval(
        () => this.fetchAdapter(name, adapter),
        adapter.refreshIntervalMs
      );
      this.timers.set(name, timer);
    }
  }

  /** Stop all polling */
  stop(): void {
    this.running = false;
    for (const timer of this.timers.values()) {
      clearInterval(timer);
    }
    this.timers.clear();
  }

  /** Force refresh a specific adapter */
  async refresh(adapterName?: string): Promise<void> {
    if (adapterName) {
      const adapter = this.adapters.get(adapterName);
      if (adapter) await this.fetchAdapter(adapterName, adapter);
    } else {
      const fetches = Array.from(this.adapters.entries()).map(
        ([name, adapter]) => this.fetchAdapter(name, adapter)
      );
      await Promise.allSettled(fetches);
    }
  }

  /** Subscribe to state changes */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    // Immediately emit current state
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  /** Get current snapshot */
  getState(): DataStreamState {
    return this.state;
  }

  /** Get entities filtered by type */
  getEntitiesByType(type: EntityType): SituationalEntity[] {
    return Array.from(this.state.entities.values()).filter(e => e.type === type);
  }

  /** Get all entities as array */
  getAllEntities(): SituationalEntity[] {
    return Array.from(this.state.entities.values());
  }

  // ─── Internal ──────────────────────────────────────────────

  private async fetchAdapter(name: string, adapter: DataAdapter): Promise<void> {
    try {
      const entities = await adapter.fetch();

      // Upsert entities
      for (const entity of entities) {
        this.state.entities.set(entity.id, entity);
      }

      // Prune stale entities from this adapter (older than 2x refresh interval)
      const staleThreshold = Date.now() - adapter.refreshIntervalMs * 2;
      for (const [id, entity] of this.state.entities) {
        if (entity.source === name && entity.timestamp < staleThreshold) {
          // Keep financial entities longer (they don't disappear)
          if (entity.type !== EntityType.FINANCIAL) {
            this.state.entities.delete(id);
          }
        }
      }

      this.state.lastUpdate[adapter.type] = Date.now();
      this.state.adapterHealth[name] = true;
      delete this.state.errors[name];

      this.notify();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.state.errors[name] = msg;
      this.state.adapterHealth[name] = false;
      console.error(`[DataStreamEngine] ${name} fetch failed:`, msg);
      this.notify();
    }
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (err) {
        console.error("[DataStreamEngine] Listener error:", err);
      }
    }
  }
}
