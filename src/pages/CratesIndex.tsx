import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { PageHeader, HeaderAction } from "../components/PageHeader";
import { VinylDisc } from "../components/VinylDisc";
import { CrateEditorModal, makeEmptyCrate } from "../components/CrateEditorModal";
import { useLibraryData } from "../hooks/useLibraryData";
import { useRankedPool } from "../hooks/useRankedPool";
import { useDataCache } from "../contexts/DataCache";
import { cratePool, DEFAULT_WEIGHTING } from "../../lib/crates";
import type { CrateDefinition, Item } from "../types";

interface CratesIndexProps {
  onLogout: () => void;
}

/** Every crate as a card; each opens its crate page. */
export function CratesIndex({ onLogout }: CratesIndexProps) {
  const navigate = useNavigate();
  const { crateDefs, saveCrateDefs, allItems, pickStats, ready } = useLibraryData();
  const [creating, setCreating] = useState<CrateDefinition | null>(null);
  const crates = crateDefs;

  const handleCreate = async (crate: CrateDefinition) => {
    await saveCrateDefs([...crateDefs, crate]);
    setCreating(null);
    navigate(`/crates/${encodeURIComponent(crate.id)}`);
  };

  return (
    <Layout>
      <PageHeader
        title="Your Crates"
        backTo="/"
        onLogout={onLogout}
        actions={
          <HeaderAction onClick={() => setCreating(makeEmptyCrate(crateDefs.length))} title="New crate">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" d="M12 5v14M5 12h14" />
            </svg>
          </HeaderAction>
        }
      />

      {!ready ? (
        <div className="mt-16 flex justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-crate-accent border-t-transparent animate-spin" />
        </div>
      ) : crates.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-3">
          <VinylDisc size={56} />
          <p className="font-mono text-xs text-crate-muted" style={{ letterSpacing: "0.1em" }}>NO CRATES YET — TAP + TO MAKE ONE</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3" style={{ padding: "18px 12px 100px" }}>
          {crates.map((crate) => (
            <CrateCard
              key={crate.id}
              crate={crate}
              items={allItems}
              pickStats={pickStats}
              onOpen={() => navigate(`/crates/${encodeURIComponent(crate.id)}`)}
            />
          ))}
        </div>
      )}

      {creating && (
        <CrateEditorModal
          initial={creating}
          onSave={handleCreate}
          onClose={() => setCreating(null)}
        />
      )}
    </Layout>
  );
}

function CrateCard({ crate, items, pickStats, onOpen }: {
  crate: CrateDefinition;
  items: Item[];
  pickStats: Map<number, { pickCount: number; lastPickedTs: number | null }>;
  onOpen: () => void;
}) {
  const pool = useMemo(() => cratePool(crate, items, pickStats), [crate, items, pickStats]);
  // Shares the crate page's order, so the covers here are the ones it opens with.
  const { ranked, resting } = useRankedPool(`crate:${crate.id}`, pool, DEFAULT_WEIGHTING);
  // A crate with nothing of its own (e.g. Surprise Me) borrows Claude's latest
  // picks for its cover, when this session has fetched them.
  const { getCachedSuggestions } = useDataCache();
  const own = [...ranked, ...resting];
  const covers = (own.length > 0 ? own : getCachedSuggestions(crate.id) ?? []).slice(0, 4);

  return (
    <button
      onClick={onOpen}
      className="w-full text-left cursor-pointer transition-transform duration-150 active:scale-[0.98]"
      style={{ background: "rgb(var(--c-elevated))", border: "1px solid rgb(var(--c-border))", padding: 8 }}
    >
      {covers.length === 0 ? (
        // Nothing to show yet: one centered mark for the whole cover area.
        <div className="aspect-square flex items-center justify-center" style={{ background: "rgb(var(--c-surface))" }}>
          {crate.ai_suggestions ? (
            <span style={{ fontSize: 64, color: "rgb(var(--c-rec))", textShadow: "0 0 18px rgb(var(--c-rec) / calc(0.6 * var(--tint)))" }}>✦</span>
          ) : (
            <VinylDisc size={72} />
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-0.5 aspect-square overflow-hidden" style={{ background: "rgb(var(--c-surface))" }}>
          {Array.from({ length: 4 }).map((_, i) => {
            const item = covers[i];
            return (
              <div key={i} className="relative aspect-square" style={{ background: "rgb(var(--c-surface))" }}>
                {item?.image_url && (
                  <img src={item.image_url} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="flex items-baseline gap-2 mt-2">
        <span className="font-display flex-1 truncate" style={{ fontSize: 18, color: "rgb(var(--c-text))", letterSpacing: "0.14em" }}>
          {crate.name.toUpperCase() || "UNTITLED"}
        </span>
        {crate.ai_suggestions && (
          <span className="font-mono shrink-0" style={{ fontSize: 12, color: "rgb(var(--c-rec))" }} title="Claude suggestions on">✦</span>
        )}
        <span className="font-mono shrink-0" style={{ fontSize: 12, color: "rgb(var(--c-muted))" }}>{pool.length}</span>
      </div>
    </button>
  );
}
