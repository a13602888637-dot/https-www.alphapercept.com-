import assert from "node:assert/strict";

async function verifyScheduledEvents() {
  const module = await import("../../lib/osint/scheduled-events").catch(() => ({}));
  assert.equal(typeof module.parseFedCalendarHtml, "function", "应提供Fed日历解析器");
  assert.equal(typeof module.parseBlsCalendarIcs, "function", "应提供BLS ICS解析器");
  assert.equal(typeof module.parseBeaScheduleHtml, "function", "应提供BEA日历解析器");
  assert.equal(typeof module.parseFinnhubEarningsCalendar, "function", "应提供Finnhub财报日历解析器");
  assert.equal(typeof module.parseFinnhubIpoCalendar, "function", "应提供Finnhub IPO日历解析器");
  assert.equal(typeof module.parseNvidiaPressRss, "function", "应提供NVIDIA公告解析器");
  assert.equal(typeof module.fetchScheduledEvents, "function", "应提供未来事件聚合器");

  if (
    typeof module.parseFedCalendarHtml !== "function" ||
    typeof module.parseBlsCalendarIcs !== "function" ||
    typeof module.parseBeaScheduleHtml !== "function" ||
    typeof module.parseFinnhubEarningsCalendar !== "function" ||
    typeof module.parseFinnhubIpoCalendar !== "function" ||
    typeof module.parseNvidiaPressRss !== "function"
  ) return;

  const now = new Date("2026-08-26T00:00:00.000Z");
  const fedHtml = `<h4>Speeches</h4><div class="panel-body"><div class="row"><div class="col-xs-2"><p>10:00 a.m.</p></div><div class="col-xs-7"><p>Speech - Chairman Kevin Warsh</p><p class="calendar__title"><em>Keynote Remarks</em></p><p>At the 2026 Jackson Hole Economic Policy Symposium</p></div><div class="col-xs-3"><p>28</p></div></div></div>`;
  const fed = module.parseFedCalendarHtml(fedHtml, { year: 2026, month: 8, now, days: 7, sourceUrl: "https://www.federalreserve.gov/newsevents/2026-august.htm" });
  assert.equal(fed.length, 1);
  assert.equal(fed[0].eventType, "upcoming");
  assert.equal(fed[0].scheduledFor, "2026-08-28T14:00:00.000Z");
  assert.equal(fed[0].scheduledPrecision, "exact");
  assert.equal(fed[0].title, "美联储主席Kevin Warsh：Keynote Remarks");
  assert.equal(fed[0].topicHints.includes("未来事件"), true);
  assert.equal(fed[0].preAnalyzed, true);

  const blsIcs = `BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:jobs-2026\nDTSTART;TZID=US-Eastern:20260904T083000\nSUMMARY:Employment Situation\nEND:VEVENT\nEND:VCALENDAR`;
  const bls = module.parseBlsCalendarIcs(blsIcs, { now, days: 10, sourceUrl: "https://www.bls.gov/schedule/news_release/bls.ics" });
  assert.equal(bls.length, 1);
  assert.equal(bls[0].scheduledFor, "2026-09-04T12:30:00.000Z");
  assert.equal(bls[0].topicHints.includes("宏观"), true);

  const beaHtml = `<tr class="scheduled-releases-type-press"><td class="scheduled-date"><div class="release-date">August 26</div><small>8:30 AM</small></td><td class="release-title">GDP (Second Estimate) and Corporate Profits, 2nd Quarter 2026</td></tr>`;
  const bea = module.parseBeaScheduleHtml(beaHtml, { year: 2026, now, days: 7, sourceUrl: "https://www.bea.gov/news/schedule/full" });
  assert.equal(bea.length, 1);
  assert.equal(bea[0].scheduledFor, "2026-08-26T12:30:00.000Z");
  assert.equal(bea[0].importanceHint, 9);

  const earnings = module.parseFinnhubEarningsCalendar({ earningsCalendar: [
    { date: "2026-08-26", hour: "amc", symbol: "NVDA", epsEstimate: 1.23, revenueEstimate: 54000000000 },
    { date: "2026-08-27", hour: "bmo", symbol: "XOM", epsEstimate: 2.1 },
    { date: "2026-08-27", hour: "amc", symbol: "JPM", epsEstimate: 4.2 },
    { date: "2026-08-27", hour: "amc", symbol: "TINY", epsEstimate: 0.1 },
  ] }, { now, days: 7, sourceUrl: "https://finnhub.io/docs/api/earnings-calendar" });
  assert.equal(earnings.length, 3);
  assert.equal(earnings[0].title.includes("NVDA"), true);
  assert.equal(earnings[0].scheduledFor, "2026-08-26T12:00:00.000Z");
  assert.equal(earnings[0].scheduledPrecision, "session");
  assert.equal(earnings[0].scheduledSession, "amc");
  assert.equal(earnings.find((event: { title: string }) => event.title.includes("XOM"))?.topicHints.includes("能源"), true);
  assert.equal(earnings.find((event: { title: string }) => event.title.includes("JPM"))?.topicHints.includes("科技"), false);

  const ipos = module.parseFinnhubIpoCalendar({ ipoCalendar: [
    { date: "2026-08-28", name: "Large AI Co", symbol: "LAIC", exchange: "NASDAQ", totalSharesValue: 2500000000, status: "expected" },
    { date: "2026-08-28", name: "Small Co", symbol: "SMOL", totalSharesValue: 100000000, status: "expected" },
  ] }, { now, days: 7, sourceUrl: "https://finnhub.io/docs/api/ipo-calendar" });
  assert.equal(ipos.length, 1);
  assert.equal(ipos[0].title.includes("Large AI Co"), true);
  assert.equal(ipos[0].scheduledFor, "2026-08-28T12:00:00.000Z");
  assert.equal(ipos[0].scheduledPrecision, "date");

  const nvidiaRss = `<rss><channel><item><title>NVIDIA Sets Conference Call for Second-Quarter Financial Results</title><link>https://nvidianews.nvidia.com/news/nvidia-results</link><description><![CDATA[NVIDIA will host a conference call on Wednesday, August 26, at 2 p.m. PT (5 p.m. ET). Results are publicly announced at approximately 1:20 p.m. PT.]]></description><pubDate>Wed, 29 Jul 2026 21:00:00 GMT</pubDate></item></channel></rss>`;
  const nvidia = module.parseNvidiaPressRss(nvidiaRss, { now, days: 7, sourceUrl: "https://nvidianews.nvidia.com/cats/press_release.xml" });
  assert.equal(nvidia.length, 2);
  assert.deepEqual(nvidia.map((event: { scheduledFor: string }) => event.scheduledFor), ["2026-08-26T20:20:00.000Z", "2026-08-26T21:00:00.000Z"]);
  assert.equal(nvidia.every((event: { topicHints: string[] }) => event.topicHints.includes("科技")), true);

  const result = await module.fetchScheduledEvents({
    now,
    days: 7,
    fetchImpl: async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("federalreserve.gov")) return new Response(fedHtml);
      if (url.includes("bls.gov")) return new Response(null, { status: 503 });
      if (url.includes("bea.gov")) return new Response(beaHtml);
      if (url.includes("calendar/earnings")) return Response.json({ earningsCalendar: [{ date: "2026-08-26", hour: "amc", symbol: "NVDA" }] });
      if (url.includes("calendar/ipo")) return Response.json({ ipoCalendar: [] });
      if (url.includes("nvidianews.nvidia.com")) return new Response(nvidiaRss);
      return new Response(null, { status: 404 });
    },
    finnhubApiKey: "test-key",
  });
  assert.ok(result.stories.length >= 4);
  assert.equal(result.sources.find((source: { name: string }) => source.name === "BLS日历")?.ok, false);
  assert.equal(result.sources.find((source: { name: string }) => source.name === "NVIDIA IR")?.ok, true);
  assert.equal(result.sources.find((source: { name: string }) => source.name === "Finnhub财报")?.ok, true);

  console.log("SCHEDULED_EVENTS_CONTRACT_OK");
}

void verifyScheduledEvents();
