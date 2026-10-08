import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Layout } from "../components/Layout";
import { PageHeader } from "../components/PageHeader";
import { VinylDisc } from "../components/VinylDisc";
import { GridHeading } from "../components/CoverGrid";
import { ItemSheet } from "../components/ItemSheet";
import { useLibraryData } from "../hooks/useLibraryData";
import { usePlayer } from "../hooks/usePlayer";
import { matchLibrary } from "../lib/librarySearch";
import { matchPlaylists } from "../lib/playlistSearch";
import { isPlaylist, spotifyUriOf } from "../lib/media";
import {
  searchSpotify, searchArtists, getArtistAlbums, getAllSpotifyPlaylists, addAlbum,
  type ArtistResult,
} from "../services/api";
import type { Item, LibraryAlbum, SpotifyPlaylistInfo } from "../types";

interface SearchProps {
  onLogout: () => void;
}

type ListType = "favorite" | "recommendation";
type SpotifyTab = "albums" | "artists" | "playlists";

const LIBRARY_PREVIEW = 6;

function playlistAsRow(pl: SpotifyPlaylistInfo): LibraryAlbum {
  return {
    media_type: "playlist",
    spotify_id: pl.id,
    title: pl.name,
    artist: pl.owner ?? "",
    image_url: pl.image_url,
    spotify_uri: pl.uri,
    spotify_url: pl.url,
    total_tracks: pl.track_count,
    already_added: pl.already_added,
  };
}

/** A Spotify result as an Item the details pane can show. Negative id = not in the library. */
function rowAsItem(row: LibraryAlbum, fakeId: number): Item {
  return {
    id: fakeId,
    user_id: 0,
    media_type: row.media_type ?? "album",
    list_type: "recommendation",
    title: row.title,
    creator: row.artist,
    image_url: row.image_url,
    external_id: row.spotify_id,
    external_uri: row.spotify_uri,
    external_url: row.spotify_url,
    added_at: 0,
    metadata: null,
  };
}

/**
 * One search for everything: what's already in your library first, then
 * Spotify (albums, artists, or your own playlists). Every result can be
 * played, opened, or added.
 */
export function Search({ onLogout }: SearchProps) {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const [input, setInput] = useState(query);
  const [tab, setTab] = useState<SpotifyTab>("albums");
  const [showAllLibrary, setShowAllLibrary] = useState(false);
  const [selected, setSelected] = useState<Item | null>(null);
  const { allItems, setFavorites, setRecommendations } = useLibraryData();

  // Keep the query in the URL (without piling up history) so back/forward and
  // reloads land on the same search.
  const onInput = (value: string) => {
    setInput(value);
    setShowAllLibrary(false);
    setParams(value ? { q: value } : {}, { replace: true });
  };

  const libraryHits = useMemo(() => matchLibrary(allItems, query), [allItems, query]);
  const byExternalId = useMemo(() => new Map(allItems.map((i) => [i.external_id, i])), [allItems]);

  // Opening a Spotify result shows the library row when there is one, so the
  // pane offers the library actions rather than "add".
  const openRow = (row: LibraryAlbum, index: number) => {
    setSelected(byExternalId.get(row.spotify_id) ?? rowAsItem(row, -(index + 1)));
  };

  const addRow = async (row: LibraryAlbum, listType: ListType) => {
    const { item } = await addAlbum({
      spotify_id: row.spotify_id, title: row.title, artist: row.artist,
      image_url: row.image_url || undefined, spotify_uri: row.spotify_uri, spotify_url: row.spotify_url,
      list_type: listType, media_type: row.media_type, total_tracks: row.total_tracks,
    });
    if (item.list_type === "favorite") setFavorites((prev) => [...prev, item]);
    else setRecommendations((prev) => [...prev, item]);
  };

  return (
    <Layout>
      <PageHeader title="Search" backTo="back" onLogout={onLogout} hideSearch />

      <div style={{ padding: "14px 12px 100px" }}>
        <SearchInput value={input} onChange={onInput} />

        {query.trim() && (
          <>
            <GridHeading label="IN YOUR LIBRARY" count={libraryHits.length} />
            {libraryHits.length === 0 ? (
              <p className="font-mono" style={{ fontSize: 13, color: "rgb(var(--c-muted))", padding: "0 12px" }}>Nothing in your library matches.</p>
            ) : (
              <div style={{ padding: "0 12px" }}>
                {(showAllLibrary ? libraryHits : libraryHits.slice(0, LIBRARY_PREVIEW)).map((item) => (
                  <LibraryRow key={item.id} item={item} onOpen={() => setSelected(item)} />
                ))}
                {!showAllLibrary && libraryHits.length > LIBRARY_PREVIEW && (
                  <TextButton onClick={() => setShowAllLibrary(true)}>Show all {libraryHits.length}</TextButton>
                )}
              </div>
            )}
          </>
        )}

        <GridHeading label="SPOTIFY" />
        <div style={{ padding: "0 12px" }}>
          <Tabs tab={tab} onChange={setTab} />
          {tab === "albums" && <AlbumResults query={query} isOwned={(id) => byExternalId.get(id)?.list_type ?? null} onOpen={openRow} onAdd={addRow} />}
          {tab === "artists" && <ArtistResults query={query} isOwned={(id) => byExternalId.get(id)?.list_type ?? null} onOpen={openRow} onAdd={addRow} />}
          {tab === "playlists" && <PlaylistResults query={query} isOwned={(id) => byExternalId.get(id)?.list_type ?? null} onOpen={openRow} onAdd={addRow} />}
        </div>
      </div>

      {selected && <ItemSheet item={selected} playSource="search" onClose={() => setSelected(null)} />}
    </Layout>
  );
}

