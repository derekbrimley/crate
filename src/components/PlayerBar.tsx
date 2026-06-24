import React from "react";
import { usePlayer } from "../hooks/usePlayer";

export function PlayerBar() {
  const { available, currentTrack, paused, togglePlay, next, previous } = usePlayer();

  if (!available || !currentTrack) return null;

  const btn = "flex items-center justify-center w-9 h-9 text-crate-text/80 hover:text-crate-text transition-colors cursor-pointer";

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center gap-3 px-4 py-2 border-t"
      style={{ background: "#1a120b", borderColor: "#3d2815" }}
    >
      {/* Art */}
      {currentTrack.image_url && (
        <img src={currentTrack.image_url} alt="" className="w-11 h-11 object-cover" />
      )}

      {/* Title + artist */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-[12px] text-crate-text">{currentTrack.name}</p>
        <p className="truncate font-mono text-[10px] text-crate-muted">{currentTrack.artist}</p>
      </div>

      {/* Transport */}
      <div className="flex items-center gap-1">
        <button aria-label="Previous" className={btn} onClick={() => { void previous(); }}>
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>
        </button>
        <button aria-label={paused ? "Play" : "Pause"} className={btn} onClick={() => { void togglePlay(); }}>
          {paused ? (
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          ) : (
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zm8 0h4v14h-4z" /></svg>
          )}
        </button>
        <button aria-label="Next" className={btn} onClick={() => { void next(); }}>
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M16 6h2v12h-2zm-2 6L5.5 6v12z" /></svg>
        </button>
      </div>
    </div>
  );
}
