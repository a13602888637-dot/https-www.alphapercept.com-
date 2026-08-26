import type { RawStory } from "./story-service";

export interface ScheduledEventSourceHealth {
  name: string;
  ok: boolean;
  count: number;
  error: string | null;
}

export interface ScheduledEventFetchResult {
  stories: RawStory[];
  sources: ScheduledEventSourceHealth[];
}

const MAJOR_EARNINGS_SYMBOLS = new Set([
  "NVDA", "AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "META", "TSLA", "AMD", "AVGO",
  "ORCL", "NFLX", "CRM", "ADBE", "INTC", "QCOM", "MU", "TSM", "ASML", "ARM",
  "JPM", "BAC", "GS", "MS", "V", "MA", "WMT", "COST", "HD", "NKE",
  "XOM", "CVX", "LLY", "UNH", "JNJ", "PFE", "BA", "CAT", "GE", "DIS",
]);

interface ParseOptions {
  now: Date;
  days: number;
  sourceUrl: string;
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function decode(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\p{Script=Han}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 70);
}

function timeParts(value: string): { hour: number; minute: number } | null {
  const match = value.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)$/);
  if (!match) return null;
  let hour = Number(match[1]) % 12;
  if (match[3].startsWith("p")) hour += 12;
  return { hour, minute: Number(match[2] ?? 0) };
}

function zoneOffsetMs(timeZone: string, date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const represented = Date.UTC(
    Number(values.year), Number(values.month) - 1, Number(values.day),
    Number(values.hour), Number(values.minute), Number(values.second)
  );
  return represented - date.getTime();
}

function zonedLocalToIso(input: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  timeZone: string;
}): string {
  const localAsUtc = Date.UTC(input.year, input.month - 1, input.day, input.hour, input.minute, 0);
  let candidate = new Date(localAsUtc - zoneOffsetMs(input.timeZone, new Date(localAsUtc)));
  candidate = new Date(localAsUtc - zoneOffsetMs(input.timeZone, candidate));
  return candidate.toISOString();
}

function isFutureInWindow(scheduledFor: string, now: Date, days: number): boolean {
  const timestamp = Date.parse(scheduledFor);
  return Number.isFinite(timestamp) && timestamp >= now.getTime() - 5 * 60_000 && timestamp <= now.getTime() + days * 86_400_000;
}

function officialStory(input: {
  source: string;
  sourceUrl: string;
  title: string;
  description: string;
  scheduledFor: string;
  category: "宏观" | "科技";
  assets: string[];
  importance: number;
}): RawStory {
  return {
    sourceId: `scheduled:${slug(input.source)}:${input.scheduledFor}:${slug(input.title)}`,
    sourceName: input.source,
    sourceUrl: input.sourceUrl,
    title: input.title,
    originalTitle: input.title,
    description: input.description,
    publishedAt: input.scheduledFor,
    scheduledFor: input.scheduledFor,
    eventType: "upcoming",
    topicHints: ["未来事件", input.category, ...input.assets],
    preAnalyzed: true,
    importanceHint: input.importance,
  };
}

function fedTitle(baseTitle: string, detail: string, section: string): string {
  if (/FOMC Minutes/i.test(baseTitle)) return "美联储FOMC会议纪要";
  if (/FOMC Meeting/i.test(baseTitle) || /FOMC Meetings/i.test(section)) return "美联储FOMC利率决议";
  if (/Beige Book/i.test(baseTitle) || /Beige Book/i.test(section)) return "美联储Beige Book";
  const chairman = baseTitle.match(/(?:Speech|Discussion|Testimony)\s*-\s*Chairman\s+(.+)/i);
  if (chairman) return `美联储主席${chairman[1]}${detail ? `：${detail}` : "讲话"}`;
  const governor = baseTitle.match(/(?:Speech|Discussion|Testimony)\s*-\s*(?:Governor|Vice Chair(?: for Supervision)?)\s+(.+)/i);
  if (governor) return `美联储官员${governor[1]}${detail ? `：${detail}` : "讲话"}`;
  return `美联储${baseTitle}${detail ? `：${detail}` : ""}`;
}

