import React, { useState } from "react";
import { usePlayer } from "../hooks/usePlayer";
import { NowPlayingSheet } from "./NowPlayingSheet";

function fmt(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function PlayerBar() {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const {
    currentTrack, paused, togglePlay, next, previous, position, duration,
    volume, seek, setVolume, deviceName, supportsVolume,
  } = usePlayer();

  if (!currentTrack) return null;

  const btn = "flex items-center justify-center w-9 h-9 text-crate-text/80 hover:text-crate-text transition-colors cursor-pointer";

  // Podcast episodes have no album, so there are no album details to open.
  const album = currentTrack.album;

  return (
    <div className="fixed bottom-[70px] left-0 right-0 z-50">
      {/* Details for the playing album, stacked directly above the bar so the
          transport controls stay visible and usable while it's open. */}
      {detailsOpen && album && (
        <NowPlayingSheet album={album} onClose={() => setDetailsOpen(false)} />
      )}

      <div
        className="relative z-50 flex flex-col gap-1 px-4 py-2 border-t"
        style={{ background: "rgb(var(--c-elevated))", borderColor: "rgb(var(--c-border))" }}
      >
        <div className="flex items-center gap-3">
          {/* Art + title open the album's details pane, where it can be added
              to or removed from favorites / recommendations. */}
          <button
            type="button"
            onClick={() => setDetailsOpen((open) => !open)}
            disabled={!album}
            aria-label={album ? `Album details for ${album.name}` : undefined}
            aria-expanded={album ? detailsOpen : undefined}
            className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer disabled:cursor-default"
          >
            {currentTrack.image_url && (
              <img
                src={currentTrack.image_url}
                alt=""
                className="w-11 h-11 object-cover shrink-0"
                style={{ outline: detailsOpen ? "1px solid rgb(var(--c-accent))" : undefined }}
              />
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-[12px] text-crate-text">{currentTrack.name}</p>
              <p className="truncate font-mono text-[10px] text-crate-muted">{currentTrack.artist}</p>
            </div>
          </button>

          {/* Which Spotify device this is playing on — informational only. */}
          {deviceName && (
            <div
              className="hidden sm:flex items-center gap-1.5 max-w-[140px] shrink-0"
              style={{ color: "rgb(var(--c-muted))" }}
            >
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 6h16v10H4zm0 12h16v2H4zM6 8v6h12V8z" opacity="0.9" />
              </svg>
              <span className="truncate font-mono text-[10px]">{deviceName}</span>
            </div>
          )}

          {/* Volume — hidden on devices that reject remote volume (e.g. iOS) */}
          {supportsVolume && (
            <div className="hidden sm:flex items-center gap-1.5 w-24">
              <svg className="w-3.5 h-3.5 text-crate-muted shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2a4.5 4.5 0 00-2.5-4.03v8.06A4.5 4.5 0 0016.5 12z" />
              </svg>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => { void setVolume(Number(e.target.value)); }}
                className="w-full accent-crate-accent cursor-pointer"
                aria-label="Volume"
              />
            </div>
          )}

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

        {/* Seek bar */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] text-crate-muted shrink-0 w-8 text-right">{fmt(position)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={1000}
            value={Math.min(position, duration || 0)}
            onChange={(e) => { void seek(Number(e.target.value)); }}
            className="flex-1 accent-crate-accent cursor-pointer"
            aria-label="Seek"
          />
          <span className="font-mono text-[9px] text-crate-muted shrink-0 w-8">{fmt(duration)}</span>
        </div>
      </div>
    </div>
  );
}
