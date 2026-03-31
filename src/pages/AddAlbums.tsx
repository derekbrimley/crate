import React, { useState, useRef, useEffect, useCallback } from "react";
import { Layout } from "../components/Layout";
import {
  searchSpotify,
  addAlbum,
  getSpotifyLibrary,
  getSpotifyPlaylists,
  getPlaylistAlbums,
  bulkAddAlbums,
} from "../services/api";
import type { SpotifySearchResult, LibraryAlbum, SpotifyPlaylistInfo } from "../types";

type ListType = "favorite" | "recommendation";
type Tab = "search" | "library" | "playlists";

function AlbumRow({
  album,
  addedAs,
  adding,
  onAdd,
}: {
  album: SpotifySearchResult;
  addedAs: ListType | undefined;
  adding: string | null;
  onAdd: (album: SpotifySearchResult, listType: ListType) => void;
}) {
  const isAddingFav = adding === `${album.spotify_id}:favorite`;
  const isAddingRec = adding === `${album.spotify_id}:recommendation`;

  return (
    <li className="flex items-center gap-3.5 py-3 border-b border-crate-border last:border-0">
      <AlbumArt url={album.image_url} title={album.title} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-crate-text truncate">{album.title}</p>
        <p className="text-xs text-crate-muted truncate font-light">{album.artist}</p>
      </div>
      <div className="flex gap-1.5 shrink-0">
        {addedAs ? (
          <span className="text-xs text-crate-accent font-medium px-2 py-1">
            {addedAs === "favorite" ? "⭐ Fav" : "📋 Rec"}
          </span>
        ) : (
          <>
            <button
              onClick={() => onAdd(album, "favorite")}
              disabled={isAddingFav || isAddingRec}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-crate-accent text-black font-semibold hover:bg-crate-accent-dim disabled:opacity-50 transition-colors"
            >
              {isAddingFav ? "…" : "⭐ Fav"}
            </button>
            <button
              onClick={() => onAdd(album, "recommendation")}
              disabled={isAddingFav || isAddingRec}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-crate-elevated border border-crate-border text-crate-muted hover:text-crate-text disabled:opacity-50 transition-colors"
            >
              {isAddingRec ? "…" : "📋 Rec"}
            </button>
          </>
        )}
      </div>
    </li>
  );
}

function AlbumArt({ url, title }: { url: string | null; title: string }) {
  if (url) {
    return (
      <img
        src={url}
        alt={title}
        className="w-12 h-12 rounded-md object-cover shrink-0 shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
      />
    );
  }
  return (
    <div className="w-12 h-12 rounded-md bg-crate-elevated flex items-center justify-center shrink-0">
      <span className="text-lg opacity-20">♪</span>
    </div>
  );
}

