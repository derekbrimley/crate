import React, { useState, useRef, useEffect, useCallback } from "react";
import { Layout } from "../components/Layout";
import { VinylDisc } from "../components/VinylDisc";
import { useAuth } from "../hooks/useAuth";
import {
  searchSpotify, addAlbum, getSpotifyLibrary, getSpotifyPlaylists,
  getPlaylistAlbums, bulkAddAlbums,
} from "../services/api";
import type { SpotifySearchResult, LibraryAlbum, SpotifyPlaylistInfo } from "../types";

type ListType = "favorite" | "recommendation";
type Tab = "search" | "library" | "playlists";

function SleeveArt({ url, title, size = 48 }: { url: string | null; title: string; size?: number }) {
  return url ? (
    <div className="relative shrink-0" style={{ width: size, height: size, boxShadow: "2px 3px 8px rgba(0,0,0,0.6)" }}>
      <img src={url} alt={title} className="w-full h-full object-cover block" />
      <div className="absolute inset-0 ring-1 ring-inset ring-black/40" />
    </div>
  ) : (
    <div className="shrink-0 flex items-center justify-center bg-crate-elevated" style={{ width: size, height: size }}>
      <VinylDisc size={Math.round(size * 0.7)} />
    </div>
  );
}

function SearchTab() {
  const [query, setQuery]       = useState("");
  const [results, setResults]   = useState<SpotifySearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding]     = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Map<string, ListType>>(new Map());
  const [error, setError]       = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const handleQuery = (q: string) => {
    setQuery(q);
    clearTimeout(timer.current);
    if (!q.trim()) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      setSearching(true); setError(null);
      try { const { albums } = await searchSpotify(q); setResults(albums); }
      catch { setError("Search failed. Try again."); setResults([]); }
      finally { setSearching(false); }
    }, 400);
  };

  const handleAdd = async (album: SpotifySearchResult, listType: ListType) => {
    const key = `${album.spotify_id}:${listType}`;
    setAdding(key);
    try {
      await addAlbum({ spotify_id: album.spotify_id, title: album.title, artist: album.artist, image_url: album.image_url || undefined, spotify_uri: album.spotify_uri, spotify_url: album.spotify_url, list_type: listType });
      setAddedIds((prev) => new Map(prev).set(album.spotify_id, listType));
    } catch { setError("Failed to add."); }
    finally { setAdding(null); }
  };

  return (
    <>
      <div className="relative mb-5">
        <input
          type="search" value={query} onChange={(e) => handleQuery(e.target.value)}
          placeholder="Search for an album..."
          className="w-full font-mono text-sm text-crate-text placeholder-crate-muted/50 outline-none transition-all"
          style={{ background: "#1a1210", border: "1px solid #3d2815", borderBottom: "2px solid #ff5e00", padding: "10px 40px 10px 14px", letterSpacing: "0.04em" }}
          onFocus={(e) => { e.currentTarget.style.boxShadow = "0 2px 12px rgba(255,94,0,0.15)"; }}
          onBlur={(e)  => { e.currentTarget.style.boxShadow = "none"; }}
        />
        {searching ? (
          <div className="absolute right-3 top-1/2 -translate-y-1/2"><div className="w-3.5 h-3.5 rounded-full border-2 border-crate-accent border-t-transparent animate-spin" /></div>
        ) : (
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-crate-muted/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        )}
      </div>

      {error && <p className="mb-3 font-mono text-xs text-red-400" style={{ letterSpacing: "0.05em" }}>{error}</p>}

      {results.length > 0 && (
        <ul>
          {results.map((album) => {
            const addedAs = addedIds.get(album.spotify_id);
            const addingFav = adding === `${album.spotify_id}:favorite`;
            const addingRec = adding === `${album.spotify_id}:recommendation`;
            return (
              <li key={album.spotify_id} className="flex items-center gap-3 py-3 border-b border-crate-border/50 last:border-0">
                <SleeveArt url={album.image_url} title={album.title} size={44} />
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-xs font-medium text-crate-text truncate">{album.title}</p>
                  <p className="font-mono text-[10px] text-crate-muted truncate mt-0.5">
                    {album.artist}
                    {album.total_tracks != null && <span className="opacity-50"> · {album.total_tracks} tracks</span>}
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {addedAs ? (
                    <span className="font-mono text-[9px] text-crate-accent px-2 py-1" style={{ letterSpacing: "0.12em" }}>
                      {addedAs === "favorite" ? "★ FAV" : "◈ REC"}
                    </span>
                  ) : (
                    <>
                      <button onClick={() => handleAdd(album, "favorite")} disabled={!!(addingFav || addingRec)}
                        className="font-mono text-[9px] px-2.5 py-1.5 transition-all duration-150 disabled:opacity-40"
                        style={{ background: "rgba(255,94,0,0.1)", border: "1px solid rgba(255,94,0,0.4)", color: "#ff5e00", letterSpacing: "0.12em" }}>
                        {addingFav ? "…" : "★ FAV"}
                      </button>
                      <button onClick={() => handleAdd(album, "recommendation")} disabled={!!(addingFav || addingRec)}
                        className="font-mono text-[9px] px-2.5 py-1.5 transition-all duration-150 disabled:opacity-40"
                        style={{ background: "rgba(0,180,200,0.1)", border: "1px solid rgba(0,180,200,0.4)", color: "#00b4c8", letterSpacing: "0.12em" }}>
                        {addingRec ? "…" : "◈ REC"}
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!searching && query && results.length === 0 && (
        <p className="mt-10 text-center font-mono text-xs text-crate-muted/50" style={{ letterSpacing: "0.1em" }}>NO RECORDS FOUND</p>
      )}
      {!query && (
        <div className="mt-16 flex flex-col items-center gap-4">
          <VinylDisc size={72} />
          <p className="font-display text-3xl text-crate-muted/20 tracking-widest">Feel free to look around.</p>
        </div>
      )}
    </>
  );
}

function SelectableRow({ album, selected, onToggle }: { album: LibraryAlbum; selected: boolean; onToggle: (id: string) => void }) {
  const disabled = album.already_added !== null;
  return (
    <li className={`flex items-center gap-3 py-2.5 border-b border-crate-border/50 last:border-0 transition-colors ${selected ? "bg-crate-accent/5" : ""} ${disabled ? "opacity-45" : ""}`}>
      <input type="checkbox" checked={selected} disabled={disabled} onChange={() => onToggle(album.spotify_id)} className="w-4 h-4 shrink-0 accent-[#ff5e00]" />
      <SleeveArt url={album.image_url} title={album.title} size={40} />
      <div className="flex-1 min-w-0">
        <p className="font-mono text-xs font-medium text-crate-text truncate">{album.title}</p>
        <p className="font-mono text-[10px] text-crate-muted truncate mt-0.5">
          {album.artist}
          {album.total_tracks != null && <span className="opacity-50"> · {album.total_tracks} tracks</span>}
        </p>
      </div>
      {album.already_added && (
        <span className="font-mono text-[9px] text-crate-accent shrink-0 px-1" style={{ letterSpacing: "0.1em" }}>
          {album.already_added === "favorite" ? "★" : "◈"}
        </span>
      )}
    </li>
  );
}

function BulkBar({ count, adding, onAdd }: { count: number; adding: boolean; onAdd: (t: ListType) => void }) {
  if (count === 0) return null;
  return (
    <div className="fixed bottom-20 left-0 right-0 z-50 px-4">
      <div className="max-w-xl mx-auto flex items-center justify-between gap-3 p-3"
        style={{ background: "rgba(26,18,16,0.97)", border: "1px solid #3d2815", backdropFilter: "blur(16px)", boxShadow: "0 8px 32px rgba(0,0,0,0.7)" }}>
        <span className="font-mono text-xs text-crate-text" style={{ letterSpacing: "0.08em" }}>{count} SELECTED</span>
        <div className="flex gap-2">
          <button onClick={() => onAdd("favorite")} disabled={adding}
            className="font-mono text-[9px] px-3 py-2 transition-all disabled:opacity-40"
            style={{ background: "rgba(255,94,0,0.15)", border: "1px solid rgba(255,94,0,0.5)", color: "#ff5e00", letterSpacing: "0.12em" }}>
            {adding ? "ADDING…" : "★ FAVORITES"}
          </button>
          <button onClick={() => onAdd("recommendation")} disabled={adding}
            className="font-mono text-[9px] px-3 py-2 transition-all disabled:opacity-40"
            style={{ background: "transparent", border: "1px solid #3d2815", color: "#907558", letterSpacing: "0.12em" }}>
            {adding ? "ADDING…" : "◈ RECS"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SpotifyConnectPrompt({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="mt-16 flex flex-col items-center gap-5">
      <VinylDisc size={64} />
      <div className="text-center">
        <p className="font-display text-base text-crate-muted/40 tracking-widest mb-1">SPOTIFY IMPORT</p>
        <p className="font-mono text-[10px] text-crate-muted/40 tracking-widest">CONNECT TO IMPORT YOUR LIBRARY</p>
      </div>
      <button
        onClick={onConnect}
        className="flex items-center gap-2.5 px-5 py-3 font-display text-xs transition-all duration-150 active:scale-[0.97]"
        style={{
          background: "transparent",
          border: "1px solid #39ff14",
          color: "#39ff14",
          textShadow: "0 0 8px #39ff14",
          boxShadow: "0 0 6px rgba(57,255,20,0.2),inset 0 0 8px rgba(57,255,20,0.04)",
          letterSpacing: "0.2em",
        }}
      >
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
        </svg>
        CONNECT SPOTIFY
      </button>
      <p className="font-mono text-[9px] text-crate-muted/30 tracking-widest">READ-ONLY ACCESS</p>
    </div>
  );
}

function LibraryTab({ spotifyConnected, onConnectSpotify }: { spotifyConnected: boolean; onConnectSpotify: () => void }) {
  const [albums, setAlbums]           = useState<LibraryAlbum[]>([]);
  const [total, setTotal]             = useState(0);
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [bulkAdding, setBulkAdding]   = useState(false);
  const [successMsg, setSuccessMsg]   = useState<string | null>(null);

  const loadPage = useCallback(async (offset: number) => {
    try {
      const data = await getSpotifyLibrary(50, offset);
      if (offset === 0) setAlbums(data.albums); else setAlbums((p) => [...p, ...data.albums]);
      setTotal(data.total);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to load library"); }
  }, []);

  useEffect(() => {
    if (!spotifyConnected) return;
    setLoading(true); loadPage(0).finally(() => setLoading(false));
  }, [loadPage, spotifyConnected]);

  if (!spotifyConnected) return <SpotifyConnectPrompt onConnect={onConnectSpotify} />;

  const toggleSelect = (id: string) => { setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
  const selectableAlbums = albums.filter((a) => a.already_added === null);
  const toggleAll = () => { setSelected(selected.size === selectableAlbums.length ? new Set() : new Set(selectableAlbums.map((a) => a.spotify_id))); };

  const handleBulkAdd = async (listType: ListType) => {
    const toAdd = albums.filter((a) => selected.has(a.spotify_id));
    if (!toAdd.length) return;
    setBulkAdding(true); setError(null);
    try {
      const { added } = await bulkAddAlbums(toAdd, listType);
      setSuccessMsg(`FILED ${added} RECORD${added !== 1 ? "S" : ""} → ${listType === "favorite" ? "FAVORITES" : "RECS"}`);
      setAlbums((p) => p.map((a) => selected.has(a.spotify_id) ? { ...a, already_added: listType } : a));
      setSelected(new Set());
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch { setError("Failed. Try again."); }
    finally { setBulkAdding(false); }
  };

  if (loading) return <div className="mt-16 flex justify-center"><div className="w-5 h-5 rounded-full border-2 border-crate-accent border-t-transparent animate-spin" /></div>;
  if (error && !albums.length) return <p className="mt-10 text-center font-mono text-xs text-red-400">{error}</p>;
  if (!albums.length) return <div className="mt-16 flex flex-col items-center gap-4"><VinylDisc size={60} /><p className="font-display text-3xl text-crate-muted/20 tracking-widest">EMPTY</p></div>;

  return (
    <>
      {successMsg && <div className="mb-4 px-3 py-2 font-mono text-[10px] text-center" style={{ background: "rgba(57,255,20,0.06)", border: "1px solid rgba(57,255,20,0.2)", color: "#39ff14", letterSpacing: "0.12em" }}>{successMsg}</div>}
      {error && <p className="mb-2 font-mono text-xs text-red-400">{error}</p>}
      <div className="flex items-center justify-between mb-3">
        <p className="font-mono text-[9px] text-crate-muted/60" style={{ letterSpacing: "0.12em" }}>{albums.length}/{total} RECORDS</p>
        {selectableAlbums.length > 0 && (
          <button onClick={toggleAll} className="font-mono text-[9px] text-crate-accent hover:text-crate-accent-dim transition-colors" style={{ letterSpacing: "0.12em" }}>
            {selected.size === selectableAlbums.length ? "DESELECT ALL" : "SELECT ALL"}
          </button>
        )}
      </div>
      <ul>{albums.map((a) => <SelectableRow key={a.spotify_id} album={a} selected={selected.has(a.spotify_id)} onToggle={toggleSelect} />)}</ul>
      {albums.length < total && (
        <button onClick={async () => { setLoadingMore(true); await loadPage(albums.length); setLoadingMore(false); }} disabled={loadingMore}
          className="mt-4 w-full py-3 font-mono text-[10px] text-crate-muted hover:text-crate-text disabled:opacity-40 transition-all"
          style={{ border: "1px solid #3d2815", letterSpacing: "0.15em" }}>
          {loadingMore ? "LOADING…" : `LOAD MORE (${total - albums.length} REMAINING)`}
        </button>
      )}
      <BulkBar count={selected.size} adding={bulkAdding} onAdd={handleBulkAdd} />
    </>
  );
}

function PlaylistsTab({ spotifyConnected, onConnectSpotify }: { spotifyConnected: boolean; onConnectSpotify: () => void }) {
  const [playlists, setPlaylists]         = useState<SpotifyPlaylistInfo[]>([]);
  const [totalPl, setTotalPl]             = useState(0);
  const [loadingPl, setLoadingPl]         = useState(true);
  const [loadingMorePl, setLoadingMorePl] = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [active, setActive]               = useState<SpotifyPlaylistInfo | null>(null);
  const [plAlbums, setPlAlbums]           = useState<LibraryAlbum[]>([]);
  const [loadingAlbums, setLoadingAlbums] = useState(false);
  const [selected, setSelected]           = useState<Set<string>>(new Set());
  const [bulkAdding, setBulkAdding]       = useState(false);
  const [successMsg, setSuccessMsg]       = useState<string | null>(null);

  const loadPlaylists = useCallback(async (offset: number) => {
    try {
      const data = await getSpotifyPlaylists(50, offset);
      if (offset === 0) setPlaylists(data.playlists); else setPlaylists((p) => [...p, ...data.playlists]);
      setTotalPl(data.total);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to load"); }
  }, []);

  useEffect(() => {
    if (!spotifyConnected) return;
    setLoadingPl(true); loadPlaylists(0).finally(() => setLoadingPl(false));
  }, [loadPlaylists, spotifyConnected]);

  if (!spotifyConnected) return <SpotifyConnectPrompt onConnect={onConnectSpotify} />;

  const openPlaylist = async (pl: SpotifyPlaylistInfo) => {
    setActive(pl); setLoadingAlbums(true); setError(null); setSelected(new Set()); setSuccessMsg(null);
    try { const data = await getPlaylistAlbums(pl.id); setPlAlbums(data.albums); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed"); setPlAlbums([]); }
    finally { setLoadingAlbums(false); }
  };
  const goBack = () => { setActive(null); setPlAlbums([]); setSelected(new Set()); setError(null); setSuccessMsg(null); };

  const toggleSelect = (id: string) => { setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
  const selectableAlbums = plAlbums.filter((a) => a.already_added === null);
  const toggleAll = () => { setSelected(selected.size === selectableAlbums.length ? new Set() : new Set(selectableAlbums.map((a) => a.spotify_id))); };

  const handleBulkAdd = async (listType: ListType) => {
    const toAdd = plAlbums.filter((a) => selected.has(a.spotify_id));
    if (!toAdd.length) return;
    setBulkAdding(true); setError(null);
    try {
      const { added } = await bulkAddAlbums(toAdd, listType);
      setSuccessMsg(`FILED ${added} RECORD${added !== 1 ? "S" : ""}`);
      setPlAlbums((p) => p.map((a) => selected.has(a.spotify_id) ? { ...a, already_added: listType } : a));
      setSelected(new Set());
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch { setError("Failed. Try again."); }
    finally { setBulkAdding(false); }
  };

  if (active) {
    return (
      <>
        <button onClick={goBack} className="flex items-center gap-1.5 font-mono text-[10px] text-crate-accent hover:text-crate-accent-dim transition-colors mb-4" style={{ letterSpacing: "0.12em" }}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          BACK
        </button>
        <div className="flex items-center gap-3 mb-5">
          <SleeveArt url={active.image_url} title={active.name} size={48} />
          <div className="min-w-0">
            <p className="font-display text-lg text-crate-text truncate" style={{ letterSpacing: "0.1em" }}>{active.name.toUpperCase()}</p>
            <p className="font-mono text-[10px] text-crate-muted">{active.track_count} TRACKS</p>
          </div>
        </div>
        {successMsg && <div className="mb-4 px-3 py-2 font-mono text-[10px] text-center" style={{ background: "rgba(57,255,20,0.06)", border: "1px solid rgba(57,255,20,0.2)", color: "#39ff14", letterSpacing: "0.12em" }}>{successMsg}</div>}
        {error && <p className="mb-2 font-mono text-xs text-red-400">{error}</p>}
        {loadingAlbums ? (
          <div className="mt-10 flex justify-center"><div className="w-5 h-5 rounded-full border-2 border-crate-accent border-t-transparent animate-spin" /></div>
        ) : plAlbums.length === 0 ? (
          <p className="mt-10 text-center font-mono text-[10px] text-crate-muted/50" style={{ letterSpacing: "0.1em" }}>NO ALBUMS IN THIS PLAYLIST</p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="font-mono text-[9px] text-crate-muted/60" style={{ letterSpacing: "0.12em" }}>{selectableAlbums.length} AVAILABLE</p>
              {selectableAlbums.length > 0 && (
                <button onClick={toggleAll} className="font-mono text-[9px] text-crate-accent hover:text-crate-accent-dim transition-colors" style={{ letterSpacing: "0.12em" }}>
                  {selected.size === selectableAlbums.length ? "DESELECT ALL" : "SELECT ALL"}
                </button>
              )}
            </div>
            <ul>{selectableAlbums.map((a) => <SelectableRow key={a.spotify_id} album={a} selected={selected.has(a.spotify_id)} onToggle={toggleSelect} />)}</ul>
            <BulkBar count={selected.size} adding={bulkAdding} onAdd={handleBulkAdd} />
          </>
        )}
      </>
    );
  }

  if (loadingPl) return <div className="mt-16 flex justify-center"><div className="w-5 h-5 rounded-full border-2 border-crate-accent border-t-transparent animate-spin" /></div>;
  if (error && !playlists.length) return <p className="mt-10 text-center font-mono text-xs text-red-400">{error}</p>;
  if (!playlists.length) return <div className="mt-16 flex flex-col items-center gap-4"><VinylDisc size={60} /><p className="font-display text-3xl text-crate-muted/20 tracking-widest">EMPTY</p></div>;

  return (
    <>
      <p className="font-mono text-[9px] text-crate-muted/60 mb-3" style={{ letterSpacing: "0.12em" }}>{playlists.length}/{totalPl} PLAYLISTS</p>
      <ul>
        {playlists.map((pl) => (
          <li key={pl.id} className="border-b border-crate-border/50 last:border-0">
            <button onClick={() => openPlaylist(pl)} className="w-full flex items-center gap-3 py-3 text-left transition-colors hover:bg-crate-elevated/30 -mx-1 px-1">
              <SleeveArt url={pl.image_url} title={pl.name} size={40} />
              <div className="flex-1 min-w-0">
                <p className="font-mono text-xs font-medium text-crate-text truncate">{pl.name}</p>
                <p className="font-mono text-[10px] text-crate-muted mt-0.5">{pl.track_count} TRACKS · {pl.owner}</p>
              </div>
              <svg className="w-3 h-3 text-crate-muted/40 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </li>
        ))}
      </ul>
      {playlists.length < totalPl && (
        <button onClick={async () => { setLoadingMorePl(true); await loadPlaylists(playlists.length); setLoadingMorePl(false); }} disabled={loadingMorePl}
          className="mt-4 w-full py-3 font-mono text-[10px] text-crate-muted hover:text-crate-text disabled:opacity-40 transition-all"
          style={{ border: "1px solid #3d2815", letterSpacing: "0.15em" }}>
          {loadingMorePl ? "LOADING…" : `LOAD MORE (${totalPl - playlists.length} LEFT)`}
        </button>
      )}
    </>
  );
}

const TABS: { key: Tab; label: string }[] = [
  { key: "search",    label: "SEARCH"    },
  { key: "library",   label: "LIBRARY"   },
  { key: "playlists", label: "PLAYLISTS" },
];

export function AddAlbums() {
  const [activeTab, setActiveTab] = useState<Tab>("search");
  const { user, login } = useAuth();
  const spotifyConnected = !!user?.spotifyId;

  return (
    <Layout title="Dig for Records">
      <div className="px-5 pt-5">
        <div className="flex mb-5 border-b border-crate-border">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="mr-5 pb-2.5 font-display text-sm transition-all duration-150"
                style={{
                  borderBottom: isActive ? "2px solid #ff5e00" : "2px solid transparent",
                  color: isActive ? "#ff5e00" : "#907558",
                  letterSpacing: "0.18em",
                  textShadow: isActive ? "0 0 8px rgba(255,94,0,0.4)" : "none",
                  marginBottom: -1,
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        {activeTab === "search"    && <SearchTab />}
        {activeTab === "library"   && <LibraryTab spotifyConnected={spotifyConnected} onConnectSpotify={login} />}
        {activeTab === "playlists" && <PlaylistsTab spotifyConnected={spotifyConnected} onConnectSpotify={login} />}
      </div>
    </Layout>
  );
}
