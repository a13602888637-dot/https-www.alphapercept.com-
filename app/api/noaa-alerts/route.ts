export const dynamic = "force-dynamic";

interface WeatherAlert {
  id: string;
  event: string;
  severity: string;
  headline: string;
  description: string;
  areaDesc: string;
  onset: string | null;
  expires: string | null;
  senderName: string;
}

let cache: { alerts: WeatherAlert[] } | null = null;
let cacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function getMockData(): WeatherAlert[] {
  return [
    {
      id: "urn:oid:2.49.0.1.840.0.mock.1",
      event: "Tornado Warning",
      severity: "Extreme",
      headline: "Tornado Warning issued for Central Oklahoma",
      description:
        "The National Weather Service has issued a Tornado Warning for central Oklahoma. Seek shelter immediately in a sturdy building.",
      areaDesc: "Oklahoma County, OK",
      onset: new Date().toISOString(),
      expires: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      senderName: "NWS Norman OK",
    },
    {
      id: "urn:oid:2.49.0.1.840.0.mock.2",
      event: "Hurricane Warning",
      severity: "Extreme",
      headline: "Hurricane Warning for Southeast Florida Coast",
      description:
        "A Hurricane Warning is in effect for the southeast Florida coast. Hurricane conditions expected within 36 hours.",
      areaDesc: "Miami-Dade County, FL",
      onset: new Date().toISOString(),
      expires: new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString(),
      senderName: "NWS Miami FL",
    },
    {
      id: "urn:oid:2.49.0.1.840.0.mock.3",
      event: "Severe Thunderstorm Warning",
      severity: "Severe",
      headline: "Severe Thunderstorm Warning for North Texas",
      description:
        "Severe thunderstorms capable of producing large hail and damaging winds are expected across north Texas.",
      areaDesc: "Dallas County, TX; Tarrant County, TX",
      onset: new Date().toISOString(),
      expires: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(),
      senderName: "NWS Fort Worth TX",
    },
  ];
}

export async function GET() {
  try {
    const now = Date.now();
    if (cache && now - cacheTime < CACHE_DURATION) {
      return Response.json({ success: true, alerts: cache.alerts });
    }

    let res: Response;
    try {
      res = await fetch(
        "https://api.weather.gov/alerts/active?status=actual&message_type=alert",
        {
          headers: {
            "User-Agent": "AlphaQuantCopilot/1.0 (contact@alphaquant.dev)",
            Accept: "application/geo+json",
          },
          signal: AbortSignal.timeout(10000),
        }
      );
    } catch {
      const alerts = getMockData();
      return Response.json({ success: true, alerts, source: "mock" });
    }

    if (!res.ok) {
      const alerts = getMockData();
      return Response.json({ success: true, alerts, source: "mock" });
    }

    const json = await res.json();
    const features = json.features ?? [];

    const filtered = features
      .filter((f: { properties: { severity: string } }) => {
        const sev = f.properties?.severity;
        return sev === "Extreme" || sev === "Severe";
      })
      .slice(0, 30);

    const alerts: WeatherAlert[] = filtered.map(
      (f: {
        properties: {
          id: string;
          event: string;
          severity: string;
          headline: string;
          description: string;
          areaDesc: string;
          onset: string | null;
          expires: string | null;
          senderName: string;
        };
      }) => {
        const p = f.properties;
        return {
          id: p.id ?? "",
          event: p.event ?? "",
          severity: p.severity ?? "",
          headline: p.headline ?? "",
          description: (p.description ?? "").slice(0, 500),
          areaDesc: p.areaDesc ?? "",
          onset: p.onset ?? null,
          expires: p.expires ?? null,
          senderName: p.senderName ?? "",
        };
      }
    );

    cache = { alerts };
    cacheTime = now;

    return Response.json({ success: true, alerts });
  } catch (error) {
    console.error("NOAA Alerts API error:", error);
    return Response.json(
      { success: false, error: "Failed to fetch NOAA alerts" },
      { status: 500 }
    );
  }
}
