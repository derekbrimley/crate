import React from "react";
import { ShelfRow } from "./ShelfRow";
import { DetailPanel } from "./DetailPanel";
import type { Item } from "../../types";

interface PickStats {
  pickCount: number;
  lastPickedTs: number | null;
}

interface LibraryShelfProps {
  albums: Item[];
  spinesPerRow: number;
  groupLabel?: string;
  selectedAlbumId: number | null;
  onSelectAlbum: (id: number | null) => void;
  onRemoveAlbum: (item: Item) => void;
  pickStats: Map<number, PickStats>;
  sortKey?: string;
}

function formatStatLabel(item: Item, sortKey: string, pickStats: Map<number, PickStats>): string | undefined {
  const stats = pickStats.get(item.id);
  switch (sortKey) {
    case "plays":
      return stats?.pickCount ? `×${stats.pickCount}` : undefined;
    case "recent": {
      if (!stats?.lastPickedTs) return undefined;
      const days = Math.floor((Date.now() / 1000 - stats.lastPickedTs) / 86400);
      if (days <= 0) return "0d";
      if (days < 7) return `${days}d`;
      if (days < 30) return `${Math.floor(days / 7)}w`;
      return `${Math.floor(days / 30)}mo`;
    }
    case "added": {
      if (!item.added_at) return undefined;
      const d = new Date(item.added_at * 1000);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    }
    default:
      return undefined;
  }
}

export function LibraryShelf({
  albums,
  spinesPerRow,
  groupLabel,
  selectedAlbumId,
  onSelectAlbum,
  onRemoveAlbum,
  pickStats,
  sortKey,
}: LibraryShelfProps) {
  if (albums.length === 0) return null;

  const rows: Item[][] = [];
  for (let i = 0; i < albums.length; i += spinesPerRow) {
    rows.push(albums.slice(i, i + spinesPerRow));
  }

  const selectedItem = selectedAlbumId != null
    ? albums.find((a) => a.id === selectedAlbumId) || null
    : null;

  return (
    <div style={{ marginBottom: groupLabel ? 20 : 10 }}>
      {groupLabel && (
        <div className="flex items-center gap-2 mb-2" style={{ padding: "0 12px" }}>
          <span
            className="font-display shrink-0"
            style={{ fontSize: 13, color: "#ff5e00", letterSpacing: "0.15em" }}
          >
            {groupLabel.toUpperCase()}
          </span>
          <div className="flex-1 h-px" style={{ background: "#3d2815" }} />
          <span className="font-mono" style={{ fontSize: 10, color: "#907558", letterSpacing: "0.1em" }}>
            {albums.length}
          </span>
        </div>
      )}

      {rows.map((row, i) => {
        const rowHasSelected = selectedItem != null && row.some((a) => a.id === selectedAlbumId);
        const stats = selectedItem ? pickStats.get(selectedItem.id) : undefined;

        const statLabels = new Map<number, string>();
        if (sortKey && (sortKey === "plays" || sortKey === "recent" || sortKey === "added")) {
          for (const item of row) {
            const label = formatStatLabel(item, sortKey, pickStats);
            if (label) statLabels.set(item.id, label);
          }
        }

        return (
          <div key={i} style={{ marginBottom: i < rows.length - 1 ? 6 : 0 }}>
            <ShelfRow
              items={row}
              spinesPerRow={row.length}
              selectedAlbumId={selectedAlbumId}
              onSelectAlbum={onSelectAlbum}
              overlap={0}
              autoFit
              statLabels={statLabels.size > 0 ? statLabels : undefined}
              detailPanel={
                rowHasSelected && selectedItem ? (
                  <DetailPanel
                    item={selectedItem}
                    pickCount={stats?.pickCount ?? 0}
                    lastPickedTs={stats?.lastPickedTs ?? null}
                    onClose={() => onSelectAlbum(null)}
                    onRemove={onRemoveAlbum}
                  />
                ) : undefined
              }
            />
          </div>
        );
      })}
    </div>
  );
}
