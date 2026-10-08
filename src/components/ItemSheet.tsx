import React, { useCallback, useEffect, useState } from "react";
import { DetailPanel } from "./library/DetailPanel";
import { useDataCache } from "../contexts/DataCache";
import type { Item } from "../types";

interface ItemSheetProps {
  item: Item;
  /** Recorded as the pick's mode when something is played from the sheet. */
  playSource: string;
  onClose: () => void;
  /** Override the default remove (delete from library) behaviour, e.g. to dismiss a friend rec. */
  onRemove?: (item: Item) => void;
  /** Override the default promote (move to favorites) behaviour. */
  onPromote?: (item: Item) => void;
  /** Hide the play stats, for items that aren't library rows. */
  hideStats?: boolean;
}

/**
 * The details pane for a library item, as a bottom sheet over the page. By
 * default removing or promoting the item updates the cached library lists, so
 * whatever page is underneath re-renders without it.
 */
export function ItemSheet({ item, playSource, onClose, onRemove, onPromote, hideStats }: ItemSheetProps) {
  const { pickStats, setFavorites, setRecommendations } = useDataCache();
  const [current, setCurrent] = useState(item);

  useEffect(() => { setCurrent(item); }, [item]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleRemove = useCallback((removed: Item) => {
    if (onRemove) {
      onRemove(removed);
    } else {
      setFavorites((prev) => prev.filter((i) => i.id !== removed.id));
      setRecommendations((prev) => prev.filter((i) => i.id !== removed.id));
    }
    onClose();
  }, [onRemove, onClose, setFavorites, setRecommendations]);

  const handlePromote = useCallback((promoted: Item) => {
    if (onPromote) {
      onPromote(promoted);
      return;
    }
    const asFavorite = { ...promoted, list_type: "favorite" as const };
    setRecommendations((prev) => prev.filter((i) => i.id !== promoted.id));
    setFavorites((prev) => [...prev.filter((i) => i.id !== promoted.id), asFavorite]);
    setCurrent(asFavorite);
  }, [onPromote, setFavorites, setRecommendations]);

  // Adding a suggestion (or anything not yet saved) swaps in the real library
  // row, so the pane's library actions, like "Add to crate", become available.
  const handleAdd = useCallback((created: Item) => {
    if (created.list_type === "favorite") setFavorites((prev) => [...prev, created]);
    else setRecommendations((prev) => [...prev, created]);
    setCurrent(created);
  }, [setFavorites, setRecommendations]);

  const stats = hideStats ? undefined : pickStats.get(current.id);

  return (
    <>
      <div className="fixed inset-0 z-[60]" style={{ background: "rgba(0,0,0,0.65)" }} onClick={onClose} />
      <div
        className="fixed inset-x-0 bottom-0 z-[61] max-w-xl lg:max-w-4xl mx-auto overflow-y-auto scrollbar-hide"
        style={{ maxHeight: "85vh" }}
      >
        <DetailPanel
          key={current.external_id}
          item={current}
          pickCount={stats?.pickCount ?? 0}
          lastPickedTs={stats?.lastPickedTs ?? null}
          onClose={onClose}
          onRemove={handleRemove}
          onPromote={current.list_type === "recommendation" ? handlePromote : undefined}
          onAdd={handleAdd}
          playSource={playSource}
        />
      </div>
    </>
  );
}