// ── Input and tabs ────────────────────────────────────────────────────────────

function SearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="relative" style={{ margin: "0 12px" }}>
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Albums, artists, playlists…"
        className="w-full font-mono text-crate-text placeholder-crate-muted/50 outline-none"
        // 16px keeps iOS from zooming in on focus.
        style={{ fontSize: 16, background: "rgb(var(--c-elevated))", border: "1px solid rgb(var(--c-border))", borderBottom: "2px solid rgb(var(--c-accent))", padding: "12px 44px 12px 14px", borderRadius: 6 }}
      />
      <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-crate-muted/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </div>
  );
}

function Tabs({ tab, onChange }: { tab: SpotifyTab; onChange: (t: SpotifyTab) => void }) {
  const tabs: { key: SpotifyTab; label: string }[] = [
    { key: "albums", label: "ALBUMS" },
    { key: "artists", label: "ARTISTS" },
    { key: "playlists", label: "MY PLAYLISTS" },
  ];
  return (
    <div className="flex mb-3" style={{ border: "1px solid rgb(var(--c-border))", borderRadius: 6, overflow: "hidden" }}>
      {tabs.map(({ key, label }) => {
        const active = key === tab;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className="flex-1 font-mono cursor-pointer"
            style={{
              fontSize: 12, minHeight: 44, letterSpacing: "0.12em", border: "none",
              background: active ? "rgb(var(--c-accent) / calc(0.14 * var(--tint)))" : "transparent",
              color: active ? "rgb(var(--c-accent))" : "rgb(var(--c-muted))",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ── Spotify result lists ──────────────────────────────────────────────────────

interface ResultsProps {
  query: string;
  /** The list a Spotify id is already filed under, if any. */
  isOwned: (spotifyId: string) => ListType | null;
  onOpen: (row: LibraryAlbum, index: number) => void;
  onAdd: (row: LibraryAlbum, listType: ListType) => Promise<void>;
}

/** Debounced Spotify lookups, ignoring answers to queries the user has typed past. */
function useDebouncedSearch<T>(query: string, run: (q: string) => Promise<T>) {
  const [result, setResult] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    const q = query.trim();
    if (!q) { setResult(null); setError(false); return; }
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(false);
      run(q)
        .then((r) => { if (!cancelled) setResult(r); })
        .catch(() => { if (!cancelled) setError(true); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
    // run is a stable module-level function per caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);
  return { result, loading, error };
}

function AlbumResults({ query, isOwned, onOpen, onAdd }: ResultsProps) {
  const { result, loading, error } = useDebouncedSearch(query, searchSpotify);
  if (!query.trim()) return <Hint>Search Spotify for albums to play or add.</Hint>;
  if (loading && !result) return <Spinner />;
  if (error) return <Hint>Search failed. Try again.</Hint>;
  const rows = result?.albums ?? [];
  if (rows.length === 0) return <Hint>No albums found.</Hint>;
  return <>{rows.map((row, i) => <ResultRow key={row.spotify_id} row={row} owned={isOwned(row.spotify_id)} onOpen={() => onOpen(row, i)} onAdd={onAdd} />)}</>;
}

function ArtistResults({ query, isOwned, onOpen, onAdd }: ResultsProps) {
  const { result, loading, error } = useDebouncedSearch(query, searchArtists);
  const [artist, setArtist] = useState<ArtistResult | null>(null);
  const [albums, setAlbums] = useState<LibraryAlbum[] | null>(null);

  useEffect(() => { setArtist(null); }, [query]);
  useEffect(() => {
    if (!artist) { setAlbums(null); return; }
    let cancelled = false;
    setAlbums(null);
    getArtistAlbums(artist.id)
      .then(({ albums: a }) => { if (!cancelled) setAlbums(a); })
      .catch(() => { if (!cancelled) setAlbums([]); });
    return () => { cancelled = true; };
  }, [artist]);

  if (artist) {
    return (
      <>
        <button
          onClick={() => setArtist(null)}
          className="font-mono cursor-pointer flex items-center gap-1.5 mb-2"
          style={{ fontSize: 13, minHeight: 40, background: "transparent", border: "none", color: "rgb(var(--c-accent))", padding: 0 }}
        >
          ‹ All artists
        </button>
        <div className="font-display mb-2" style={{ fontSize: 22, color: "rgb(var(--c-text))", letterSpacing: "0.12em" }}>
          {artist.name.toUpperCase()}
        </div>
        {albums === null ? <Spinner /> : albums.length === 0 ? <Hint>No albums found.</Hint> : (
          albums.map((row, i) => <ResultRow key={row.spotify_id} row={row} owned={isOwned(row.spotify_id)} onOpen={() => onOpen(row, i)} onAdd={onAdd} />)
        )}
      </>
    );
  }

  if (!query.trim()) return <Hint>Search for an artist to browse their albums.</Hint>;
  if (loading && !result) return <Spinner />;
  if (error) return <Hint>Search failed. Try again.</Hint>;
  const artists = result?.artists ?? [];
  if (artists.length === 0) return <Hint>No artists found.</Hint>;
  return (
    <>
      {artists.map((a) => (
        <button
          key={a.id}
          onClick={() => setArtist(a)}
          className="w-full flex items-center gap-3 text-left cursor-pointer"
          style={{ background: "transparent", border: "none", borderBottom: "1px solid rgb(var(--c-border) / calc(0.5 * var(--tint)))", padding: "10px 0", minHeight: 64 }}
        >
          <span className="shrink-0 overflow-hidden flex items-center justify-center" style={{ width: 52, height: 52, borderRadius: 26, background: "rgb(var(--c-elevated))" }}>
            {a.image_url ? <img src={a.image_url} alt="" className="w-full h-full object-cover" /> : <VinylDisc size={36} />}
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-mono truncate" style={{ fontSize: 15, color: "rgb(var(--c-text))" }}>{a.name}</span>
            {a.genres.length > 0 && (
              <span className="block font-mono truncate" style={{ fontSize: 12, color: "rgb(var(--c-muted))" }}>{a.genres.slice(0, 3).join(" · ")}</span>
            )}
          </span>
          <span className="shrink-0 font-mono" style={{ fontSize: 18, color: "rgb(var(--c-muted))" }}>›</span>
        </button>
      ))}
    </>
  );
}

function PlaylistResults({ query, isOwned, onOpen, onAdd }: ResultsProps) {
  const [playlists, setPlaylists] = useState<SpotifyPlaylistInfo[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    getAllSpotifyPlaylists().then(setPlaylists).catch(() => { setError(true); setPlaylists([]); });
  }, []);
  if (playlists === null) return <Spinner />;
  if (error) return <Hint>Couldn't load your Spotify playlists.</Hint>;
  const rows = matchPlaylists(playlists, query).map(playlistAsRow);
  if (rows.length === 0) return <Hint>{query.trim() ? "None of your playlists match." : "No playlists."}</Hint>;
  return <>{rows.map((row, i) => <ResultRow key={row.spotify_id} row={row} owned={isOwned(row.spotify_id)} onOpen={() => onOpen(row, i)} onAdd={onAdd} />)}</>;
}

// ── Rows ──────────────────────────────────────────────────────────────────────

function Cover({ url }: { url: string | null }) {
  return (
    <span className="shrink-0 overflow-hidden flex items-center justify-center" style={{ width: 52, height: 52, background: "rgb(var(--c-elevated))", boxShadow: "2px 3px 8px rgba(0,0,0,0.6)" }}>
      {url ? <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" /> : <VinylDisc size={36} />}
    </span>
  );
}

function PlayButton({ uri }: { uri: string | null }) {
  const player = usePlayer();
  return (
    <button
      onClick={(e) => { e.stopPropagation(); if (uri) void player.playAlbum(uri, undefined, "search"); }}
      title="Play on Spotify"
      className="shrink-0 flex items-center justify-center cursor-pointer"
      style={{ width: 40, height: 40, borderRadius: 6, border: "1px solid rgb(var(--c-spotify) / calc(0.4 * var(--tint)))", color: "rgb(var(--c-spotify))", background: "rgb(var(--c-spotify) / calc(0.08 * var(--tint)))" }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
    </button>
  );
}

function ListLabel({ listType }: { listType: ListType }) {
  return (
    <span className="shrink-0 font-mono" style={{ fontSize: 12, color: listType === "favorite" ? "rgb(var(--c-accent))" : "rgb(var(--c-rec))", letterSpacing: "0.08em" }}>
      {listType === "favorite" ? "★ FAV" : "◈ REC"}
    </span>
  );
}

function RowShell({ onOpen, children }: { onOpen: () => void; children: React.ReactNode }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}
      className="flex items-center gap-3 cursor-pointer"
      style={{ borderBottom: "1px solid rgb(var(--c-border) / calc(0.5 * var(--tint)))", padding: "10px 0", minHeight: 72 }}
    >
      {children}
    </div>
  );
}

function RowText({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <span className="flex-1 min-w-0">
      <span className="block font-mono truncate" style={{ fontSize: 14, color: "rgb(var(--c-text))" }}>{title}</span>
      <span className="block font-mono truncate mt-0.5" style={{ fontSize: 12, color: "rgb(var(--c-muted))" }}>{subtitle}</span>
    </span>
  );
}

function LibraryRow({ item, onOpen }: { item: Item; onOpen: () => void }) {
  return (
    <RowShell onOpen={onOpen}>
      <Cover url={item.image_url} />
      <RowText title={item.title} subtitle={`${isPlaylist(item) ? "Playlist · " : ""}${item.creator}`} />
      <ListLabel listType={item.list_type} />
      <PlayButton uri={spotifyUriOf(item)} />
    </RowShell>
  );
}

function ResultRow({ row, owned, onOpen, onAdd }: {
  row: LibraryAlbum;
  owned: ListType | null;
  onOpen: () => void;
  onAdd: (row: LibraryAlbum, listType: ListType) => Promise<void>;
}) {
  const [adding, setAdding] = useState<ListType | null>(null);
  const [failed, setFailed] = useState(false);
  const filed = owned ?? row.already_added;
  const add = async (e: React.MouseEvent, listType: ListType) => {
    e.stopPropagation();
    setAdding(listType);
    setFailed(false);
    try { await onAdd(row, listType); } catch { setFailed(true); } finally { setAdding(null); }
  };
  const year = row.release_date?.slice(0, 4);
  const subtitle = [
    row.media_type === "playlist" ? "Playlist" : null,
    row.artist,
    year,
    row.total_tracks != null ? `${row.total_tracks} tracks` : null,
  ].filter(Boolean).join(" · ");

  return (
    <RowShell onOpen={onOpen}>
      <Cover url={row.image_url} />
      <RowText title={row.title} subtitle={failed ? "Couldn't add. Try again." : subtitle} />
      {filed ? <ListLabel listType={filed} /> : (
        <span className="shrink-0 flex gap-1.5">
          <AddButton label="★" title="Add to favorites" color="--c-accent" busy={adding === "favorite"} disabled={adding !== null} onClick={(e) => add(e, "favorite")} />
          <AddButton label="◈" title="Add to recommendations" color="--c-rec" busy={adding === "recommendation"} disabled={adding !== null} onClick={(e) => add(e, "recommendation")} />
        </span>
      )}
      <PlayButton uri={row.spotify_uri || null} />
    </RowShell>
  );
}

function AddButton({ label, title, color, busy, disabled, onClick }: {
  label: string; title: string; color: string; busy: boolean; disabled: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex items-center justify-center cursor-pointer disabled:opacity-50"
      style={{
        width: 40, height: 40, borderRadius: 6, fontSize: 16,
        border: `1px solid rgb(var(${color}) / calc(0.45 * var(--tint)))`,
        color: `rgb(var(${color}))`, background: `rgb(var(${color}) / calc(0.08 * var(--tint)))`,
      }}
    >
      {busy ? "…" : label}
    </button>
  );
}

// ── Bits ──────────────────────────────────────────────────────────────────────

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="font-mono" style={{ fontSize: 13, color: "rgb(var(--c-muted))", padding: "12px 0" }}>{children}</p>;
}

function Spinner() {
  return (
    <div className="flex justify-center" style={{ padding: "24px 0" }}>
      <div className="w-6 h-6 rounded-full border-2 border-crate-accent border-t-transparent animate-spin" />
    </div>
  );
}

function TextButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="font-mono cursor-pointer"
      style={{ fontSize: 13, minHeight: 44, background: "transparent", border: "none", color: "rgb(var(--c-accent))", padding: 0 }}
    >
      {children}
    </button>
  );
}
