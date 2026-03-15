/**
 * Alpha-Quant-Copilot: Unified Situational Awareness Data Types
 *
 * All heterogeneous data sources (finance, aviation, maritime, geo-conflict)
 * are normalized into a single SituationalEntity interface for the OSINT dashboard.
 */

// ─── Core Enum ───────────────────────────────────────────────

export enum EntityType {
  FINANCIAL = "financial",
  AVIATION = "aviation",
  MARITIME = "maritime",
  GEO_CONFLICT = "geo_conflict",
  ALERT = "alert",
}

export enum Severity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

// ─── Unified Situational Entity ──────────────────────────────

export interface Coordinates {
  lat: number;
  lng: number;
  alt?: number; // altitude in meters (aviation)
}

export interface SituationalEntity {
  id: string;
  type: EntityType;
  subtype: string; // e.g. "index", "commodity", "cargo_ship", "fighter_jet", "armed_conflict"
  label: string; // display name
  coordinates: Coordinates | null; // null for non-spatial entities
  value: number | null; // price, altitude, speed, casualty count, etc.
  delta: number | null; // change amount
  deltaPercent: number | null; // change percentage
  status: string; // "up" | "down" | "neutral" | "active" | "resolved" | "warning"
  metadata: Record<string, unknown>; // source-specific extra fields
  source: string; // "finnhub" | "sina" | "opensky" | "aisstream" | "acled"
  timestamp: number; // unix ms
}

// ─── Financial subtypes ──────────────────────────────────────

export interface FinancialEntity extends SituationalEntity {
  type: EntityType.FINANCIAL;
  subtype: "index" | "commodity" | "fx" | "rate" | "stock";
  metadata: {
    symbol: string;
    region: string;
    currency?: string;
    exchange?: string;
    sparkline?: number[]; // recent price points for mini chart
  };
}

// ─── Aviation subtypes ───────────────────────────────────────

export interface AviationEntity extends SituationalEntity {
  type: EntityType.AVIATION;
  subtype: "commercial" | "military" | "cargo" | "unknown";
  metadata: {
    icao24: string;
    callsign: string;
    originCountry: string;
    velocity: number; // m/s
    heading: number; // degrees
    onGround: boolean;
    squawk?: string;
  };
}

// ─── Maritime subtypes ───────────────────────────────────────

export interface MaritimeEntity extends SituationalEntity {
  type: EntityType.MARITIME;
  subtype: "cargo" | "tanker" | "military" | "passenger" | "unknown";
  metadata: {
    mmsi: string;
    imo?: string;
    shipName: string;
    destination?: string;
    draught?: number;
    speed: number; // knots
    course: number; // degrees
    flag?: string;
  };
}

// ─── Geo-Conflict subtypes ───────────────────────────────────

export interface GeoConflictEntity extends SituationalEntity {
  type: EntityType.GEO_CONFLICT;
  subtype: "battle" | "protest" | "explosion" | "strategic_development" | "violence_against_civilians";
  metadata: {
    eventDate: string;
    country: string;
    region: string;
    actor1?: string;
    actor2?: string;
    fatalities: number;
    notes: string;
    sourceUrl?: string;
  };
}

// ─── Alert (cross-domain) ────────────────────────────────────

export interface AlertEntity extends SituationalEntity {
  type: EntityType.ALERT;
  subtype: "price_spike" | "route_deviation" | "conflict_escalation" | "system" | "ai_signal";
  metadata: {
    severity: Severity;
    headline: string;
    body: string;
    relatedEntityIds: string[];
    acknowledged: boolean;
  };
}

// ─── Data Adapter Interface ──────────────────────────────────

export interface DataAdapter<T extends SituationalEntity = SituationalEntity> {
  readonly name: string;
  readonly type: EntityType;
  readonly refreshIntervalMs: number;

  /** Fetch latest data, return normalized entities */
  fetch(): Promise<T[]>;

  /** Health check */
  isHealthy(): Promise<boolean>;
}

// ─── Data Stream Engine State ────────────────────────────────

export interface DataStreamState {
  entities: Map<string, SituationalEntity>;
  lastUpdate: Record<EntityType, number>; // last fetch timestamp per type
  errors: Record<string, string>; // adapter name -> last error
  adapterHealth: Record<string, boolean>;
}

// ─── Dashboard Layout Slot IDs ───────────────────────────────

export type DashboardSlot = "center" | "left" | "right" | "ticker";
