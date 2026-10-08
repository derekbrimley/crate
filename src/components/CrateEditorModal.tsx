import React, { useEffect, useMemo, useState } from "react";
import AdvancedFilters from "./library/AdvancedFilters";
import { VinylDisc } from "./VinylDisc";
import { useDataCache } from "../contexts/DataCache";
import { cratePool, makeEmptyCrate } from "../../lib/crates";
import { getItemGenres, type FilterRule } from "../lib/filters";
import { isPlaylist } from "../lib/media";
import type { CrateDefinition, Item } from "../types";

export { makeEmptyCrate };

interface CrateEditorModalProps {
  initial: CrateDefinition;
  onSave: (crate: CrateDefinition) => void | Promise<void>;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

const SEARCH_LIMIT = 8;

/**
 * Create or edit a crate: a name, optional library filters (with or without
 * recommendations), and records added or left out by hand. Every crate is
 * ranked with the same built-in weighting, so there's nothing to tune.
 */
export function CrateEditorModal({ initial, onSave, onDelete, onClose }: CrateEditorModalProps) {
  const { favorites, recommendations, pickStats } = useDataCache();
  const allItems = useMemo(() => [...favorites, ...recommendations], [favorites, recommendations]);

  const [name, setName] = useState(initial.name);
  const [useFilters, setUseFilters] = useState(initial.use_filters);
  const [includeRecs, setIncludeRecs] = useState(initial.include_recommendations);
  const [rules, setRules] = useState<FilterRule[]>(initial.filters.rules);
  const [matchMode, setMatchMode] = useState<"AND" | "OR">(initial.filters.matchMode);
  const [includeIds, setIncludeIds] = useState<number[]>(initial.include_ids);
  const [excludeIds, setExcludeIds] = useState<number[]>(initial.exclude_ids);
  const [query, setQuery] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  // Lock background scroll while the modal is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const draft: CrateDefinition = {
    ...initial,
    name: name.trim() || "Untitled Crate",
    use_filters: useFilters,
    include_recommendations: includeRecs,
    filters: { rules, matchMode },
    include_ids: includeIds,
    exclude_ids: excludeIds,
  };
  const pool = cratePool(draft, allItems, pickStats);
  const poolIds = new Set(pool.map((i) => i.id));

  const byId = useMemo(() => new Map(allItems.map((i) => [i.id, i])), [allItems]);
  const handPicked = includeIds.map((id) => byId.get(id)).filter((i): i is Item => !!i);
  const leftOut = excludeIds.map((id) => byId.get(id)).filter((i): i is Item => !!i);

  const availableGenres = useMemo(
    () => Array.from(new Set(allItems.flatMap((i) => getItemGenres(i)))).sort(),
    [allItems]
  );

  // Library items not already in the crate, matching every word of the query.
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const searchResults = words.length === 0 ? [] : allItems
    .filter((i) => !poolIds.has(i.id))
    .filter((i) => words.every((w) => `${i.title} ${i.creator}`.toLowerCase().includes(w)))
    .slice(0, SEARCH_LIMIT);