function SelectableAlbumRow({
  album,
  selected,
  onToggle,
}: {
  album: LibraryAlbum;
  selected: boolean;
  onToggle: (spotifyId: string) => void;
}) {
  const disabled = album.already_added !== null;

  return (
    <li
      className={`flex items-center gap-3.5 py-3 border-b border-crate-border last:border-0 transition-colors ${
        disabled
          ? "opacity-50"
          : selected
          ? "bg-crate-accent/5"
          : ""
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        disabled={disabled}
        onChange={() => onToggle(album.spotify_id)}
        className="w-4 h-4 rounded border-crate-border text-crate-accent focus:ring-crate-accent shrink-0 accent-[var(--color-crate-accent)]"
      />
      <AlbumArt url={album.image_url} title={album.title} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-crate-text truncate">{album.title}</p>
        <p className="text-xs text-crate-muted truncate font-light">{album.artist}</p>
      </div>
      {album.already_added && (
        <span className="text-xs text-crate-accent font-medium px-2 py-1 shrink-0">
          {album.already_added === "favorite" ? "⭐" : "📋"}
        </span>
      )}
    </li>
  );
}

function BulkActionBar({
  selectedCount,
  adding,
  onAdd,
}: {
  selectedCount: number;
  adding: boolean;
  onAdd: (listType: ListType) => void;
}) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-20 left-0 right-0 z-50 px-4">
      <div className="max-w-xl mx-auto bg-crate-elevated/95 backdrop-blur-md border border-crate-border rounded-2xl p-3 shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex items-center justify-between gap-3">
        <span className="text-sm text-crate-text font-medium">
          {selectedCount} selected
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => onAdd("favorite")}
            disabled={adding}
            className="text-xs px-3 py-2 rounded-lg bg-crate-accent text-black font-semibold hover:bg-crate-accent-dim disabled:opacity-50 transition-colors"
          >
            {adding ? "Adding…" : "⭐ Favorites"}
          </button>
          <button
            onClick={() => onAdd("recommendation")}
            disabled={adding}
            className="text-xs px-3 py-2 rounded-lg bg-crate-elevated border border-crate-border text-crate-muted hover:text-crate-text disabled:opacity-50 transition-colors"
          >
            {adding ? "Adding…" : "📋 Recs"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SearchTab() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SpotifySearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Map<string, ListType>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const handleQueryChange = (q: string) => {
    setQuery(q);
    clearTimeout(searchTimer.current);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        const { albums } = await searchSpotify(q);
        setResults(albums);
      } catch {
        setError("Search failed. Try again.");
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const handleAdd = async (album: SpotifySearchResult, listType: ListType) => {
    const key = `${album.spotify_id}:${listType}`;
    setAdding(key);
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
      setAddedIds((prev) => new Map(prev).set(album.spotify_id, listType));
    } catch {
      setError("Failed to add album.");
    } finally {
      setAdding(null);
    }
  };

  return (
    <>
      <div className="relative">
        <input
          type="search"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Search Spotify for an album…"
          className="w-full bg-crate-elevated text-crate-text placeholder-crate-muted/60 rounded-xl px-4 py-3 pl-10 text-sm outline-none focus:ring-1 focus:ring-crate-accent/50 transition-all border border-crate-border focus:border-crate-accent/30"
        />
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-crate-muted/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        {searching && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
            <div className="w-3.5 h-3.5 rounded-full border-2 border-crate-accent border-t-transparent animate-spin" />
          </div>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-red-400 font-light">{error}</p>}

      {results.length > 0 && (
        <ul className="mt-3">
          {results.map((album) => (
            <AlbumRow
              key={album.spotify_id}
              album={album}
              addedAs={addedIds.get(album.spotify_id)}
              adding={adding}
              onAdd={handleAdd}
            />
          ))}
        </ul>
      )}

      {!searching && query && results.length === 0 && (
        <p className="mt-10 text-center text-crate-muted text-sm font-light">No results found</p>
      )}

      {!query && (
        <div className="mt-16 text-center">
          <p className="font-display text-4xl italic text-crate-muted/25 mb-3">search</p>
          <p className="text-crate-muted text-sm font-light">Find albums to add to your crate</p>
        </div>
      )}
    </>
  );
}

function LibraryTab() {
  const [albums, setAlbums] = useState<LibraryAlbum[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAdding, setBulkAdding] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadPage = useCallback(async (offset: number) => {
    try {
      const data = await getSpotifyLibrary(50, offset);
      if (offset === 0) {
        setAlbums(data.albums);
      } else {
        setAlbums((prev) => [...prev, ...data.albums]);
      }
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load library");
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadPage(0).finally(() => setLoading(false));
  }, [loadPage]);

  const loadMore = async () => {
    setLoadingMore(true);
    await loadPage(albums.length);
    setLoadingMore(false);
  };

  const toggleSelect = (spotifyId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(spotifyId)) next.delete(spotifyId);
      else next.add(spotifyId);
      return next;
    });
  };

  const selectableAlbums = albums.filter((a) => a.already_added === null);

  const toggleSelectAll = () => {
    if (selected.size === selectableAlbums.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableAlbums.map((a) => a.spotify_id)));
    }
  };

  const handleBulkAdd = async (listType: ListType) => {
    const toAdd = albums.filter((a) => selected.has(a.spotify_id));
    if (toAdd.length === 0) return;
    setBulkAdding(true);
    setError(null);
    try {
      const { added } = await bulkAddAlbums(toAdd, listType);
      setSuccessMsg(`Added ${added} album${added !== 1 ? "s" : ""} to ${listType === "favorite" ? "Favorites" : "Recommendations"}`);
      setAlbums((prev) =>
        prev.map((a) =>
          selected.has(a.spotify_id) ? { ...a, already_added: listType } : a
        )
      );
      setSelected(new Set());
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      setError("Failed to add albums. Try again.");
    } finally {
      setBulkAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="mt-16 flex justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-crate-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error && albums.length === 0) {
    return <p className="mt-10 text-center text-red-400 text-sm font-light">{error}</p>;
  }

  if (albums.length === 0) {
    return (
      <div className="mt-16 text-center">
        <p className="font-display text-4xl italic text-crate-muted/25 mb-3">empty</p>
        <p className="text-crate-muted text-sm font-light">No saved albums in your Spotify library</p>
      </div>
    );
  }

  return (
    <>
      {successMsg && (
        <div className="mb-4 px-3 py-2.5 rounded-xl bg-green-500/8 border border-green-500/15 text-green-400 text-sm text-center font-light">
          {successMsg}
        </div>
      )}

      {error && <p className="mb-2 text-sm text-red-400 font-light">{error}</p>}

      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-crate-muted font-light">
          {albums.length} of {total} saved albums
        </p>
        {selectableAlbums.length > 0 && (
          <button
            onClick={toggleSelectAll}
            className="text-xs text-crate-accent hover:text-crate-accent-dim transition-colors"
          >
            {selected.size === selectableAlbums.length ? "Deselect all" : "Select all"}
          </button>
        )}
      </div>

      <ul>
        {albums.map((album) => (
          <SelectableAlbumRow
            key={album.spotify_id}
            album={album}
            selected={selected.has(album.spotify_id)}
            onToggle={toggleSelect}
          />
        ))}
      </ul>

      {albums.length < total && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="mt-4 w-full py-3 rounded-xl border border-crate-border text-sm text-crate-muted hover:text-crate-text hover:border-crate-muted/30 disabled:opacity-50 transition-all duration-150 font-light"
        >
          {loadingMore ? "Loading…" : `Load more (${total - albums.length} remaining)`}
        </button>
      )}

      <BulkActionBar selectedCount={selected.size} adding={bulkAdding} onAdd={handleBulkAdd} />
    </>
  );
}

function PlaylistsTab() {
  const [playlists, setPlaylists] = useState<SpotifyPlaylistInfo[]>([]);
  const [totalPlaylists, setTotalPlaylists] = useState(0);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  const [loadingMorePlaylists, setLoadingMorePlaylists] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activePlaylist, setActivePlaylist] = useState<SpotifyPlaylistInfo | null>(null);
  const [playlistAlbums, setPlaylistAlbums] = useState<LibraryAlbum[]>([]);
  const [loadingAlbums, setLoadingAlbums] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAdding, setBulkAdding] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadPlaylists = useCallback(async (offset: number) => {
    try {
      const data = await getSpotifyPlaylists(50, offset);
      if (offset === 0) {
        setPlaylists(data.playlists);
      } else {
        setPlaylists((prev) => [...prev, ...data.playlists]);
      }
      setTotalPlaylists(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load playlists");
    }
  }, []);

  useEffect(() => {
    setLoadingPlaylists(true);
    loadPlaylists(0).finally(() => setLoadingPlaylists(false));
  }, [loadPlaylists]);

  const loadMorePlaylists = async () => {
    setLoadingMorePlaylists(true);
    await loadPlaylists(playlists.length);
    setLoadingMorePlaylists(false);
  };

  const openPlaylist = async (playlist: SpotifyPlaylistInfo) => {
    setActivePlaylist(playlist);
    setLoadingAlbums(true);
    setError(null);
    setSelected(new Set());
    setSuccessMsg(null);
    try {
      const data = await getPlaylistAlbums(playlist.id);
      setPlaylistAlbums(data.albums);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load playlist albums");
      setPlaylistAlbums([]);
    } finally {
      setLoadingAlbums(false);
    }
  };

  const goBack = () => {
    setActivePlaylist(null);
    setPlaylistAlbums([]);
    setSelected(new Set());
    setError(null);
    setSuccessMsg(null);
  };

  const toggleSelect = (spotifyId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(spotifyId)) next.delete(spotifyId);
      else next.add(spotifyId);
      return next;
    });
  };

  const selectableAlbums = playlistAlbums.filter((a) => a.already_added === null);

  const toggleSelectAll = () => {
    if (selected.size === selectableAlbums.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableAlbums.map((a) => a.spotify_id)));
    }
  };

  const handleBulkAdd = async (listType: ListType) => {
    const toAdd = playlistAlbums.filter((a) => selected.has(a.spotify_id));
    if (toAdd.length === 0) return;
    setBulkAdding(true);
    setError(null);
    try {
      const { added } = await bulkAddAlbums(toAdd, listType);
      setSuccessMsg(`Added ${added} album${added !== 1 ? "s" : ""} to ${listType === "favorite" ? "Favorites" : "Recommendations"}`);
      setPlaylistAlbums((prev) =>
        prev.map((a) =>
          selected.has(a.spotify_id) ? { ...a, already_added: listType } : a
        )
      );
      setSelected(new Set());
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      setError("Failed to add albums. Try again.");
    } finally {
      setBulkAdding(false);
    }
  };

  if (activePlaylist) {
    return (
      <>
        <button
          onClick={goBack}
          className="flex items-center gap-1.5 text-sm text-crate-accent hover:text-crate-accent-dim transition-colors mb-4"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to playlists
        </button>

        <div className="flex items-center gap-3.5 mb-5">
          {activePlaylist.image_url ? (
            <img src={activePlaylist.image_url} alt={activePlaylist.name} className="w-14 h-14 rounded-md object-cover shrink-0 shadow-[0_4px_16px_rgba(0,0,0,0.4)]" />
          ) : (
            <div className="w-14 h-14 rounded-md bg-crate-elevated flex items-center justify-center shrink-0">
              <span className="text-xl opacity-20">♪</span>
            </div>
          )}
          <div className="min-w-0">
            <p className="font-display text-lg italic font-semibold text-crate-text truncate">{activePlaylist.name}</p>
            <p className="text-xs text-crate-muted font-light">{activePlaylist.track_count} tracks</p>
          </div>
        </div>

        {successMsg && (
          <div className="mb-4 px-3 py-2.5 rounded-xl bg-green-500/8 border border-green-500/15 text-green-400 text-sm text-center font-light">
            {successMsg}
          </div>
        )}
        {error && <p className="mb-2 text-sm text-red-400 font-light">{error}</p>}

        {loadingAlbums ? (
          <div className="mt-10 flex justify-center">
            <div className="w-5 h-5 rounded-full border-2 border-crate-accent border-t-transparent animate-spin" />
          </div>
        ) : playlistAlbums.length === 0 ? (
          <p className="mt-10 text-center text-crate-muted text-sm font-light">No albums found in this playlist</p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-crate-muted font-light">
                {playlistAlbums.length} unique album{playlistAlbums.length !== 1 ? "s" : ""}
              </p>
              {selectableAlbums.length > 0 && (
                <button
                  onClick={toggleSelectAll}
                  className="text-xs text-crate-accent hover:text-crate-accent-dim transition-colors"
                >
                  {selected.size === selectableAlbums.length ? "Deselect all" : "Select all"}
                </button>
              )}
            </div>

            <ul>
              {playlistAlbums.map((album) => (
                <SelectableAlbumRow
                  key={album.spotify_id}
                  album={album}
                  selected={selected.has(album.spotify_id)}
                  onToggle={toggleSelect}
                />
              ))}
            </ul>

            <BulkActionBar selectedCount={selected.size} adding={bulkAdding} onAdd={handleBulkAdd} />
          </>
        )}
      </>
    );
  }

  if (loadingPlaylists) {
    return (
      <div className="mt-16 flex justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-crate-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error && playlists.length === 0) {
    return <p className="mt-10 text-center text-red-400 text-sm font-light">{error}</p>;
  }

  if (playlists.length === 0) {
    return (
      <div className="mt-16 text-center">
        <p className="font-display text-4xl italic text-crate-muted/25 mb-3">empty</p>
        <p className="text-crate-muted text-sm font-light">No playlists found in your Spotify account</p>
      </div>
    );
  }

  return (
    <>
      <p className="text-xs text-crate-muted font-light mb-3">
        {playlists.length} of {totalPlaylists} playlists
      </p>
      <ul>
        {playlists.map((pl) => (
          <li key={pl.id} className="border-b border-crate-border last:border-0">
            <button
              onClick={() => openPlaylist(pl)}
              className="w-full flex items-center gap-3.5 py-3 hover:bg-crate-elevated/40 transition-colors text-left rounded-lg -mx-1 px-1"
            >
              {pl.image_url ? (
                <img src={pl.image_url} alt={pl.name} className="w-12 h-12 rounded-md object-cover shrink-0 shadow-[0_2px_8px_rgba(0,0,0,0.35)]" />
              ) : (
                <div className="w-12 h-12 rounded-md bg-crate-elevated flex items-center justify-center shrink-0">
                  <span className="text-xl opacity-20">♪</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-crate-text truncate">{pl.name}</p>
                <p className="text-xs text-crate-muted font-light">{pl.track_count} tracks · {pl.owner}</p>
              </div>
              <svg className="w-3.5 h-3.5 text-crate-muted/50 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </li>
        ))}
      </ul>

      {playlists.length < totalPlaylists && (
        <button
          onClick={loadMorePlaylists}
          disabled={loadingMorePlaylists}
          className="mt-4 w-full py-3 rounded-xl border border-crate-border text-sm text-crate-muted hover:text-crate-text hover:border-crate-muted/30 disabled:opacity-50 transition-all duration-150 font-light"
        >
          {loadingMorePlaylists ? "Loading…" : `Load more (${totalPlaylists - playlists.length} remaining)`}
        </button>
      )}
    </>
  );
}

const TABS: { key: Tab; label: string }[] = [
  { key: "search", label: "Search" },
  { key: "library", label: "Library" },
  { key: "playlists", label: "Playlists" },
];

export function AddAlbums() {
  const [activeTab, setActiveTab] = useState<Tab>("search");

  return (
    <Layout title="Add Albums">
      <div className="px-5 pt-4">
        {/* Tab bar */}
        <div className="flex gap-0 bg-crate-elevated rounded-xl p-1 mb-5 border border-crate-border/50">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-150 ${
                activeTab === tab.key
                  ? "bg-crate-accent text-black shadow-sm"
                  : "text-crate-muted hover:text-crate-text"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "search" && <SearchTab />}
        {activeTab === "library" && <LibraryTab />}
        {activeTab === "playlists" && <PlaylistsTab />}
      </div>
    </Layout>
  );
}