export function parseFedCalendarHtml(
  html: string,
  options: ParseOptions & { year: number; month: number }
): RawStory[] {
  const events: RawStory[] = [];
  const rowPattern = /<div class="col-xs-2">\s*<p>([\s\S]*?)<\/p>\s*<\/div>[\s\S]*?<div class="col-xs-7">([\s\S]*?)<\/div>\s*<div class="col-xs-3">\s*<p>(\d{1,2})<\/p>/gi;
  for (const match of html.matchAll(rowPattern)) {
    const preceding = html.slice(0, match.index);
    const headings = [...preceding.matchAll(/<h4[^>]*>([\s\S]*?)<\/h4>/gi)];
    const section = decode(headings.at(-1)?.[1] ?? "");
    if (!/Speeches|FOMC Meetings|Beige Book/i.test(section)) continue;
    const time = timeParts(decode(match[1]));
    if (!time) continue;
    const paragraphs = [...match[2].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((paragraph) => decode(paragraph[1]))
      .filter((value) => value && !/Watch Live/i.test(value));
    const baseTitle = paragraphs[0] ?? section;
    const detail = paragraphs[1] && paragraphs[1] !== baseTitle ? paragraphs[1] : "";
    const title = fedTitle(baseTitle, detail, section);
    const scheduledFor = zonedLocalToIso({
      year: options.year,
      month: options.month,
      day: Number(match[3]),
      hour: time.hour,
      minute: time.minute,
      timeZone: "America/New_York",
    });
    if (!isFutureInWindow(scheduledFor, options.now, options.days)) continue;
    const chairman = /Chairman/i.test(title);
    const fomc = /FOMC Meeting/i.test(section);
    const beige = /Beige Book/i.test(section);
    events.push(officialStory({
      source: "Federal Reserve",
      sourceUrl: options.sourceUrl,
      title: decode(title),
      description: `${decode(paragraphs.slice(1).join("；") || section)}。关注利率路径、美元、美债与风险资产反应。`,
      scheduledFor,
      category: "宏观",
      assets: ["美债", "美元", "黄金"],
      importance: fomc ? 10 : chairman || beige ? 9 : 8,
    }));
  }
  return events;
}

const BLS_RULES: Array<{ pattern: RegExp; title: string; importance: number; assets: string[] }> = [
  { pattern: /^Employment Situation$/i, title: "美国非农就业报告", importance: 10, assets: ["美债", "美元", "黄金", "美股"] },
  { pattern: /^Consumer Price Index$/i, title: "美国CPI数据", importance: 10, assets: ["美债", "美元", "黄金"] },
  { pattern: /^Producer Price Index$/i, title: "美国PPI数据", importance: 9, assets: ["美债", "美元", "黄金"] },
  { pattern: /Job Openings and Labor Turnover/i, title: "美国JOLTS职位空缺", importance: 8, assets: ["美债", "美元"] },
  { pattern: /Employment Cost Index/i, title: "美国就业成本指数", importance: 8, assets: ["美债", "美元"] },
  { pattern: /^Productivity and Costs/i, title: "美国生产率与成本", importance: 7, assets: ["美债", "美元"] },
];

export function parseBlsCalendarIcs(ics: string, options: ParseOptions): RawStory[] {
  const unfolded = ics.replace(/\r?\n[ \t]/g, "");
  const events: RawStory[] = [];
  for (const block of unfolded.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? []) {
    const dateMatch = block.match(/DTSTART(?:;TZID=[^:]+)?:([0-9]{8})T([0-9]{6})/);
    const summary = block.match(/\nSUMMARY:(.+)/)?.[1]?.trim() ?? "";
    const rule = BLS_RULES.find((item) => item.pattern.test(summary));
    if (!dateMatch || !rule) continue;
    const date = dateMatch[1];
    const time = dateMatch[2];
    const scheduledFor = zonedLocalToIso({
      year: Number(date.slice(0, 4)), month: Number(date.slice(4, 6)), day: Number(date.slice(6, 8)),
      hour: Number(time.slice(0, 2)), minute: Number(time.slice(2, 4)), timeZone: "America/New_York",
    });
    if (!isFutureInWindow(scheduledFor, options.now, options.days)) continue;
    events.push(officialStory({
      source: "U.S. Bureau of Labor Statistics",
      sourceUrl: options.sourceUrl,
      title: rule.title,
      description: `${summary}按美东时间公布，可能影响美联储政策预期。`,
      scheduledFor,
      category: "宏观",
      assets: rule.assets,
      importance: rule.importance,
    }));
  }
  return events;
}

const BEA_RULES: Array<{ pattern: RegExp; title: string; importance: number; assets: string[] }> = [
  { pattern: /GDP/i, title: "美国GDP及企业利润", importance: 9, assets: ["美债", "美元", "美股"] },
  { pattern: /Personal Income and Outlays/i, title: "美国个人收入与PCE", importance: 10, assets: ["美债", "美元", "黄金"] },
  { pattern: /International Trade in Goods and Services/i, title: "美国国际贸易数据", importance: 7, assets: ["美元", "美债"] },
];

export function parseBeaScheduleHtml(
  html: string,
  options: ParseOptions & { year: number }
): RawStory[] {
  const events: RawStory[] = [];
  for (const row of html.match(/<tr class="scheduled-releases[^>]*>[\s\S]*?<\/tr>/gi) ?? []) {
    const monthDay = decode(row.match(/<div class="release-date">([\s\S]*?)<\/div>/i)?.[1] ?? "");
    const timeText = decode(row.match(/<small[^>]*>([\s\S]*?)<\/small>/i)?.[1] ?? "");
    const originalTitle = decode(row.match(/<td class="release-title[^>]*>([\s\S]*?)<\/td>/i)?.[1] ?? "");
    const rule = BEA_RULES.find((item) => item.pattern.test(originalTitle));
    const dateParts = monthDay.match(/^([A-Za-z]+)\s+(\d{1,2})$/);
    const time = timeParts(timeText);
    if (!rule || !dateParts || !time) continue;
    const month = MONTHS.indexOf(dateParts[1].toLowerCase()) + 1;
    if (month <= 0) continue;
    const scheduledFor = zonedLocalToIso({
      year: options.year, month, day: Number(dateParts[2]), hour: time.hour, minute: time.minute,
      timeZone: "America/New_York",
    });
    if (!isFutureInWindow(scheduledFor, options.now, options.days)) continue;
    events.push(officialStory({
      source: "U.S. Bureau of Economic Analysis",
      sourceUrl: options.sourceUrl,
      title: rule.title,
      description: `${originalTitle}，重点观察增长、通胀及政策预期变化。`,
      scheduledFor,
      category: "宏观",
      assets: rule.assets,
      importance: rule.importance,
    }));
  }
  return events;
}

function xmlTag(block: string, name: string): string {
  return decode(block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1] ?? "");
}

export function parseNvidiaPressRss(rss: string, options: ParseOptions): RawStory[] {
  const events: RawStory[] = [];
  for (const item of rss.match(/<item>[\s\S]*?<\/item>/gi) ?? []) {
    const title = xmlTag(item, "title");
    if (!/Sets Conference Call.*Financial Results/i.test(title)) continue;
    const description = `${xmlTag(item, "description")} ${xmlTag(item, "content")}`;
    const published = new Date(xmlTag(item, "pubDate"));
    const call = description.match(/on\s+(?:Monday|Tuesday|Wednesday|Thursday|Friday),?\s+([A-Za-z]+)\s+(\d{1,2}),\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\s*PT/i);
    if (!call || Number.isNaN(published.getTime())) continue;
    const month = MONTHS.indexOf(call[1].toLowerCase()) + 1;
    const callTime = timeParts(`${call[3]}:${call[4] ?? "00"} ${call[5]}`);
    if (month <= 0 || !callTime) continue;
    const sourceUrl = xmlTag(item, "link") || options.sourceUrl;
    const year = published.getUTCFullYear();
    const callScheduled = zonedLocalToIso({
      year, month, day: Number(call[2]), hour: callTime.hour, minute: callTime.minute,
      timeZone: "America/Los_Angeles",
    });
    const resultTime = description.match(/approximately\s+(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\s*PT/i);
    if (resultTime) {
      const parsed = timeParts(`${resultTime[1]}:${resultTime[2] ?? "00"} ${resultTime[3]}`);
      if (parsed) {
        const scheduledFor = zonedLocalToIso({ year, month, day: Number(call[2]), hour: parsed.hour, minute: parsed.minute, timeZone: "America/Los_Angeles" });
        if (isFutureInWindow(scheduledFor, options.now, options.days)) {
          events.push(officialStory({
            source: "NVIDIA IR", sourceUrl, title: "NVIDIA季度财务结果公布",
            description: "NVIDIA公布季度财务结果及CFO书面评论，关注数据中心、AI算力和业绩指引。",
            scheduledFor, category: "科技", assets: ["AI算力", "半导体", "美股科技"], importance: 10,
          }));
        }
      }
    }
    if (isFutureInWindow(callScheduled, options.now, options.days)) {
      events.push(officialStory({
        source: "NVIDIA IR", sourceUrl, title: "NVIDIA财报电话会",
        description: "NVIDIA管理层举行季度财报电话会，重点关注业绩指引、数据中心需求及新产品进度。",
        scheduledFor: callScheduled, category: "科技", assets: ["AI算力", "半导体", "美股科技"], importance: 10,
      }));
    }
  }
  return events.sort((left, right) => String(left.scheduledFor).localeCompare(String(right.scheduledFor)));
}

export function parseFinnhubEarningsCalendar(payload: unknown, options: ParseOptions): RawStory[] {
  const rows = Array.isArray((payload as { earningsCalendar?: unknown[] } | null)?.earningsCalendar)
    ? (payload as { earningsCalendar: Array<Record<string, unknown>> }).earningsCalendar
    : [];
  const events: RawStory[] = [];
  for (const row of rows) {
    const symbol = String(row.symbol ?? "").toUpperCase();
    const date = String(row.date ?? "");
    if (!MAJOR_EARNINGS_SYMBOLS.has(symbol) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const [year, month, day] = date.split("-").map(Number);
    const hourCode = String(row.hour ?? "").toLowerCase();
    const hour = hourCode === "bmo" ? 8 : hourCode === "dmh" ? 12 : 16;
    const scheduledFor = zonedLocalToIso({ year, month, day, hour, minute: 0, timeZone: "America/New_York" });
    if (!isFutureInWindow(scheduledFor, options.now, options.days)) continue;
    const eps = Number(row.epsEstimate);
    const revenue = Number(row.revenueEstimate);
    const timing = hourCode === "bmo" ? "美股盘前" : hourCode === "dmh" ? "美股盘中" : "美股盘后";
    events.push(officialStory({
      source: "Finnhub Earnings",
      sourceUrl: options.sourceUrl,
      title: `${symbol} 财报发布（${timing}）`,
      description: `${symbol} 预计公布季度财务结果${Number.isFinite(eps) ? `，市场EPS预期 ${eps}` : ""}${Number.isFinite(revenue) ? `，营收预期 ${(revenue / 1_000_000_000).toFixed(1)} 十亿美元` : ""}。`,
      scheduledFor,
      category: "科技",
      assets: [symbol, "美股", "财报"],
      importance: ["NVDA", "AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA"].includes(symbol) ? 10 : 8,
    }));
  }
  return events;
}

export function parseFinnhubIpoCalendar(payload: unknown, options: ParseOptions): RawStory[] {
  const rows = Array.isArray((payload as { ipoCalendar?: unknown[] } | null)?.ipoCalendar)
    ? (payload as { ipoCalendar: Array<Record<string, unknown>> }).ipoCalendar
    : [];
  const events: RawStory[] = [];
  for (const row of rows) {
    const value = Number(row.totalSharesValue);
    const date = String(row.date ?? "");
    if (!Number.isFinite(value) || value < 1_000_000_000 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const [year, month, day] = date.split("-").map(Number);
    const scheduledFor = zonedLocalToIso({ year, month, day, hour: 9, minute: 30, timeZone: "America/New_York" });
    if (!isFutureInWindow(scheduledFor, options.now, options.days)) continue;
    const name = String(row.name ?? row.symbol ?? "大型公司");
    const symbol = String(row.symbol ?? "");
    events.push(officialStory({
      source: "Finnhub IPO",
      sourceUrl: options.sourceUrl,
      title: `${name}${symbol ? `（${symbol}）` : ""}计划上市`,
      description: `${name}预计在${String(row.exchange ?? "美国市场")}上市，预计发行规模约 ${(value / 1_000_000_000).toFixed(1)} 十亿美元。`,
      scheduledFor,
      category: "科技",
      assets: [symbol || "IPO", "美股", "IPO"],
      importance: value >= 5_000_000_000 ? 9 : 8,
    }));
  }
  return events;
}

async function responseText(response: Response): Promise<string> {
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  return response.text();
}

function monthUrl(year: number, month: number): string {
  return `https://www.federalreserve.gov/newsevents/${year}-${MONTHS[month - 1]}.htm`;
}

export async function fetchScheduledEvents(options: {
  now?: Date;
  fetchImpl?: typeof fetch;
  days?: number;
  finnhubApiKey?: string | null;
} = {}): Promise<ScheduledEventFetchResult> {
  const now = options.now ?? new Date();
  const days = Math.max(1, Math.min(30, options.days ?? 7));
  const fetchImpl = options.fetchImpl ?? fetch;
  const shanghai = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit" }).formatToParts(now);
  const values = Object.fromEntries(shanghai.map((part) => [part.type, part.value]));
  const year = Number(values.year);
  const month = Number(values.month);
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const headers = { "User-Agent": "Mozilla/5.0 (compatible; AlphaPercept/1.0; +https://www.alphapercept.com)" };
  const from = now.toISOString().slice(0, 10);
  const to = new Date(now.getTime() + days * 86_400_000).toISOString().slice(0, 10);
  const finnhubApiKey = options.finnhubApiKey ?? process.env.FINNHUB_API_KEY ?? null;

  const jobs: Array<{ name: string; run: () => Promise<RawStory[]> }> = [
    {
      name: "Finnhub财报",
      run: async () => {
        if (!finnhubApiKey) throw new Error("FINNHUB_API_KEY_MISSING");
        const url = `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&international=true&token=${encodeURIComponent(finnhubApiKey)}`;
        const response = await fetchImpl(url, { headers, signal: AbortSignal.timeout(10_000) });
        if (!response.ok) throw new Error(`HTTP_${response.status}`);
        return parseFinnhubEarningsCalendar(await response.json(), { now, days, sourceUrl: "https://finnhub.io/docs/api/earnings-calendar" });
      },
    },
    {
      name: "Finnhub IPO",
      run: async () => {
        if (!finnhubApiKey) throw new Error("FINNHUB_API_KEY_MISSING");
        const url = `https://finnhub.io/api/v1/calendar/ipo?from=${from}&to=${to}&token=${encodeURIComponent(finnhubApiKey)}`;
        const response = await fetchImpl(url, { headers, signal: AbortSignal.timeout(10_000) });
        if (!response.ok) throw new Error(`HTTP_${response.status}`);
        return parseFinnhubIpoCalendar(await response.json(), { now, days, sourceUrl: "https://finnhub.io/docs/api/ipo-calendar" });
      },
    },
    {
      name: "Federal Reserve日历",
      run: async () => {
        const urls = [monthUrl(year, month), monthUrl(next.year, next.month)];
        const pages = await Promise.all(urls.map((url) => fetchImpl(url, { headers, signal: AbortSignal.timeout(10_000) }).then(responseText)));
        return [
          ...parseFedCalendarHtml(pages[0], { year, month, now, days, sourceUrl: urls[0] }),
          ...parseFedCalendarHtml(pages[1], { year: next.year, month: next.month, now, days, sourceUrl: urls[1] }),
        ];
      },
    },
    {
      name: "BLS日历",
      run: async () => parseBlsCalendarIcs(
        await fetchImpl("https://www.bls.gov/schedule/news_release/bls.ics", { headers, signal: AbortSignal.timeout(10_000) }).then(responseText),
        { now, days, sourceUrl: "https://www.bls.gov/schedule/news_release/bls.ics" }
      ),
    },
    {
      name: "BEA日历",
      run: async () => parseBeaScheduleHtml(
        await fetchImpl("https://www.bea.gov/news/schedule/full", { headers, signal: AbortSignal.timeout(10_000) }).then(responseText),
        { year, now, days, sourceUrl: "https://www.bea.gov/news/schedule/full" }
      ),
    },
    {
      name: "NVIDIA IR",
      run: async () => parseNvidiaPressRss(
        await fetchImpl("https://nvidianews.nvidia.com/cats/press_release.xml", { headers, signal: AbortSignal.timeout(10_000) }).then(responseText),
        { now, days, sourceUrl: "https://nvidianews.nvidia.com/cats/press_release.xml" }
      ),
    },
  ];
  const settled = await Promise.allSettled(jobs.map((job) => job.run()));
  const sources: ScheduledEventSourceHealth[] = settled.map((result, index) => ({
    name: jobs[index].name,
    ok: result.status === "fulfilled",
    count: result.status === "fulfilled" ? result.value.length : 0,
    error: result.status === "rejected" ? (result.reason instanceof Error ? result.reason.message : "unknown") : null,
  }));
  const stories = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  return {
    stories: [...new Map(stories.map((story) => [story.sourceId, story])).values()]
      .sort((left, right) => String(left.scheduledFor).localeCompare(String(right.scheduledFor))),
    sources,
  };
}
