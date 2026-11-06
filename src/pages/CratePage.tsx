import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Layout } from "../components/Layout";
import { PageHeader, HeaderAction } from "../components/PageHeader";
import { VinylDisc } from "../components/VinylDisc";
import { CoverGrid, GridHeading } from "../components/CoverGrid";
import { SuggestionsSection, SuggestionsRail } from "../components/SuggestionsSection";
import { ItemSheet } from "../components/ItemSheet";
import { CrateEditorModal } from "../components/CrateEditorModal";
import { SortMenu, sortLabel } from "../components/SortMenu";
import { useLibraryData } from "../hooks/useLibraryData";
import { useRankedPool } from "../hooks/useRankedPool";
import { cratePool, DEFAULT_WEIGHTING } from "../../lib/crates";
import type { CrateSort } from "../../lib/ranking";
import type { CrateDefinition, Item } from "../types";

interface CratePageProps {
  onLogout: () => void;
}

/**
 * One crate's whole contents in the crate's chosen sort (longest unplayed by
 * default): playable records, then the ones played too recently, faded. A
 * shuffled order holds for the session until reshuffled.
 */
export function CratePage({ onLogout }: CratePageProps) {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { crateDefs, saveCrateDefs, allItems, pickStats, ready, setRankOrder } = useLibraryData();
  const [selected, setSelected] = useState<Item | null>(null);
  const [editing, setEditing] = useState<CrateDefinition | null>(null);
  // The sort just picked, shown while it saves.
  const [pendingSort, setPendingSort] = useState<CrateSort | null>(null);

  const crate = crateDefs.find((c) => c.id === id) ?? null;
  const pool = useMemo(
    () => (ready && crate ? cratePool(crate, allItems, pickStats) : null),
    [ready, crate, allItems, pickStats]
  );
  const sort = pendingSort ?? crate?.sort ?? "unplayed";
  const { ranked, resting, reshuffle } = useRankedPool(`crate:${id}`, pool, DEFAULT_WEIGHTING, sort);

  const handleSort = async (next: CrateSort) => {
    if (!crate) return;
    setPendingSort(next);
    // Switching to shuffle should deal a fresh order, not one from earlier.
    if (next === "shuffle") setRankOrder(`crate:${crate.id}`, undefined);
    try {
      await saveCrateDefs(crateDefs.map((c) => (c.id === crate.id ? { ...c, sort: next } : c)));
    } catch (err) {
      console.error("Failed to save sort:", err);
    } finally {
      setPendingSort(null);
    }
  };

  const handleSave = async (next: CrateDefinition) => {
    // New filters deserve a fresh order, not the old one with additions tacked on.
    setRankOrder(`crate:${next.id}`, undefined);
    await saveCrateDefs(crateDefs.map((c) => (c.id === next.id ? next : c)));
    setEditing(null);
  };

  const handleDelete = async (crateId: string) => {
    await saveCrateDefs(crateDefs.filter((c) => c.id !== crateId));
    setEditing(null);
    navigate("/crates");
  };

  return (
    <Layout>
      <PageHeader
        title={crate?.name || "Crate"}
        backTo="/crates"
        onLogout={onLogout}
        actions={
          crate && (
            <>
              <SortMenu value={sort} onChange={handleSort} onReshuffle={reshuffle} disabled={!pool} />
              <HeaderAction onClick={() => setEditing(crate)} title="Edit crate">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </HeaderAction>
            </>
          )
        }
      />

      <div style={{ paddingBottom: 100 }}>
        {!ready ? (
          <div className="mt-16 flex justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-crate-accent border-t-transparent animate-spin" />
          </div>
        ) : !crate ? (
          <p className="mt-16 text-center font-mono text-[13px] text-crate-muted" style={{ letterSpacing: "0.1em" }}>
            THIS CRATE NO LONGER EXISTS
          </p>
        ) : ranked.length + resting.length === 0 && !crate.ai_suggestions ? (
          <div className="mt-16 flex flex-col items-center gap-3">
            <VinylDisc size={56} />
            <p className="font-mono text-[13px] text-crate-muted" style={{ letterSpacing: "0.1em" }}>NOTHING IN THIS CRATE YET — EDIT IT, OR ADD RECORDS WITH "ADD TO CRATE"</p>
          </div>
        ) : ranked.length + resting.length === 0 ? (
          // Nothing of its own (e.g. Surprise Me): Claude's picks get the whole page.
          <SuggestionsSection target={crate.id} onSelect={setSelected} />
        ) : (
          <div className="flex items-start">
            <div className="flex-1 min-w-0">
              {ranked.length > 0 && (
                <>
                  <GridHeading label={`UP NEXT · ${sortLabel(sort).toUpperCase()}`} count={ranked.length} />
                  <CoverGrid items={ranked} onSelect={setSelected} />
                </>
              )}
              {resting.length > 0 && (
                <>
                  <GridHeading label="RECENTLY PLAYED" count={resting.length} />
                  <CoverGrid items={resting} onSelect={setSelected} dimmed />
                </>
              )}
            </div>
            {crate.ai_suggestions && <SuggestionsRail target={crate.id} onSelect={setSelected} />}
          </div>
        )}
      </div>

      {selected && crate && (
        <ItemSheet item={selected} playSource={crate.id} onClose={() => setSelected(null)} />
      )}

      {editing && (
        <CrateEditorModal
          initial={editing}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditing(null)}
        />
      )}
    </Layout>
  );
}
