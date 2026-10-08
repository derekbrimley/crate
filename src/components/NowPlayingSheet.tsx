import React, { useCallback, useEffect, useState } from "react";
import { DetailPanel } from "./library/DetailPanel";
import { lookupAlbum } from "../services/api";
import { useDataCache } from "../contexts/DataCache";
import type { Item, PlayingAlbum } from "../types";

interface NowPlayingSheetProps {
  album: PlayingAlbum;
  onClose: () => void;
}

/**
 * The album Spotify is playing right now, as an Item the DetailPanel can render.
 * A non-positive id marks it as "not in the library", which is what makes the
 * panel offer ★ FAV / ◈ REC instead of remove/favorite.
 */
function toItem(album: PlayingAlbum): Item {
  return {
    id: 0,
    user_id: 0,
    media_type: "album",
    list_type: "favorite",
    title: album.name,
    creator: album.artist,
    image_url: album.image_url,
    external_id: album.id,
    external_uri: album.uri,
    external_url: album.url,
    added_at: 0,
    metadata: null,
  };
}

/**
 * Album details for whatever is currently playing, opened from the player bar.
 * The album may or may not be in the library, so it's looked up first: a saved
 * album gets the usual remove/favorite actions, an unsaved one gets add buttons.
 */
export function NowPlayingSheet({ album, onClose }: NowPlayingSheetProps) {
  const { pickStats, setFavorites, setRecommendations } = useDataCache();
  const [item, setItem] = useState<Item | null>(null);

  useEffect(() => {
    let cancelled = false;
    setItem(null);
    lookupAlbum(album.id)
      .then(({ item: found }) => {
        if (!cancelled) setItem(found ?? toItem(album));
      })
      .catch(() => {
        // Lookup failed — still show the album, just without library actions
        // resolved. Worst case the user re-opens the pane.
        if (!cancelled) setItem(toItem(album));
      });
    return () => { cancelled = true; };
  }, [album.id, album.name, album.artist, album.image_url, album.uri, album.url]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Keep the cached library lists in step so the Crates/Library pages don't show
  // an album this pane just removed (or miss one it just added).
  const dropFromLists = useCallback((removed: Item) => {
    setFavorites((prev) => prev.filter((i) => i.id !== removed.id));
    setRecommendations((prev) => prev.filter((i) => i.id !== removed.id));
  }, [setFavorites, setRecommendations]);

  const handleRemove = useCallback((removed: Item) => {
    dropFromLists(removed);
    onClose();
  }, [dropFromLists, onClose]);

  const handlePromote = useCallback((promoted: Item) => {
    const asFavorite = { ...promoted, list_type: "favorite" as const };
    setRecommendations((prev) => prev.filter((i) => i.id !== promoted.id));
    setFavorites((prev) => [...prev.filter((i) => i.id !== promoted.id), asFavorite]);
    setItem(asFavorite);
  }, [setFavorites, setRecommendations]);

  const handleAdd = useCallback((created: Item) => {
    if (created.list_type === "favorite") setFavorites((prev) => [...prev, created]);
    else setRecommendations((prev) => [...prev, created]);
    // Swap the placeholder for the real row so remove/favorite become available
    // without closing and re-opening the pane.
    setItem(created);
  }, [setFavorites, setRecommendations]);

  const stats = item ? pickStats.get(item.id) : undefined;

  return (
    <>
      {/* Backdrop — the player bar sits above it and stays usable. */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.65)" }}
        onClick={onClose}
      />
      <div
        className="relative z-40 max-w-xl lg:max-w-4xl mx-auto w-full overflow-y-auto scrollbar-hide"
        style={{ maxHeight: "calc(100vh - 230px)" }}
      >
        {item ? (
          <DetailPanel
            // Re-keying on the album resets the panel's own transient state
            // (remove confirmation, "added" flags) when the track rolls over
            // into a different album, while an add-in-place keeps it.
            key={item.external_id}
            item={item}
            pickCount={stats?.pickCount ?? 0}
            lastPickedTs={stats?.lastPickedTs ?? null}
            onClose={onClose}
            onRemove={handleRemove}
            playSource="now_playing"
            onPromote={handlePromote}
            onAdd={handleAdd}
          />
        ) : (
          <div
            className="flex items-center justify-center"
            style={{ background: "rgb(var(--c-elevated))", borderTop: "2px solid rgb(var(--c-accent))", height: 120 }}
          >
            <div
              className="animate-spin"
              style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid rgb(var(--c-accent))", borderTopColor: "transparent" }}
            />
          </div>
        )}
      </div>
    </>
  );
}
