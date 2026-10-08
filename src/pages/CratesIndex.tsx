import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { PageHeader, HeaderAction } from "../components/PageHeader";
import { VinylDisc } from "../components/VinylDisc";
import { CrateEditorModal, makeEmptyCrate } from "../components/CrateEditorModal";
import { useLibraryData } from "../hooks/useLibraryData";
import { useRankedPool } from "../hooks/useRankedPool";
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
  const [arranging, setArranging] = useState(false);
  const crates = crateDefs;

  // Swap a crate with its neighbor, then renumber so positions stay 0..n-1.
  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= crates.length) return;
    const next = [...crates];
    [next[index], next[target]] = [next[target], next[index]];
    await saveCrateDefs(next.map((c, i) => ({ ...c, position: i })));
  };

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
          <>
            {crates.length > 1 && (
              <HeaderAction onClick={() => setArranging((v) => !v)} title={arranging ? "Done arranging" : "Arrange crates"}>
                {arranging ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M7 4L4 7M7 4l3 3M17 20V4M17 20l-3-3M17 20l3-3" />
                  </svg>
                )}
              </HeaderAction>
            )}
            <HeaderAction onClick={() => setCreating(makeEmptyCrate(crateDefs.length))} title="New crate">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" d="M12 5v14M5 12h14" />
              </svg>
            </HeaderAction>
          </>
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
          {crates.map((crate, i) => (
            <CrateCard
              key={crate.id}
              crate={crate}
              items={allItems}
              pickStats={pickStats}
              onOpen={() => navigate(`/crates/${encodeURIComponent(crate.id)}`)}
              arrange={arranging ? { onEarlier: i > 0 ? () => move(i, -1) : undefined, onLater: i < crates.length - 1 ? () => move(i, 1) : undefined } : undefined}
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

function CrateCard({ crate, items, pickStats, onOpen, arrange }: {
  crate: CrateDefinition;
  items: Item[];
  pickStats: Map<number, { pickCount: number; lastPickedTs: number | null }>;
  onOpen: () => void;
  /** Present in arrange mode: move this crate earlier/later (undefined at the ends). */
  arrange?: { onEarlier?: () => void; onLater?: () => void };
}) {
  const pool = useMemo(() => cratePool(crate, items, pickStats), [crate, items, pickStats]);
  // Shares the crate page's order, so the covers here are the ones it opens with.
  const { ranked, resting } = useRankedPool(`crate:${crate.id}`, pool, DEFAULT_WEIGHTING);
  const covers = [...ranked, ...resting].slice(0, 4);

  return (
    <div className="relative">
    <button
      onClick={arrange ? undefined : onOpen}
      className="w-full text-left cursor-pointer transition-transform duration-150 active:scale-[0.98]"
      style={{ background: "rgb(var(--c-elevated))", border: "1px solid rgb(var(--c-border))", padding: 8 }}
    >
      <div className="grid grid-cols-2 gap-0.5 aspect-square overflow-hidden" style={{ background: "rgb(var(--c-surface))" }}>
        {Array.from({ length: 4 }).map((_, i) => {
          const item = covers[i];
          return (
            <div key={i} className="relative aspect-square flex items-center justify-center" style={{ background: "rgb(var(--c-surface))" }}>
              {item?.image_url ? (
                <img src={item.image_url} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
              ) : i === 0 && covers.length === 0 ? (
                <VinylDisc size={28} />
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="flex items-baseline gap-2 mt-2">
        <span className="font-display flex-1 truncate" style={{ fontSize: 18, color: "rgb(var(--c-text))", letterSpacing: "0.14em" }}>
          {crate.name.toUpperCase() || "UNTITLED"}
        </span>
        <span className="font-mono shrink-0" style={{ fontSize: 12, color: "rgb(var(--c-muted))" }}>{pool.length}</span>
      </div>
    </button>
    {arrange && (
      <div className="absolute inset-x-2 flex justify-between" style={{ top: "38%" }}>
        <ArrangeButton label="◀" title="Move earlier" onClick={arrange.onEarlier} />
        <ArrangeButton label="▶" title="Move later" onClick={arrange.onLater} />
      </div>
    )}
    </div>
  );
}

function ArrangeButton({ label, title, onClick }: { label: string; title: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      title={title}
      className="flex items-center justify-center cursor-pointer disabled:opacity-0"
      style={{
        width: 44, height: 44, borderRadius: 22, fontSize: 16,
        background: "rgb(var(--c-modal) / 0.92)", border: "1.5px solid rgb(var(--c-accent))", color: "rgb(var(--c-accent))",
      }}
    >
      {label}
    </button>
  );
}
