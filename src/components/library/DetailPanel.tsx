import React, { useState, useEffect, useRef } from "react";
import { VinylDisc } from "../VinylDisc";
import { getAlbumDetails, deleteAlbum, addAlbum, promoteAlbum } from "../../services/api";
import type { Item, AlbumTrack, ArtistAlbum } from "../../types";

interface DetailPanelProps {
  item: Item;
  pickCount: number;
  lastPickedTs: number | null;
  onClose: () => void;
  onRemove: (item: Item) => void;
  onPlay?: () => void;
  onPromote?: (item: Item) => void;
}

function formatLastPlayed(ts: number | null): string {
  if (!ts) return "—";
  const days = Math.floor((Date.now() / 1000 - ts) / (60 * 60 * 24));
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function formatDuration(ms: number): string {
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

function daysAgo(ts: number | null): number {
  if (!ts) return Infinity;
  return Math.floor((Date.now() / 1000 - ts) / (60 * 60 * 24));
}

const detailsCache = new Map<string, { genres: string[]; artistAlbums: ArtistAlbum[]; tracks: AlbumTrack[] }>();

export function DetailPanel({ item, pickCount, lastPickedTs, onClose, onRemove, onPlay, onPromote }: DetailPanelProps) {
  const cached = detailsCache.get(item.external_id);
  const [genres, setGenres] = useState<string[]>(cached?.genres || []);
  const [artistAlbums, setArtistAlbums] = useState<ArtistAlbum[]>(cached?.artistAlbums || []);
  const [tracks, setTracks] = useState<AlbumTrack[]>(cached?.tracks || []);
  const [loadingDetails, setLoadingDetails] = useState(!cached);
  const [addingAlbums, setAddingAlbums] = useState<Set<string>>(new Set());
  const [addedAlbums, setAddedAlbums] = useState<Map<string, "favorite" | "recommendation">>(() => {
    const initial = new Map<string, "favorite" | "recommendation">();
    if (cached?.artistAlbums) {
      for (const a of cached.artistAlbums) {
        if (a.already_added) initial.set(a.spotify_id, a.already_added);
      }
    }
    return initial;
  });
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const removeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [promoting, setPromoting] = useState(false);
  const [promoted, setPromoted] = useState(false);

  useEffect(() => {
    if (detailsCache.has(item.external_id)) {
      const c = detailsCache.get(item.external_id)!;
      setGenres(c.genres);
      setArtistAlbums(c.artistAlbums);
      setTracks(c.tracks);
      setLoadingDetails(false);
      const initial = new Map<string, "favorite" | "recommendation">();
      for (const a of c.artistAlbums) {
        if (a.already_added) initial.set(a.spotify_id, a.already_added);
      }
      setAddedAlbums(initial);
      return;
    }
    let cancelled = false;
    setLoadingDetails(true);
    getAlbumDetails(item.external_id)
      .then((data) => {
        if (cancelled) return;
        detailsCache.set(item.external_id, { genres: data.genres, artistAlbums: data.artist_albums, tracks: data.tracks });
        setGenres(data.genres);
        setArtistAlbums(data.artist_albums);
        setTracks(data.tracks);
        const initial = new Map<string, "favorite" | "recommendation">();
        for (const a of data.artist_albums) {
          if (a.already_added) initial.set(a.spotify_id, a.already_added);
        }
        setAddedAlbums(initial);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingDetails(false); });
    return () => { cancelled = true; };
  }, [item.external_id]);

  const handleAddAlbum = async (album: ArtistAlbum, listType: "favorite" | "recommendation") => {
    setAddingAlbums((prev) => new Set([...prev, album.spotify_id]));
    try {
      await addAlbum({
        spotify_id: album.spotify_id,
        title: album.title,
        artist: album.artist,
        image_url: album.image_url || undefined,
        spotify_uri: album.spotify_uri,
        spotify_url: album.spotify_url,
        list_type: listType,
      });
      setAddedAlbums((prev) => new Map(prev).set(album.spotify_id, listType));
    } catch {}
    setAddingAlbums((prev) => {
      const next = new Set(prev);
      next.delete(album.spotify_id);
      return next;
    });
  };

  useEffect(() => {
    return () => {
      if (removeTimerRef.current) clearTimeout(removeTimerRef.current);
    };
  }, []);

  const handleRemoveClick = async () => {
    if (!removeConfirm) {
      setRemoveConfirm(true);
      removeTimerRef.current = setTimeout(() => setRemoveConfirm(false), 2000);
    } else {
      if (removeTimerRef.current) clearTimeout(removeTimerRef.current);
      try {
        await deleteAlbum(item.id);
        onRemove(item);
      } catch {
        setRemoveConfirm(false);
      }
    }
  };

  const handlePromote = async () => {
    if (promoting || promoted) return;
    setPromoting(true);
    try {
      await promoteAlbum(item.id);
      setPromoted(true);
      onPromote?.(item);
    } catch {}
    setPromoting(false);
  };

  const lastPlayedDays = daysAgo(lastPickedTs);
  const isRecent = lastPlayedDays <= 7;
  const multiDisc = tracks.some((t) => t.disc > 1);

  return (
    <div
      className="animate-panel-open"
      style={{
        background: "#1a1210",
        borderTop: "2px solid #ff5e00",
        borderBottom: "1px solid #3d2815",
        padding: "13px 14px 14px",
      }}
    >
      {/* Header: art + info */}
      <div className="flex gap-3 mb-3">
        <div
          className="shrink-0 flex items-center justify-center"
          style={{
            width: 82,
            height: 82,
            background: item.image_url
              ? undefined
              : "linear-gradient(145deg, rgba(40,30,20,0.8) 0%, rgba(0,0,0,0.7) 100%)",
            boxShadow: "3px 5px 16px rgba(0,0,0,0.8), inset 0 0 0 1px rgba(255,255,255,0.05)",
          }}
        >
          {item.image_url ? (
            <img src={item.image_url} alt={item.title} className="w-full h-full object-cover block" />
          ) : (
            <VinylDisc size={44} />
          )}
        </div>

        <div className="flex-1 overflow-hidden">
          <div
            className="font-display leading-none mb-0.5 truncate"
            style={{ fontSize: 22, color: "#f2e8d2", letterSpacing: "0.04em" }}
          >
            {item.title.toUpperCase()}
          </div>
          <div
            className="font-mono uppercase mb-2"
            style={{ fontSize: 10, color: "#907558", letterSpacing: "0.1em" }}
          >
            {item.creator}
          </div>

          <div className="flex gap-1">
            <div
              className="flex-1"
              style={{ background: "#0f0a0c", border: "1px solid #3d2815", padding: "4px 5px" }}
            >
              <div className="font-mono uppercase" style={{ fontSize: 10, color: "#907558", letterSpacing: "0.1em", marginBottom: 1 }}>
                LAST PLAYED
              </div>
              <div className="font-mono" style={{ fontSize: 10, color: isRecent ? "#39ff14" : "#f2e8d2", fontWeight: 500 }}>
                {formatLastPlayed(lastPickedTs)}
              </div>
            </div>
            <div
              className="flex-1"
              style={{ background: "#0f0a0c", border: "1px solid #3d2815", padding: "4px 5px" }}
            >
              <div className="font-mono uppercase" style={{ fontSize: 10, color: "#907558", letterSpacing: "0.1em", marginBottom: 1 }}>
                PLAYS
              </div>
              <div className="font-mono" style={{ fontSize: 10, color: "#ff5e00", fontWeight: 600 }}>
                {pickCount > 0 ? `×${pickCount}` : "—"}
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="shrink-0 self-start flex items-center justify-center cursor-pointer"
          style={{
            width: 22,
            height: 22,
            background: "transparent",
            border: "1px solid #3d2815",
            color: "#907558",
            fontSize: 10,
          }}
        >
          ✕
        </button>
      </div>
      
      {/* Actions */}
      <div className="flex gap-1.5" style={{ marginBottom: 10 }}>
        <a
          href={item.external_uri || item.external_url || "#"}
          onClick={(e) => { if (!item.external_uri && !item.external_url) e.preventDefault(); else onPlay?.(); }}
          className="flex-1 flex items-center justify-center gap-1 no-underline text-center font-mono"
          style={{
            fontSize: 10,
            padding: "6px 0",
            border: "1px solid rgba(29,185,84,0.3)",
            color: "#1DB954",
            background: "rgba(29,185,84,0.07)",
            letterSpacing: "0.1em",
            textDecoration: "none",
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
          PLAY ON SPOTIFY
        </a>
        {onPromote && (
          <button
            onClick={handlePromote}
            disabled={promoting || promoted}
            className="font-mono cursor-pointer disabled:opacity-60"
            style={{
              fontSize: 10,
              padding: "6px 10px",
              border: promoted ? "1px solid rgba(255,94,0,0.6)" : "1px solid rgba(255,94,0,0.35)",
              color: "#ff5e00",
              background: promoted ? "rgba(255,94,0,0.15)" : "transparent",
              letterSpacing: "0.08em",
            }}
            title="Move to favorites"
          >
            {promoting ? "★ …" : promoted ? "★ FAVED" : "★ FAVORITE"}
          </button>
        )}
        <button
          onClick={handleRemoveClick}
          className="font-mono cursor-pointer"
          style={{
            fontSize: 10,
            padding: "6px 10px",
            border: removeConfirm ? "1px solid rgba(255,85,85,0.5)" : "1px solid rgba(180,0,0,0.35)",
            color: "#ff5555",
            background: removeConfirm ? "rgba(180,0,0,0.15)" : "transparent",
          }}
        >
          {removeConfirm ? "REMOVE?" : "REMOVE"}
        </button>
      </div>
      {/* Genres */}
      <div style={{ minHeight: 28, marginBottom: 10 }}>
        {loadingDetails ? (
          <div className="flex gap-1">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse" style={{ width: 50 + i * 15, height: 22, background: "#0f0a0c", border: "1px solid #3d2815" }} />
            ))}
          </div>
        ) : genres.length > 0 ? (
          <div className="flex gap-1 flex-wrap">
            {genres.map((g) => (
              <span
                key={g}
                className="font-mono"
                style={{ fontSize: 10, padding: "2px 6px", border: "1px solid rgba(255,94,0,0.35)", color: "#ff5e00", letterSpacing: "0.08em" }}
              >
                {g}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* Track list */}
      <div style={{ marginBottom: 10 }}>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="font-mono uppercase shrink-0" style={{ fontSize: 10, color: "#907558", letterSpacing: "0.1em" }}>
            TRACKS
          </span>
          <div className="flex-1 h-px" style={{ background: "#3d2815" }} />
          {!loadingDetails && tracks.length > 0 && (
            <span className="font-mono" style={{ fontSize: 10, color: "#907558" }}>
              {tracks.length}
            </span>
          )}
        </div>
        <div style={{ minHeight: 100 }}>
          {loadingDetails ? (
            <div>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse" style={{ height: 18, marginBottom: 4, background: "#0f0a0c", width: `${60 + (i * 17) % 40}%` }} />
              ))}
            </div>
          ) : tracks.length > 0 ? (
            <div>
              {tracks.map((track, i) => {
                const showDiscHeader = multiDisc && (i === 0 || track.disc !== tracks[i - 1].disc);
                return (
                  <React.Fragment key={`${track.disc}-${track.number}`}>
                    {showDiscHeader && (
                      <div className="font-mono" style={{ fontSize: 10, color: "#ff5e00", letterSpacing: "0.15em", paddingTop: 4, paddingBottom: 2 }}>
                        DISC {track.disc}
                      </div>
                    )}
                    <div className="flex items-baseline gap-2 py-0.5">
                      <span className="font-mono shrink-0 text-right" style={{ fontSize: 10, color: "rgba(144,117,88,0.5)", width: 18 }}>
                        {track.number}
                      </span>
                      <span className="font-mono truncate flex-1" style={{ fontSize: 10, color: "#f2e8d2" }}>
                        {track.name}
                      </span>
                      <span className="font-mono shrink-0" style={{ fontSize: 10, color: "rgba(144,117,88,0.4)" }}>
                        {formatDuration(track.duration_ms)}
                      </span>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {/* More by artist */}
      <div style={{ minHeight: 100, marginBottom: 10 }}>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="font-mono uppercase shrink-0" style={{ fontSize: 10, color: "#907558", letterSpacing: "0.1em" }}>
            MORE BY {item.creator.toUpperCase()}
          </span>
          <div className="flex-1 h-px" style={{ background: "#3d2815" }} />
        </div>
        {loadingDetails ? (
          <div className="flex gap-1.5 pb-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="shrink-0" style={{ width: 72 }}>
                <div className="animate-pulse" style={{ width: 72, height: 72, background: "#0f0a0c" }} />
                <div className="animate-pulse" style={{ height: 12, marginTop: 3, background: "#0f0a0c", width: "80%" }} />
              </div>
            ))}
          </div>
        ) : artistAlbums.length > 0 ? (
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
            {artistAlbums.slice(0, 10).map((album) => {
              const added = addedAlbums.get(album.spotify_id);
              const isAdding = addingAlbums.has(album.spotify_id);
              return (
                <div key={album.spotify_id} className="shrink-0" style={{ width: 72 }}>
                  <div
                    className="relative"
                    style={{
                      width: 72,
                      height: 72,
                      background: album.image_url ? undefined : "#0f0a0c",
                      boxShadow: "2px 3px 8px rgba(0,0,0,0.6)",
                    }}
                  >
                    {album.image_url ? (
                      <img
                        src={album.image_url}
                        alt={album.title}
                        className="w-full h-full object-cover block"
                        loading="lazy"
                        draggable={false}
                        style={{ filter: added ? "brightness(0.4)" : undefined }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <VinylDisc size={28} />
                      </div>
                    )}
                    {added && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <span className="font-mono" style={{ fontSize: 10, color: added === "favorite" ? "#ff5e00" : "#00b4c8" }}>
                          {added === "favorite" ? "★ FAV" : "◈ REC"}
                        </span>
                      </div>
                    )}
                    {isAdding && (
                      <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
                        <div className="animate-spin" style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid #ff5e00", borderTopColor: "transparent" }} />
                      </div>
                    )}
                  </div>
                  <div
                    className="font-mono truncate"
                    style={{ fontSize: 10, color: "#f2e8d2", marginTop: 2, letterSpacing: "0.02em" }}
                    title={album.title}
                  >
                    {album.title}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono" style={{ fontSize: 10, color: "#907558" }}>
                      {album.total_tracks} trk{album.total_tracks !== 1 ? "s" : ""}
                    </span>
                    <span className="font-mono" style={{ fontSize: 10, color: "#907558" }}>
                      {album.release_date?.slice(0, 4)}
                    </span>
                  </div>
                  {!added && !isAdding ? (
                    <div className="flex gap-1 mt-1">
                      <button
                        onClick={() => handleAddAlbum(album, "favorite")}
                        className="font-mono cursor-pointer"
                        style={{ fontSize: 10, padding: "1px 4px", border: "1px solid rgba(255,94,0,0.4)", color: "#ff5e00", background: "rgba(255,94,0,0.08)" }}
                        title="Add to favorites"
                      >
                        ★
                      </button>
                      <button
                        onClick={() => handleAddAlbum(album, "recommendation")}
                        className="font-mono cursor-pointer"
                        style={{ fontSize: 10, padding: "1px 4px", border: "1px solid rgba(0,180,200,0.4)", color: "#00b4c8", background: "rgba(0,180,200,0.08)" }}
                        title="Add to recommendations"
                      >
                        ◈
                      </button>
                      <a
                        href={album.spotify_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center no-underline"
                        style={{ padding: "1px 4px", border: "1px solid rgba(29,185,84,0.3)", color: "#1DB954", background: "rgba(29,185,84,0.06)" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                        </svg>
                      </a>
                    </div>
                  ) : added ? (
                    <a
                      href={album.spotify_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 font-mono no-underline mt-1"
                      style={{ fontSize: 10, color: "#1DB954" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                      </svg>
                      Spotify
                    </a>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : !loadingDetails ? (
          <p className="font-mono italic" style={{ fontSize: 10, color: "rgba(144,117,88,0.5)" }}>
            No other albums found
          </p>
        ) : null}
      </div>

      
    </div>
  );
}
