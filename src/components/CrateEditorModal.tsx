import React, { useState } from "react";
import AdvancedFilters from "./library/AdvancedFilters";
import type { CrateDefinition, Weighting, CrateStrategy } from "../types";
import type { FilterRule } from "../lib/filters";

export const CLIENT_DEFAULT_WEIGHTING: Weighting = {
  cooldown_days: 3,
  weight_recent_days: 14,
  weight_medium_days: 30,
  weight_low: 1,
  weight_medium: 3,
  weight_high: 5,
  weight_never_picked_bonus: 2,
  recently_added_days: 14,
  recently_added_bonus: 0,
  randomness_factor: 1.0,
};

export function makeEmptyCrate(position: number): CrateDefinition {
  return {
    id: `crate_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
    name: "",
    position,
    source: "library",
    count: 4,
    filters: { rules: [], matchMode: "AND" },
    strategy: { type: "weighted", weighting: { ...CLIENT_DEFAULT_WEIGHTING } },
  };
}

const COOLDOWN_STOPS = [0, 3, 7, 14, 31];
const COOLDOWN_LABELS = ["None", "A few days", "A week", "Two weeks", "A month"];
const VARIETY_STOPS = [2.0, 1.5, 1.0, 0.7, 0.4];
const VARIETY_LABELS = ["Predictable", "Consistent", "Balanced", "Random", "Chaotic"];
const DISCOVERY_STOPS = [0, 1, 2, 3, 5];
const DISCOVERY_LABELS = ["Off", "Subtle", "Moderate", "Strong", "Maximum"];
const FRESH_STOPS = [0, 1, 2, 3, 5];
const FRESH_LABELS = ["Off", "Subtle", "Moderate", "Strong", "Maximum"];

function nearestIdx(value: number, stops: number[]): number {
  return stops.reduce((best, v, i) => (Math.abs(v - value) < Math.abs(stops[best] - value) ? i : best), 0);
}

type StrategyType = CrateStrategy["type"];
const STRATEGY_OPTIONS: { key: StrategyType; label: string }[] = [
  { key: "weighted", label: "WEIGHTED" },
  { key: "random", label: "RANDOM" },
  { key: "ai_pool", label: "AI · LIBRARY" },
  { key: "ai_new", label: "AI · NEW" },
];

const sliderStyle = `
  .algo-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 4px;
    border-radius: 2px;
    background: rgba(61,40,21,0.8);
    outline: none;
    cursor: pointer;
  }
  .algo-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #ff5e00;
    cursor: pointer;
    box-shadow: 0 0 6px rgba(255,94,0,0.5);
  }
  .algo-slider::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #ff5e00;
    cursor: pointer;
    border: none;
    box-shadow: 0 0 6px rgba(255,94,0,0.5);
  }
  .algo-slider:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

