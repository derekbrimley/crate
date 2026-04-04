# Algorithm Settings Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Selection Tuning" section to the Settings page with three sliders (Cooldown, Variety, Discovery Bias) that let users control the album selection algorithm.

**Architecture:** All three controls live in `src/pages/Settings.tsx` — the only file that needs to change. Each slider maps a 0–4 index to a hand-picked value array. Changes save immediately via `updateConfig` on pointer release (matching how the existing cards-per-mode buttons work). All three config keys (`cooldown_days`, `randomness_factor`, `weight_never_picked_bonus`) are already defined in `AppConfig` in `src/types/index.ts` and handled by the backend.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, IBM Plex Mono font (matching existing Settings styling), `updateConfig` / `loadConfig` from existing DataCache context.

---

## File Map

| Action | File | What changes |
|---|---|---|
| Modify | `src/pages/Settings.tsx` | Add stop arrays, state, handler, useEffect sync, JSX section, slider CSS |

No other files need to change.

---

### Task 1: Add stop arrays and index helper to Settings.tsx

**Files:**
- Modify: `src/pages/Settings.tsx` (add module-level constants before the `Settings` function)

These constants map slider index (0–4) to actual config values and friendly display labels.

- [ ] **Step 1: Add constants and helper after the existing `FALLBACK_GENRES` array (around line 17)**

Open `src/pages/Settings.tsx` and insert the following block immediately after the `FALLBACK_GENRES` array definition:

```ts
const COOLDOWN_STOPS = [1, 2, 3, 5, 7]; // cooldown_days
const COOLDOWN_LABELS = ["Short", "Short", "Medium", "Long", "Long"];

const VARIETY_STOPS = [2.0, 1.5, 1.0, 0.7, 0.4]; // randomness_factor — higher = more predictable
const VARIETY_LABELS = ["Predictable", "Consistent", "Balanced", "Random", "Chaotic"];

const DISCOVERY_STOPS = [0, 1, 2, 3, 5]; // weight_never_picked_bonus
const DISCOVERY_LABELS = ["Off", "Subtle", "Moderate", "Strong", "Maximum"];

function nearestIdx(value: number, stops: number[]): number {
  return stops.reduce(
    (best, v, i) => (Math.abs(v - value) < Math.abs(stops[best] - value) ? i : best),
    0
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -30
```

Expected: no errors referencing Settings.tsx.

---

### Task 2: Add slider state and save handler inside the Settings component

**Files:**
- Modify: `src/pages/Settings.tsx` (inside the `Settings` function, after the existing state declarations)

- [ ] **Step 1: Add state declarations after the existing `savingCards`/`savingContexts` state (around line 62–71)**

```ts
const [cooldownIdx, setCooldownIdx] = useState(() =>
  nearestIdx(config?.cooldown_days ?? 3, COOLDOWN_STOPS)
);
const [varietyIdx, setVarietyIdx] = useState(() =>
  nearestIdx(config?.randomness_factor ?? 1.0, VARIETY_STOPS)
);
const [discoveryIdx, setDiscoveryIdx] = useState(() =>
  nearestIdx(config?.weight_never_picked_bonus ?? 2, DISCOVERY_STOPS)
);
const [savingAlgorithm, setSavingAlgorithm] = useState(false);
```

- [ ] **Step 2: Add the save handler after the existing `handleCardsChange` function**

```ts
const handleAlgorithmSave = async (patch: Partial<typeof config>) => {
  if (!patch) return;
  setSavingAlgorithm(true);
  try {
    await updateConfig(patch as Parameters<typeof updateConfig>[0]);
    await loadConfig();
  } finally {
    setSavingAlgorithm(false);
  }
};
```

- [ ] **Step 3: Update the config sync useEffect to also reset slider indices**

Find the existing `useEffect` that runs when `config` changes (the one that calls `setCardsPerMode` and `setLocalContexts`). It looks like this:

```ts
useEffect(() => {
  if (config) {
    setCardsPerMode(config.cards_per_mode);
    setLocalContexts(config.right_now_contexts ?? []);
    setDirty(false);
  }
}, [config]);
```

Add three more setter calls inside the `if (config)` block:

```ts
useEffect(() => {
  if (config) {
    setCardsPerMode(config.cards_per_mode);
    setLocalContexts(config.right_now_contexts ?? []);
    setDirty(false);
    setCooldownIdx(nearestIdx(config.cooldown_days, COOLDOWN_STOPS));
    setVarietyIdx(nearestIdx(config.randomness_factor, VARIETY_STOPS));
    setDiscoveryIdx(nearestIdx(config.weight_never_picked_bonus, DISCOVERY_STOPS));
  }
}, [config]);
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -30
```

Expected: no errors.

---

### Task 3: Add the Selection Tuning JSX section

**Files:**
- Modify: `src/pages/Settings.tsx` (JSX, between the cards section and the Right Now contexts section)

The existing Settings JSX structure is:
1. `<SectionLabel>Suggestions per section</SectionLabel>` + buttons
2. `<Divider />`
3. `<SectionLabel>Right now contexts</SectionLabel>` + context list

Insert a new section between the first `<Divider />` and the Right Now contexts header. The new structure will be:

1. Cards section
2. `<Divider />`
3. **NEW: Selection Tuning section**
4. `<Divider />`
5. Right Now contexts section

- [ ] **Step 1: Add the global slider CSS style tag**

Immediately before the `return (` statement in the Settings component, add:

```tsx
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
```

- [ ] **Step 2: Inject the style tag at the top of the returned JSX**

Inside the `<Layout title="Settings">` element, add `<style>{sliderStyle}</style>` as the very first child.

