import { NextResponse } from "next/server";
import { getStorySnapshot } from "@/lib/osint/story-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getStorySnapshot({ window: "24h", limit: 20 });
  const news = snapshot.stories.map((story) => ({
    id: story.id,
    title: story.title,
    originalTitle: story.originalTitle,
    language: story.language,
    translationStatus: story.translationStatus,
    summary: story.summary,
    source: story.sources.map((source) => source.name).join(" + "),
    sourceUrl: story.sources[0]?.url ?? "",
    sources: story.sources,
    impact: story.importance >= 8 ? "high" : story.importance >= 5 ? "medium" : "low",
    importance: story.importance,
    sectors: story.tags.assets,
    tags: story.tags,
    analysisStatus: story.analysisStatus,
    pubDate: story.publishedAt,
  }));

  return NextResponse.json(
    {
      success: true,
      news,
      summary: snapshot.advice.text,
      source: "osint-story-service",
      lastFetchedAt: snapshot.generatedAt,
      isLive: news.length > 0,
      sources: snapshot.sources,
      timestamp: snapshot.generatedAt,
    },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" } }
  );
}
