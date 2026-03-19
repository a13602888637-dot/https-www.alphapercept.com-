export const dynamic = "force-dynamic";

interface ReliefWebReport {
  id: number;
  title: string;
  date: string | null;
  country: string | null;
  disasterType: string | null;
  url: string | null;
}

let cache: { reports: ReliefWebReport[] } | null = null;
let cacheTime = 0;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

function getMockData(): ReliefWebReport[] {
  return [
    {
      id: 1001,
      title: "Earthquake response update: Turkey-Syria border region",
      date: new Date().toISOString(),
      country: "Turkey",
      disasterType: "Earthquake",
      url: "https://reliefweb.int/report/mock-1001",
    },
    {
      id: 1002,
      title: "Flooding displaces thousands in Bangladesh",
      date: new Date().toISOString(),
      country: "Bangladesh",
      disasterType: "Flood",
      url: "https://reliefweb.int/report/mock-1002",
    },
    {
      id: 1003,
      title: "Drought conditions worsen across East Africa",
      date: new Date().toISOString(),
      country: "Kenya",
      disasterType: "Drought",
      url: "https://reliefweb.int/report/mock-1003",
    },
    {
      id: 1004,
      title: "Cyclone preparedness in the Bay of Bengal",
      date: new Date().toISOString(),
      country: "India",
      disasterType: "Cyclone",
      url: "https://reliefweb.int/report/mock-1004",
    },
    {
      id: 1005,
      title: "Humanitarian crisis deepens in Sudan conflict zones",
      date: new Date().toISOString(),
      country: "Sudan",
      disasterType: "Complex Emergency",
      url: "https://reliefweb.int/report/mock-1005",
    },
  ];
}

export async function GET() {
  try {
    const now = Date.now();
    if (cache && now - cacheTime < CACHE_DURATION) {
      return Response.json({ success: true, reports: cache.reports });
    }

    const url =
      "https://api.reliefweb.int/v1/reports?appname=alpha-quant&limit=20&preset=latest&fields[include][]=title&fields[include][]=date.created&fields[include][]=country.name&fields[include][]=disaster_type.name&fields[include][]=url";

    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    } catch {
      const reports = getMockData();
      return Response.json({ success: true, reports, source: "mock" });
    }

    if (!res.ok) {
      const reports = getMockData();
      return Response.json({ success: true, reports, source: "mock" });
    }

    const json = await res.json();
    const data = json.data ?? [];

    const reports: ReliefWebReport[] = data.map(
      (item: {
        id: number;
        fields: {
          title?: string;
          date?: { created?: string };
          country?: { name?: string }[];
          disaster_type?: { name?: string }[];
          url?: string;
        };
      }) => {
        const f = item.fields ?? {};
        return {
          id: item.id,
          title: f.title ?? "",
          date: f.date?.created ?? null,
          country: f.country?.[0]?.name ?? null,
          disasterType: f.disaster_type?.[0]?.name ?? null,
          url: f.url ?? null,
        };
      }
    );

    cache = { reports };
    cacheTime = now;

    return Response.json({ success: true, reports });
  } catch (error) {
    console.error("ReliefWeb API error:", error);
    return Response.json(
      { success: false, error: "Failed to fetch ReliefWeb data" },
      { status: 500 }
    );
  }
}