interface CrateEditorModalProps {
  initial: CrateDefinition;
  availableGenres: string[];
  onSave: (crate: CrateDefinition) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

export function CrateEditorModal({ initial, availableGenres, onSave, onDelete, onClose }: CrateEditorModalProps) {
  const [name, setName] = useState(initial.name);
  const [count, setCount] = useState(initial.count);
  const [rules, setRules] = useState<FilterRule[]>(initial.filters.rules);
  const [matchMode, setMatchMode] = useState<"AND" | "OR">(initial.filters.matchMode);
  const [strategyType, setStrategyType] = useState<StrategyType>(initial.strategy.type);
  const [weighting, setWeighting] = useState<Weighting>(
    initial.strategy.type === "weighted" ? initial.strategy.weighting : { ...CLIENT_DEFAULT_WEIGHTING }
  );
  const [prompt, setPrompt] = useState<string>(
    initial.strategy.type === "ai_pool" || initial.strategy.type === "ai_new" ? initial.strategy.prompt ?? "" : ""
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  const cooldownIdx = nearestIdx(weighting.cooldown_days, COOLDOWN_STOPS);
  const varietyIdx = nearestIdx(weighting.randomness_factor, VARIETY_STOPS);
  const discoveryIdx = nearestIdx(weighting.weight_never_picked_bonus, DISCOVERY_STOPS);
  const freshIdx = nearestIdx(weighting.recently_added_bonus, FRESH_STOPS);

  function buildStrategy(): CrateStrategy {
    if (strategyType === "weighted") return { type: "weighted", weighting };
    if (strategyType === "random") return { type: "random" };
    return { type: strategyType, prompt: prompt.trim() || undefined };
  }

  function handleSave() {
    onSave({
      ...initial,
      name: name.trim() || "Untitled Crate",
      count,
      filters: { rules, matchMode },
      strategy: buildStrategy(),
    });
  }

  const label: React.CSSProperties = {
    fontFamily: '"IBM Plex Mono", monospace', fontSize: 9, letterSpacing: "0.2em",
    textTransform: "uppercase", color: "#907558", display: "block", marginBottom: 6,
  };
  const input: React.CSSProperties = {
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(61,40,21,0.8)", borderRadius: 4,
    color: "#f2e8d2", fontFamily: '"IBM Plex Mono", monospace', fontSize: 12, padding: "6px 10px",
    width: "100%", outline: "none",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <style>{sliderStyle}</style>
      <div
        className="w-full max-w-lg overflow-y-auto"
        style={{ background: "#140d0a", border: "1px solid #3d2815", borderRadius: 10, maxHeight: "90vh", padding: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="font-display" style={{ fontSize: 16, color: "#f2e8d2", letterSpacing: "0.15em" }}>
            {initial.name ? "EDIT CRATE" : "NEW CRATE"}
          </span>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#907558", fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>

        {/* Name */}
        <div className="mb-4">
          <label style={label}>Name</label>
          <input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="My Crate" />
        </div>

        {/* Count */}
        <div className="mb-4">
          <label style={label}>Albums per crate</label>
          <div className="flex gap-2 flex-wrap">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <button
                key={n}
                onClick={() => setCount(n)}
                style={{
                  width: 36, height: 36, borderRadius: 4, cursor: "pointer",
                  border: count === n ? "1px solid #ff5e00" : "1px solid rgba(61,40,21,0.8)",
                  background: count === n ? "rgba(255,94,0,0.12)" : "transparent",
                  color: count === n ? "#ff5e00" : "#907558",
                  fontFamily: '"IBM Plex Mono", monospace', fontSize: 13,
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4">
          <label style={label}>Filters</label>
          <AdvancedFilters
            rules={rules}
            matchMode={matchMode}
            availableGenres={availableGenres}
            onChangeRules={setRules}
            onChangeMatchMode={setMatchMode}
          />
        </div>

        {/* Strategy */}
        <div className="mb-4">
          <label style={label}>Pick strategy</label>
          <div className="flex gap-1 flex-wrap">
            {STRATEGY_OPTIONS.map((o) => (
              <button
                key={o.key}
                onClick={() => setStrategyType(o.key)}
                className="font-mono cursor-pointer"
                style={{
                  fontSize: 10, padding: "4px 8px", letterSpacing: "0.08em",
                  border: strategyType === o.key ? "1px solid #ff5e00" : "1px solid #3d2815",
                  background: strategyType === o.key ? "rgba(255,94,0,0.1)" : "transparent",
                  color: strategyType === o.key ? "#ff5e00" : "#907558",
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Strategy detail */}
        {strategyType === "weighted" && (
          <div className="mb-4 flex flex-col gap-4">
            <Slider label="Cooldown" valueLabel={`${COOLDOWN_LABELS[cooldownIdx]} (${COOLDOWN_STOPS[cooldownIdx]}d)`}
              idx={cooldownIdx} onChange={(i) => setWeighting((w) => ({ ...w, cooldown_days: COOLDOWN_STOPS[i] }))} />
            <Slider label="Variety" valueLabel={VARIETY_LABELS[varietyIdx]}
              idx={varietyIdx} onChange={(i) => setWeighting((w) => ({ ...w, randomness_factor: VARIETY_STOPS[i] }))} />
            <Slider label="Discovery bias" valueLabel={DISCOVERY_LABELS[discoveryIdx]}
              idx={discoveryIdx} onChange={(i) => setWeighting((w) => ({ ...w, weight_never_picked_bonus: DISCOVERY_STOPS[i] }))} />
            <Slider label="Recently added" valueLabel={FRESH_LABELS[freshIdx]}
              idx={freshIdx} onChange={(i) => setWeighting((w) => ({ ...w, recently_added_bonus: FRESH_STOPS[i] }))} />
          </div>
        )}

        {(strategyType === "ai_pool" || strategyType === "ai_new") && (
          <div className="mb-4">
            <label style={label}>Vibe / prompt (optional)</label>
            <input style={input} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. rainy Sunday morning" />
            <p className="font-mono" style={{ fontSize: 10, color: "#907558", marginTop: 6 }}>
              {strategyType === "ai_pool"
                ? "AI picks from your filtered albums. Blank = weighted pick."
                : "AI suggests albums outside your library."}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between mt-6">
          {onDelete ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <button onClick={() => onDelete(initial.id)} className="font-mono cursor-pointer"
                  style={{ fontSize: 10, padding: "4px 8px", color: "#ff4444", border: "1px solid rgba(255,68,68,0.4)", background: "transparent", borderRadius: 3 }}>
                  DELETE
                </button>
                <button onClick={() => setConfirmDelete(false)} className="font-mono cursor-pointer"
                  style={{ fontSize: 10, padding: "4px 8px", color: "#907558", border: "1px solid #3d2815", background: "transparent", borderRadius: 3 }}>
                  CANCEL
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="font-mono cursor-pointer"
                style={{ fontSize: 10, padding: "4px 8px", color: "#907558", border: "1px solid #3d2815", background: "transparent", borderRadius: 3 }}>
                DELETE CRATE
              </button>
            )
          ) : <span />}

          <div className="flex items-center gap-2">
            <button onClick={onClose} className="font-mono cursor-pointer"
              style={{ fontSize: 10, padding: "6px 12px", color: "#907558", border: "1px solid #3d2815", background: "transparent", borderRadius: 4 }}>
              CANCEL
            </button>
            <button onClick={handleSave} className="font-mono cursor-pointer"
              style={{ fontSize: 10, padding: "6px 12px", color: "#ff5e00", border: "1px solid rgba(255,94,0,0.6)", background: "rgba(255,94,0,0.12)", borderRadius: 4, letterSpacing: "0.1em" }}>
              SAVE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Slider({ label, valueLabel, idx, onChange }: { label: string; valueLabel: string; idx: number; onChange: (i: number) => void }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#f2e8d2" }}>{label}</span>
        <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, color: "#ff5e00" }}>{valueLabel}</span>
      </div>
      <input type="range" className="algo-slider" min={0} max={4} step={1} value={idx}
        style={{ width: "100%" }}
        onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}
