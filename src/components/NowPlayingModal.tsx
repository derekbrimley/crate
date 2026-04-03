import React, { useState, useEffect, useRef } from "react";
import { VinylDisc } from "./VinylDisc";
import { getAlbumDetails, addAlbum } from "../services/api";
import type { Item, AlbumTrack, ArtistAlbum } from "../types";

interface NowPlayingModalProps {
  item: Item;
  onClose: () => void;
  onPlay?: () => void;
}

function formatDuration(ms: number): string {
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export function NowPlayingModal({ item, onClose, onPlay }: NowPlayingModalProps) {
  const [tracks, setTracks] = useState<AlbumTrack[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [artistAlbums, setArtistAlbums] = useState<ArtistAlbum[]>([]);
  const [albumSort, setAlbumSort] = useState<"popularity" | "recency" | "title">("popularity");
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedAlbums, setAddedAlbums] = useState<Map<string, "favorite" | "recommendation">>(new Map());
  const [scrolled, setScrolled] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAlbumDetails(item.external_id)
      .then((data) => {
        if (cancelled) return;
        setTracks(data.tracks);
        setGenres(data.genres);
        setArtistAlbums(data.artist_albums);
        // Seed addedAlbums from the API response
        const initial = new Map<string, "favorite" | "recommendation">();
        for (const a of data.artist_albums) {
          if (a.already_added) initial.set(a.spotify_id, a.already_added);
        }
        setAddedAlbums(initial);
      })
      .catch((err) => console.error("Failed to load album details:", err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [item.external_id]);

  // Close on Escape + lock body scroll
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  // Entrance animation
  useEffect(() => {
    requestAnimationFrame(() => {
      backdropRef.current?.classList.add("opacity-100");
      contentRef.current?.classList.add("translate-y-0", "opacity-100");
    });
  }, []);

  // Track scroll to show/hide sticky header
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 80);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const handleAddAlbum = async (album: ArtistAlbum, listType: "favorite" | "recommendation") => {
    setAddingId(album.spotify_id);
    try {
      await addAlbum({
        spotify_id: album.spotify_id,
        title: album.title,
        artist: album.artist,
        image_url: album.image_url ?? undefined,
        spotify_uri: album.spotify_uri,
        spotify_url: album.spotify_url,
        list_type: listType,
      });
      setAddedAlbums((prev) => new Map(prev).set(album.spotify_id, listType));
    } catch (err) {
      console.error("Failed to add album:", err);
    } finally {
      setAddingId(null);
    }
  };

  const multiDisc = tracks.some((t) => t.disc > 1);

  const sortedArtistAlbums = [...artistAlbums].sort((a, b) => {
    if (albumSort === "popularity") return b.popularity - a.popularity;
    if (albumSort === "recency") return b.release_date.localeCompare(a.release_date);
    return a.title.localeCompare(b.title);
  });

  return (
    <div
      ref={backdropRef}
      className="fixed inset-x-0 top-0 bottom-16 sm:bottom-0 z-[60] flex items-end sm:items-center justify-center opacity-0 transition-opacity duration-300"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={contentRef}
        className="relative w-full max-w-md max-h-full sm:max-h-[90vh] overflow-y-auto scrollbar-hide
                   translate-y-8 opacity-0 transition-all duration-300 ease-out"
        style={{
          background: "linear-gradient(180deg, #1a1210 0%, #0f0a0c 100%)",
          border: "1px solid #3d2815",
          boxShadow: "0 0 60px rgba(0,0,0,0.8), 0 0 20px rgba(255,94,0,0.08)",
        }}
      >
        {/* Sticky header — always present, shows title when scrolled */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-4 transition-all duration-200"
          style={{
            background: scrolled ? "rgba(26,18,16,0.95)" : "transparent",
            backdropFilter: scrolled ? "blur(12px)" : "none",
            borderBottom: scrolled ? "1px solid #3d2815" : "1px solid transparent",
            height: 44,
          }}
        >
          <span
            className="text-[11px] font-mono text-crate-text tracking-wider uppercase truncate mr-3 transition-opacity duration-200"
            style={{ opacity: scrolled ? 1 : 0 }}
          >
            {item.title}
          </span>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center shrink-0
                       text-crate-muted hover:text-crate-text transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Spinning record section */}
        <div className="flex flex-col items-center pt-2 pb-4 px-6">
          {/* Record with album art */}
          <div className="relative" style={{ width: 200, height: 200 }}>
            {/* Vinyl disc behind the album art circle */}
            <div className="absolute inset-0 flex items-center justify-center animate-spin-vinyl">
              <VinylDisc size={200} isSpinning={false} />
            </div>
            {/* Album art circle on top, also spinning */}
            <div
              className="absolute inset-0 flex items-center justify-center animate-spin-vinyl"
              style={{ animationDuration: "4s" }}
            >
              <div
                className="rounded-full overflow-hidden"
                style={{
                  width: 100,
                  height: 100,
                  boxShadow: "0 0 0 2px rgba(0,0,0,0.8), 0 0 12px rgba(0,0,0,0.5)",
                }}
              >
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-crate-elevated" />
                )}
              </div>
            </div>
          </div>

          {/* Album info */}
          <h2
            className="font-display text-2xl text-crate-text text-center mt-5 leading-tight tracking-wide"
            style={{ textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}
          >
            {item.title.toUpperCase()}
          </h2>
          <p className="text-xs font-mono text-crate-muted mt-1 tracking-wider uppercase">
            {item.creator}
          </p>

          {/* Open in Spotify button */}
          <a
            href={item.external_uri || item.external_url || "#"}
            onClick={() => onPlay?.()}
            className="mt-4 flex items-center gap-2 px-4 py-2 border border-[#1DB954]/40
                       text-[11px] font-mono tracking-widest uppercase
                       text-[#1DB954] hover:bg-[#1DB954]/10 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>
            Play on Spotify
          </a>
        </div>

        {/* Divider */}
        <div
          className="mx-6 h-px"
          style={{ background: "linear-gradient(90deg, transparent, #3d2815, transparent)" }}
        />

        {/* Genres */}
        {!loading && genres.length > 0 && (
          <div className="px-6 pt-4 pb-0 flex flex-wrap gap-1.5">
            {genres.map((genre) => (
              <span
                key={genre}
                className="text-[9px] font-mono tracking-wider uppercase px-2 py-0.5 border border-crate-accent/30 text-crate-accent/70"
              >
                {genre}
              </span>
            ))}
          </div>
        )}

        {/* Track list */}
        <div className="px-6 py-4">
          <h3 className="text-[10px] font-mono text-crate-muted tracking-[0.2em] uppercase mb-3">
            Track List
          </h3>
          {loading ? (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-4 bg-crate-elevated animate-pulse rounded" style={{ width: `${70 + Math.random() * 30}%` }} />
              ))}
            </div>
          ) : (
            <div className="space-y-0">
              {tracks.map((track, i) => {
                const showDiscHeader = multiDisc && (i === 0 || track.disc !== tracks[i - 1].disc);
                return (
                  <React.Fragment key={`${track.disc}-${track.number}`}>
                    {showDiscHeader && (
                      <div className="text-[9px] font-mono text-crate-accent tracking-[0.2em] uppercase pt-2 pb-1">
                        Disc {track.disc}
                      </div>
                    )}
                    <div className="flex items-baseline gap-3 py-1 group/track">
                      <span className="text-[10px] font-mono text-crate-muted/50 w-5 text-right shrink-0">
                        {track.number}
                      </span>
                      <span className="text-[11px] font-mono text-crate-text truncate flex-1">
                        {track.name}
                      </span>
                      <span className="text-[10px] font-mono text-crate-muted/40 shrink-0">
                        {formatDuration(track.duration_ms)}
                      </span>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>

        {/* Divider */}
        <div
          className="mx-6 h-px"
          style={{ background: "linear-gradient(90deg, transparent, #3d2815, transparent)" }}
        />

        {/* More by artist */}
        <div className="px-6 py-4 pb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] font-mono text-crate-muted tracking-[0.2em] uppercase">
              More by {item.creator}
            </h3>
            {!loading && artistAlbums.length > 0 && (
              <div className="flex gap-1">
                {(["popularity", "recency", "title"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setAlbumSort(s)}
                    className={`text-[9px] font-mono tracking-wider px-1.5 py-0.5 transition-colors ${
                      albumSort === s
                        ? "text-crate-accent border border-crate-accent/50"
                        : "text-crate-muted/50 border border-transparent hover:text-crate-muted"
                    }`}
                  >
                    {s === "popularity" ? "POP" : s === "recency" ? "NEW" : "A–Z"}
                  </button>
                ))}
              </div>
            )}
          </div>
          {loading ? (
            <div className="grid grid-cols-3 gap-3">
              {[...Array(3)].map((_, i) => (
                <div key={i}>
                  <div className="aspect-square bg-crate-elevated animate-pulse" />
                  <div className="h-3 bg-crate-elevated animate-pulse mt-1.5 w-3/4" />
                </div>
              ))}
            </div>
          ) : artistAlbums.length === 0 ? (
            <p className="text-[11px] font-mono text-crate-muted/50 italic">
              No other albums found
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {sortedArtistAlbums.map((album) => {
                const added = addedAlbums.get(album.spotify_id);
                const isAdding = addingId === album.spotify_id;
                return (
                  <div key={album.spotify_id} className="group/album">
                    {/* Album art */}
                    <div className="relative aspect-square overflow-hidden bg-crate-elevated">
                      {album.image_url ? (
                        <img
                          src={album.image_url}
                          alt={album.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <VinylDisc size={40} />
                        </div>
                      )}
                      {/* Overlay with add buttons */}
                      {added ? (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <span className="text-[10px] font-mono text-crate-accent tracking-wider uppercase">
                            {added === "favorite" ? "★ Fav" : "◈ Rec"}
                          </span>
                        </div>
                      ) : (
                        <div className="absolute inset-0 bg-black/70 flex items-center justify-center gap-1.5
                                        opacity-0 group-hover/album:opacity-100 transition-opacity duration-150">
                          {isAdding ? (
                            <div className="w-4 h-4 border-2 border-crate-accent border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <button
                                onClick={() => handleAddAlbum(album, "favorite")}
                                className="px-2 py-1 text-[9px] font-mono text-crate-accent border border-crate-accent/50
                                           hover:bg-crate-accent/20 transition-colors tracking-wider"
                                title="Add to favorites"
                              >
                                ★ FAV
                              </button>
                              <button
                                onClick={() => handleAddAlbum(album, "recommendation")}
                                className="px-2 py-1 text-[9px] font-mono border transition-colors tracking-wider"
                                style={{ color: "#00b4c8", borderColor: "rgba(0,180,200,0.4)", background: "rgba(0,180,200,0.1)" }}
                                title="Add to recommendations"
                              >
                                ◈ REC
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    {/* Title */}
                    <p className="text-[10px] font-mono text-crate-text truncate mt-1.5 leading-snug" title={album.title}>
                      {album.title}
                    </p>
                    <p className="text-[9px] font-mono text-crate-muted/50 truncate">
                      {album.total_tracks} tracks
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
