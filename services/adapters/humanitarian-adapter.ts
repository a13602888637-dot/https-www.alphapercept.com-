/**
 * HumanitarianAdapter: Crisis & disaster event data
 *
 * Data flow:
 *   ReliefWeb reports -> /api/reliefweb
 *
 * All outputs normalized to HumanitarianEntity[]
 */

import {
  EntityType,
  Severity,
  type DataAdapter,
  type HumanitarianEntity,
  type Coordinates,
} from "../types";

// ─── Rough country -> coordinates lookup for top crisis countries ─

const COUNTRY_COORDS: Record<string, Coordinates> = {
  "Afghanistan":               { lat: 33.93, lng: 67.71 },
  "Bangladesh":                { lat: 23.68, lng: 90.36 },
  "Burkina Faso":              { lat: 12.24, lng: -1.56 },
  "Cameroon":                  { lat: 7.37,  lng: 12.35 },
  "Central African Republic":  { lat: 6.61,  lng: 20.94 },
  "Chad":                      { lat: 15.45, lng: 18.73 },
  "Colombia":                  { lat: 4.57,  lng: -74.30 },
  "Democratic Republic of the Congo": { lat: -4.04, lng: 21.76 },
  "DRC":                       { lat: -4.04, lng: 21.76 },
  "Ethiopia":                  { lat: 9.15,  lng: 40.49 },
  "Haiti":                     { lat: 18.97, lng: -72.29 },
  "India":                     { lat: 20.59, lng: 78.96 },
  "Indonesia":                 { lat: -0.79, lng: 113.92 },
  "Iraq":                      { lat: 33.22, lng: 43.68 },
  "Libya":                     { lat: 26.34, lng: 17.23 },
  "Mali":                      { lat: 17.57, lng: -4.00 },
  "Mozambique":                { lat: -18.67, lng: 35.53 },
  "Myanmar":                   { lat: 21.91, lng: 95.96 },
  "Niger":                     { lat: 17.61, lng: 8.08 },
  "Nigeria":                   { lat: 9.08,  lng: 7.49 },
  "Pakistan":                  { lat: 30.38, lng: 69.35 },
  "Philippines":               { lat: 12.88, lng: 121.77 },
  "Somalia":                   { lat: 5.15,  lng: 46.20 },
  "South Sudan":               { lat: 6.88,  lng: 31.31 },
  "Sudan":                     { lat: 12.86, lng: 30.22 },
  "Syria":                     { lat: 34.80, lng: 38.99 },
  "Turkey":                    { lat: 38.96, lng: 35.24 },
  "Turkiye":                   { lat: 38.96, lng: 35.24 },
  "Ukraine":                   { lat: 48.38, lng: 31.17 },
  "Venezuela":                 { lat: 6.42,  lng: -66.59 },
  "Yemen":                     { lat: 15.55, lng: 48.52 },
};

// ─── Severity from disaster type ────────────────────────────

function disasterSeverity(disasterType: string): Severity {
  const t = disasterType.toLowerCase();
  if (t.includes("earthquake") || t.includes("tsunami") || t.includes("cyclone")) {
    return Severity.HIGH;
  }
  if (t.includes("flood") || t.includes("hurricane") || t.includes("typhoon")) {
    return Severity.MEDIUM;
  }
  if (t.includes("drought") || t.includes("famine") || t.includes("epidemic")) {
    return Severity.HIGH;
  }
  if (t.includes("conflict") || t.includes("war")) {
    return Severity.HIGH;
  }
  return Severity.MEDIUM;
}

// ─── Adapter Implementation ─────────────────────────────────

export class HumanitarianAdapter implements DataAdapter<HumanitarianEntity> {
  readonly name = "humanitarian";
  readonly type = EntityType.HUMANITARIAN;
  readonly refreshIntervalMs = 1_800_000; // 30 min

  async fetch(): Promise<HumanitarianEntity[]> {
    try {
      const res = await fetch("/api/reliefweb", {
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return [];

      const data = await res.json();
      if (!data.success || !Array.isArray(data.reports)) return [];

      const now = Date.now();

      return data.reports.map((report: any): HumanitarianEntity => {
        const country = report.country || "Unknown";
        const disasterType = report.disasterType || report.type || "unknown";
        const severity = disasterSeverity(disasterType);
        const coords = COUNTRY_COORDS[country] || null;

        return {
          id: `humanitarian-${report.id || `${country}-${now}`}`,
          type: EntityType.HUMANITARIAN,
          subtype: disasterType.toLowerCase().includes("outbreak") || disasterType.toLowerCase().includes("epidemic")
            ? "outbreak"
            : "crisis",
          label: report.title || `${country}: ${disasterType}`,
          coordinates: coords,
          value: null,
          delta: null,
          deltaPercent: null,
          status: severity === Severity.HIGH ? "warning" : "active",
          metadata: {
            title: report.title || "",
            country,
            disasterType,
            url: report.url || "",
            tradingSignal: severity === Severity.HIGH || severity === Severity.CRITICAL
              ? "bearish"
              : "neutral",
          },
          source: "reliefweb",
          timestamp: now,
        };
      });
    } catch (err) {
      console.warn("HumanitarianAdapter: fetch failed:", err);
      return [];
    }
  }

  async isHealthy(): Promise<boolean> {
    return true;
  }
}
