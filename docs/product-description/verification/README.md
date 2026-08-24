# Hand verification

The feature documents were written from Crate's source and its tests. This directory is the protocol for checking them against the running product, one observable claim at a time.

## What is here

| File | Covers |
| --- | --- |
| [foundations-and-crates.md](foundations-and-crates.md) | `foundations/*` and `crates/*` |
| [library.md](library.md) | `library/*` |
| [add-and-history.md](add-and-history.md) | `add/*` and `history/*` |
| [account-player-and-cross-cutting.md](account-player-and-cross-cutting.md) | `account/*`, `player/*`, and `cross-cutting/*` |

Each file has one table per document. Each row is an item with a stable ID (`WALL-07`, `PANEL-12`), a priority, what it needs, the claim with a link to the document section, the setup, numbered steps, the expected result, and a Result column for the tester. Claims that cannot be settled by watching the product are listed under each document as "Not checkable by hand".

Priorities: **P1** is an established fact, a claim other documents depend on, or a suspected bug; **P2** is an ordinary claim; **P3** is a number, a colour, or a timing.

## How to run a pass

1. **Bring up the surface.** Crate is a Vite client plus serverless functions, and most items need both.

   ```bash
   npx vercel dev          # client + api/ together, http://localhost:3000
   ```

   `npm run dev` runs `vite` alone: the client comes up but every `/api/*` request 404s, so every screen looks like a failed load. Use it only for the handful of items marked `client-only`. `.env.local` must hold every variable listed in `.env.example` (the two `VITE_SUPABASE_*` pair, the two server-side `SUPABASE_*`, the two `SPOTIFY_*`, and `ANTHROPIC_API_KEY`) — without `SUPABASE_SERVICE_ROLE_KEY` every request fails authentication, and without `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` nothing Spotify-backed works, including the album panel on an account that is not linked.

2. **Confirm the commit.** Every document ends `Verified against Crate commit 8301127`. Run `git rev-parse --short HEAD`; if it differs, the documents describe a different build and some failures will be drift rather than defects. Say so in the note rather than filing them.

3. **Get the two accounts.** Most of the interesting differences are between account states, and Crate cannot link an existing account to Spotify, so a full pass needs two:
   - **A Spotify account** — created by pressing CONTINUE WITH SPOTIFY. Needed for the two import tabs, for playback, and for everything in `player/`.
   - **An email account** — created on the SIGN UP half of the sign-in screen. Needed for every item about an account that is not linked, and for the whole of `account/resetting-a-password.md`.

   Keep them separate and named in the note. Signing in with Spotify from an email account does not link it; it signs you into the other account.

4. **Get a clean state where an item asks for one.** There is no reset button in the product. A fresh account is the only clean state: sign up with a new email address, and the crate wall seeds thirteen crates on its first load. Items that need "an empty library" need a fresh account, not a library emptied by hand — emptying by hand leaves picks behind, and picks change what the selection engine does.

5. **Keep the documents open beside the app.** Read the linked section before each item; the row is a summary, the section is the claim.

6. **Work P1 first across all four files, then P2, then P3.** The P1 items include every suspected bug, and a few of those are destructive — `SAVE-05` deletes every crate on the account it is run against. Run those last within P1, on the account you are willing to lose, and say in the note which account it was.

7. **Record `pass`, `fail`, or `blocked`** in the Result column, with a short note for anything that is not a clean pass. A fail is something a document claims that the product does not do. A blocked item could not be run — no Premium, no second device, a previous failure in the way.

8. **File every fail** in [`bug-triage.md`](../bug-triage.md): if an entry already covers it, add a Status line quoting the item ID; if not, add a new entry with the item ID under "Raised by". A fail is not automatically a product bug — sometimes the document is wrong and the fix is to the document. The Status line says which.

