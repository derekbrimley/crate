import React, { useState } from "react";
import { usePlayer } from "../hooks/usePlayer";

/** Rough glyph per Spotify device type, for scanning the list quickly. */
function deviceGlyph(type: string): string {
  const t = type.toLowerCase();
  if (t === "smartphone") return "▯";
  if (t === "tablet") return "▭";
  if (t === "computer") return "▤";
  if (t === "speaker" || t === "avr" || t === "stb") return "◍";
  if (t === "tv" || t === "castvideo") return "▣";
  return "◆";
}

export function DevicePicker() {
  const { pickerOpen, closePicker, devices, deviceId, selectDevice, refreshDevices } = usePlayer();
  const [refreshing, setRefreshing] = useState(false);

  if (!pickerOpen) return null;

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await refreshDevices(); } finally { setRefreshing(false); }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.72)" }}
      onClick={closePicker}
    >
      <div
        className="w-full sm:max-w-sm"
        style={{ background: "#1a120b", border: "1px solid #3d2815", borderTop: "2px solid #ff5e00" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid #3d2815" }}>
          <div>
            <div className="font-display" style={{ fontSize: 16, color: "#f2e8d2", letterSpacing: "0.05em" }}>
              PLAY ON
            </div>
            <div className="font-mono" style={{ fontSize: 9, color: "#907558", letterSpacing: "0.08em" }}>
              AUDIO QUALITY FOLLOWS THE DEVICE
            </div>
          </div>
          <button
            onClick={closePicker}
            className="flex items-center justify-center cursor-pointer"
            style={{ width: 22, height: 22, background: "transparent", border: "1px solid #3d2815", color: "#907558", fontSize: 10 }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {devices.length > 0 ? (
          <div className="max-h-[50vh] overflow-y-auto">
            {devices.map((device) => {
              const selected = device.id === deviceId;
              return (
                <button
                  key={device.id}
                  onClick={() => selectDevice(device.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer"
                  style={{
                    background: selected ? "rgba(255,94,0,0.09)" : "transparent",
                    borderBottom: "1px solid rgba(61,40,21,0.6)",
                  }}
                >
                  <span style={{ color: selected ? "#ff5e00" : "#907558", fontSize: 14 }}>
                    {deviceGlyph(device.type)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className="block truncate font-mono"
                      style={{ fontSize: 12, color: selected ? "#ff5e00" : "#f2e8d2" }}
                    >
                      {device.name}
                    </span>
                    <span
                      className="block font-mono uppercase"
                      style={{ fontSize: 9, color: "#907558", letterSpacing: "0.1em" }}
                    >
                      {device.type}{device.is_active ? " · ACTIVE" : ""}
                    </span>
                  </span>
                  {selected && (
                    <span className="font-mono" style={{ fontSize: 10, color: "#ff5e00" }}>✓</span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="px-4 py-6 text-center">
            <p className="font-mono" style={{ fontSize: 11, color: "#f2e8d2", lineHeight: 1.6 }}>
              No Spotify device found.
            </p>
            <p className="font-mono mt-2" style={{ fontSize: 10, color: "#907558", lineHeight: 1.6 }}>
              Open Spotify on your phone or tablet — start anything playing for a
              second so it registers — then refresh.
            </p>
            <a
              href="spotify:"
              className="inline-block mt-3 font-mono no-underline"
              style={{
                fontSize: 10, padding: "6px 12px", letterSpacing: "0.1em",
                border: "1px solid rgba(29,185,84,0.4)", color: "#1DB954", background: "rgba(29,185,84,0.07)",
              }}
            >
              OPEN SPOTIFY APP
            </a>
          </div>
        )}

        <div className="px-4 py-3" style={{ borderTop: "1px solid #3d2815" }}>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-full font-mono uppercase cursor-pointer disabled:opacity-50"
            style={{
              fontSize: 10, padding: "6px 0", letterSpacing: "0.12em",
              border: "1px solid #3d2815", color: "#907558", background: "transparent",
            }}
          >
            {refreshing ? "Scanning…" : "Refresh devices"}
          </button>
        </div>
      </div>
    </div>
  );
}
