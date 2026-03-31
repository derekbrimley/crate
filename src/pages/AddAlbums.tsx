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

// ── Shared: Album row for search results (single-add) ───────────────────────

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
    <li className="flex items-center gap-3 p-3 bg-crate-elevated rounded-xl">
      <AlbumArt url={album.image_url} title={album.title} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-crate-text truncate">{album.title}</p>
        <p className="text-xs text-crate-muted truncate">{album.artist}</p>
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
              {isAddingFav ? "..." : "⭐ Fav"}
            </button>
            <button
              onClick={() => onAdd(album, "recommendation")}
              disabled={isAddingFav || isAddingRec}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-crate-surface border border-crate-border text-crate-muted hover:text-crate-text disabled:opacity-50 transition-colors"
            >
              {isAddingRec ? "..." : "📋 Rec"}
            </button>
          </>
        )}
      </div>
    </li>
  );
}

// ── Shared: Album art ────────────────────────────────────────────────────────

function AlbumArt({ url, title }: { url: string | null; title: string }) {
  if (url) {
    return <img src={url} alt={title} className="w-12 h-12 rounded-lg object-cover shrink-0" />;
  }
  return (
    <div className="w-12 h-12 rounded-lg bg-crate-border flex items-center justify-center shrink-0">
      <span className="text-xl">🎵</span>
    </div>
  );
}

// ── Shared: Selectable album row (for bulk import) ───────────────────────────

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
      className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
        disabled ? "bg-crate-elevated/50 opacity-60" : selected ? "bg-crate-accent/10 ring-1 ring-crate-accent/30" : "bg-crate-elevated"
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        disabled={disabled}
        onChange={() => onToggle(album.spotify_id)}
        className="w-5 h-5 rounded border-crate-border text-crate-accent focus:ring-crate-accent shrink-0 accent-[var(--color-crate-accent)]"
      />
      <AlbumArt url={album.image_url} title={album.title} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-crate-text truncate">{album.title}</p>
        <p className="text-xs text-crate-muted truncate">{album.artist}</p>
      </div>
      {album.already_added && (
        <span className="text-xs text-crate-accent font-medium px-2 py-1 shrink-0">
          {album.already_added === "favorite" ? "⭐ Fav" : "📋 Rec"}
        </span>
      )}
    </li>
  );
}

// ── Shared: Bulk action bar ──────────────────────────────────────────────────

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
      <div className="max-w-xl mx-auto bg-crate-elevated border border-crate-border rounded-2xl p-3 shadow-lg flex items-center justify-between gap-3">
        <span className="text-sm text-crate-text font-medium">
          {selectedCount} selected
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => onAdd("favorite")}
            disabled={adding}
            className="text-xs px-3 py-2 rounded-lg bg-crate-accent text-black font-semibold hover:bg-crate-accent-dim disabled:opacity-50 transition-colors"
          >
            {adding ? "Adding..." : "⭐ Add as Favorites"}
          </button>
          <button
            onClick={() => onAdd("recommendation")}
            disabled={adding}
            className="text-xs px-3 py-2 rounded-lg bg-crate-surface border border-crate-border text-crate-muted hover:text-crate-text disabled:opacity-50 transition-colors"
          >
            {adding ? "Adding..." : "📋 Add as Recs"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Search ──────────────────────────────────────────────────────────────

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
          placeholder="Search Spotify for an album..."
          className="w-full bg-crate-elevated text-crate-text placeholder-crate-muted rounded-xl px-4 py-3 pl-10 text-sm outline-none focus:ring-2 focus:ring-crate-accent transition-all"
        />
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-crate-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        {searching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 rounded-full border-2 border-crate-accent border-t-transparent animate-spin" />
          </div>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      {results.length > 0 && (
        <ul className="mt-4 space-y-2">
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
        <p className="mt-8 text-center text-crate-muted text-sm">No results found</p>
      )}

      {!query && (
        <div className="mt-12 text-center">
          <p className="text-4xl mb-4">🔍</p>
          <p className="text-crate-muted text-sm">Search for albums to add</p>
        </div>
      )}
    </>
  );
}

// ── Tab: Library ─────────────────────────────────────────────────────────────

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
      setSuccessMsg(`Added ${added} album${added !== 1 ? "s" : ""} to ${listType === "favorite" ? "Favorites" : "Recommendations"}!`);
      // Update already_added status and clear selection
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
      <div className="mt-12 flex justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-crate-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error && albums.length === 0) {
    return <p className="mt-8 text-center text-red-400 text-sm">{error}</p>;
  }

  if (albums.length === 0) {
    return (
      <div className="mt-12 text-center">
        <p className="text-4xl mb-4">📚</p>
        <p className="text-crate-muted text-sm">No saved albums in your Spotify library</p>
      </div>
    );
  }

  return (
    <>
      {successMsg && (
        <div className="mb-3 px-3 py-2 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm text-center">
          {successMsg}
        </div>
      )}

      {error && <p className="mb-2 text-sm text-red-400">{error}</p>}

      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-crate-muted">
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

      <ul className="space-y-2">
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
          className="mt-4 w-full py-2.5 rounded-xl bg-crate-elevated border border-crate-border text-sm text-crate-muted hover:text-crate-text disabled:opacity-50 transition-colors"
        >
          {loadingMore ? "Loading..." : `Load more (${total - albums.length} remaining)`}
        </button>
      )}

      <BulkActionBar selectedCount={selected.size} adding={bulkAdding} onAdd={handleBulkAdd} />
    </>
  );
}

