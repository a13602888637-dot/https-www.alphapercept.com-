/**
 * SocialAdapter: Social media sentiment data
 *
 * Data flow:
 *   Bluesky posts -> /api/bluesky
 *
 * All outputs normalized to SocialEntity[]
 */

import {
  EntityType,
  type DataAdapter,
  type SocialEntity,
} from "../types";

// ─── Trading signal from sentiment score ────────────────────

function deriveTradingSignal(
  sentimentScore: number,
): "bullish" | "bearish" | "neutral" {
  if (sentimentScore >= 0.3) return "bullish";
  if (sentimentScore <= -0.3) return "bearish";
  return "neutral";
}

// ─── Adapter Implementation ─────────────────────────────────

export class SocialAdapter implements DataAdapter<SocialEntity> {
  readonly name = "social";
  readonly type = EntityType.SOCIAL;
  readonly refreshIntervalMs = 300_000; // 5 min

  async fetch(): Promise<SocialEntity[]> {
    try {
      const res = await fetch("/api/bluesky", {
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return [];

      const data = await res.json();
      if (!data.success || !Array.isArray(data.posts)) return [];

      const now = Date.now();

      return data.posts.map((post: any): SocialEntity => {
        const sentimentScore = post.sentimentScore ?? 0;

        return {
          id: `social-${post.id || `${post.author}-${now}`}`,
          type: EntityType.SOCIAL,
          subtype: post.trending ? "trending" : "sentiment",
          label: post.text
            ? post.text.substring(0, 80) + (post.text.length > 80 ? "..." : "")
            : "Social post",
          coordinates: null,
          value: sentimentScore,
          delta: null,
          deltaPercent: null,
          status: sentimentScore > 0 ? "up" : sentimentScore < 0 ? "down" : "neutral",
          metadata: {
            platform: post.platform || "bluesky",
            text: post.text || "",
            author: post.author || "unknown",
            sentimentScore,
            tradingSignal: deriveTradingSignal(sentimentScore),
          },
          source: "bluesky",
          timestamp: now,
        };
      });
    } catch (err) {
      console.warn("SocialAdapter: fetch failed:", err);
      return [];
    }
  }

  async isHealthy(): Promise<boolean> {
    return true;
  }
}
