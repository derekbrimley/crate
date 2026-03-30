import React, { useState, useRef } from "react";
import { Layout } from "../components/Layout";
import { searchSpotify, addAlbum } from "../services/api";
import type { SpotifySearchResult } from "../types";

type ListType = "favorite" | "recommendation";

export function AddAlbums() {
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
      } catch (err) {
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
    } catch (err) {
      setError("Failed to add album.");
    } finally {
      setAdding(null);
    }
  };

  return (
    <Layout title="Add Albums">
      <div className="px-4 pt-4">
        {/* Search input */}
        <div className="relative">
          <input
            type="search"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search Spotify for an album..."
            className="w-full bg-crate-elevated text-crate-text placeholder-crate-muted rounded-xl px-4 py-3 pl-10 text-sm outline-none focus:ring-2 focus:ring-crate-accent transition-all"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-crate-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 rounded-full border-2 border-crate-accent border-t-transparent animate-spin" />
            </div>
          )}
        </div>

        {error && (
          <p className="mt-2 text-sm text-red-400">{error}</p>
        )}

        {/* Results */}
        {results.length > 0 && (
          <ul className="mt-4 space-y-2">
            {results.map((album) => {
              const addedAs = addedIds.get(album.spotify_id);
              const isAddingFav = adding === `${album.spotify_id}:favorite`;
              const isAddingRec = adding === `${album.spotify_id}:recommendation`;

              return (
                <li
                  key={album.spotify_id}
                  className="flex items-center gap-3 p-3 bg-crate-elevated rounded-xl"
                >
                  {album.image_url ? (
                    <img
                      src={album.image_url}
                      alt={album.title}
                      className="w-12 h-12 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-crate-border flex items-center justify-center shrink-0">
                      <span className="text-xl">🎵</span>
                    </div>
                  )}
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
                          onClick={() => handleAdd(album, "favorite")}
                          disabled={isAddingFav || isAddingRec}
                          className="text-xs px-2.5 py-1.5 rounded-lg bg-crate-accent text-black font-semibold hover:bg-crate-accent-dim disabled:opacity-50 transition-colors"
                          title="Add to Favorites"
                        >
                          {isAddingFav ? "..." : "⭐ Fav"}
                        </button>
                        <button
                          onClick={() => handleAdd(album, "recommendation")}
                          disabled={isAddingFav || isAddingRec}
                          className="text-xs px-2.5 py-1.5 rounded-lg bg-crate-surface border border-crate-border text-crate-muted hover:text-crate-text disabled:opacity-50 transition-colors"
                          title="Add to Recommendations"
                        >
                          {isAddingRec ? "..." : "📋 Rec"}
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
          <p className="mt-8 text-center text-crate-muted text-sm">No results found</p>
        )}

        {!query && (
          <div className="mt-12 text-center">
            <p className="text-4xl mb-4">🎵</p>
            <p className="text-crate-muted text-sm">
              Search for albums to add to your Favorites or Recommendations
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
