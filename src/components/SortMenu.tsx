import React, { useState } from "react";
import { HeaderAction } from "./PageHeader";
import { CRATE_SORTS, type CrateSort } from "../../lib/ranking";

/**
 * Header button that opens a list of sorts. Picking "Shuffle" again while it's
 * already the sort makes a fresh shuffle.
 */
export function SortMenu({ value, onChange, onReshuffle, disabled }: {
  value: CrateSort;
  onChange: (sort: CrateSort) => void;
  onReshuffle: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const choose = (key: CrateSort) => {
    setOpen(false);
    if (key === value) {
      if (key === "shuffle") onReshuffle();
    } else {
      onChange(key);
    }
  };

  return (
    <div>
      <HeaderAction onClick={() => setOpen((v) => !v)} title="Sort" disabled={disabled}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h13M3 12h9M3 18h5M18 9V20m0 0l-3-3m3 3l3-3" />
        </svg>
      </HeaderAction>
      {open && (
        <>
          <div onClick={() => setOpen(false)} className="fixed inset-0 z-[29]" />
          <div
            role="menu"
            // Pinned under the header's right edge so it never runs off a narrow screen.
            className="fixed z-30 animate-panel-open"
            style={{
              top: "calc(var(--safe-t) + var(--header-h) + 4px)",
              right: 12,
              width: 220,
              background: "rgb(var(--c-elevated))",
              border: "1px solid rgb(var(--c-border))",
              boxShadow: "0 8px 32px rgba(0,0,0,0.85)",
            }}
          >
            <div className="font-mono" style={{ padding: "10px 14px 6px", fontSize: 12, letterSpacing: "0.15em", color: "rgb(var(--c-muted))" }}>
              SORT BY
            </div>
            {CRATE_SORTS.map(({ key, label }) => {
              const active = key === value;
              return (
                <button
                  key={key}
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => choose(key)}
                  className="flex items-center w-full text-left font-mono cursor-pointer"
                  style={{
                    minHeight: 44,
                    padding: "0 14px",
                    fontSize: 13,
                    letterSpacing: "0.08em",
                    color: active ? "rgb(var(--c-accent))" : "rgb(var(--c-text))",
                    background: "transparent",
                    border: "none",
                    borderTop: "1px solid rgb(var(--c-border))",
                  }}
                >
                  <span className="flex-1">{active && key === "shuffle" ? "Reshuffle" : label}</span>
                  {active && <span aria-hidden>{key === "shuffle" ? "↻" : "✓"}</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/** Short name of a sort, for headings. */
export function sortLabel(sort: CrateSort): string {
  return CRATE_SORTS.find((s) => s.key === sort)?.label ?? "";
}
