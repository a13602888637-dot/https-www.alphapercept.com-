"use client";

interface StatusBarProps {
  health: Record<string, boolean>;
  errors: Record<string, string>;
  lastUpdate: Record<string, number>;
}

const ADAPTER_LABELS: Record<string, string> = {
  finance: "FIN",
  aviation: "AVI",
  maritime: "MAR",
  geoconflict: "GEO",
};

export function StatusBar({ health, errors, lastUpdate }: StatusBarProps) {
  const now = Date.now();

  return (
    <div className="h-5 bg-[#0d1220] border-t border-[#1a2035] flex items-center px-3 gap-4 text-[9px] font-mono">
      {/* Adapter status dots */}
      {Object.entries(ADAPTER_LABELS).map(([key, label]) => {
        const isUp = health[key] ?? false;
        const lastMs = lastUpdate[key as any];
        const ago = lastMs ? Math.round((now - lastMs) / 1000) : null;

        return (
          <div key={key} className="flex items-center gap-1">
            <div
              className={`w-1.5 h-1.5 rounded-full ${isUp ? "bg-emerald-500" : "bg-red-500 animate-pulse"}`}
            />
            <span className="text-[#5a6580]">{label}</span>
            {ago !== null && (
              <span className="text-[#3a4560]">{ago}s</span>
            )}
          </div>
        );
      })}

      {/* Error count */}
      {Object.keys(errors).length > 0 && (
        <span className="text-red-500 ml-auto">
          {Object.keys(errors).length} ERR
        </span>
      )}

      {/* Clock */}
      <span className="text-[#3a4560] ml-auto">
        {new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </span>
    </div>
  );
}
