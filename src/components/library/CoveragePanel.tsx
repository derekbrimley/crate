import React from "react";
import type { Item } from "../../types";
import { VinylDisc } from "../VinylDisc";

interface CoveragePanelProps {
  albums: Item[];
  genres: string[];
  onClose: () => void;
}

export default function CoveragePanel({ albums, genres, onClose }: CoveragePanelProps) {
  return (
    <div style={{ padding: "0 12px" }}>
      <div className="max-w-xl lg:max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-3">
          <span className="font-display" style={{ fontSize: 15, color: "#f2e8d2", letterSpacing: "0.15em" }}>
            GAPS
          </span>
          <span className="font-mono" style={{ fontSize: 10, color: "#907558" }}>
            not in any crate
          </span>
          <div className="flex-1 h-px" style={{ background: "#3d2815" }} />
          <button
            onClick={onClose}
            className="font-mono cursor-pointer"
            style={{ fontSize: 10, padding: "2px 6px", border: "1px solid #3d2815", background: "transparent", color: "#907558" }}
          >
            CLOSE
          </button>
        </div>

        {genres.length > 0 && (
          <div className="mb-4">
            <div className="font-mono uppercase" style={{ fontSize: 10, color: "#907558", letterSpacing: "0.1em", marginBottom: 6 }}>
              UNCOVERED GENRES ({genres.length})
            </div>
            <div className="flex flex-wrap gap-1">
              {genres.map((g) => (
                <span key={g} className="font-mono" style={{ fontSize: 10, padding: "2px 6px", border: "1px solid rgba(255,94,0,0.35)", color: "#ff5e00" }}>
                  {g}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="font-mono uppercase" style={{ fontSize: 10, color: "#907558", letterSpacing: "0.1em", marginBottom: 6 }}>
          UNCOVERED ALBUMS ({albums.length})
        </div>
        {albums.length === 0 ? (
          <div className="flex items-center gap-3 py-6">
            <VinylDisc size={32} />
            <p className="font-mono italic" style={{ fontSize: 11, color: "#907558", opacity: 0.7 }}>
              every album lives in at least one crate
            </p>
          </div>
        ) : (
          <ul>
            {albums.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2 border-b border-crate-border/50 last:border-0">
                <div className="shrink-0" style={{ width: 40, height: 40, background: a.image_url ? undefined : "#0f0a0c" }}>
                  {a.image_url ? (
                    <img src={a.image_url} alt={a.title} className="w-full h-full object-cover block" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><VinylDisc size={22} /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-mono truncate" style={{ fontSize: 12, color: "#f2e8d2" }}>{a.title}</p>
                  <p className="font-mono truncate" style={{ fontSize: 10, color: "#907558" }}>{a.creator}</p>
                </div>
                <span className="font-mono shrink-0" style={{ fontSize: 10, color: a.list_type === "favorite" ? "#ff5e00" : "#00b4c8" }}>
                  {a.list_type === "favorite" ? "★" : "◈"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