  const addByHand = (item: Item) => {
    setExcludeIds((ids) => ids.filter((id) => id !== item.id));
    setIncludeIds((ids) => (ids.includes(item.id) ? ids : [...ids, item.id]));
  };

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg flex flex-col"
        style={{ background: "rgb(var(--c-modal))", border: "1px solid rgb(var(--c-border))", borderRadius: 12, maxHeight: "92dvh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between shrink-0" style={{ padding: "14px 12px 12px 20px", borderBottom: "1px solid rgb(var(--c-border))" }}>
          <span className="font-display" style={{ fontSize: 22, color: "rgb(var(--c-text))", letterSpacing: "0.15em" }}>
            {initial.name ? "EDIT CRATE" : "NEW CRATE"}
          </span>
          <button
            onClick={onClose}
            className="flex items-center justify-center cursor-pointer"
            style={{ width: 44, height: 44, background: "transparent", border: "none", color: "rgb(var(--c-muted))", fontSize: 22 }}
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto" style={{ padding: "18px 20px", flex: 1 }}>
          <label style={labelStyle}>Name</label>
          <input
            style={inputStyle}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sunday Morning"
          />
          <p className="font-mono" style={{ fontSize: 13, color: "rgb(var(--c-accent))", margin: "10px 0 22px" }}>
            {pool.length} record{pool.length === 1 ? "" : "s"} in this crate
          </p>

          {/* Filters */}
          <Section>
            <Switch
              label="Fill from your library"
              help="Records matching the filters below join automatically."
              on={useFilters}
              onChange={setUseFilters}
            />
            {useFilters && (
              <>
                <Switch
                  label="Include recommendations"
                  help="Off: only your favorites can match."
                  on={includeRecs}
                  onChange={setIncludeRecs}
                />
                <label style={{ ...labelStyle, marginTop: 14 }}>Filters</label>
                {rules.length === 0 && (
                  <p className="font-mono" style={{ fontSize: 13, color: "rgb(var(--c-muted))", marginBottom: 10, lineHeight: 1.5 }}>
                    No filters: every {includeRecs ? "favorite and recommendation" : "favorite"} is in.
                  </p>
                )}
                <AdvancedFilters
                  rules={rules}
                  matchMode={matchMode}
                  availableGenres={availableGenres}
                  onChangeRules={setRules}
                  onChangeMatchMode={setMatchMode}
                  hiddenFields={["list"]}
                  size="large"
                  alwaysOpen
                />
              </>
            )}
          </Section>

          {/* Added by hand */}
          <Section>
            <label style={labelStyle}>Added by hand{handPicked.length > 0 ? ` · ${handPicked.length}` : ""}</label>
            {handPicked.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                action="Remove"
                onAction={() => setIncludeIds((ids) => ids.filter((id) => id !== item.id))}
              />
            ))}
            <input
              style={{ ...inputStyle, marginTop: handPicked.length > 0 ? 10 : 0 }}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your library to add…"
            />
            {searchResults.map((item) => (
              <ItemRow key={item.id} item={item} action="+ Add" accent onAction={() => { addByHand(item); setQuery(""); }} />
            ))}
            {words.length > 0 && searchResults.length === 0 && (
              <p className="font-mono" style={{ fontSize: 13, color: "rgb(var(--c-muted))", marginTop: 10 }}>
                Nothing else in your library matches.
              </p>
            )}
          </Section>

          {/* Left out */}
          {leftOut.length > 0 && (
            <Section>
              <label style={labelStyle}>Left out · {leftOut.length}</label>
              {leftOut.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  action="Put back"
                  onAction={() => setExcludeIds((ids) => ids.filter((id) => id !== item.id))}
                />
              ))}
            </Section>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between gap-2 shrink-0"
          style={{ padding: "12px 16px", borderTop: "1px solid rgb(var(--c-border))", background: "rgb(var(--c-modal))" }}
        >
          {onDelete ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <FooterButton onClick={() => onDelete(initial.id)} color="--c-danger">Delete</FooterButton>
                <FooterButton onClick={() => setConfirmDelete(false)}>Keep</FooterButton>
              </div>
            ) : (
              <FooterButton onClick={() => setConfirmDelete(true)}>Delete…</FooterButton>
            )
          ) : <span />}
          <div className="flex items-center gap-2">
            <FooterButton onClick={onClose}>Cancel</FooterButton>
            <FooterButton onClick={handleSave} color="--c-accent" filled disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </FooterButton>
          </div>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontFamily: '"IBM Plex Mono", monospace', fontSize: 12, letterSpacing: "0.16em",
  textTransform: "uppercase", color: "rgb(var(--c-muted))", display: "block", marginBottom: 8,
};

