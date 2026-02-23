import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";

async function testDatabase() {
  console.log("Testing database connection...");

  const prisma = new PrismaClient({});

  try {
    // Test connection
    await prisma.$connect();
    console.log("✅ Database connection successful");

    // Count existing records
    const userCount = await prisma.user.count();
    const watchlistCount = await prisma.watchlist.count();
    const feedCount = await prisma.intelligenceFeed.count();

    console.log(`📊 Database stats:`);
    console.log(`  Users: ${userCount}`);
    console.log(`  Watchlist items: ${watchlistCount}`);
    console.log(`  Intelligence feeds: ${feedCount}`);

    // Create test intelligence feed if none exist
    if (feedCount === 0) {
      console.log("Creating test intelligence feed...");

      const testFeed = await prisma.intelligenceFeed.create({
        data: {
          stockCode: "000001.SZ",
          stockName: "平安银行",
          eventSummary: "央行降准预期升温，银行板块受益",
          industryTrend: "金融",
          trapProbability: 25,
          actionSignal: "BUY",
          targetPrice: 15.8,
          stopLoss: 13.2,
          logicChain: JSON.stringify({
            macro: "货币政策宽松预期",
            value: "PE处于历史30%分位",
            sentiment: "资金持续流入银行板块",
            ma60: "股价站稳MA60上方",
            md60: "MD60趋势向上"
          }),
          rawData: JSON.stringify({
            price: 14.5,
            pe: 6.8,
            pb: 0.9,
            volume: 1250000
          }),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      console.log(`✅ Created test intelligence feed: ${testFeed.stockName}`);
    }

    // List recent feeds
    const recentFeeds = await prisma.intelligenceFeed.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' }
    });

    console.log("\n📋 Recent intelligence feeds:");
    recentFeeds.forEach(feed => {
      console.log(`  ${feed.stockCode} - ${feed.stockName}: ${feed.actionSignal} (Trap: ${feed.trapProbability}%)`);
    });

  } catch (error) {
    console.error("❌ Database connection failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabase();