# Algorithm Settings Controls — Design Spec

**Date:** 2026-04-04  
**Status:** Approved

---

## Context

Users noticed that the dashboard was recommending recently-listened albums too often and felt repetitive. A fix was applied to the selection algorithm, but the underlying config values (cooldown, variety, discovery bias) are internal with no user-facing controls. This spec adds three sliders to the Settings page that expose the most useful algorithm tuning parameters in a friendly, approachable way.

---

## What We're Building

A new "Selection Tuning" section on the Settings page, placed between "Suggestions per section" and "Right Now Contexts", with three sliders:

1. **Cooldown** — days before a picked album can reappear (`cooldown_days`)
2. **Variety** — how random vs. consistent picks are (`randomness_factor`)
3. **Discovery Bias** — how much to favor albums never picked before (`weight_never_picked_bonus`)

---

## Design Decisions

- **Grouped section with header** — all three controls under a "Selection Tuning" label with a one-line description. Matches the visual rhythm of the existing settings page.
- **Immediate save** — each slider change calls `updateConfig` and `loadConfig` on `mouseup`/`pointerup`, matching the behavior of the "Suggestions per section" buttons. No separate save button.
- **Discrete stops, index-based slider** — each slider uses `<input type="range" min={0} max={4} step={1}>`. The index maps to a hand-picked value array. This handles non-linear spacing (e.g., cooldown stops at 1, 2, 3, 5, 7 rather than evenly spaced).
- **Hybrid labels** — the current value shows as a friendly label + raw value (e.g., "Medium (3 days)"), matching the mockup. Endpoints shown as plain values.

---

## Slider Stops

| Slider | Index 0 | Index 1 | Index 2 (default) | Index 3 | Index 4 |
|---|---|---|---|---|---|
| Cooldown | 1 day | 2 days | **3 days** | 5 days | 7 days |
| Variety | Predictable (2.0) | Consistent (1.5) | **Balanced (1.0)** | Random (0.7) | Chaotic (0.4) |
| Discovery Bias | Off (0) | Subtle (1) | **Moderate (2)** | Strong (3) | Maximum (5) |

Note: `randomness_factor` is inverted — higher = more predictable. The slider is labeled left-to-right as "Predictable → Chaotic" but the underlying value decreases.

---

## Implementation

### File: `src/pages/Settings.tsx`

**State additions** (alongside existing `cardsPerMode`):
```ts
const [cooldownIdx, setCooldownIdx] = useState(/* index of config.cooldown_days in COOLDOWN_STOPS */);
const [varietyIdx, setVarietyIdx] = useState(/* index of config.randomness_factor in VARIETY_STOPS */);
const [discoveryIdx, setDiscoveryIdx] = useState(/* index of config.weight_never_picked_bonus in DISCOVERY_STOPS */);
const [savingAlgorithm, setSavingAlgorithm] = useState(false);
```

**Stop arrays** (module-level constants):
```ts
const COOLDOWN_STOPS = [1, 2, 3, 5, 7]; // cooldown_days values
const COOLDOWN_LABELS = ["Short", "Short", "Medium", "Long", "Long"];

const VARIETY_STOPS = [2.0, 1.5, 1.0, 0.7, 0.4]; // randomness_factor values
const VARIETY_LABELS = ["Predictable", "Consistent", "Balanced", "Random", "Chaotic"];

const DISCOVERY_STOPS = [0, 1, 2, 3, 5]; // weight_never_picked_bonus values
const DISCOVERY_LABELS = ["Off", "Subtle", "Moderate", "Strong", "Maximum"];
```

**Helper to find nearest index** (for initializing state from config):
```ts
function nearestIdx(value: number, stops: number[]): number {
  return stops.reduce((best, v, i) =>
    Math.abs(v - value) < Math.abs(stops[best] - value) ? i : best, 0);
}
```

**Save handler** — `onChange` updates local index state immediately (live label feedback); `onPointerUp` triggers the API call so we don't spam on every drag step. Keyboard users (arrow keys) fire `onChange` without a `pointerUp`, so also call save on `onChange` when the event source is a keyboard (`e.nativeEvent instanceof KeyboardEvent`):
```ts
const handleAlgorithmChange = async (patch: Partial<AppConfig>) => {
  setSavingAlgorithm(true);
  try {
    await updateConfig(patch);
    await loadConfig();
  } finally {
    setSavingAlgorithm(false);
  }
};
```

**New JSX section** — inserted between the "Suggestions per section" and "Right Now Contexts" sections, separated by `<Divider />` components:

```tsx
<Divider />
<SectionLabel>Selection Tuning</SectionLabel>
<p style={{ fontFamily: '"IBM Plex Mono"', fontSize: 10, color: "#907558", marginBottom: 20 }}>
  Control how albums are picked for your dashboard
</p>

{/* Cooldown slider */}
{/* Variety slider */}
{/* Discovery Bias slider */}
```

Each slider row:
- Section label (uppercase mono, same as existing `labelStyle`)
- Description line (10px, `#907558`)
- Current value display (right-aligned, `#ff5e00`)
- `<input type="range" min={0} max={4} step={1}>` styled to match app theme
- Endpoint labels below (left: first label, right: last label)

**Slider styling**: Custom CSS to match the dark theme — track background `rgba(61,40,21,0.8)`, filled portion `#ff5e00`, thumb `#ff5e00` with glow. Use a `<style>` tag or inline approach consistent with how the rest of Settings styles its inputs.

**Sync from config**: The existing `useEffect` that runs when `config` changes (line 79-86 of Settings.tsx) needs to also set the three new index states using `nearestIdx`.

### No other files need changes

The backend already supports all three config keys. `updateConfig` in `src/services/api.ts` accepts any `Partial<AppConfig>`. The `AppConfig` type in `src/types.ts` should be checked to confirm `cooldown_days`, `randomness_factor`, and `weight_never_picked_bonus` are already present — if not, add them.

---

## Verification

1. Run `npm run dev`, open Settings
2. Confirm "Selection Tuning" section appears between the two existing sections
3. Drag each slider — the label updates immediately, config saves after release
4. Refresh page — slider positions match saved values
5. Set Cooldown to "Short (1 day)", pick an album on Dashboard, refresh Dashboard — verify the picked album does not reappear
6. Set Variety to "Chaotic" — refresh Dashboard multiple times and confirm picks vary more than with "Predictable"
