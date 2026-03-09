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

let newsCache: { data: NewsItem[]; aiSummary: string; timestamp: number } | null = null;
const CACHE_TTL = 10 * 60 * 1000;

const RSS_FEEDS = [
  { url: 'https://rsshub.app/cls/telegraph', name: '财联社电报' },
  { url: 'https://rsshub.app/eastmoney/report/strategy', name: '东方财富策略' },
  { url: 'https://rsshub.app/sina/finance', name: '新浪财经' },
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

async function fetchRSSFeed(feedUrl: string, feedName: string): Promise<{ titles: string[]; source: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; StockAnalysis/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const xml = await response.text();
    return { titles: extractTitlesFromXML(xml), source: feedName };
  } catch (err) {
    console.warn(`RSS fetch failed for ${feedName}:`, err instanceof Error ? err.message : err);
    return { titles: [], source: feedName };
  }
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
    if (newsCache && Date.now() - newsCache.timestamp < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        news: newsCache.data,
        summary: newsCache.aiSummary,
        cached: true,
        timestamp: new Date().toISOString(),
      });
    }

    const feedResults = await Promise.allSettled(
      RSS_FEEDS.map(feed => fetchRSSFeed(feed.url, feed.name))
    );

    const allHeadlines: string[] = [];
    for (const result of feedResults) {
      if (result.status === 'fulfilled' && result.value.titles.length > 0) {
        allHeadlines.push(...result.value.titles);
      }
    }

    const uniqueHeadlines = [...new Set(allHeadlines)];
    const { items, summary } = await generateAISummary(uniqueHeadlines);

    newsCache = { data: items, aiSummary: summary, timestamp: Date.now() };

    return NextResponse.json({
      success: true,
      news: items,
      summary,
      totalHeadlines: uniqueHeadlines.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in news-feed API:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch news feed", news: [], summary: '' },
      { status: 500 }
    );
  }
}
