/**
 * React hook for DataStreamEngine
 *
 * Usage:
 *   const { entities, financials, aviation, maritime, conflicts, errors } = useDataStream();
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { DataStreamEngine } from "./data-stream-engine";
import { FinanceAdapter } from "./adapters/finance-adapter";
import { AviationAdapter } from "./adapters/aviation-adapter";
import { MaritimeAdapter } from "./adapters/maritime-adapter";
import { GeoConflictAdapter } from "./adapters/geoconflict-adapter";
import { EntityType, type SituationalEntity, type DataStreamState } from "./types";

export interface DataStreamHook {
  entities: SituationalEntity[];
  financials: SituationalEntity[];
  aviation: SituationalEntity[];
  maritime: SituationalEntity[];
  conflicts: SituationalEntity[];
  errors: Record<string, string>;
  health: Record<string, boolean>;
  lastUpdate: Record<string, number>;
  isLoading: boolean;
  refresh: (adapter?: string) => Promise<void>;
}

export function useDataStream(): DataStreamHook {
  const engineRef = useRef<DataStreamEngine | null>(null);
  const [entities, setEntities] = useState<SituationalEntity[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [health, setHealth] = useState<Record<string, boolean>>({});
  const [lastUpdate, setLastUpdate] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const engine = new DataStreamEngine();

    // Register all adapters
    engine
      .register(new FinanceAdapter())
      .register(new AviationAdapter("taiwan_strait"))
      .register(new MaritimeAdapter(["malacca", "red_sea", "taiwan"]))
      .register(new GeoConflictAdapter());

    // Subscribe to state changes
    engine.subscribe((state: DataStreamState) => {
      setEntities(Array.from(state.entities.values()));
      setErrors({ ...state.errors });
      setHealth({ ...state.adapterHealth });
      setLastUpdate({ ...state.lastUpdate } as Record<string, number>);
      setIsLoading(false);
    });

    engine.start();
    engineRef.current = engine;

    return () => {
      engine.stop();
      engineRef.current = null;
    };
  }, []);

  const refresh = useCallback(async (adapter?: string) => {
    if (engineRef.current) {
      await engineRef.current.refresh(adapter);
    }
  }, []);

  const financials = entities.filter(e => e.type === EntityType.FINANCIAL);
  const aviation = entities.filter(e => e.type === EntityType.AVIATION);
  const maritime = entities.filter(e => e.type === EntityType.MARITIME);
  const conflicts = entities.filter(e => e.type === EntityType.GEO_CONFLICT);

  return {
    entities,
    financials,
    aviation,
    maritime,
    conflicts,
    errors,
    health,
    lastUpdate,
    isLoading,
    refresh,
  };
}