// ── Tab: Playlists ───────────────────────────────────────────────────────────

function PlaylistsTab() {
  const [playlists, setPlaylists] = useState<SpotifyPlaylistInfo[]>([]);
  const [totalPlaylists, setTotalPlaylists] = useState(0);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  const [loadingMorePlaylists, setLoadingMorePlaylists] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Drill-down state
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
      setSuccessMsg(`Added ${added} album${added !== 1 ? "s" : ""} to ${listType === "favorite" ? "Favorites" : "Recommendations"}!`);
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

  // ── Playlist drill-down view ─────────────────────────────────────────────

  if (activePlaylist) {
    return (
      <>
        <button
          onClick={goBack}
          className="flex items-center gap-1.5 text-sm text-crate-accent hover:text-crate-accent-dim transition-colors mb-3"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to playlists
        </button>

        <div className="flex items-center gap-3 mb-4">
          {activePlaylist.image_url ? (
            <img src={activePlaylist.image_url} alt={activePlaylist.name} className="w-14 h-14 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-crate-border flex items-center justify-center shrink-0">
              <span className="text-2xl">🎶</span>
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-crate-text truncate">{activePlaylist.name}</p>
            <p className="text-xs text-crate-muted">{activePlaylist.track_count} tracks</p>
          </div>
        </div>

        {successMsg && (
          <div className="mb-3 px-3 py-2 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm text-center">
            {successMsg}
          </div>
        )}
        {error && <p className="mb-2 text-sm text-red-400">{error}</p>}

        {loadingAlbums ? (
          <div className="mt-8 flex justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-crate-accent border-t-transparent animate-spin" />
          </div>
        ) : playlistAlbums.length === 0 ? (
          <p className="mt-8 text-center text-crate-muted text-sm">No albums found in this playlist</p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-crate-muted">
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

            <ul className="space-y-2">
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

  // ── Playlist list view ───────────────────────────────────────────────────

  if (loadingPlaylists) {
    return (
      <div className="mt-12 flex justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-crate-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error && playlists.length === 0) {
    return <p className="mt-8 text-center text-red-400 text-sm">{error}</p>;
  }

  if (playlists.length === 0) {
    return (
      <div className="mt-12 text-center">
        <p className="text-4xl mb-4">🎶</p>
        <p className="text-crate-muted text-sm">No playlists found in your Spotify account</p>
      </div>
    );
  }

  return (
    <>
      <p className="text-xs text-crate-muted mb-3">
        {playlists.length} of {totalPlaylists} playlists
      </p>
      <ul className="space-y-2">
        {playlists.map((pl) => (
          <li key={pl.id}>
            <button
              onClick={() => openPlaylist(pl)}
              className="w-full flex items-center gap-3 p-3 bg-crate-elevated rounded-xl hover:bg-crate-surface transition-colors text-left"
            >
              {pl.image_url ? (
                <img src={pl.image_url} alt={pl.name} className="w-12 h-12 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-crate-border flex items-center justify-center shrink-0">
                  <span className="text-xl">🎶</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-crate-text truncate">{pl.name}</p>
                <p className="text-xs text-crate-muted">{pl.track_count} tracks · {pl.owner}</p>
              </div>
              <svg className="w-4 h-4 text-crate-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
          className="mt-4 w-full py-2.5 rounded-xl bg-crate-elevated border border-crate-border text-sm text-crate-muted hover:text-crate-text disabled:opacity-50 transition-colors"
        >
          {loadingMorePlaylists ? "Loading..." : `Load more (${totalPlaylists - playlists.length} remaining)`}
        </button>
      )}
    </>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string }[] = [
  { key: "search", label: "Search" },
  { key: "library", label: "Library" },
  { key: "playlists", label: "Playlists" },
];

export function AddAlbums() {
  const [activeTab, setActiveTab] = useState<Tab>("search");

  return (
    <Layout title="Add Albums">
      <div className="px-4 pt-4">
        {/* Tab bar */}
        <div className="flex gap-1 bg-crate-elevated rounded-xl p-1 mb-4">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab.key
                  ? "bg-crate-accent text-black"
                  : "text-crate-muted hover:text-crate-text"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "search" && <SearchTab />}
        {activeTab === "library" && <LibraryTab />}
        {activeTab === "playlists" && <PlaylistsTab />}
      </div>
    </Layout>
  );
}