// 16px keeps iOS from zooming into the field on focus.
const inputStyle: React.CSSProperties = {
  background: "rgb(var(--c-hi) / calc(0.03 * var(--tint-hi)))", border: "1px solid rgb(var(--c-border) / calc(0.8 * var(--tint)))", borderRadius: 6,
  color: "rgb(var(--c-text))", fontFamily: '"IBM Plex Mono", monospace', fontSize: 16, padding: "11px 12px",
  width: "100%", outline: "none",
};

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ borderTop: "1px solid rgb(var(--c-border))", paddingTop: 18, marginBottom: 22 }}>
      {children}
    </div>
  );
}

function Switch({ label, help, on, onChange }: { label: string; help: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="w-full flex items-center gap-3 text-left cursor-pointer"
      style={{ background: "transparent", border: "none", padding: "6px 0", minHeight: 48 }}
    >
      <span className="flex-1 min-w-0">
        <span className="block font-mono" style={{ fontSize: 15, color: "rgb(var(--c-text))" }}>{label}</span>
        <span className="block font-mono mt-0.5" style={{ fontSize: 12, color: "rgb(var(--c-muted))" }}>{help}</span>
      </span>
      <span
        className="shrink-0 relative transition-colors"
        style={{
          width: 50, height: 30, borderRadius: 15,
          background: on ? "rgb(var(--c-accent))" : "rgb(var(--c-border))",
        }}
      >
        <span
          className="absolute transition-all"
          style={{ top: 3, left: on ? 23 : 3, width: 24, height: 24, borderRadius: 12, background: "rgb(var(--c-text))" }}
        />
      </span>
    </button>
  );
}

function ItemRow({ item, action, onAction, accent }: { item: Item; action: string; onAction: () => void; accent?: boolean }) {
  return (
    <div className="flex items-center gap-3" style={{ padding: "8px 0", borderBottom: "1px solid rgb(var(--c-border) / calc(0.5 * var(--tint)))" }}>
      <div className="shrink-0 flex items-center justify-center overflow-hidden" style={{ width: 44, height: 44, background: "rgb(var(--c-elevated))" }}>
        {item.image_url ? <img src={item.image_url} alt="" className="w-full h-full object-cover" /> : <VinylDisc size={30} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-mono truncate" style={{ fontSize: 14, color: "rgb(var(--c-text))" }}>{item.title}</div>
        <div className="font-mono truncate" style={{ fontSize: 12, color: "rgb(var(--c-muted))" }}>
          {isPlaylist(item) ? "Playlist · " : ""}{item.creator}
          {item.list_type === "recommendation" ? " · rec" : ""}
        </div>
      </div>
      <button
        type="button"
        onClick={onAction}
        className="shrink-0 font-mono cursor-pointer"
        style={{
          fontSize: 13, minHeight: 40, padding: "0 12px", borderRadius: 6,
          border: accent ? "1px solid rgb(var(--c-accent) / calc(0.6 * var(--tint)))" : "1px solid rgb(var(--c-border))",
          color: accent ? "rgb(var(--c-accent))" : "rgb(var(--c-muted))",
          background: "transparent",
        }}
      >
        {action}
      </button>
    </div>
  );
}

function FooterButton({ children, onClick, color, filled, disabled }: {
  children: React.ReactNode;
  onClick: () => void;
  color?: string;
  filled?: boolean;
  disabled?: boolean;
}) {
  const c = color ? `rgb(var(${color}))` : "rgb(var(--c-muted))";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="font-mono cursor-pointer disabled:opacity-60"
      style={{
        fontSize: 14, minHeight: 44, padding: "0 16px", borderRadius: 6, letterSpacing: "0.06em",
        color: c,
        border: color ? `1px solid rgb(var(${color}) / calc(0.6 * var(--tint)))` : "1px solid rgb(var(--c-border))",
        background: filled && color ? `rgb(var(${color}) / calc(0.14 * var(--tint)))` : "transparent",
      }}
    >
      {children}
    </button>
  );
}
