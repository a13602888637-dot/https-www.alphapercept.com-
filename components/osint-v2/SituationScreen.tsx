"use client";

/**
 * OSINT v2: Situational Awareness Command Screen
 *
 * Bento Grid layout — h-screen, no scroll:
 *   ┌────────┬──────────────────────────────┬────────┐
 *   │        │         TICKER BAR           │        │
 *   │  LEFT  ├──────────────────────────────┤ RIGHT  │
 *   │  20%   │        CENTER MAP  60%       │  20%   │
 *   │Finance │    Geo-Spatial Base Layer    │ Intel  │
 *   │Sparkln │  Aviation + Maritime + Geo   │ Feed   │
 *   │        │                              │        │
 *   └────────┴──────────────────────────────┴────────┘
 */

import { useDataStream } from "@/services/use-data-stream";
import { FinancePanel } from "./FinancePanel";
import { GeoMapBase } from "./GeoMapBase";
import { IntelFeed } from "./IntelFeed";
import { TickerBar } from "./TickerBar";
import { StatusBar } from "./StatusBar";

export function SituationScreen() {
  const stream = useDataStream();

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#0a0e17] text-[#c8cdd5] flex flex-col">
      {/* Top ticker bar */}
      <TickerBar financials={stream.financials} />

      {/* Main 3-column grid */}
      <div className="flex-1 grid grid-cols-[minmax(240px,1fr)_3fr_minmax(260px,1fr)] gap-px min-h-0">
        {/* Left: Finance + Macro */}
        <div className="overflow-y-auto border-r border-[#1a2035]">
          <FinancePanel financials={stream.financials} isLoading={stream.isLoading} />
        </div>

        {/* Center: Geo-Spatial Map */}
        <div className="relative min-h-0">
          <GeoMapBase
            aviation={stream.aviation}
            maritime={stream.maritime}
            conflicts={stream.conflicts}
            financials={stream.financials}
          />
        </div>

        {/* Right: Intelligence Feed */}
        <div className="overflow-hidden border-l border-[#1a2035]">
          <IntelFeed
            entities={stream.entities}
            conflicts={stream.conflicts}
            errors={stream.errors}
          />
        </div>
      </div>

      {/* Bottom status bar */}
      <StatusBar health={stream.health} errors={stream.errors} lastUpdate={stream.lastUpdate} />
    </div>
  );
}
