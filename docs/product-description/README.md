# Crate product description

A written description of the user experience of Crate: what the user sees, what they can do, and exactly what happens when they do it.

## Purpose

Crate is, from the user's point of view, a large state chart. The user moves through it by tapping record spines, opening and dismissing panels and modals, typing into search boxes and filter rules, dragging sliders, and pressing play. Most of that behavior is defined implicitly, spread across React page components, a client-side cache context, a player hook, a selection engine, a filter engine, and eleven serverless route handlers. There is no single place that says, in plain language, "when the user does X, this is what happens, and this is what happens if they do Y halfway through."

This project is that place. It describes the full experience a signed-in user has in the web app — the crate wall at `/`, the library at `/library`, the add screen at `/add`, the listening log at `/history`, and the sign-in screens — in the default configuration, with nothing customized.

The documents are for people who need to understand or change the product: designers, engineers, writers, testers, and anyone evaluating whether a behavior is intentional. They are written from the outside in. They describe the experience, not the implementation.

### What this is not

- Not API documentation. The HTTP routes under `api/` are described only where a user can tell the difference; there is no endpoint reference here.
- Not organized by package. `lib/`, `src/lib/`, `src/components/`, and `api/` are not described separately. A single behavior is described once, wherever the user encounters it — the album detail panel appears on three screens and has one document.
- Not a technical design document. Where a technical detail is critical to understanding the experience, it appears in a block quote labeled `Technical note:` and nowhere else.

## Conventions

- Describe the experience, not the code. "The add button greys out and reads ADDED once the record is filed" rather than "`addedKeys` gains the `${spotify_id}:${listType}` key".
- Technical detail goes in block quotes, prefixed with `Technical note:`. Use it only when the mechanism changes what the user would expect.
- Use sentence case for headings.
- Name the vocabulary consistently. The [glossary](glossary.md) is the source of truth for terms like *crate*, *spine*, *pick*, *the library*, *favorite*, *recommendation*, *the session cache*, *a slow crate*, and *linked to Spotify*.
- Every document ends with the commit of the Crate repo it was verified against and a list of open questions.
- When a behavior is surprising, say so and say why it is that way if the reason is known. Do not smooth it over.

## The work to be done

Each document describes one feature. Features are large things (the crate wall, the crate editor) or small things (the player bar, the profile dropdown), but each is described in full, including its edge cases and its interactions with other features.

### Document template

Every feature document follows the same skeleton so that documents are comparable and nothing is skipped.

1. **Summary.** One paragraph describing the feature abstractly. For example: "Adding albums by search is how a record first enters the library: the user types an artist or album name, Crate asks Spotify, and each result can be filed into one of the two lists with a single tap."
2. **The simple case.** The common path in prose.
3. **The interaction, event by event.** The five phases of a screen-or-panel lifecycle, named in Crate's words and used in this order in every document: **arrive**, **leave untouched**, **first change**, **while working**, **commit**. What brings the user to the screen and what is loaded or focused, what happens if they leave without touching anything, what the first change commits them to, what updates as they keep working, and what is written when they finish. Include a small state diagram (Mermaid `stateDiagram-v2`) of the states the user passes through.
4. **Modifiers.** A table of Crate's variant axis, with what each variant does when it is already true on arrival and what happens when it changes while the user is working. The rows are the same five in every document:
   - **Spotify account state** — signed in with Spotify or with email and password only; Premium or free.
   - **Playback state** — nothing playing, or a track playing with the player bar showing.
   - **Library state** — empty, or populated; and whether the album in hand is already a favorite, already a recommendation, or not in the library at all.
   - **Viewport** — narrow (one column, bottom nav, no volume slider) or wide (taller spines, more per row).
   - **Crate and config settings** — non-default crate definitions, weighting, or counts.
