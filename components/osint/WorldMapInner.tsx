"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface MarketItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  region: string;
}

interface WorldMapInnerProps {
  globalMarkets: MarketItem[];
}

const FINANCIAL_CENTERS: {
  name: string;
  lat: number;
  lng: number;
  symbols: string[];
  market: string;
}[] = [
  { name: "上海", lat: 31.23, lng: 121.47, symbols: ["000001"], market: "上证指数" },
  { name: "深圳", lat: 22.54, lng: 114.06, symbols: ["399001"], market: "深证成指" },
  { name: "香港", lat: 22.32, lng: 114.17, symbols: ["^HSI"], market: "恒生指数" },
  { name: "东京", lat: 35.68, lng: 139.69, symbols: ["^N225"], market: "日经225" },
  { name: "纽约", lat: 40.71, lng: -74.01, symbols: ["^DJI", "^IXIC", "^GSPC"], market: "美股" },
  { name: "伦敦", lat: 51.51, lng: -0.13, symbols: [], market: "伦敦" },
  { name: "法兰克福", lat: 50.11, lng: 8.68, symbols: [], market: "欧洲" },
];

function createDotIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="
      width: 12px; height: 12px;
      background: ${color};
      border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.3);
      box-shadow: 0 0 8px ${color}88;
    "></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}

export default function WorldMapInner({ globalMarkets }: WorldMapInnerProps) {
  const marketMap = new Map(globalMarkets.map(m => [m.symbol, m]));

  return (
    <div className="h-full min-h-[300px] rounded-lg overflow-hidden border border-slate-700/50">
      <MapContainer
        center={[25, 80]}
        zoom={2}
        minZoom={2}
        maxZoom={6}
        style={{ height: "100%", width: "100%", background: "#0f172a" }}
        attributionControl={false}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
        />
        {FINANCIAL_CENTERS.map((center) => {
          const marketData = center.symbols
            .map(s => marketMap.get(s))
            .filter(Boolean)[0];

          const change = marketData?.changePercent ?? 0;
          const color = change > 0 ? "#ef4444" : change < 0 ? "#22c55e" : "#94a3b8";

          return (
            <Marker
              key={center.name}
              position={[center.lat, center.lng]}
              icon={createDotIcon(color)}
            >
              <Popup className="dark-popup">
                <div className="text-xs">
                  <div className="font-bold">{center.name} · {center.market}</div>
                  {marketData ? (
                    <>
                      <div className="mt-1">
                        {marketData.price.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div style={{ color }}>
                        {change >= 0 ? "+" : ""}{change.toFixed(2)}%
                      </div>
                    </>
                  ) : (
                    <div className="text-gray-400 mt-1">暂无数据</div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