- [ ] **Step 3: Add the Selection Tuning section JSX**

Find the first `<Divider />` (after the cards buttons) and the `{/* ── Right Now contexts ── */}` comment. Insert the following between them (replacing the existing lone `<Divider />`):

```tsx
<Divider />

{/* ── Selection Tuning ── */}
<SectionLabel>Selection Tuning</SectionLabel>
<p style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, color: "#907558", marginBottom: 20 }}>
  Control how albums are picked for your dashboard
</p>

{/* Cooldown */}
<div style={{ marginBottom: 24 }}>
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
    <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "#f2e8d2" }}>
      Cooldown
    </span>
    <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, color: "#ff5e00" }}>
      {COOLDOWN_LABELS[cooldownIdx]} ({COOLDOWN_STOPS[cooldownIdx]}d)
    </span>
  </div>
  <p style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, color: "#907558", marginBottom: 10 }}>
    Days before a picked album can reappear
  </p>
  <input
    type="range"
    className="algo-slider"
    min={0}
    max={4}
    step={1}
    value={cooldownIdx}
    disabled={savingAlgorithm}
    onChange={(e) => setCooldownIdx(Number(e.target.value))}
    onPointerUp={(e) => {
      const idx = Number((e.target as HTMLInputElement).value);
      handleAlgorithmSave({ cooldown_days: COOLDOWN_STOPS[idx] });
    }}
    onKeyUp={(e) => {
      const idx = Number((e.target as HTMLInputElement).value);
      handleAlgorithmSave({ cooldown_days: COOLDOWN_STOPS[idx] });
    }}
  />
  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
    <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, color: "#907558" }}>1 day</span>
    <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, color: "#907558" }}>7 days</span>
  </div>
</div>

{/* Variety */}
<div style={{ marginBottom: 24 }}>
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
    <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "#f2e8d2" }}>
      Variety
    </span>
    <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, color: "#ff5e00" }}>
      {VARIETY_LABELS[varietyIdx]}
    </span>
  </div>
  <p style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, color: "#907558", marginBottom: 10 }}>
    How random vs. consistent your picks are
  </p>
  <input
    type="range"
    className="algo-slider"
    min={0}
    max={4}
    step={1}
    value={varietyIdx}
    disabled={savingAlgorithm}
    onChange={(e) => setVarietyIdx(Number(e.target.value))}
    onPointerUp={(e) => {
      const idx = Number((e.target as HTMLInputElement).value);
      handleAlgorithmSave({ randomness_factor: VARIETY_STOPS[idx] });
    }}
    onKeyUp={(e) => {
      const idx = Number((e.target as HTMLInputElement).value);
      handleAlgorithmSave({ randomness_factor: VARIETY_STOPS[idx] });
    }}
  />
  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
    <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, color: "#907558" }}>Predictable</span>
    <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, color: "#907558" }}>Chaotic</span>
  </div>
</div>

{/* Discovery Bias */}
<div style={{ marginBottom: 8 }}>
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
    <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "#f2e8d2" }}>
      Discovery Bias
    </span>
    <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, color: "#ff5e00" }}>
      {DISCOVERY_LABELS[discoveryIdx]}
    </span>
  </div>
  <p style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, color: "#907558", marginBottom: 10 }}>
    Favor albums you haven't listened to yet
  </p>
  <input
    type="range"
    className="algo-slider"
    min={0}
    max={4}
    step={1}
    value={discoveryIdx}
    disabled={savingAlgorithm}
    onChange={(e) => setDiscoveryIdx(Number(e.target.value))}
    onPointerUp={(e) => {
      const idx = Number((e.target as HTMLInputElement).value);
      handleAlgorithmSave({ weight_never_picked_bonus: DISCOVERY_STOPS[idx] });
    }}
    onKeyUp={(e) => {
      const idx = Number((e.target as HTMLInputElement).value);
      handleAlgorithmSave({ weight_never_picked_bonus: DISCOVERY_STOPS[idx] });
    }}
  />
  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
    <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, color: "#907558" }}>Off</span>
    <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, color: "#907558" }}>Maximum</span>
  </div>
</div>

<Divider />
```

- [ ] **Step 4: Build and verify no TypeScript errors**

```bash
npm run build 2>&1 | head -40
```

Expected: clean build, no errors in Settings.tsx.

---

### Task 4: Manual verification and commit

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Open `http://localhost:3000`, navigate to Settings.

- [ ] **Step 2: Verify section appears**

Check that "Selection Tuning" section appears between "Suggestions per section" and "Right Now Contexts", with all three sliders rendered and labeled correctly. Default positions should be: Cooldown at index 2 (Medium, 3d), Variety at index 2 (Balanced), Discovery Bias at index 2 (Moderate).

- [ ] **Step 3: Verify slider interaction**

Drag the Cooldown slider — the label should update as you drag (e.g., "Short (1d)", "Short (2d)", "Medium (3d)"…). Release the slider — wait 1–2 seconds, then refresh the page. Confirm the slider is at the same position you left it.

- [ ] **Step 4: Verify dashboard respects the setting**

Set Cooldown to "Short (1d)". On the Dashboard, pick an album (record it). Refresh Dashboard. That album should not reappear until tomorrow.

- [ ] **Step 5: Commit**

```bash
cd "/Users/derek.brimley/personal projects/crate"
git add src/pages/Settings.tsx
git commit -m "feat: add selection tuning sliders to settings

Add Cooldown, Variety, and Discovery Bias sliders to Settings page.
Each saves immediately on pointer release, matching existing behavior.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