9. **Promote the document.** When every P1 and P2 item for a document has passed or been filed, change its row in the [coverage table](../README.md#coverage) from `drafted` to `verified`. Nothing is promoted on the strength of a scripted pass alone.

## Devices and conditions

The Device column takes these values.

- **`desktop`** — a desktop browser at 1280 px or wider. Rows measure themselves, so a window narrower than about 700 px changes spine sizes and the number of spines per row.
- **`narrow`** — a viewport under 640 px. Use the browser's device toolbar for layout items, but note that it does not change the user-agent string unless device emulation is on, and the in-tab player is decided from the user-agent, not the width. A narrow desktop window keeps the player; an emulated iPhone loses it.
- **`phone`** — a real phone or an emulated device whose user-agent contains `iPhone`, `iPad`, or `Android`. This is the only way to see the hand-off to the Spotify app, and the only way to see the product without the player bar while music is playing.
- **`premium`** — a Spotify Premium account on a desktop browser. Everything in `player/the-player-bar.md` and the green playing-track highlight in the album panel need it. A free account cannot be substituted: the item is testing the difference.
- **`free`** — a linked Spotify account without Premium. Only for the items that check what happens when the in-tab player refuses to start.
- **`email-only`** — an account created with email and password, never linked to Spotify.
- **`offline`** — the network disabled. Use devtools' Offline throttling for load and write failures; it is enough for every item here, because Crate has no websockets and no in-flight-request handling to defeat. It does **not** stop music already playing through the Web Playback SDK immediately, which matters for `BAR-14`.
- **`two-tabs`** — two tabs of the same account in the same browser. A second window of the same browser profile is the same thing; a second browser or a private window is a different session and tests something else.
- **`console`** — the browser's developer console must be open and visible, because the claim is that the only trace of the failure is a console line.
- **`client-only`** — runnable with `npm run dev` and no serverless functions, because the claim is about layout or about what a failed load looks like.

## Driving the product from a console or script

Crate exposes no global handle: there is no app object on `window`, no state dump, and no test hook. The session cache lives in React context and cannot be read or written from the console, so items about the cache have to be produced the way a user produces them — by which address the tab was opened at, and in which order screens were visited. That is why so many items specify "open `http://localhost:3000/library` directly in a fresh tab"; it is the only way to reach the state where the crate definitions are absent.

The console is still worth having open for three purposes: reading the `console.error` lines that are the only trace of a silently failed request, watching the network panel to confirm that a screen re-requests (or does not) on a second visit, and confirming from the Application panel that `crate_backfill_done` is set in session storage. Use it to observe, not to gesture — every item about input needs real input.

Two things cannot be observed this way at all. Whether a request was sent with Crate's own credentials or the user's token is a server-side distinction, visible only as which account states work. And the Web Playback SDK's device registration is Spotify's, not Crate's; the only view of it is Spotify's own device list in another Spotify client.

## Results so far

**No hand pass has been run.** Every Result column is `—`. Bringing up the surface needs a `.env.local` with Supabase service-role and Spotify client credentials, and a full pass needs a Spotify Premium account and an email account; both are the user's to provide, so the documents were drafted from source and tests only.

What has been run is the source repo's own test suite, at commit `8301127`: `npm test` → 7 files, 59 tests, all passing. That covers the parts of the product that are pure functions and nothing else — the weighting and cooldown arithmetic in `lib/selection.test.ts`, the strategy dispatch in `lib/crateEngine.test.ts`, the thirteen seeded crates in `lib/crates.test.ts`, the filter-rule operators in `src/lib/filters.test.ts` and `src/lib/crateFilters.test.ts`, the duplicate matching in `src/lib/duplicates.test.ts`, and the GAPS coverage arithmetic in `src/lib/coverage.test.ts`. So the numbers in [the selection engine](../foundations/selection-engine.md) and the matching rules in [duplicates and gaps](../library/duplicates-and-gaps.md) rest on passing tests, which is why several of their items are listed as not checkable by hand rather than given rows.

It covers nothing about what is on screen, nothing about what a request does, nothing about failure states, and nothing about timing. No document is marked `verified`, and none should be until a hand pass fills in the Result columns.
