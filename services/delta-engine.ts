/**
 * Delta Change Detection Engine
 * Detects meaningful changes between data scans and generates DeltaEvents
 */
import { type SituationalEntity, type DeltaEvent, EntityType, Severity } from "./types";

const THRESHOLDS: Record<string, { medium: number; high: number; critical: number }> = {
  VIXCLS: { medium: 3, high: 5, critical: 8 },
  DGS10: { medium: 2, high: 3, critical: 5 },
  WTI: { medium: 3, high: 5, critical: 8 },
  GOLD: { medium: 2, high: 3, critical: 5 },
  DEFAULT: { medium: 3, high: 5, critical: 10 },
};

export class DeltaEngine {
  private previousState: Map<string, SituationalEntity> = new Map();

  detect(currentEntities: SituationalEntity[]): DeltaEvent[] {
    const events: DeltaEvent[] = [];
    const currentMap = new Map(currentEntities.map(e => [e.id, e]));

    // Check for new entities
    for (const [id, entity] of currentMap) {
      const prev = this.previousState.get(id);
      if (!prev) {
        if (entity.type === EntityType.GEO_CONFLICT || entity.type === EntityType.HUMANITARIAN) {
          events.push({
            id: `delta-new-${id}-${Date.now()}`,
            entityType: entity.type,
            changeType: "new",
            field: "entity",
            oldValue: null,
            newValue: entity.label,
            severity: Severity.MEDIUM,
            timestamp: Date.now(),
            description: `New: ${entity.label}`,
            tradingSignal: entity.type === EntityType.GEO_CONFLICT ? "bearish" : "neutral",
          });
        }
        continue;
      }

      // Check value changes
      if (entity.value != null && prev.value != null && entity.value !== prev.value) {
        const changePct = Math.abs((entity.value - prev.value) / prev.value * 100);
        const thresholdKey = (entity.metadata as any)?.seriesId || (entity.metadata as any)?.symbol || "DEFAULT";
        const threshold = THRESHOLDS[thresholdKey] || THRESHOLDS.DEFAULT;

        let severity = Severity.LOW;
        if (changePct >= threshold.critical) severity = Severity.CRITICAL;
        else if (changePct >= threshold.high) severity = Severity.HIGH;
        else if (changePct >= threshold.medium) severity = Severity.MEDIUM;

        if (severity !== Severity.LOW) {
          const direction = entity.value > prev.value ? "up" : "down";
          events.push({
            id: `delta-change-${id}-${Date.now()}`,
            entityType: entity.type,
            changeType: "value_change",
            field: "value",
            oldValue: prev.value,
            newValue: entity.value,
            severity,
            timestamp: Date.now(),
            description: `${entity.label} ${direction} ${changePct.toFixed(1)}%`,
            tradingSignal: direction === "up" && thresholdKey === "VIXCLS" ? "bearish" : direction === "down" && thresholdKey === "VIXCLS" ? "bullish" : "neutral",
          });
        }
      }
    }

    // Check for removed entities (conflicts resolving)
    for (const [id, prev] of this.previousState) {
      if (!currentMap.has(id) && prev.type === EntityType.GEO_CONFLICT) {
        events.push({
          id: `delta-removed-${id}-${Date.now()}`,
          entityType: prev.type,
          changeType: "removed",
          field: "entity",
          oldValue: prev.label,
          newValue: null,
          severity: Severity.LOW,
          timestamp: Date.now(),
          description: `Resolved: ${prev.label}`,
          tradingSignal: "bullish",
        });
      }
    }

    // Update state
    this.previousState = currentMap;

    // Sort by severity (critical first)
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    events.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return events;
  }

  reset(): void {
    this.previousState.clear();
  }
}