5. **Cancel and interrupt.** The same checklist in every document, in this order:
   - Escape, Cancel, Close, or a tap on the backdrop
   - Navigating inside the app: the bottom nav, another route, or a second panel or modal
   - Browser back or forward
   - Reload, or the tab is closed
   - Network lost, or the request fails or times out
   - The session expires, or Spotify rejects the token
   - The same account in a second tab, or the library changed elsewhere
   - The album in hand is deleted, or Spotify no longer returns it
   - Playback moves to another device, or the tab is backgrounded
6. **Interactions with other systems.** Crate's cross-cutting concerns, one bold-led paragraph each, in this fixed order: authentication and account state; the session cache and freshness; pick history; playback; configuration and crate definitions; offline and failed requests; multiple tabs and the Spotify app; toasts, badges, and empty states; viewport and accessibility.
7. **Edge cases.** Anything a user could notice that is not covered above.
8. **Open questions and verification.** The Crate commit the document was verified against, and any behavior that could not be confirmed.

Item 5 matters most. Asking the same interrupt questions of every feature is how gaps and inconsistencies are found.

### Method

For each document:

1. Read the page or component that owns the screen's state (`src/pages/`, `src/components/`), and the route handler it calls (`api/`).
2. Read the matching tests. `lib/selection.test.ts`, `lib/crateEngine.test.ts`, `lib/crates.test.ts`, `src/lib/filters.test.ts`, `src/lib/duplicates.test.ts`, `src/lib/coverage.test.ts`, and `src/lib/crateFilters.test.ts` are close to executable specifications of the edge cases. Run them with `npm test`.
3. Draft the document.
4. Try anything ambiguous in the running app at `http://localhost:3000`. Tests settle "what happens"; the running app settles how it feels, what is visible while a request is in flight, and what the timing is like.
5. Record the commit verified against.

### Verification

Drafting reads the code; verification watches the product. The `verification/` directory holds one checklist per cluster of documents, each item a single observable claim with setup, steps, expected result, a priority, and what it needs (a viewport, a Premium account, an offline network). A tester runs them against the app at `http://localhost:3000`, records `pass`, `fail`, or `blocked` in the Result column, and files every failure in [`bug-triage.md`](bug-triage.md) with the item's ID. A document moves from `drafted` to `verified` in the coverage table only when every P1 and P2 item for it has passed or been filed.

[`bug-triage.md`](bug-triage.md) is the other half: every behavior the documents flagged as a likely defect, deduplicated, with reproduction steps, the reason in the code, a severity, and the decision the product team needs to make. Entries confirmed in the running app carry a Status line.

### Order of work

1. **Pilot: [adding albums by search](add/search-and-add.md).** Small and self-contained, and it exercises all five phases: a debounced search, an empty query that does nothing, a pending add, a committed add, and a failure. Used to settle the template, tone, and depth.
2. **Foundations.** [The data model](foundations/data-model.md), [account and session](foundations/account-and-session.md), [navigation and loading](foundations/navigation-and-loading.md), [the selection engine](foundations/selection-engine.md), [playback](foundations/playback.md). Everything else refers to them; the selection engine owns every weighting number in the product.
3. **The crate wall.** The bulk of the experience and the hardest part: four documents that hand off states to each other. Written third so the template is already proven.
4. **Everything else.** The library, the rest of the add screen, the listening log, the account screens, the player bar, and the cross-cutting concerns, followed by a consistency pass and a verification pass across the whole set.

