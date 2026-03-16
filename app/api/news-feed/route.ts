import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

interface NewsItem {
  title: string;
  summary: string;
  source: string;
  impact: 'high' | 'medium' | 'low';
  sectors: string[];
  pubDate: string;
}

interface FeedSourceStatus {
  name: string;
  ok: boolean;
  count: number;
  method: 'rsshub' | 'fallback';
}

let newsCache: {
  data: NewsItem[];
  aiSummary: string;
  timestamp: number;
  sources: FeedSourceStatus[];
} | null = null;
const CACHE_TTL = 10 * 60 * 1000;
// Empty-result cache TTL: retry sooner if nothing was fetched
const EMPTY_CACHE_TTL = 60 * 1000;

const RSS_FEEDS = [
  {
    url: 'https://rsshub.app/cls/telegraph',
    name: '财联社电报',
    fallbackUrl: 'https://www.cls.cn/nodeapi/updateTelegraphList?app=CailianpressWeb&os=web&sv=7.7.5',
  },
  {
    url: 'https://rsshub.app/eastmoney/report/strategy',
    name: '东方财富策略',
    fallbackUrl: 'https://newsapi.eastmoney.com/kuaixun/v1/getlist_102_ajaxResult_50_1_.html',
  },
  {
    url: 'https://rsshub.app/sina/finance',
    name: '新浪财经',
    fallbackUrl: 'https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2516&k=&num=20&page=1&r=0.1&callback=',
  },
];

function extractTitlesFromXML(xml: string): string[] {
  const titles: string[] = [];
  const titleRegex = /<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/gs;
  let match;
  while ((match = titleRegex.exec(xml)) !== null) {
    const title = match[1].trim();
    if (title && title.length > 5 && !title.includes('RSSHub') && !title.includes('RSS')) {
      titles.push(title);
    }
  }
  return titles.slice(0, 20);
}

function extractTitlesFromCLS(json: any): string[] {
  try {
    const items = json?.data?.roll_data || json?.data || [];
    if (!Array.isArray(items)) return [];
    return items
      .map((item: any) => item.title || item.brief || item.content || '')
      .filter((t: string) => t.length > 5)
      .slice(0, 20);
  } catch {
    return [];
  }
}

function extractTitlesFromEastmoney(json: any): string[] {
  try {
    const items = json?.LivesList || json?.data || [];
    if (!Array.isArray(items)) return [];
    return items
      .map((item: any) => item.title || item.Title || item.digest || '')
      .filter((t: string) => t.length > 5)
      .slice(0, 20);
  } catch {
    return [];
  }
}

function extractTitlesFromSina(json: any): string[] {
  try {
    const items = json?.result?.data || json?.data || [];
    if (!Array.isArray(items)) return [];
    return items
      .map((item: any) => item.title || item.stitle || '')
      .filter((t: string) => t.length > 5)
      .slice(0, 20);
  } catch {
    return [];
  }
}

const FALLBACK_PARSERS: Record<string, (json: any) => string[]> = {
  '财联社电报': extractTitlesFromCLS,
  '东方财富策略': extractTitlesFromEastmoney,
  '新浪财经': extractTitlesFromSina,
};

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; StockAnalysis/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

async function fetchFallbackFeed(
  fallbackUrl: string,
  feedName: string,
): Promise<string[]> {
  try {
    const response = await fetchWithTimeout(fallbackUrl, 8000);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const text = await response.text();

    // Strip JSONP callback wrapper only when text doesn't already start with JSON.
    // Plain JSON responses (starting with { or [) must NOT have trailing braces stripped —
    // the original regex /[)}\];]*$/ would eat legitimate closing }} and break JSON.parse.
    const trimmed = text.trimStart();
    let jsonText: string;
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      jsonText = trimmed; // already plain JSON
    } else {
      jsonText = text.replace(/^[^({[]*/, '').replace(/[)}\];]*$/, '');
    }

    if (jsonText.startsWith('{') || jsonText.startsWith('[')) {
      const json = JSON.parse(jsonText);
      const parser = FALLBACK_PARSERS[feedName];
      if (parser) return parser(json);
    }
    return [];
  } catch (err) {
    console.warn(`Fallback fetch failed for ${feedName}:`, err instanceof Error ? err.message : err);
    return [];
  }
}

