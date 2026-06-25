import React, { useMemo, useState } from "react";
import type { Item } from "../../types";
import { findDuplicateGroups } from "../../lib/duplicates";
import { deleteAlbum } from "../../services/api";

interface DuplicatesPanelProps {
  items: Item[];
  pickStats: Map<number, { pickCount: number; lastPickedTs: number | null }>;
  onDeleted: (ids: number[]) => void;
  onClose: () => void;
}

function itemMeta(item: Item): Record<string, unknown> | null {
  return typeof item.metadata === "string" ? safeParse(item.metadata) : item.metadata;
}

function itemYear(item: Item): string {
  const rd = itemMeta(item)?.release_date;
  if (typeof rd === "string" && rd.length >= 4) return rd.slice(0, 4);
  return "—";
}

function itemTrackCount(item: Item): number | null {
  const tc = itemMeta(item)?.total_tracks;
  return typeof tc === "number" ? tc : null;
}

function safeParse(s: string): Record<string, unknown> | null {
  try { return JSON.parse(s); } catch { return null; }
}

export default function DuplicatesPanel({ items, pickStats, onDeleted, onClose }: DuplicatesPanelProps) {
  const groups = useMemo(() => findDuplicateGroups(items), [items]);
  const [marked, setMarked] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [errorIds, setErrorIds] = useState<Set<number>>(new Set());

  function toggle(id: number) {
    setMarked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDelete() {
    if (marked.size === 0) return;
    if (!window.confirm(`Delete ${marked.size} album${marked.size === 1 ? "" : "s"}? This can't be undone.`)) return;
    setDeleting(true);
    const ids = Array.from(marked);
    const results = await Promise.allSettled(ids.map((id) => deleteAlbum(id)));
    const ok: number[] = [];
    const failed = new Set<number>();
    results.forEach((r, i) => {
      if (r.status === "fulfilled") ok.push(ids[i]);
      else failed.add(ids[i]);
    });
    setDeleting(false);
    setErrorIds(failed);
    setMarked(new Set(failed));
    if (ok.length > 0) onDeleted(ok);
  }

  return (
    <div style={{ padding: "0 12px", maxWidth: 896, margin: "0 auto" }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <span className="font-mono" style={{ fontSize: 11, color: "#907558", letterSpacing: "0.12em" }}>
          {groups.length === 0 ? "NO DUPLICATES FOUND" : `${groups.length} DUPLICATE GROUP${groups.length === 1 ? "" : "S"}`}
        </span>
        <button
          onClick={onClose}
          className="font-mono cursor-pointer"
          style={{ fontSize: 10, padding: "2px 8px", border: "1px solid #3d2815", background: "transparent", color: "#907558" }}
        >
          DONE
        </button>
      </div>

      {groups.map((g, gi) => (
        <div key={gi} style={{ marginBottom: 16, border: `1px solid ${g.matchType === "fuzzy" ? "#a86a1f" : "#3d2815"}`, padding: 10 }}>
          <div className="font-mono" style={{ fontSize: 10, letterSpacing: "0.12em", marginBottom: 8, color: g.matchType === "fuzzy" ? "#d99a3a" : "#907558" }}>
            {g.matchType === "fuzzy" ? "◇ POSSIBLE DUPLICATE" : "◆ EXACT DUPLICATE"}
          </div>
          {g.items.map((it) => {
            const isMarked = marked.has(it.id);
            const failed = errorIds.has(it.id);
            return (
              <div key={it.id} className="flex items-center gap-2" style={{ padding: "4px 0" }}>
                {(() => {
                  const trackCount = itemTrackCount(it);
                  const metaLine = [
                    it.creator,
                    itemYear(it),
                    it.list_type === "favorite" ? "★ FAV" : "◈ REC",
                    ...(trackCount !== null ? [`${trackCount} tracks`] : []),
                    `${pickStats.get(it.id)?.pickCount ?? 0} plays`,
                  ].join(" · ");
                  const inner = (
                    <>
                      {it.image_url
                        ? <img src={it.image_url} alt="" style={{ width: 36, height: 36, objectFit: "cover" }} />
                        : <div style={{ width: 36, height: 36, background: "#1a1210" }} />}
                      <div className="flex-1" style={{ minWidth: 0 }}>
                        <div className="font-mono truncate" style={{ fontSize: 11, color: "#f2e8d2" }}>{it.title}</div>
                        <div className="font-mono truncate" style={{ fontSize: 10, color: "#907558" }}>{metaLine}</div>
                        {failed && <div className="font-mono" style={{ fontSize: 9, color: "#e0573e" }}>delete failed — try again</div>}
                      </div>
                    </>
                  );
                  return it.external_url ? (
                    <a
                      href={it.external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 flex-1"
                      style={{ minWidth: 0, textDecoration: "none" }}
                      title="Open in Spotify"
                    >
                      {inner}
                    </a>
                  ) : (
                    <div className="flex items-center gap-2 flex-1" style={{ minWidth: 0 }}>
                      {inner}
                    </div>
                  );
                })()}
                <button
                  onClick={() => toggle(it.id)}
                  disabled={deleting}
                  className="font-mono cursor-pointer shrink-0"
                  style={{
                    fontSize: 10, padding: "2px 8px",
                    border: isMarked ? "1px solid #e0573e" : "1px solid #3d2815",
                    background: isMarked ? "rgba(224,87,62,0.12)" : "transparent",
                    color: isMarked ? "#e0573e" : "#907558",
                  }}
                >
                  {isMarked ? "✕ DELETE" : "DELETE"}
                </button>
              </div>
            );
          })}
        </div>
      ))}

      {groups.length > 0 && (
        <div className="sticky" style={{ bottom: 0, padding: "10px 0", background: "rgba(15,10,12,0.97)" }}>
          <button
            onClick={handleDelete}
            disabled={marked.size === 0 || deleting}
            className="font-mono cursor-pointer w-full"
            style={{
              fontSize: 11, padding: "8px", letterSpacing: "0.1em",
              border: "1px solid #e0573e",
              background: marked.size === 0 ? "transparent" : "rgba(224,87,62,0.15)",
              color: marked.size === 0 ? "#6b5640" : "#e0573e",
              opacity: deleting ? 0.6 : 1,
            }}
          >
            {deleting ? "DELETING…" : `DELETE ${marked.size} ITEM${marked.size === 1 ? "" : "S"}`}
          </button>
        </div>
      )}
    </div>
  );
}