Progress is tracked in the [coverage table](#coverage) below.

### Scope decisions

- **Friend recommendations are out of scope.** Sending an album to a friend, the recommendations inbox, the outbound email, and the From Friends crate (`source: "friends"`) are excluded. They are a distinct social feature with their own data model and an email dependency, and describing them would double the surface. Where a shared screen has a friends-only affordance — the send button in the album detail panel, the From Friends crate on the wall — the document says the affordance exists, says it is out of scope, and links here. They can get their own area later.
- **Unreachable components are not described.** `NowPlayingModal`, `ContextAlbumsModal`, `ModeSection`, and `AlbumCard` are in the source tree but nothing imports them; no user can reach them. They are recorded as a triage entry rather than given documents.
- **The album detail panel gets one document, not three.** It appears under the crate wall, under the library shelf, and inside a modal on the listening log. A separate copy in each screen's document would drift, so [the album detail panel](library/the-album-detail-panel.md) owns it and the three screens link to it, each noting what it passes in.
- **Failed requests are described once.** Nearly every screen swallows load failures the same way — the skeleton clears, the section renders empty, and the error goes only to the browser console. [Failed requests and offline](cross-cutting/failed-requests-and-offline.md) owns that pattern; each document's interrupt table links to it rather than restating it.
- **Interaction shape.** The unit of interaction is a screen or panel lifecycle and its phases are arrive, leave untouched, first change, while working, and commit. The interrupt list and the order of cross-cutting concerns are fixed as written in the document template above and do not vary between documents.
- **Numbered rules.** These are prose documents, not numbered specifications. Stable heading anchors are enough for cross-references.

## Structure

```
README.md                        this file
goal.md                          the standing instructions for whoever drafts
AGENTS.md, CLAUDE.md             entry points for agents: read README.md, then goal.md
glossary.md                      shared vocabulary
bug-triage.md                    suspected defects collected from every document, with repro steps and decisions needed

verification/
  README.md                      how to run a hand-verification pass and record results
  foundations-and-crates.md      checklists for foundations/ and crates/
  library.md                     checklists for library/
  add-and-history.md             checklists for add/ and history/
  account-player-and-cross-cutting.md
                                 checklists for account/, player/, and cross-cutting/

foundations/
  data-model.md                  albums, the two lists, crates, picks, and config: what each is,
                                   what identifies it, and in what units its numbers are kept
  account-and-session.md         the four account states, how Spotify gets linked, how tokens are
                                   refreshed behind the user's back, and what a lost session looks like
  navigation-and-loading.md      the five routes, the two-item bottom nav, the session cache that
                                   loads each screen once, skeletons, and deferred loads
  selection-engine.md            how a crate's pool is filtered and how a record is drawn from it:
                                   cooldown, recency tiers, bonuses, randomness. Owns every number.
  playback.md                    the in-app web player, the Premium and desktop requirements, and the
                                   four-step fallback when it cannot play

crates/
  the-crate-wall.md              the home screen: rows of crates, refresh, reordering, adding a crate
  picking-a-record.md            choosing a spine, what opens, and what is recorded as a pick
  the-crate-editor.md            creating and editing a crate: name, source, strategy, sliders, count, delete
  ai-crates.md                   the crates Claude fills: why they arrive late, what a suggestion is,
                                   and what happens when the suggestion cannot be acted on

library/
  the-library-shelf.md           the whole library on shelves: sorting, grouping, the list filter
  the-album-detail-panel.md      the panel that opens under a spine: tracks, stats, play, remove, promote
  saving-a-crate-from-the-library.md
                                 advanced filter rules, the genre picker, and turning the current
                                   view into a crate
  duplicates-and-gaps.md         the two audit panels: duplicate records, and records in no crate

add/
  search-and-add.md              the pilot: search Spotify and file a record into one of the two lists
  importing-from-your-spotify-library.md
                                 the LIBRARY tab: paging through saved albums and filing many at once
  importing-from-a-playlist.md   the PLAYLISTS tab: picking a playlist and filing the albums in it

history/
  the-listening-log.md           every pick, newest first, grouped by day

account/
  signing-in.md                  the sign-in screen: email and password, creating an account, Spotify
  resetting-a-password.md        asking for a reset link and setting a new password

player/
  the-player-bar.md              the bar above the bottom nav: what it shows and what its controls do

cross-cutting/
  failed-requests-and-offline.md what the user sees when a request fails, and what is retried
  stale-data-and-second-tabs.md  what the session cache does not notice, and what a second tab breaks
  spotify-dependence.md          what the product can and cannot do without Spotify, without Premium,
                                   and when Spotify rate-limits it
```

## Coverage

Status is one of `not started`, `drafted`, or `verified`.

| Document | Status |
| --- | --- |
| glossary.md | drafted |
| bug-triage.md | not started |
| verification/ (4 checklists) | not started |
| foundations/data-model.md | drafted |
| foundations/account-and-session.md | drafted |
| foundations/navigation-and-loading.md | drafted |
| foundations/selection-engine.md | drafted |
| foundations/playback.md | drafted |
| crates/the-crate-wall.md | drafted |
| crates/picking-a-record.md | drafted |
| crates/the-crate-editor.md | not started |
| crates/ai-crates.md | not started |
| library/the-library-shelf.md | not started |
| library/the-album-detail-panel.md | not started |
| library/saving-a-crate-from-the-library.md | not started |
| library/duplicates-and-gaps.md | not started |
| add/search-and-add.md | drafted |
| add/importing-from-your-spotify-library.md | not started |
| add/importing-from-a-playlist.md | not started |
| history/the-listening-log.md | not started |
| account/signing-in.md | not started |
| account/resetting-a-password.md | not started |
| player/the-player-bar.md | not started |
| cross-cutting/failed-requests-and-offline.md | not started |
| cross-cutting/stale-data-and-second-tabs.md | not started |
| cross-cutting/spotify-dependence.md | not started |

## Reference

The source of truth is the Crate repo, which is the repository these documents live in, at `/Users/derek.brimley/personal-projects/crate`, commit `8301127`. The relevant locations are:

- `src/App.tsx`: the surface this project describes — the five routes, the provider nesting, and the three top-level states (loading, password recovery, signed out).
- `src/pages/`: where each screen's interaction state lives. `Crates.tsx` (the crate wall), `Lists.tsx` (the library), `AddAlbums.tsx` (all three add tabs), `History.tsx`, `Login.tsx`, `ResetPassword.tsx`.
- `src/contexts/DataCache.tsx`: the session cache. Which screens have loaded, what they hold, and what invalidates nothing.
- `src/hooks/useAuth.ts`, `src/hooks/usePlayer.tsx`: the account state machine and the Spotify Web Playback SDK wrapper.
- `src/types/index.ts`, `lib/types.ts`, `supabase/schema.sql`: the domain objects — items, picks, config rows, crate definitions.
- `src/components/`: the UI. `library/` holds the shelf, the spines, the detail panel, and the audit panels; `CrateEditorModal.tsx`, `PlayerBar.tsx`, `Layout.tsx`, `BottomNav.tsx`, `GenrePicker.tsx` are top level.
- `lib/selection.ts`, `lib/crates.ts`, `lib/crateEngine.ts`, `lib/filters.ts`, `lib/claude.ts`: the subsystems that shape which records the user is shown — weighting, crate seeding, strategy dispatch, the filter rules engine, and the Claude Haiku suggestions.
- `api/`: the eleven route handlers. `picks/dashboard.ts` is the one that decides what the crate wall shows; `albums/[id].ts` serves the detail panel; `spotify/[[...path]].ts` is the catch-all for everything that talks to Spotify on the user's behalf.
- `lib/selection.test.ts`, `lib/crateEngine.test.ts`, `lib/crates.test.ts`, `src/lib/filters.test.ts`, `src/lib/duplicates.test.ts`, `src/lib/coverage.test.ts`, `src/lib/crateFilters.test.ts`: the behavioral tests, run with `npm test`.
- `lib/defaults.ts`, `src/components/CrateEditorModal.tsx`, `src/components/library/SpineItem.tsx`: defaults and thresholds — the default config, the slider stops, and the spine dimensions and colors.