async function fetchRSSFeed(
  feedUrl: string,
  feedName: string,
  fallbackUrl: string,
): Promise<{ titles: string[]; source: string; method: 'rsshub' | 'fallback' }> {
  // Try RSSHub first
  try {
    const response = await fetchWithTimeout(feedUrl, 8000);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const xml = await response.text();
    const titles = extractTitlesFromXML(xml);
    if (titles.length > 0) {
      return { titles, source: feedName, method: 'rsshub' };
    }
  } catch (err) {
    console.warn(`RSS fetch failed for ${feedName}:`, err instanceof Error ? err.message : err);
  }

  // Fallback to direct API
  console.log(`Trying fallback for ${feedName}...`);
  const fallbackTitles = await fetchFallbackFeed(fallbackUrl, feedName);
  return { titles: fallbackTitles, source: feedName, method: 'fallback' };
}

async function generateAISummary(headlines: string[]): Promise<{ items: NewsItem[]; summary: string }> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey || headlines.length === 0) {
    return { items: [], summary: '暂无新闻摘要' };
  }

  const headlineText = headlines.slice(0, 15).map((h, i) => `${i + 1}. ${h}`).join('\n');

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: '你是一位专业的财经新闻分析师。输出必须是纯JSON格式。' },
          {
            role: 'user',
            content: `分析以下财经新闻标题，输出JSON格式：\n\n${headlineText}\n\n输出格式（直接输出JSON，不要markdown代码块）：\n{"summary":"一段话总结今日财经要闻（80字内）","items":[{"title":"标题","summary":"一句话摘要（30字内）","impact":"high/medium/low","sectors":["板块1"]}]}\n\n只分析最重要的8条。`,
          },
        ],
        stream: false,
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) throw new Error(`DeepSeek API error: ${response.status}`);
    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || '';
    content = content.trim();
    if (content.startsWith('```')) {
      content = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(content);
    const items: NewsItem[] = (parsed.items || []).map((item: any) => ({
      title: item.title || '',
      summary: item.summary || '',
      source: '财经新闻',
      impact: ['high', 'medium', 'low'].includes(item.impact) ? item.impact : 'medium',
      sectors: Array.isArray(item.sectors) ? item.sectors : [],
      pubDate: new Date().toISOString(),
    }));

    return { items, summary: parsed.summary || '暂无摘要' };
  } catch (err) {
    console.error('AI summary generation failed:', err);
    const items: NewsItem[] = headlines.slice(0, 8).map(title => ({
      title,
      summary: '',
      source: '财经新闻',
      impact: 'medium' as const,
      sectors: [],
      pubDate: new Date().toISOString(),
    }));
    return { items, summary: '新闻摘要生成失败，显示原始标题' };
  }
}

export async function GET() {
  try {
    const now = new Date();
    const lastFetchedAt = now.toISOString();

    const ttl = newsCache?.data.length === 0 ? EMPTY_CACHE_TTL : CACHE_TTL;
    if (newsCache && Date.now() - newsCache.timestamp < ttl) {
      return NextResponse.json({
        success: true,
        news: newsCache.data,
        summary: newsCache.aiSummary,
        cached: true,
        source: 'news-feed',
        lastFetchedAt: new Date(newsCache.timestamp).toISOString(),
        isLive: Date.now() - newsCache.timestamp < CACHE_TTL,
        sources: newsCache.sources,
        timestamp: lastFetchedAt,
      });
    }

    const feedResults = await Promise.allSettled(
      RSS_FEEDS.map(feed => fetchRSSFeed(feed.url, feed.name, feed.fallbackUrl))
    );

    const allHeadlines: string[] = [];
    const sources: FeedSourceStatus[] = [];

    for (const result of feedResults) {
      if (result.status === 'fulfilled') {
        const { titles, source, method } = result.value;
        allHeadlines.push(...titles);
        sources.push({
          name: source,
          ok: titles.length > 0,
          count: titles.length,
          method,
        });
      } else {
        sources.push({
          name: 'unknown',
          ok: false,
          count: 0,
          method: 'rsshub',
        });
      }
    }

    const uniqueHeadlines = [...new Set(allHeadlines)];
    const { items, summary } = await generateAISummary(uniqueHeadlines);

    newsCache = { data: items, aiSummary: summary, timestamp: Date.now(), sources };

    return NextResponse.json({
      success: true,
      news: items,
      summary,
      totalHeadlines: uniqueHeadlines.length,
      source: 'news-feed',
      lastFetchedAt,
      isLive: uniqueHeadlines.length > 0,
      sources,
      timestamp: lastFetchedAt,
    });
  } catch (error) {
    console.error("Error in news-feed API:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch news feed",
        news: [],
        summary: '',
        source: 'news-feed',
        lastFetchedAt: new Date().toISOString(),
        isLive: false,
        sources: [],
      },
      { status: 500 }
    );
  }
}
