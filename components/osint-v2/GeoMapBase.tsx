"use client";

import dynamic from "next/dynamic";
import type { SituationalEntity } from "@/services/types";

interface GeoMapBaseProps {
  aviation: SituationalEntity[];
  maritime: SituationalEntity[];
  conflicts: SituationalEntity[];
  financials: SituationalEntity[];
  weather?: SituationalEntity[];
  humanitarian?: SituationalEntity[];
}

const GeoMapInner = dynamic(() => import("./GeoMapInner"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-[#0a0e17] flex items-center justify-center">
      <span className="text-[#3a4560] text-xs animate-pulse">initializing geo-spatial layer...</span>
    </div>
  ),
});

export function GeoMapBase(props: GeoMapBaseProps) {
  return <GeoMapInner {...props} />;
}
