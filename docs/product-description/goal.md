# Goal: complete the Crate product description

You are working in `docs/product-description/` inside the Crate repo. Read `README.md`, `glossary.md`, `foundations/selection-engine.md`, and `add/search-and-add.md` first. The README defines the purpose, the document template, the method, the structure, and the coverage table. The other three are the exemplars: match their depth, tone, and structure exactly. Your job is to write every document in the README's structure until the coverage table has no `not started` rows, then run a consistency pass.

## Source of truth

The source is the repo these documents live in, rooted at `/Users/derek.brimley/personal-projects/crate`, at commit `8301127`. Describe the experience a signed-in user has in the web app — the crate wall at `/`, the library at `/library`, the add screen at `/add`, the listening log at `/history`, and the sign-in screens — in the default configuration, with nothing customized. Friend recommendations are out of scope: the send-to-friend action, the recommendations inbox, the outbound email, and any crate whose source is `friends`.

For each document, read in this order before writing:

1. The page or component that owns the screen's state: `src/pages/{Crates,Lists,AddAlbums,History,Login,ResetPassword}.tsx`, `src/components/CrateEditorModal.tsx`, `src/components/library/*`. These hold every piece of interaction state in the product; there is no reducer or state machine anywhere.
2. The route handler the screen calls, in `api/`, and the shared library it leans on: `lib/queries.ts` for what is written, `lib/selection.ts` and `lib/crateEngine.ts` for what is chosen, `lib/filters.ts` for what a rule means, `lib/spotify.ts` for what Spotify is asked, `lib/claude.ts` for what Claude is asked. `api/picks/dashboard.ts` is the one route worth reading in full for almost any crate-wall document.
3. The tests. They are close to executable specifications of edge cases: `lib/selection.test.ts`, `lib/crateEngine.test.ts`, `lib/crates.test.ts`, `src/lib/filters.test.ts`, `src/lib/duplicates.test.ts`, `src/lib/coverage.test.ts`, `src/lib/crateFilters.test.ts`. Run them with `npm test`.
4. Shared UI behavior: `src/contexts/DataCache.tsx` (what is cached and for how long), `src/hooks/usePlayer.tsx` (the web player), `src/hooks/useAuth.ts` (the account state machine), `src/components/{Layout,BottomNav,PlayerBar}.tsx`, `src/components/library/{ShelfRow,SpineItem,LibraryShelf,DetailPanel}.tsx`.
5. Defaults and thresholds: `lib/defaults.ts` (the default config), `lib/crates.ts` (the default weighting and what a new account is seeded with), `src/components/CrateEditorModal.tsx` (the slider stops), `src/components/library/SpineItem.tsx` (spine dimensions and colours).

Do not describe code. Describe what the user sees and does. Technical detail goes only in `> Technical note:` block quotes, and only when the mechanism changes what the user would expect.

## Writing rules

- Follow the eight-section template in the README for every screen, panel, and action document. Foundations and cross-cutting documents may drop sections that do not apply (the data model has no phases) but must still cover cancel/interrupt behavior wherever an interaction exists.
- Modifiers and cancel/interrupt go in tables, split by phase — the modifier columns are "Set on arrival" and "Changed while working"; the interrupt columns are "Before the first change" and "While working" — exactly as in `add/search-and-add.md`. The five modifier rows, the nine interrupt rows, and the nine cross-cutting concerns are fixed in the README; do not add, drop, or reorder them in a single document.
- Use the glossary's words. If you need a term the glossary lacks, add it to `glossary.md` in the right section with a one-paragraph definition, then use it. Do not coin a synonym for a term that exists.
- Sentence case for all headings. Direct, concrete language. No hedging, no marketing.
- State surprising behavior plainly and say why if the reason is in the code or a comment. If it looks like a bug, say so in "Open questions" rather than smoothing it over.
- Cross-reference other documents with relative links rather than repeating their content. `foundations/selection-engine.md` owns every weighting number, cooldown rule, and filter operator. `foundations/playback.md` owns the play fallback chain and the Premium and desktop requirements. `foundations/navigation-and-loading.md` owns the session cache and what refreshes it. `cross-cutting/failed-requests-and-offline.md` owns the silent-failure pattern. Do not restate them; link.
- Every document ends with "## Open questions and verification" listing what was read from code but not confirmed by hand, followed by `Verified against Crate commit \`8301127\``. If the source has moved on, use the new `git rev-parse --short HEAD` and say so in the document; do not silently mix commits within one document.
- Mermaid `stateDiagram-v2` for each interaction's states. Keep it to the states the user passes through; omit internal bookkeeping states.

