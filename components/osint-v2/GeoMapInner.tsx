"use client";

import { useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { type SituationalEntity, type AviationEntity, type MaritimeEntity, type GeoConflictEntity } from "@/services/types";

interface GeoMapInnerProps {
  aviation: SituationalEntity[];
  maritime: SituationalEntity[];
  conflicts: SituationalEntity[];
  financials: SituationalEntity[];
  weather?: SituationalEntity[];
  humanitarian?: SituationalEntity[];
}

type LayerKey = "all" | "financial" | "maritime" | "aviation" | "conflict" | "weather" | "humanitarian";

const LAYER_TABS: { key: LayerKey; label: string; color: string }[] = [
  { key: "all",       label: "全部",   color: "#6b7280" },
  { key: "financial", label: "股票",   color: "#ef4444" },
  { key: "maritime",  label: "海事",   color: "#818cf8" },
  { key: "aviation",  label: "航空",   color: "#38bdf8" },
  { key: "conflict",  label: "冲突",   color: "#f97316" },
  { key: "weather",       label: "气象",   color: "#06b6d4" },
  { key: "humanitarian",  label: "人道",   color: "#ec4899" },
];

// Layer color scheme
const LAYER_COLORS = {
  aviation:      "#38bdf8",
  maritime:      "#818cf8",
  conflict:      "#f97316",
  financial_up:  "#ef4444",
  financial_down:"#22c55e",
  weather:       "#06b6d4",
  humanitarian:  "#ec4899",
};

export default function GeoMapInner({ aviation, maritime, conflicts, financials, weather, humanitarian }: GeoMapInnerProps) {
  const [activeLayer, setActiveLayer] = useState<LayerKey>("all");

  const showFinancial = activeLayer === "all" || activeLayer === "financial";
  const showMaritime  = activeLayer === "all" || activeLayer === "maritime";
  const showAviation  = activeLayer === "all" || activeLayer === "aviation";
  const showConflict  = activeLayer === "all" || activeLayer === "conflict";
  const showWeather   = activeLayer === "all" || activeLayer === "weather";
  const showHumanitarian = activeLayer === "all" || activeLayer === "humanitarian";

  const financialMarkers = financials.filter(e => e.coordinates);

  return (
    <div className="h-full w-full relative">
      <MapContainer
        center={[20, 80]}
        zoom={2}
        minZoom={2}
        maxZoom={12}
        style={{ height: "100%", width: "100%", background: "#0a0e17" }}
        attributionControl={false}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
        />

        {/* Layer: Financial Centers */}
        {showFinancial && financialMarkers.map((e) => {
          const finColor = (e.deltaPercent ?? 0) >= 0 ? LAYER_COLORS.financial_up : LAYER_COLORS.financial_down;
          const sign = (e.deltaPercent ?? 0) >= 0 ? "+" : "";
          return [
            <CircleMarker
              key={`glow-${e.id}`}
              center={[e.coordinates!.lat, e.coordinates!.lng]}
              radius={4 * 2.5}
              pathOptions={{ color: finColor, fillColor: finColor, fillOpacity: 0.12, weight: 0, stroke: false }}
            />,
            <CircleMarker
              key={e.id}
              center={[e.coordinates!.lat, e.coordinates!.lng]}
              radius={4}
              pathOptions={{ color: finColor, fillColor: finColor, fillOpacity: 0.7, weight: 1 }}
            >
              <Tooltip direction="top" offset={[0, -6]} className="dark-tooltip">
                <span className="text-[10px] font-mono">
                  {e.label} {e.value?.toLocaleString()} {sign}{e.deltaPercent?.toFixed(2)}%
                </span>
              </Tooltip>
              <Popup>
                <div className="text-[11px] min-w-[140px]">
                  <div className="font-bold mb-1">{e.label}</div>
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-500">价格</span>
                    <span className="font-mono">{e.value?.toLocaleString() ?? "—"}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-500">涨跌</span>
                    <span className="font-mono" style={{ color: finColor }}>
                      {sign}{e.delta?.toFixed(2) ?? "—"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-500">涨跌幅</span>
                    <span className="font-mono" style={{ color: finColor }}>
                      {sign}{e.deltaPercent?.toFixed(2) ?? "—"}%
                    </span>
                  </div>
                </div>
              </Popup>
            </CircleMarker>,
          ];
        })}

        {/* Layer: Aviation */}
        {showAviation && aviation.map((e) => [
          <CircleMarker
            key={`glow-${e.id}`}
            center={[e.coordinates!.lat, e.coordinates!.lng]}
            radius={2.5 * 3}
            pathOptions={{ color: "#38bdf8", fillColor: "#38bdf8", fillOpacity: 0.12, weight: 0, stroke: false }}
          />,
          <CircleMarker
            key={e.id}
            center={[e.coordinates!.lat, e.coordinates!.lng]}
            radius={2.5}
            pathOptions={{ color: LAYER_COLORS.aviation, fillColor: LAYER_COLORS.aviation, fillOpacity: 0.8, weight: 0.5 }}
          >
            <Popup>
              <div className="text-[10px]">
                <div className="font-bold">{e.label}</div>
                <div>{(e as AviationEntity).metadata.originCountry}</div>
                <div>Alt: {e.coordinates?.alt?.toFixed(0)}m | Spd: {(e as AviationEntity).metadata.velocity?.toFixed(0)}m/s</div>
              </div>
            </Popup>
          </CircleMarker>,
        ])}

        {/* Layer: Maritime */}
        {showMaritime && maritime.map((e) => [
          <CircleMarker
            key={`glow-${e.id}`}
            center={[e.coordinates!.lat, e.coordinates!.lng]}
            radius={3 * 3}
            pathOptions={{ color: "#818cf8", fillColor: "#818cf8", fillOpacity: 0.12, weight: 0, stroke: false }}
          />,
          <CircleMarker
            key={e.id}
            center={[e.coordinates!.lat, e.coordinates!.lng]}
            radius={3}
            pathOptions={{ color: LAYER_COLORS.maritime, fillColor: LAYER_COLORS.maritime, fillOpacity: 0.7, weight: 0.5 }}
          >
            <Popup>
              <div className="text-[10px]">
                <div className="font-bold">{(e as MaritimeEntity).metadata.shipName}</div>
                <div>Type: {e.subtype} | Flag: {(e as MaritimeEntity).metadata.flag ?? "N/A"}</div>
                <div>Speed: {(e as MaritimeEntity).metadata.speed}kn | Course: {(e as MaritimeEntity).metadata.course}°</div>
                <div>Dest: {(e as MaritimeEntity).metadata.destination ?? "N/A"}</div>
              </div>
            </Popup>
          </CircleMarker>,
        ])}

        {/* Layer: Geo-Conflicts */}
        {showConflict && conflicts.map((e) => {
          if (!e.coordinates) return null;
          const fatalities = (e as GeoConflictEntity).metadata.fatalities;
          const radius = Math.max(3, Math.min(10, 3 + fatalities * 0.3));
          return [
            <CircleMarker
              key={`glow-${e.id}`}
              center={[e.coordinates.lat, e.coordinates.lng]}
              radius={radius * 3.5}
              pathOptions={{ color: "#f97316", fillColor: "#f97316", fillOpacity: 0.12, weight: 0, stroke: false }}
            />,
            <CircleMarker
              key={e.id}
              center={[e.coordinates.lat, e.coordinates.lng]}
              radius={radius}
              pathOptions={{ color: LAYER_COLORS.conflict, fillColor: LAYER_COLORS.conflict, fillOpacity: 0.6, weight: 1 }}
            >
              <Popup>
                <div className="text-[10px]">
                  <div className="font-bold">{e.label}</div>
                  <div>{(e as GeoConflictEntity).metadata.eventDate}</div>
                  <div>Fatalities: {fatalities}</div>
                  <div className="max-w-[200px] truncate">{(e as GeoConflictEntity).metadata.notes}</div>
                </div>
              </Popup>
            </CircleMarker>,
          ];
        })}
        {/* Layer: Weather Alerts */}
        {showWeather && (weather || []).filter(e => e.coordinates).map((e) => (
          <CircleMarker
            key={e.id}
            center={[e.coordinates!.lat, e.coordinates!.lng]}
            radius={6}
            pathOptions={{ color: "#06b6d4", fillColor: "#06b6d4", fillOpacity: 0.4, weight: 1 }}
          >
            <Popup>
              <div className="text-[10px]">
                <div className="font-bold">{e.label}</div>
                <div>{(e.metadata as any)?.headline || ""}</div>
                <div>Area: {(e.metadata as any)?.areaDesc || ""}</div>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* Layer: Humanitarian */}
        {showHumanitarian && (humanitarian || []).filter(e => e.coordinates).map((e) => (
          <CircleMarker
            key={e.id}
            center={[e.coordinates!.lat, e.coordinates!.lng]}
            radius={5}
            pathOptions={{ color: "#ec4899", fillColor: "#ec4899", fillOpacity: 0.5, weight: 1 }}
          >
            <Popup>
              <div className="text-[10px]">
                <div className="font-bold">{e.label}</div>
                <div>{(e.metadata as any)?.country || ""}</div>
                <div>{(e.metadata as any)?.disasterType || ""}</div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* Layer toggle — top-center overlay */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-1 bg-[#0a0e17]/85 border border-[#1a2035] rounded-full px-2 py-1 backdrop-blur-sm">
        {LAYER_TABS.map(({ key, label, color }) => {
          const isActive = activeLayer === key;
          return (
            <button
              key={key}
              onClick={() => setActiveLayer(key)}
              className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono transition-all ${
                isActive
                  ? "text-white font-semibold"
                  : "text-[#5a6580] hover:text-[#8892a8]"
              }`}
              style={isActive ? { backgroundColor: `${color}25`, color } : {}}
            >
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: color }} />
              )}
              {label}
            </button>
          );
        })}
      </div>

      {/* Map legend — bottom-left */}
      <div className="absolute bottom-3 left-3 bg-[#0a0e17]/80 border border-[#1a2035] rounded px-2 py-1.5 flex gap-3 z-[1000]">
        {[
          { color: LAYER_COLORS.aviation,      label: "航空" },
          { color: LAYER_COLORS.maritime,      label: "海事" },
          { color: LAYER_COLORS.conflict,      label: "冲突" },
          { color: LAYER_COLORS.financial_up,  label: "股指" },
          { color: "#06b6d4", label: "气象" },
          { color: "#ec4899", label: "人道" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[9px] text-[#5a6580]">{label}</span>
          </div>
        ))}
      </div>

      {/* Maritime count badge */}
      {showMaritime && maritime.length > 0 && (
        <div className="absolute top-3 right-3 z-[1000] bg-[#818cf8]/10 border border-[#818cf8]/30 rounded px-2 py-1">
          <span className="text-[9px] font-mono text-[#818cf8]">
            {maritime.length} vessels
          </span>
        </div>
      )}
    </div>
  );
}
