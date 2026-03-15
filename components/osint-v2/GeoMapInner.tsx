"use client";

import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { EntityType, type SituationalEntity, type AviationEntity, type MaritimeEntity, type GeoConflictEntity } from "@/services/types";

interface GeoMapInnerProps {
  aviation: SituationalEntity[];
  maritime: SituationalEntity[];
  conflicts: SituationalEntity[];
  financials: SituationalEntity[];
}

// Layer color scheme
const LAYER_COLORS: Record<string, string> = {
  aviation: "#38bdf8",    // sky blue
  maritime: "#818cf8",    // indigo
  conflict: "#f97316",    // orange
  financial_up: "#ef4444",
  financial_down: "#22c55e",
};

export default function GeoMapInner({ aviation, maritime, conflicts, financials }: GeoMapInnerProps) {
  // Financial centers with coordinates
  const financialMarkers = financials.filter(e => e.coordinates);

  return (
    <div className="h-full w-full">
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
        {financialMarkers.map((e) => (
          <CircleMarker
            key={e.id}
            center={[e.coordinates!.lat, e.coordinates!.lng]}
            radius={5}
            pathOptions={{
              color: (e.deltaPercent ?? 0) >= 0 ? LAYER_COLORS.financial_up : LAYER_COLORS.financial_down,
              fillColor: (e.deltaPercent ?? 0) >= 0 ? LAYER_COLORS.financial_up : LAYER_COLORS.financial_down,
              fillOpacity: 0.7,
              weight: 1,
            }}
          >
            <Tooltip direction="top" offset={[0, -6]} className="dark-tooltip">
              <span className="text-[10px] font-mono">
                {e.label} {e.value?.toLocaleString()} {(e.deltaPercent ?? 0) >= 0 ? "+" : ""}{e.deltaPercent?.toFixed(2)}%
              </span>
            </Tooltip>
          </CircleMarker>
        ))}

        {/* Layer: Aviation */}
        {aviation.map((e) => (
          <CircleMarker
            key={e.id}
            center={[e.coordinates!.lat, e.coordinates!.lng]}
            radius={2.5}
            pathOptions={{
              color: LAYER_COLORS.aviation,
              fillColor: LAYER_COLORS.aviation,
              fillOpacity: 0.8,
              weight: 0.5,
            }}
          >
            <Popup>
              <div className="text-[10px]">
                <div className="font-bold">{e.label}</div>
                <div>{(e as AviationEntity).metadata.originCountry}</div>
                <div>Alt: {e.coordinates?.alt?.toFixed(0)}m | Spd: {(e as AviationEntity).metadata.velocity?.toFixed(0)}m/s</div>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* Layer: Maritime */}
        {maritime.map((e) => (
          <CircleMarker
            key={e.id}
            center={[e.coordinates!.lat, e.coordinates!.lng]}
            radius={3}
            pathOptions={{
              color: LAYER_COLORS.maritime,
              fillColor: LAYER_COLORS.maritime,
              fillOpacity: 0.7,
              weight: 0.5,
            }}
          >
            <Popup>
              <div className="text-[10px]">
                <div className="font-bold">{(e as MaritimeEntity).metadata.shipName}</div>
                <div>Type: {e.subtype} | Flag: {(e as MaritimeEntity).metadata.flag ?? "N/A"}</div>
                <div>Speed: {(e as MaritimeEntity).metadata.speed}kn | Course: {(e as MaritimeEntity).metadata.course}°</div>
                <div>Dest: {(e as MaritimeEntity).metadata.destination ?? "N/A"}</div>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* Layer: Geo-Conflicts */}
        {conflicts.map((e) => {
          if (!e.coordinates) return null;
          const fatalities = (e as GeoConflictEntity).metadata.fatalities;
          const radius = Math.max(3, Math.min(10, 3 + fatalities * 0.3));

          return (
            <CircleMarker
              key={e.id}
              center={[e.coordinates.lat, e.coordinates.lng]}
              radius={radius}
              pathOptions={{
                color: LAYER_COLORS.conflict,
                fillColor: LAYER_COLORS.conflict,
                fillOpacity: 0.6,
                weight: 1,
              }}
            >
              <Popup>
                <div className="text-[10px]">
                  <div className="font-bold">{e.label}</div>
                  <div>{(e as GeoConflictEntity).metadata.eventDate}</div>
                  <div>Fatalities: {fatalities}</div>
                  <div className="max-w-[200px] truncate">{(e as GeoConflictEntity).metadata.notes}</div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Map legend overlay */}
      <div className="absolute bottom-3 left-3 bg-[#0a0e17]/80 border border-[#1a2035] rounded px-2 py-1.5 flex gap-3 z-[1000]">
        {[
          { color: LAYER_COLORS.aviation, label: "Aviation" },
          { color: LAYER_COLORS.maritime, label: "Maritime" },
          { color: LAYER_COLORS.conflict, label: "Conflict" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[9px] text-[#5a6580]">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