## Things already established (do not re-derive, do not contradict)

Fixed in Phase 0:

- The unit of interaction is a screen or panel lifecycle. Its five phases, in this order and with these names in every document: **arrive**, **leave untouched**, **first change**, **while working**, **commit**.
- The variant axis has five rows, in this order, in every Modifiers table: Spotify account state; playback state; library state; viewport; crate and config settings.
- The interrupt list has nine rows, in this order, in every Cancel and interrupt table: Escape/Cancel/Close/backdrop; navigating inside the app; browser back or forward; reload or tab close; network lost or request failed; session expired or Spotify rejected the token; a second tab or the library changed elsewhere; the album in hand deleted or gone from Spotify; playback moved to another device or the tab backgrounded.
- The cross-cutting concerns, in this order, in every "Interactions with other systems" section: authentication and account state; the session cache and freshness; pick history; playback; configuration and crate definitions; offline and failed requests; multiple tabs and the Spotify app; toasts, badges, and empty states; viewport and accessibility.
- Naming decisions: the code's "item" is a **record**; the code's `list_type` values are **favorite** and **recommendation**, and the pair of them is **the two lists**; the code's "dashboard" is **the crate wall**; the code's `mode` on a pick is **the crate that produced it**; a `deferred` crate is a **slow crate**; an album Claude proposed that is not in the library is a **suggestion**.
- Crate has no unsaved-changes warning and no undo anywhere. Every write is either committed the instant the control is used or discarded silently when the screen is left.

*(Numbers, defaults, and per-area ownership are added here as each foundation document is written. Nothing below this line yet.)*

## Order of work

1. `add/search-and-add.md` first — the pilot. Iterate on it until it is right; every later document copies it.
2. `foundations/` next, in this order: `data-model.md`, `account-and-session.md`, `navigation-and-loading.md`, `selection-engine.md`, `playback.md`. Everything else links to them, and `selection-engine.md` owns every number that decides what a user is shown.
3. `crates/` next, all four documents. This is the hardest part and the bulk of the experience. Read `src/pages/Crates.tsx`, `src/components/CrateEditorModal.tsx`, `api/picks/dashboard.ts`, `lib/crateEngine.ts`, and `lib/claude.ts` in full before starting any of them, because the states hand off to each other. Ownership: `the-crate-wall.md` owns the wall's load, refresh, reorder, and add-a-crate states; `picking-a-record.md` owns everything from the moment a spine is tapped through the pick being recorded, and hands the panel's own contents to `library/the-album-detail-panel.md`; `the-crate-editor.md` owns the modal from open to save or delete; `ai-crates.md` owns the deferred load, the suggestion, and every AI fallback path.
4. The remaining areas — `library/`, the rest of `add/`, `history/`, `account/`, `player/`, then `cross-cutting/`. These are independent of each other.
5. Consistency pass over the whole set: same term for the same thing everywhere, no two documents describing the same behavior differently, every relative link resolves (`python3 .claude/skills/product-description/references/check-links.py docs/product-description` from the repo root), every document has a verification footer, every glossary term used is defined.
6. Then `verification/`, then `bug-triage.md`.

## Working rules

- Commit after each document or coherent group of documents with a message of the form `docs: add {path}` or `docs: revise {path}`. This repo puts a `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` trailer on AI-assisted commits; keep doing that.
- Do not modify anything outside `docs/product-description/`. The rest of the repo is read-only reference material for this work, even though it is the same repo.
- Do not add files outside the README's structure without updating the structure block and the coverage table to match.
- When a behavior cannot be determined from code and tests, write down what you could determine, put the rest in "Open questions", and move on. Do not guess and do not block.
- Depth bar: `add/search-and-add.md` is roughly 200 lines for a small screen. The `crates/` documents run 250–300; `player/the-player-bar.md` and `account/resetting-a-password.md` will be shorter. Completeness matters more than length. Every phase, every modifier cell, and every interrupt cell must be accounted for, even if the answer is "no effect".
- Update the coverage table in `README.md` as you go: `drafted` when written, never `verified` — verification by hand is a separate pass.
- If you find that the README's structure is wrong for something you discover (a document that should be split, two that should merge), make the change, update the structure and coverage table, and note why in the commit message.

You are done when the coverage table has no `not started` rows, the consistency pass is complete, and everything is committed.
