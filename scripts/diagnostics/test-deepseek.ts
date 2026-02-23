import * as dotenv from "dotenv";
import { generateEnhancedIntelligenceAnalysis } from "../skills/deepseek_agent";

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

async function testDeepSeekAgent() {
  console.log("Testing DeepSeek AI Agent...");

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey || apiKey === 'your_deepseek_api_key_here') {
    console.error("❌ DEEPSEEK_API_KEY environment variable not set or is default value");
    console.error("Please set DEEPSEEK_API_KEY in .env.local file");
    return;
  }

  console.log("✅ DeepSeek API key found");

  try {
    // Use mock market data to avoid API calls
    console.log("Using mock market data for testing...");
    const marketData = [{
      symbol: '000001.SZ',
      name: '平安银行',
      currentPrice: 14.5,
      highPrice: 14.8,
      lowPrice: 14.2,
      lastUpdateTime: new Date().toISOString(),
      change: 0.3,
      changePercent: 2.1,
      volume: 1250000,
      turnover: 1.8,
      peRatio: 6.8,
      marketCap: 280
    }];

    console.log(`Using ${marketData.length} mock stocks`);

    // Create mock context
    const context = {
      currentPortfolio: {
        '000001.SZ': {
          quantity: 1000,
          avgPrice: 14.0,
          currentValue: 14500,
          unrealizedPnl: 500
        }
      },
      marketCondition: {
        trend: 'bullish' as const,
        volatility: 'medium' as const,
        liquidity: '充足' as const
      },
      riskTolerance: 'moderate' as const,
      availableCapital: 50000,
      newsAnalysis: {
        overallSentiment: 'positive' as const,
        keyThemes: ['央行降准', '银行板块', '货币政策'],
        highImpactNews: [],
        stockImpact: { '000001.SZ': { count: 3, sentiment: 'positive' } }
      },
      technicalIndicators: {
        '000001.SZ': {
          ma60: 13.8,
          md60: 5.2,
          rsi: 65,
          macd: { diff: 0.15, signal: 0.12, histogram: 0.03 },
          volumeRatio: 1.2
        }
      }
    };

    console.log("Generating enhanced analysis with DeepSeek AI...");

    // Generate analysis
    const analysis = await generateEnhancedIntelligenceAnalysis(marketData, context, apiKey);

    console.log(`✅ Generated analysis for ${Object.keys(analysis).length} stocks`);

    // Display results
    for (const [symbol, feed] of Object.entries(analysis)) {
      console.log(`\n📊 ${symbol} - ${feed.stock_name}`);
      console.log(`  Event Summary: ${feed.event_summary}`);
      console.log(`  Industry Trend: ${feed.industry_trend}`);
      console.log(`  Trap Probability: ${feed.trap_probability}%`);
      console.log(`  Action Signal: ${feed.action_signal}`);
      if (feed.target_price) console.log(`  Target Price: ${feed.target_price}`);
      if (feed.stop_loss) console.log(`  Stop Loss: ${feed.stop_loss}`);

      // Show logic chain summary
      if (feed.logic_chain && typeof feed.logic_chain === 'object') {
        const logic = feed.logic_chain as any;
        console.log(`  Logic Chain:`);
        if (logic.macro_analysis) console.log(`    - Macro: ${logic.macro_analysis.substring(0, 50)}...`);
        if (logic.value_assessment) console.log(`    - Value: ${logic.value_assessment.substring(0, 50)}...`);
        if (logic.anti_humanity_check) console.log(`    - Anti-humanity: ${logic.anti_humanity_check.substring(0, 50)}...`);
      }
    }

    console.log("\n✅ DeepSeek agent test completed successfully!");

  } catch (error) {
    console.error("❌ DeepSeek agent test failed:", error);
    if (error instanceof Error) {
      console.error("Error details:", error.message);
      console.error("Stack trace:", error.stack);
    }
  }
}

testDeepSeekAgent();