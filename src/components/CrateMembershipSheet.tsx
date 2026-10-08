import React, { useEffect, useState } from "react";
import { useDataCache } from "../contexts/DataCache";
import { crateMembership, toggleMembership, makeEmptyCrate, type Membership } from "../../lib/crates";
import type { Item } from "../types";

interface CrateMembershipSheetProps {
  item: Item;
  onClose: () => void;
}

const STATUS: Record<Membership, string> = {
  filter: "In · matches filters",
  hand: "In · added by you",
  excluded: "Left out",
  none: "",
};

/**
 * Every crate with a checkbox for one record. Checking adds it by hand;
 * unchecking takes a hand-added record back out, or leaves out one that got in
 * through the crate's filters. Each tap saves straight away.
 */
export function CrateMembershipSheet({ item, onClose }: CrateMembershipSheetProps) {
  const { crateDefs, crateMetaLoaded, loadCrateMeta, saveCrateDefs, pickStats } = useDataCache();
  const [saving, setSaving] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!crateMetaLoaded) loadCrateMeta();
  }, [crateMetaLoaded, loadCrateMeta]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggle = async (crateId: string) => {
    if (saving) return;
    setSaving(crateId);
    setError(null);
    try {
      await saveCrateDefs(crateDefs.map((c) => (c.id === crateId ? toggleMembership(c, item, pickStats) : c)));
    } catch {
      setError("Couldn't save. Try again.");
    } finally {
      setSaving(null);
    }
  };

  // A new crate made from here holds just this record to start with.
  const createWithItem = async () => {
    const name = newName.trim();
    if (!name || saving) return;
    setSaving("new");
    setError(null);
    try {
      const crate = { ...makeEmptyCrate(crateDefs.length), name, use_filters: false, include_ids: [item.id] };
      await saveCrateDefs([...crateDefs, crate]);
      setNewName("");
    } catch {
      setError("Couldn't create the crate. Try again.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[80]" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose} />
      <div
        className="fixed inset-x-0 bottom-0 z-[81] max-w-lg mx-auto flex flex-col"
        style={{ background: "rgb(var(--c-modal))", borderTop: "2px solid rgb(var(--c-accent))", borderRadius: "12px 12px 0 0", maxHeight: "80dvh" }}
      >
        <div className="flex items-center gap-2 shrink-0" style={{ padding: "12px 8px 10px 18px", borderBottom: "1px solid rgb(var(--c-border))" }}>
          <div className="flex-1 min-w-0">
            <div className="font-display" style={{ fontSize: 20, color: "rgb(var(--c-text))", letterSpacing: "0.14em" }}>CRATES</div>
            <div className="font-mono truncate" style={{ fontSize: 13, color: "rgb(var(--c-muted))" }}>{item.title}</div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 flex items-center justify-center cursor-pointer font-mono"
            style={{ minWidth: 64, height: 44, background: "transparent", border: "none", color: "rgb(var(--c-accent))", fontSize: 15 }}
          >
            Done
          </button>
        </div>

        <div className="overflow-y-auto" style={{ padding: "6px 18px 18px" }}>
          {!crateMetaLoaded ? (
            <p className="font-mono" style={{ fontSize: 14, color: "rgb(var(--c-muted))", padding: "16px 0" }}>Loading crates…</p>
          ) : (
            crateDefs.map((crate) => {
              const membership = crateMembership(crate, item, pickStats);
              const inCrate = membership === "filter" || membership === "hand";
              return (
                <button
                  key={crate.id}
                  onClick={() => toggle(crate.id)}
                  disabled={saving !== null}
                  className="w-full flex items-center gap-3 text-left cursor-pointer disabled:cursor-wait"
                  style={{ background: "transparent", border: "none", borderBottom: "1px solid rgb(var(--c-border) / calc(0.5 * var(--tint)))", padding: "10px 0", minHeight: 56 }}
                >
                  <span
                    className="shrink-0 flex items-center justify-center"
                    style={{
                      width: 28, height: 28, borderRadius: 6,
                      border: inCrate ? "1.5px solid rgb(var(--c-accent))" : "1.5px solid rgb(var(--c-border))",
                      background: inCrate ? "rgb(var(--c-accent) / calc(0.18 * var(--tint)))" : "transparent",
                      color: "rgb(var(--c-accent))", fontSize: 17,
                    }}
                  >
                    {saving === crate.id ? "…" : inCrate ? "✓" : ""}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-mono truncate" style={{ fontSize: 15, color: "rgb(var(--c-text))" }}>{crate.name || "Untitled"}</span>
                    {STATUS[membership] && (
                      <span className="block font-mono" style={{ fontSize: 12, color: membership === "excluded" ? "rgb(var(--c-danger))" : "rgb(var(--c-muted))" }}>
                        {STATUS[membership]}
                      </span>
                    )}
                  </span>
                </button>
              );
            })
          )}

          <div className="flex gap-2 mt-4">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") createWithItem(); }}
              placeholder="New crate…"
              className="flex-1 min-w-0 font-mono"
              style={{
                fontSize: 16, padding: "10px 12px", borderRadius: 6, outline: "none",
                background: "rgb(var(--c-hi) / calc(0.03 * var(--tint-hi)))",
                border: "1px solid rgb(var(--c-border))", color: "rgb(var(--c-text))",
              }}
            />
            <button
              onClick={createWithItem}
              disabled={!newName.trim() || saving !== null}
              className="shrink-0 font-mono cursor-pointer disabled:opacity-40"
              style={{
                fontSize: 14, minHeight: 44, padding: "0 16px", borderRadius: 6,
                border: "1px solid rgb(var(--c-accent) / calc(0.6 * var(--tint)))", color: "rgb(var(--c-accent))", background: "transparent",
              }}
            >
              {saving === "new" ? "…" : "Create"}
            </button>
          </div>
          {error && <p className="font-mono mt-3" style={{ fontSize: 13, color: "rgb(var(--c-danger))" }}>{error}</p>}
        </div>
      </div>
    </>
  );
}
