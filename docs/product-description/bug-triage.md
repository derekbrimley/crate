# Bug triage

A consolidated list of the defects and inconsistencies the feature documents raised, in their bodies and in their "Open questions and verification" sections. Every entry is read from the Crate source at commit `8301127` and its tests; none has been confirmed in the running product yet, so no entry carries a **Status** line. The `verification/` checklists are where each one gets confirmed or dismissed — a failed checklist item is not automatically a product bug, and where an entry turns out to be a documentation error the Status line will say so.

The list exists so the product team can decide, item by item, whether to fix, to document as intended, or to leave.

## Summary

The documents raised 54 checklist-level suspected defects plus a handful of body-only findings; merged by root cause they come to **37 entries: 13 high, 19 medium, and 5 low**.

The high ones are not thirty-seven unrelated slips. They fall into four families:

- **Two writes rewrite a whole value.** The thirteen crate definitions live in one settings key, so every save rewrites all of them from the writer's own copy. Any copy that is stale or absent silently deletes crates. This is the only family in the product that loses user data (`B-01`, `B-02`).
- **The session cache is load-once and nothing invalidates it.** One screen owns each load and no write tells the cache anything, so a screen that never ran its loader behaves as though the data does not exist, and a record filed or a pick made is invisible until a reload (`B-02`, `B-03`).
- **Failure is indistinguishable from emptiness.** Three loads render a cheerful empty state on failure, one of them without even a console line; the settings load falls back to defaults, which quietly changes what the selection engine does (`B-05`, `B-06`).
- **The account screens report the wrong outcome.** A reset link that failed to send is reported as sent, a reset that succeeded shows nothing, SKIP leaves the old password in force, and CONNECT SPOTIFY cannot link an account at all (`B-07` to `B-10`).

Seven entries are `product call` rather than `fix`; the other thirty have an obvious expected behavior, which is a good sign — most of these are oversights rather than disagreements. The single most valuable thing to reproduce is `B-01`, because it destroys work and needs only a direct visit to `/library` and one button.

| ID | Title | Severity | Area | Decision needed |
| --- | --- | --- | --- | --- |
| B-01 | Saving a crate can delete every other crate | high | crates, library | fix |
| B-02 | Screens that never load the crate definitions behave as though there are none | high | foundations, library | fix |
| B-03 | A record filed or a pick made is invisible for the rest of the session | high | add, history, foundations | fix |
| B-04 | A failed account re-sync hangs the app on its spinner forever | high | account | fix |
| B-05 | Three screens greet a failed load with a cheerful empty state | high | cross-cutting | fix |
| B-06 | A failed settings load silently substitutes the defaults | high | cross-cutting, foundations | fix |
| B-07 | A reset link that failed to send is reported as sent | high | account | fix |
| B-08 | A successful password reset shows no confirmation at all | high | account | fix |
| B-09 | SKIP leaves the old password in force and spends the reset link | high | account | product call |
| B-10 | CONNECT SPOTIFY cannot link an account; it signs the user into a different one | high | account, add, cross-cutting | product call |
| B-11 | Bulk-imported records get no genres, so most seeded crates stay empty | high | add, cross-cutting | fix |
| B-12 | A pick is recorded from the tap, so track taps inflate the log and failed plays enter it | high | crates, history | product call |
| B-13 | A pick made on a phone may never be recorded | high | crates | fix |
| B-14 | The hover ★ stays filled when the promote failed | medium | crates, cross-cutting | fix |
| B-15 | Opening a HYBRID crate and saving it resets its sliders | medium | crates | fix |
| B-16 | One tap can open two album panels at once | medium | crates | fix |
| B-17 | A deferred AI shelf that fails never retries | medium | crates | fix |
| B-18 | The hover ★ on a HYBRID suggestion fills in and promotes nothing | medium | crates | fix |
| B-19 | A filed suggestion is dated fifty thousand years in the future | medium | crates, foundations | fix |
| B-20 | AI · NEW's fallback ignores the crate's filter rules | medium | crates | fix |
| B-21 | Re-filing an album whose metadata fetch fails erases its genres | medium | add | fix |
| B-22 | The playback chain swallows every message it could usefully show | medium | foundations, cross-cutting | fix |
| B-23 | The crate editor's save has no error handling at all | medium | crates, cross-cutting | fix |
| B-24 | The listening log labels a pick with a raw machine id | medium | history, foundations | product call |
| B-25 | The log stops at a hundred picks and says nothing | medium | history | product call |
| B-26 | An empty refresh token is stored rather than refused | medium | account, foundations | fix |
| B-27 | Escape does nothing on the product's only modal | medium | crates | fix |
| B-28 | An add failure shares the search error's slot and never clears | medium | add | fix |
| B-29 | The import tabs' selection bar sits behind the player bar | medium | add, player | fix |
| B-30 | A modal covers the player bar, so playback cannot be paused | medium | player, crates, history | fix |
| B-31 | The player bar's counter keeps running when playback has stopped | medium | player, cross-cutting | fix |
| B-32 | Nothing tells a user the library ends at five hundred playlist tracks or fifty album tracks | medium | add, cross-cutting | product call |
| B-33 | The connect prompt's READ-ONLY ACCESS line is inaccurate | low | cross-cutting, add | fix |
| B-34 | The profile menu is misplaced on the library screen | low | library | fix |
| B-35 | NO RECORDS FOUND is shown before any search has happened | low | add | fix |
| B-36 | Four components are in the source tree and unreachable | low | — | product call |
| B-37 | Small copy and rendering slips | low | several | fix |

## High

### B-01: Saving a crate can delete every other crate

- **Where the user meets it:** Two ways. A user who opens `http://localhost:3000/library` directly — from a bookmark, a second tab, or a reload while on that screen — filters the shelves and presses SAVE AS CRATE. Or a user with two tabs open adds a crate in one and then saves a crate in the other.
- **What happens / what was expected:** The new crate appears and every other crate is gone; the wall comes back with one shelf. What was expected is that saving a crate adds a crate. In the two-tab case only the other tab's changes are lost, which is quieter and therefore worse.
- **Reproduce:**
  1. On an account with the thirteen seeded crates, open a fresh tab straight to `/library` and do not visit `/` first.
  2. Set any filter, press SAVE AS CRATE, name it, press SAVE.
  3. Go to `/` and reload.
  4. Only the new crate is there. `SAVE-05` in [verification/library.md](verification/library.md); the two-tab variant is `STALE-06` in [verification/account-player-and-cross-cutting.md](verification/account-player-and-cross-cutting.md).
- **Why (from the code):** All thirteen definitions are one JSONB value under one settings key, and every writer writes the whole value from its own copy. `src/pages/Lists.tsx:467-474` saves `[...crateDefs, crate]`, and `crateDefs` on a direct `/library` visit is the empty initial value, because the definitions are only loaded by the crate wall (`B-02`). `src/pages/Crates.tsx:140-145` and `:147-150` do the same for the editor's save and delete. Nothing re-reads before writing, nothing merges, and nothing compares versions.
- **Severity:** `high`. It destroys work the user cannot recover, silently, from a button whose name promises an addition.
- **Decision needed:** `fix`. Either the save sends only the crate that changed and the server merges it, or the client re-reads the definitions immediately before writing and refuses on a mismatch. The first is better: it also fixes `B-02`'s consequences and the two-tab case at once.
- **Raised by:** [saving a crate from the library](library/saving-a-crate-from-the-library.md#edge-cases), [stale data and second tabs](cross-cutting/stale-data-and-second-tabs.md#edge-cases), [navigation and loading](foundations/navigation-and-loading.md#edge-cases), [the crate editor](crates/the-crate-editor.md#cancel-and-interrupt), [the crate wall](crates/the-crate-wall.md#open-questions-and-verification)

### B-02: Screens that never load the crate definitions behave as though there are none

- **Where the user meets it:** Any session that does not visit the crate wall. Landing on `/library` or `/history` directly, or reloading while on one of them.
- **What happens / what was expected:** The GAPS audit reports the entire library as belonging to no crate. The album panel reads `—` for PLAYS and LAST PLAYED on records that have been picked many times, and the listening log itself lists those picks two lines above. And SAVE AS CRATE becomes destructive (`B-01`). What was expected is that each screen has the data it displays, or says it does not.
- **Reproduce:**
  1. Open a fresh tab straight to `/library` on an account with the seeded crates and a populated library.
  2. Open GAPS: every record is listed as uncovered (`AUDIT-01`).
  3. In another fresh tab go straight to `/history` and open any entry's panel: PLAYS and LAST PLAYED read `—` (`STALE-04`).
- **Why (from the code):** `src/contexts/DataCache.tsx:63-91` — `loadDashboard` is the only loader for both the crate definitions and the pick counts, and it is called only from the crate wall. The library's coverage audit runs `findUncovered(allLibraryItems, crateDefs, pickStats)` (`src/pages/Lists.tsx:120`) against an empty definitions array and an empty counts map, both of which are legitimate values, so nothing anywhere detects that they were never loaded.
- **Severity:** `high`. It makes one audit panel state a falsehood about the whole library, makes statistics read as zero, and is what arms `B-01`.
- **Decision needed:** `fix`. The definitions and the pick counts are needed by three screens and should be loaded by whichever screen needs them first, not by the wall alone. Until then, a screen that has not loaded them should show nothing rather than an answer computed from nothing.
- **Raised by:** [navigation and loading](foundations/navigation-and-loading.md#edge-cases), [stale data and second tabs](cross-cutting/stale-data-and-second-tabs.md#edge-cases), [duplicates and gaps](library/duplicates-and-gaps.md#interactions-with-other-systems), [the album detail panel](library/the-album-detail-panel.md#interactions-with-other-systems)

### B-03: A record filed or a pick made is invisible for the rest of the session

- **Where the user meets it:** Everywhere a write happens on one screen and its effect belongs on another. Filing records on any of the three add tabs, then going to the library or the wall. Picking a record on the wall, then opening the listening log.
- **What happens / what was expected:** The library does not contain the record just added, the wall's crates cannot draw it, and the log does not show the pick just made. Nothing indicates a delay, and there is nothing to press. A reload fixes all of it. What was expected is that a write the user watched succeed is reflected on the next screen they visit.
- **Reproduce:**
  1. Visit `/` and then `/library` so both are loaded, then `/add`.
  2. File a record; watch it read ADDED.
  3. Go to `/library`: it is not on the shelves (`SEARCH-03`, `IMPORT-03`, `PLIST-04`).
  4. Go to `/`, pick a record, then open `/history`: the pick is not there (`LOG-02`, `STALE-02`).
- **Why (from the code):** `src/contexts/DataCache.tsx` is a load-once-per-tab store: each loader is guarded by its own `…Loaded` flag (`:63`, `:94`, `:130`) and no write anywhere clears a flag or patches the store. The add screen writes through `services/api.ts` and updates only its own local `addedKeys`; `src/pages/Crates.tsx:127-138` records a pick and touches nothing else. There is no invalidation API on the cache at all.
- **Severity:** `high`. It affects every write in the product, and the add screen — the one place a new user spends their first ten minutes — appears to do nothing.
- **Decision needed:** `fix`. Each write should either patch the cache in place or clear the affected loaded flag. Patching in place is preferable for the add screen, where the user is filing many records in a row.
- **Raised by:** [search and add](add/search-and-add.md#open-questions-and-verification), [importing from your Spotify library](add/importing-from-your-spotify-library.md#interactions-with-other-systems), [importing from a playlist](add/importing-from-a-playlist.md#interactions-with-other-systems), [the listening log](history/the-listening-log.md#interactions-with-other-systems), [stale data and second tabs](cross-cutting/stale-data-and-second-tabs.md#the-interaction-event-by-event), [navigation and loading](foundations/navigation-and-loading.md#interactions-with-other-systems)

### B-04: A failed account re-sync hangs the app on its spinner forever

- **Where the user meets it:** Opening or reloading Crate at a moment when the network is unavailable or the sync route fails. The app shows its full-page spinner and never leaves it. There is nothing to press and no message; only another reload gets out.
- **What happens / what was expected:** A permanently dead app. What was expected is the sign-in screen, or the app with a warning, or at worst a retry.
- **Reproduce:** Signed in, devtools open. Go offline and reload. The spinner stays. (`SIGNIN-04`. Provoking it precisely needs the network dropped between the session check and the sync, so throttling to a slow profile and then going offline is the practical approach.)
- **Why (from the code):** `src/hooks/useAuth.ts:38-45` — the initial `getSession()` handler awaits `syncUser(session)` and then sets `loading` to false. There is no `.catch` on the promise chain and no `try`/`finally`, so a rejection from the sync skips `setLoading(false)` entirely. `src/App.tsx:14-20` renders the spinner for as long as `loading` is true.
- **Severity:** `high`. The user cannot get out of it, and it is the first thing that runs on every visit.
- **Decision needed:** `fix`. `setLoading(false)` belongs in a `finally`. Whether a failed sync should also warn the user is a smaller question; clearing the spinner is not.
- **Raised by:** [signing in](account/signing-in.md#open-questions-and-verification), [account and session](foundations/account-and-session.md#open-questions-and-verification), [failed requests and offline](cross-cutting/failed-requests-and-offline.md#interactions-with-other-systems)

### B-05: Three screens greet a failed load with a cheerful empty state

- **Where the user meets it:** A bad connection, a server error, or an expired session on first load of the crate wall, the library, or the listening log.
- **What happens / what was expected:** The crate wall renders with no crates. The library renders as an empty library. The log renders `START PICKING RECORDS TO BUILD YOUR LOG` to a user with hundreds of picks. All three are exactly what a genuinely new account shows. The log's failure is not even written to the console, making it the one failure in the product with no trace anywhere. What was expected is that a screen distinguishes "nothing here" from "I could not find out".
- **Reproduce:** Offline, open each of `/`, `/library`, and `/history` in a fresh tab and read the screen and the console (`FAIL-02`, `FAIL-03`, `FAIL-04`, `LOG-03`).
- **Why (from the code):** `src/contexts/DataCache.tsx:88-90` and `:126-128` log and swallow; `:131-137` swallows without logging. In each case the state stays at its empty initial value, which every consumer renders as an empty result. `src/pages/History.tsx:114-121` renders its empty state whenever the entry list is empty, with no way to ask why.
- **Severity:** `high`. It affects every screen's first load, and it tells the user something false about their own data.
- **Decision needed:** `fix`. Each loader needs an error state distinct from its empty state, and the empty states need to stop claiming the account is new. A retry control would also convert the accidental leave-and-return retry into a deliberate one.
- **Raised by:** [failed requests and offline](cross-cutting/failed-requests-and-offline.md#arrive), [the listening log](history/the-listening-log.md#interactions-with-other-systems), [the crate wall](crates/the-crate-wall.md#open-questions-and-verification), [the library shelf](library/the-library-shelf.md#interactions-with-other-systems)

### B-06: A failed settings load silently substitutes the defaults

- **Where the user meets it:** Any session where the settings request fails. Nothing on screen changes, so the user meets it without noticing: their crates draw from default weights, default cooldowns, and default counts.
- **What happens / what was expected:** The [selection engine](foundations/selection-engine.md) runs on numbers the user never chose, and the crate editor would offer to save those numbers back as if they were the user's own. What was expected is that a settings failure is reported, or at least that the product refuses to act on numbers it does not have.
- **Reproduce:** Change one setting away from its default — a crate's count, say. Offline, open the screen that shows its effect in a fresh tab. The default behavior appears, with nothing on screen and nothing in the console (`FAIL-05`).
- **Why (from the code):** `src/contexts/DataCache.tsx:56-61` — `loadConfig` ends in a bare `catch {}`, leaving the config state at the defaults from `lib/defaults.ts`, which is indistinguishable from an account that has never been configured.
- **Severity:** `high`. It silently changes what the product does, in the one subsystem the user tuned deliberately, and leaves no evidence.
- **Decision needed:** `fix`. A failed settings load should be reported and should block the writes that would persist the substituted defaults.
- **Raised by:** [failed requests and offline](cross-cutting/failed-requests-and-offline.md#arrive), [the selection engine](foundations/selection-engine.md#interactions-with-other-systems), [navigation and loading](foundations/navigation-and-loading.md#interactions-with-other-systems)

### B-07: A reset link that failed to send is reported as sent

- **Where the user meets it:** FORGOT PASSWORD? on the sign-in screen, on a bad connection or against a deployment whose mail is misconfigured.
- **What happens / what was expected:** A green box saying the link has been sent. No link ever arrives. The user waits, tries again, and gets the same green box. What was expected is the red box the rest of the screen uses.
- **Reproduce:** On the sign-in screen tap FORGOT PASSWORD?, go offline, enter an address, and submit (`RESET-02`).
- **Why (from the code):** `src/pages/Login.tsx:31-37` calls `await onForgotPassword(email)` and then `setForgotSent(true)` unconditionally. The returned value is the error message (`src/hooks/useAuth.ts:94-99` returns `error?.message ?? null`) and it is discarded.
- **Severity:** `high`. It reports success for a failure, on the one screen a locked-out user has, and it is the only place in the product that does so.
- **Decision needed:** `fix`. Show the returned message in the red box the screen already has, and only show green on `null`.
- **Raised by:** [resetting a password](account/resetting-a-password.md#first-change), [failed requests and offline](cross-cutting/failed-requests-and-offline.md#first-change), [signing in](account/signing-in.md#interactions-with-other-systems)

### B-08: A successful password reset shows no confirmation at all

- **Where the user meets it:** Following a reset link and setting a new password successfully.
- **What happens / what was expected:** The screen has a `PASSWORD UPDATED SUCCESSFULLY` box with a CONTINUE button, and it is never shown: the app navigates away the instant the password is accepted. The user's new password is in force but nothing said so. What was expected is the confirmation the screen was built to show.
- **Reproduce:** Follow a fresh reset link, set a new password, and watch for the success box (`RESET-03`).
- **Why (from the code):** `src/hooks/useAuth.ts:101-105` clears `needsPasswordReset` inside `updatePassword` on success. `src/App.tsx:22-27` renders the reset screen only while that flag is set, so the component unmounts before `src/pages/ResetPassword.tsx:16-34` gets to `setDone(true)`. The box at `src/pages/ResetPassword.tsx:62` and its CONTINUE button are unreachable.
- **Severity:** `high`. A security-relevant action completes with no feedback, which invites the user to do it again.
- **Decision needed:** `fix`. Clear the recovery flag when CONTINUE is pressed, not when the password is accepted.
- **Raised by:** [resetting a password](account/resetting-a-password.md#commit), [signing in](account/signing-in.md#interactions-with-other-systems)

### B-09: SKIP leaves the old password in force and spends the reset link

- **Where the user meets it:** Following a reset link and pressing SKIP on the forced reset screen.
- **What happens / what was expected:** The user lands in the app, signed in, with the **old** password still working and the new one never set. The recovery link is single-use, so it cannot be followed again: the user who could not sign in still cannot sign in. What was expected is either no SKIP at all, or a SKIP that leaves the link usable.
- **Reproduce:** Follow a fresh reset link, press SKIP, sign out, and try both passwords (`RESET-04`).
- **Why (from the code):** `src/pages/ResetPassword.tsx:120-129` calls `onCancel`, which is `clearPasswordReset` (`src/hooks/useAuth.ts:107`) — a client-side flag only. The recovery session that the link established is already consumed.
- **Severity:** `high`. It puts the user back where they started with no way to try again, from a button that looks harmless.
- **Decision needed:** `product call`. Removing SKIP is the simplest answer and costs the user who followed the link by accident nothing but a sign-out. Keeping it means saying plainly on the button what it does — "keep my old password" — and accepting that the link is spent.
- **Raised by:** [resetting a password](account/resetting-a-password.md#cancel-and-interrupt), [account and session](foundations/account-and-session.md#modifiers)

### B-10: CONNECT SPOTIFY cannot link an account; it signs the user into a different one

- **Where the user meets it:** An email-only account meets the connect prompt on the add screen's two import tabs and on the wall. Pressing CONNECT SPOTIFY starts Spotify's OAuth flow.
- **What happens / what was expected:** The user comes back as a **different account** — the one Spotify's identity maps to — with a different library, different crates, and a different log. Their email account is not linked and is not gone; they are simply somewhere else. They also do not come back to the screen they left: the flow lands on the crate wall. What was expected is that the button links Spotify to the account they are signed into.
- **Reproduce:**
  1. Sign in to an email-only account that has records in its library.
  2. Open `/add` → PLAYLISTS and press CONNECT SPOTIFY.
  3. Complete the Spotify sign-in and read the library and the wall (`ACCT-05`, `SPOT-04`, `PLIST-06`).
- **Why (from the code):** `src/hooks/useAuth.ts:77-87` — `login()` calls `signInWithOAuth`, which replaces the session, rather than `linkIdentity`, which would attach the Spotify identity to the current user. Its `redirectTo` is `/callback`, and that route renders the crate wall (`src/App.tsx:14-47`), so the origin screen is lost too.
- **Severity:** `high`. An email-only account cannot reach any Spotify feature by any route, and the button that promises to fix that instead moves the user to another account without saying so.
- **Decision needed:** `product call`. Linking identities is the behavior the button's label promises and needs `linkIdentity` plus the account-sync route accepting a link. If linking is not wanted, the button should say what it does — sign in with Spotify instead — and warn that the email account's library stays behind. Either way the return should go back to the screen the user left.
- **Raised by:** [account and session](foundations/account-and-session.md#modifiers), [Spotify dependence](cross-cutting/spotify-dependence.md#modifiers), [importing from a playlist](add/importing-from-a-playlist.md#modifiers), [importing from your Spotify library](add/importing-from-your-spotify-library.md#modifiers)

### B-11: Bulk-imported records get no genres, so most seeded crates stay empty

- **Where the user meets it:** A new user who fills their library the fast way — the LIBRARY tab or a playlist — and then looks at the crate wall.
- **What happens / what was expected:** Nine of the thirteen seeded crates filter on genre and stay empty forever, because no imported record has any genres, and nothing ever backfills them. The album panel makes this hard to spot: it shows genre badges fetched live from Spotify, which are not the stored genres the crate engine filters on, so a record that looks tagged is not. What was expected is that a record filed in bulk is as usable as a record filed one at a time — the single-add path does fetch genres.
- **Reproduce:**
  1. On a fresh account, import six albums from `/add` → LIBRARY.
  2. Reload and open one of them from the library: genre badges are shown.
  3. Look at the genre-based crates on the wall: empty (`IMPORT-01`, `SPOT-06`).
- **Why (from the code):** `api/albums/bulk.ts:45-59` builds each row's metadata from `release_date` and `total_tracks` only — no genres — even though it already fetches album records from Spotify twenty at a time. The single-add route does the extra artist fetch: `api/albums/index.ts:37-48` sets `metadata.genres` from `fetchAlbumMeta`. The panel's badges come from the live album-details route instead of the stored bag.
- **Severity:** `high`. It silently disables most of the product's default crates for exactly the users who populated their library the recommended way.
- **Decision needed:** `fix`. The bulk route should fetch artist genres the way the single-add route does, and a backfill should run for records already filed without them.
- **Raised by:** [importing from your Spotify library](add/importing-from-your-spotify-library.md#interactions-with-other-systems), [Spotify dependence](cross-cutting/spotify-dependence.md#edge-cases), [the data model](foundations/data-model.md#edge-cases), [importing from a playlist](add/importing-from-a-playlist.md#interactions-with-other-systems)

### B-12: A pick is recorded from the tap, so track taps inflate the log and failed plays enter it

- **Where the user meets it:** Any play started from a crate shelf. Tapping four tracks in one album's panel to sample them. Or pressing PLAY ON SPOTIFY when nothing can play.
- **What happens / what was expected:** Four taps write four picks for the same album, so the log shows it four times, its PLAYS count reads `×4`, and the selection engine's cooldown and recency treat it as heavily played. A play that fails at every step of the fallback chain still leaves a pick behind, so the log records a listen that never happened. What was expected is one pick per listening session, recorded when something actually starts playing.
- **Reproduce:**
  1. On a crate shelf open a record with no picks and tap five different tracks.
  2. Reload and open `/history`: five entries (`PICK-02`, `LOG-05`).
  3. With no Spotify device available, press PLAY ON SPOTIFY and check the log (`PLAY-06`).
- **Why (from the code):** `src/pages/Crates.tsx:465` passes `onPlay={() => onPick(selectedItem, crateId)}`, and `src/components/library/DetailPanel.tsx:256-258` and `:369-374` call `onPlay?.()` as the **first** thing in both the track handler and the PLAY button, before the user-agent test and the whole fallback chain. Nothing dedupes and nothing waits for playback to confirm.
- **Severity:** `high`. Picks are the input to the selection engine's cooldown, recency tiers, and bonuses, so inflated counts change what the product recommends for weeks.
- **Decision needed:** `product call`. What counts as a listen is a product question: one pick per panel session, one per album per hour, or one only when the player reports playback starting. The last is the most honest and the most work. Whatever the rule, recording before the play chain has succeeded is wrong.
- **Raised by:** [picking a record](crates/picking-a-record.md#edge-cases), [the listening log](history/the-listening-log.md#edge-cases), [playback](foundations/playback.md#the-interaction-event-by-event), [the selection engine](foundations/selection-engine.md#interactions-with-other-systems)

### B-13: A pick made on a phone may never be recorded

- **Where the user meets it:** Every play on a phone. The browser leaves for the Spotify app or the album's web page immediately.
- **What happens / what was expected:** The pick request is sent and not waited for, and then the browser navigates away. Some browsers cancel a request in flight during a navigation. If they do, **no pick is ever recorded on a phone**, which makes the listening log and the entire cooldown mechanism desktop-only, silently. What was expected is that a pick made anywhere is recorded.
- **Reproduce:** On a phone, press PLAY ON SPOTIFY on a record on a crate shelf, let it hand off, come back, reload, and open `/history` (`PICK-04`).
- **Why (from the code):** `src/components/library/DetailPanel.tsx:256-263` and `:369-376` — `onPlay?.()` is called without `await`, and the phone branch then sets `window.location.href` on the next statement. `src/pages/Crates.tsx:127-138` awaits the write inside its own handler, but nothing keeps the page alive for it.
- **Severity:** `high` if it reproduces: it removes a whole feature for a whole class of device with no indication. It is listed at `high` on the strength of the code rather than an observation, and the checklist item settles it.
- **Decision needed:** `fix`. Send the pick with a keep-alive request, or await it before navigating. Both are small.
- **Raised by:** [picking a record](crates/picking-a-record.md#open-questions-and-verification), [playback](foundations/playback.md#open-questions-and-verification)

## Medium

### B-14: The hover ★ stays filled when the promote failed

- **Where the user meets it:** Hovering a spine on the crate wall and pressing the ★ that appears, on a bad connection.
- **What happens / what was expected:** The star fills in and stays filled. The record was not promoted and is still a recommendation after a reload. The album panel's own ★ FAVORITE button behaves differently — it reverts, saying nothing — so the same action on two surfaces gives two different wrong answers. What was expected is that the star reflects the answer, not the tap.
- **Reproduce:** Offline, hover a recommendation's spine on the wall and press ★; then open the same record's panel and press ★ FAVORITE; then reload (`WALL-04`, `PANEL-06`, `FAIL-07`).
- **Why (from the code):** `src/components/library/SpineItem.tsx:115-141` — the button's handler calls `onFavorite(item)` without awaiting it and then `setFavorited(true)` unconditionally, and the filled star at `:143-160` renders off that local flag. `src/pages/Crates.tsx:94-101` logs the failure and returns. The panel's version, `src/components/library/DetailPanel.tsx:220-229`, sets its flag after the await, so it reverts instead.
- **Severity:** `medium`. Wrong and unreported, but recoverable — the record is unchanged and the star resets on any reload.
- **Decision needed:** `fix`. Set the star from the answer, as the panel does, and give both surfaces the same failure message.
- **Raised by:** [the crate wall](crates/the-crate-wall.md#edge-cases), [failed requests and offline](cross-cutting/failed-requests-and-offline.md#first-change), [the album detail panel](library/the-album-detail-panel.md#cancel-and-interrupt)

### B-15: Opening a HYBRID crate and saving it resets its sliders

- **Where the user meets it:** A user who tuned a hybrid crate's cooldown or variety, then opens its editor to change something unrelated — the name, a rule — and presses SAVE.
- **What happens / what was expected:** The four sliders show the defaults rather than the crate's own values, and saving writes those defaults over the tuning. Merely looking at a tuned hybrid crate and saving it discards the tuning. What was expected is that the editor shows what is saved.
- **Reproduce:** Set a crate to WEIGHTED with cooldown "A month", save, change its strategy to HYBRID, save, reopen, and read the cooldown slider (`EDIT-01`).
- **Why (from the code):** `src/components/CrateEditorModal.tsx:119-121` reads the saved weighting only when the strategy is `weighted`: `initial.strategy.type === "weighted" ? initial.strategy.weighting : { ...CLIENT_DEFAULT_WEIGHTING }`. A hybrid strategy carries a `weighting` of its own (`lib/crateEngine.ts:71-77` uses it) and it is never read.
- **Severity:** `medium`. It loses a setting the user chose, but only that setting, and re-tuning it takes seconds.
- **Decision needed:** `fix`. Read the weighting for `hybrid` as well as `weighted`.
- **Raised by:** [the crate editor](crates/the-crate-editor.md#modifiers), [the selection engine](foundations/selection-engine.md#interactions-with-other-systems)

### B-16: One tap can open two album panels at once

- **Where the user meets it:** Two ways. A record the engine drew into two crates: tapping it on one shelf opens a panel under both. Or two AI crates on the wall: tapping the first suggestion of one opens a panel under the other too, showing a **different album**.
- **What happens / what was expected:** Two panels open, pushing the wall around, and in the AI case the second one describes an album the user did not tap. What was expected is one panel under the spine that was tapped.
- **Reproduce:** For the first, find a record drawn into two crates and tap it (`WALL-06`). For the second, get two AI crates filled on one wall and tap the first spine of one (`WALL-07`).
- **Why (from the code):** `src/pages/Crates.tsx:49` holds a single `selectedAlbumId` for the whole wall and passes it to every row, so any row whose items contain that id renders a panel. Suggestions have no database id, and `:244` assigns synthetic negative ids **per row** — `rawItems.map((it, i) => (it.id > 0 ? it : { ...it, id: -(i + 1) }))` — so the first suggestion of every AI shelf is `-1`. The line's own comment says the negative ids exist "to avoid key/selection collisions", which is what they cause.
- **Severity:** `medium`. Visually confusing and, in the AI case, actively misleading about which album is which, but nothing is written wrongly and closing either panel recovers.
- **Decision needed:** `fix`. Key the selection on the crate and the record together, and mint suggestion ids across the whole wall rather than per shelf.
- **Raised by:** [the crate wall](crates/the-crate-wall.md#edge-cases), [picking a record](crates/picking-a-record.md#edge-cases), [AI crates](crates/ai-crates.md#edge-cases)

### B-17: A deferred AI shelf that fails never retries

- **Where the user meets it:** The AI crates arrive after the rest of the wall. If that late request fails — a dropped connection, a Claude error — the shelf stays in its loading state or empty for the life of the tab.
- **What happens / what was expected:** Leaving the wall and coming back does not retry it, which is the one repair the rest of the product offers. Only a reload fixes it. What was expected is at least the same accidental retry the other loads get.
- **Reproduce:** Let the wall load, go offline as the AI shelves start filling, come back online, navigate away and back, and watch the shelf (`AI-03`).
- **Why (from the code):** `src/pages/Crates.tsx:69-77` — each deferred crate id is added to `kickedOffRef` **before** the request is made and never removed, and the ref persists for the tab. `dashboardLoaded` also stays true, so re-entering the wall does not re-run the effect's precondition.
- **Severity:** `medium`. One or two shelves are missing for the session; the rest of the wall works.
- **Decision needed:** `fix`. Record the id on success, or clear it on failure.
- **Raised by:** [AI crates](crates/ai-crates.md#cancel-and-interrupt), [the crate wall](crates/the-crate-wall.md#interactions-with-other-systems), [navigation and loading](foundations/navigation-and-loading.md#interactions-with-other-systems)

### B-18: The hover ★ on a HYBRID suggestion fills in and promotes nothing

- **Where the user meets it:** Hovering a suggestion on a HYBRID shelf — the AI half of it — and pressing the ★.
- **What happens / what was expected:** The star fills in and nothing happens. There is no record to promote: a suggestion is not in the library until it is filed from its panel. AI · NEW shelves withhold the star for exactly this reason; HYBRID shelves do not. What was expected is either no star on a suggestion anywhere, or a star that files it.
- **Reproduce:** On a hybrid crate with a suggestion on its shelf, hover the suggestion, press the ★, and then look for the record in the library (`AI-04`).
- **Why (from the code):** `src/pages/Crates.tsx:262-267` withholds `onFavorite` for `ai_new` crates only, so a hybrid crate's suggestions get it. `src/pages/Crates.tsx:127-129`'s sibling guard `if (item.id <= 0) return;` exists for picks; the promote path has no equivalent, and `src/components/library/SpineItem.tsx:115-123` fills the star regardless.
- **Severity:** `medium`. Nothing is broken, but the product claims to have done something it cannot do.
- **Decision needed:** `fix`. Withhold the star on any suggestion, matching AI · NEW. Making it file the suggestion instead is the more useful behavior and is a larger change.
- **Raised by:** [AI crates](crates/ai-crates.md#the-interaction-event-by-event), [the crate wall](crates/the-crate-wall.md#modifiers)

### B-19: A filed suggestion is dated fifty thousand years in the future

- **Where the user meets it:** Filing an AI suggestion, then sorting the library by ADDED. It sits at the top permanently and stays "recently added" forever.
- **What happens / what was expected:** Its filed-at time is a millisecond value where every other time in the product is in seconds, so it reads as a date around the year 53,000. What was expected is the time it was filed.
- **Reproduce:** File a suggestion from its panel, reload, and sort the library by ADDED (`AI-05`).
- **Why (from the code):** `api/picks/dashboard.ts:77` builds the suggestion row with `added_at: Date.now()` — milliseconds. Everywhere else uses `Math.floor(Date.now() / 1000)` (for example `lib/queries.ts:21`, `:106`, `lib/selection.ts:19`).
- **Severity:** `medium`. Currently only the ADDED sort shows it, but it also feeds any future "recently added" rule, and stored data is wrong on disk.
- **Decision needed:** `fix`. Divide by a thousand, and correct any rows already written.
- **Raised by:** [AI crates](crates/ai-crates.md#edge-cases), [the data model](foundations/data-model.md#open-questions-and-verification)

### B-20: AI · NEW's fallback ignores the crate's filter rules

- **Where the user meets it:** An AI · NEW crate with filter rules, when Claude fails or returns nothing usable. The shelf fills with records drawn from the whole library rather than from the crate's own pool.
- **What happens / what was expected:** A crate defined as "jazz from before 1970" shows anything at all, with nothing indicating that its rules were not applied. What was expected is the fallback the sibling strategy uses — a random sample of the crate's pool.
- **Reproduce:** Make an AI · NEW crate with a narrow rule and make Claude fail (an invalid `ANTHROPIC_API_KEY` is the practical way), then load the wall (`AI-06`).
- **Why (from the code):** `lib/crateEngine.ts:63-68` — `ai_new`'s `catch` returns `randomSample(allItems, crate.count)`. The `ai_pool` case directly above it, `:55-61`, falls back to `randomSample(pool, …)`. `pool` is the filtered set; `allItems` is everything.
- **Severity:** `medium`. The shelf is wrong rather than broken, and only in a path that needs Claude to fail.
- **Decision needed:** `fix`. Fall back to `pool`, matching `ai_pool`.
- **Raised by:** [AI crates](crates/ai-crates.md#edge-cases), [the selection engine](foundations/selection-engine.md#interactions-with-other-systems)

### B-21: Re-filing an album whose metadata fetch fails erases its genres

- **Where the user meets it:** Filing an album from search that is already in the library — a promotion by re-adding, or an accidental second add — at a moment when Spotify's metadata request fails.
- **What happens / what was expected:** The record's stored metadata is replaced with nothing, so the genres it had are gone and it drops out of every genre-filtered crate. Nothing is said; the row reads ADDED. What was expected is that a re-file adds to what is known rather than replacing it.
- **Reproduce:** File an album normally so it has genres. Then re-file it with Spotify's album endpoint failing (throttle heavily or block the request) and check whether its genres survive, and whether it still appears in a genre crate. `SPOT-12` covers the neighbouring case — a first file whose metadata request fails, which is filed permanently incomplete.
- **Why (from the code):** `api/albums/index.ts:37-60` builds a fresh `metadata` object per request and passes it straight to `addItem`, which upserts the whole row. When `fetchAlbumMeta` throws, the `catch` at `:46-48` leaves `metadata` empty and the write stores `null` over whatever was there.
- **Severity:** `medium`. It is real data loss, but it needs a re-file and a failure at the same moment.
- **Decision needed:** `fix`. Merge the fresh metadata into the stored bag rather than replacing it, and never write `null` over an existing value.
- **Raised by:** [search and add](add/search-and-add.md#open-questions-and-verification), [the data model](foundations/data-model.md#edge-cases)

### B-22: The playback chain swallows every message it could usefully show

- **Where the user meets it:** A free Spotify account pressing play. Or anyone with no Spotify device open anywhere.
- **What happens / what was expected:** A free account never plays in the tab and is never told that the in-tab player needs Premium; it silently falls through to a new browser tab. When no device is available the server produces exactly the right sentence — "No active Spotify device found. Open Spotify on any device first." — and it is discarded, because the caller's job at that point is to try the next step. So the most useful message in the product is written and never shown. What was expected is that after five seconds of waiting and three failed attempts, the user is told something.
- **Reproduce:** On a linked non-Premium account, load `/`, wait ten seconds, and press PLAY ON SPOTIFY with no Spotify app running anywhere (`PLAY-02`, `PLAY-03`, `SPOT-07`).
- **Why (from the code):** `lib/spotify.ts:359` throws the device message; `src/components/library/DetailPanel.tsx:264-269` and `:374-380` catch each step with `catch { /* fall through */ }` and end at `window.open`. `src/pages/AddAlbums.tsx:42-52` does the same. Nothing collects the reasons, and the Premium requirement is decided from the user-agent string and the SDK's own error rather than being told to the user.
- **Severity:** `medium`. Playback still happens, in a new tab; what is lost is the explanation.
- **Decision needed:** `fix`. Keep the last error from the chain and show it when the chain ends, and say "Premium required for in-tab playback" once rather than silently degrading.
- **Raised by:** [playback](foundations/playback.md#the-interaction-event-by-event), [Spotify dependence](cross-cutting/spotify-dependence.md#edge-cases), [the player bar](player/the-player-bar.md#modifiers)

### B-23: The crate editor's save has no error handling at all

- **Where the user meets it:** Pressing SAVE in the crate editor when the write fails.
- **What happens / what was expected:** The modal stays open with the edit intact and the button back to SAVE — which is the most recoverable failure behavior in the product — but nothing is said, and nothing is logged, so the failure does not even reach the console. It is the one failed write in Crate with no handling of any kind. What was expected is a message; what was expected of the code is at least a `catch`.
- **Reproduce:** Offline, build a crate in the editor and press SAVE. Watch the modal and read the console (`FAIL-08`, and `SAVE-04` for the library's version, which does log).
- **Why (from the code):** `src/pages/Crates.tsx:140-145` awaits `saveCrateDefs` with no `try`/`catch`, so a rejection becomes an unhandled promise rejection and `setEditingCrate(null)` is never reached. `src/components/CrateEditorModal.tsx:151-165` wraps the call in `try`/`finally` with no `catch`, which is what puts the button back.
- **Severity:** `medium`. The user keeps their work; what they lack is any way to know the save did not happen.
- **Decision needed:** `fix`. Catch the failure and show it in the modal. Keeping the modal open is right and should stay.
- **Raised by:** [the crate editor](crates/the-crate-editor.md#cancel-and-interrupt), [failed requests and offline](cross-cutting/failed-requests-and-offline.md#first-change), [saving a crate from the library](library/saving-a-crate-from-the-library.md#cancel-and-interrupt)

### B-24: The listening log labels a pick with a raw machine id

- **Where the user meets it:** Opening `/history` after picking a record from any of the thirteen seeded crates.
- **What happens / what was expected:** The entry's third line reads something like `CRATE_SEED_3_481920`. The log knows four legacy mode names and every crate id falls through to being upper-cased. A crate that has since been renamed or deleted is unresolvable even in principle, because nothing stores the name the crate had at the time. What was expected is the crate's name.
- **Reproduce:** Pick a record from any seeded crate, reload, and open `/history` (`LOG-01`, `DATA-07`).
- **Why (from the code):** `src/pages/History.tsx:27-32` defines symbols and labels for `favorites`, `discover`, `for_right_now`, and `surprise` only; `:152` falls back to `MODE_SYMBOLS[entry.mode] || { label: entry.mode.toUpperCase() }`. The pick row stores the crate's id and nothing else (`lib/queries.ts:106`), and deleting a crate leaves its picks pointing at an id nothing resolves (`crates/the-crate-editor.md`).
- **Severity:** `medium`. Every entry in the log is mislabelled for every user, but nothing is lost.
- **Decision needed:** `product call`. Resolving the id against the current definitions fixes the common case cheaply and still shows a raw id for a deleted crate. Storing the crate's name on the pick fixes it permanently and means the log can show a name for a crate that no longer exists — at the cost of a name that no longer matches a renamed crate. The second is the better record of what actually happened.
- **Raised by:** [the listening log](history/the-listening-log.md#edge-cases), [the data model](foundations/data-model.md#edge-cases), [the crate editor](crates/the-crate-editor.md#edge-cases)

### B-25: The log stops at a hundred picks and says nothing

- **Where the user meets it:** An account with more than a hundred picks scrolling to the bottom of `/history`.
- **What happens / what was expected:** The list simply ends. There is no "load more", no count, and no note that anything was left out; the oldest listens are unreachable from the product. The server would return up to two hundred. What was expected is either the whole log or a statement that it was cut.
- **Reproduce:** On an account with more than a hundred picks, open `/history` and scroll to the very bottom (`LOG-04`).
- **Why (from the code):** `src/contexts/DataCache.tsx:131-137` calls `getHistory(100)` — a hard-coded limit inside a `try` whose `catch` is empty. `api/picks/index.ts:10` caps at 200, so even the server's own ceiling is not being used.
- **Severity:** `medium`. Data is hidden rather than lost, and only from users who have used the product a while.
- **Decision needed:** `product call`. Paging is the honest answer; a raised limit with a line saying "showing the last N" is the cheap one. Doing nothing means the log quietly becomes a partial record.
- **Raised by:** [the listening log](history/the-listening-log.md#edge-cases), [navigation and loading](foundations/navigation-and-loading.md#interactions-with-other-systems)

### B-26: An empty refresh token is stored rather than refused

- **Where the user meets it:** A Spotify sign-in where the provider does not return a refresh token. Everything works for an hour and then every Spotify-backed feature fails silently and permanently: no library import, no playlists, no playback on a device. Signing out and in again is the only repair, and nothing suggests it.
- **What happens / what was expected:** Refreshes fail forever with no message anywhere. What was expected is that a sign-in without a refresh token is either rejected or flagged, so the failure is one visible event rather than an indefinite silence.
- **Reproduce:** Hard to provoke deliberately; the checkable half is `SPOT-08`, which establishes that a link that no longer works is indistinguishable from a network failure and that nothing offers to reconnect.
- **Why (from the code):** `api/auth/sync.ts:25-37` stores `provider_refresh_token ?? ""`. `lib/spotify.ts:63` then refreshes on expiry with an empty token, which Spotify refuses, and every caller treats the refusal as an ordinary request failure.
- **Severity:** `medium`. Severe when it happens, and it is not known whether it happens.
- **Decision needed:** `fix`. Do not store an empty token; record that the link is incomplete and tell the user to reconnect.
- **Raised by:** [account and session](foundations/account-and-session.md#open-questions-and-verification), [Spotify dependence](cross-cutting/spotify-dependence.md#modifiers)

### B-27: Escape does nothing on the product's only modal

- **Where the user meets it:** The crate editor open with an edit in progress. Escape does nothing. So does Escape on the album panel, the genre picker, and the two audit panels; there is no keyboard dismissal anywhere in Crate.
- **What happens / what was expected:** Nothing happens and the modal stays open. What was expected is the universal convention: Escape closes it.
- **Reproduce:** Open the crate editor and press Escape (`EDIT-04`).
- **Why (from the code):** No `keydown` handler exists on any of them. `src/components/CrateEditorModal.tsx:179` renders a backdrop with a click handler and no key handling; nothing in `src/components/` registers a document-level Escape listener.
- **Severity:** `medium`. Recoverable — there is always CANCEL or ✕ — but it is a keyboard user's only way out of a modal that also does not trap or manage focus.
- **Decision needed:** `fix`. One document-level handler while a modal is open, and it is worth doing focus management at the same time.
- **Raised by:** [the crate editor](crates/the-crate-editor.md#cancel-and-interrupt), [the album detail panel](library/the-album-detail-panel.md#cancel-and-interrupt), [failed requests and offline](cross-cutting/failed-requests-and-offline.md#cancel-and-interrupt)

### B-28: An add failure shares the search error's slot and never clears

- **Where the user meets it:** A failed file on the search tab. `Failed to add.` appears where the search error goes and stays there — through scrolling, through selecting other records, through leaving the tab and coming back.
- **What happens / what was expected:** The message is only cleared by starting a new search, so a stale failure sits above results it has nothing to do with, and a second failure looks identical to the first. What was expected is a message that clears itself, or one attached to the row that failed.
- **Reproduce:** With results on screen, go offline, tap ★ FAV on a row, then read the message and try other actions (`SEARCH-06`).
- **Why (from the code):** `src/pages/AddAlbums.tsx:67-75` sets the shared error state on a failed add, and `:55-65` clears that state only inside the debounced search timer. Nothing else resets it.
- **Severity:** `medium`. Misleading rather than harmful; the add itself simply did not happen.
- **Decision needed:** `fix`. Give the add its own message, put it on the row that failed, and clear it on the next action.
- **Raised by:** [search and add](add/search-and-add.md#open-questions-and-verification), [failed requests and offline](cross-cutting/failed-requests-and-offline.md#edge-cases)

### B-29: The import tabs' selection bar sits behind the player bar

- **Where the user meets it:** Music playing in the tab, then ticking rows on `/add` → LIBRARY or PLAYLISTS. The bar with the count and the two filing buttons overlaps the player bar.
- **What happens / what was expected:** The two fixed bars occupy nearly the same strip, so the filing buttons may be unreachable exactly when the user has a selection to file. What was expected is that they stack.
- **Reproduce:** Premium, music playing, tick one row on an import tab and look at the bottom of the screen (`IMPORT-08`).
- **Why (from the code):** `src/pages/AddAlbums.tsx:185` places the selection bar at `fixed bottom-20 … z-50` (80 px); `src/components/PlayerBar.tsx:21` places the player bar at `fixed bottom-[70px] … z-50` (70 px). Both are `z-50`, so the order is whatever the DOM gives, and neither knows the other exists.
- **Severity:** `medium`. It can block the primary action of the screen, but only while playback is showing.
- **Decision needed:** `fix`. Offset the selection bar by the player bar's height when it is visible.
- **Raised by:** [importing from your Spotify library](add/importing-from-your-spotify-library.md#open-questions-and-verification), [importing from a playlist](add/importing-from-a-playlist.md#open-questions-and-verification), [the player bar](player/the-player-bar.md#interactions-with-other-systems)

### B-30: A modal covers the player bar, so playback cannot be paused

- **Where the user meets it:** Starting playback from an album panel on the listening log, or opening the crate editor while music is playing. The player bar disappears behind the modal.
- **What happens / what was expected:** The controls for the music that is playing are unreachable until the modal is closed — including from the very panel that started it. What was expected is that the player bar stays on top, since it is the only way to pause.
- **Reproduce:** With music playing, open an album panel from `/history`, then the crate editor from `/`, and look for the bar (`BAR-05`).
- **Why (from the code):** `src/pages/History.tsx:234` and `src/components/CrateEditorModal.tsx:179` render at `z-[60]`; `src/components/PlayerBar.tsx:21` is `z-50`. `src/App.tsx` renders `<PlayerBar />` outside the routes, so it is always present and always beneath them.
- **Severity:** `medium`. Recoverable by closing the modal, but the user has to work out that that is what is needed.
- **Decision needed:** `fix`. Raise the player bar above the modals, or give the modals a bottom inset.
- **Raised by:** [the player bar](player/the-player-bar.md#cancel-and-interrupt), [the crate editor](crates/the-crate-editor.md#open-questions-and-verification), [the listening log](history/the-listening-log.md#interactions-with-other-systems)

### B-31: The player bar's counter keeps running when playback has stopped

- **Where the user meets it:** Two ways. The connection drops mid-track: the music stops and the counter carries on advancing over silence, with the bar showing the same track as though nothing happened. Or a second Crate tab takes over playback: the first tab's bar freezes on the old track and keeps counting.
- **What happens / what was expected:** The bar is confidently wrong about what is playing and how far in. It is the most misleading single thing a failure produces. What was expected is that the bar stops when the music does, or says it has lost track.
- **Reproduce:** With music playing in the tab, **turn the wifi off at the machine** — devtools throttling does not reach the SDK's own connection — and watch the counter (`BAR-14`). For the second tab, play in tab B and watch tab A's bar (`BAR-11`).
- **Why (from the code):** `src/hooks/usePlayer.tsx:155-158` advances the displayed position on an interval from a `performance.now()` baseline, and the baseline is only corrected when the SDK reports a state change (`:104-107`). A dropped connection and a device takeover both stop the events, so the arithmetic keeps running with nothing to correct it. Nothing watches the connection.
- **Severity:** `medium`. Nothing is lost, but the bar is the product's only playback truth and it lies for as long as the tab is open.
- **Decision needed:** `fix`. Stop the interval when the SDK reports nothing, and treat a long silence as a lost connection rather than as continued playback.
- **Raised by:** [the player bar](player/the-player-bar.md#cancel-and-interrupt), [failed requests and offline](cross-cutting/failed-requests-and-offline.md#modifiers), [stale data and second tabs](cross-cutting/stale-data-and-second-tabs.md#interactions-with-other-systems), [playback](foundations/playback.md#open-questions-and-verification)

### B-32: Nothing tells a user the library ends at five hundred playlist tracks or fifty album tracks

- **Where the user meets it:** Opening a playlist with more than five hundred tracks on the PLAYLISTS tab, or opening a box set's panel.
- **What happens / what was expected:** The playlist shows the albums from its first five hundred tracks and presents that as the playlist; the panel shows the album's first fifty tracks and presents that as the album. Neither says anything was cut. What was expected is a note, or the whole thing.
- **Reproduce:** Open a playlist of more than five hundred tracks and compare the album count with Spotify's own. Open an album of more than fifty tracks and count the rows.
- **Why (from the code):** `lib/spotify.ts:194` sets `MAX_PLAYLIST_TRACKS = 500` and `:205` loops while under it. The album-details request asks for fifty tracks and does not page. `api/spotify/[[...path]].ts:45` and `:73` also cap page sizes at fifty, which is Spotify's own ceiling rather than a product decision.
- **Severity:** `medium`. Silent truncation of the user's own data at import time is worse than it looks, because the missing albums never enter the library and nothing will ever mention them again.
- **Decision needed:** `product call`. Paging past the caps costs request time on a serverless function with a timeout; saying "showing the first 500 of 1,240 tracks" costs nothing and is the minimum. Doing neither means the import is quietly partial.
- **Raised by:** [importing from a playlist](add/importing-from-a-playlist.md#open-questions-and-verification), [Spotify dependence](cross-cutting/spotify-dependence.md#open-questions-and-verification), [the album detail panel](library/the-album-detail-panel.md#open-questions-and-verification)

## Low

### B-33: The connect prompt's READ-ONLY ACCESS line is inaccurate

- **Where the user meets it:** The prompt an email-only account sees before pressing CONNECT SPOTIFY.
- **What happens / what was expected:** It promises read-only access. The sign-in actually requests playback control and streaming as well, and Spotify's own consent screen will list them, so the product's reassurance is contradicted by the next screen. What was expected is a description of what is asked for.
- **Reproduce:** Read the prompt on `/add` → LIBRARY on an email-only account, then start the Spotify sign-in and read Spotify's consent screen (`SPOT-03`).
- **Why (from the code):** `src/hooks/useAuth.ts:81-82` requests `user-library-read playlist-read-private playlist-read-collaborative user-modify-playback-state user-read-playback-state streaming`. The last three are not read-only.
- **Severity:** `low`. A copy error, but about permissions, which is where a copy error costs trust.
- **Decision needed:** `fix`. Say what is asked for: read your library and playlists, and control playback.
- **Raised by:** [Spotify dependence](cross-cutting/spotify-dependence.md#modifiers), [importing from your Spotify library](add/importing-from-your-spotify-library.md#modifiers), [account and session](foundations/account-and-session.md#modifiers)

### B-34: The profile menu is misplaced on the library screen

- **Where the user meets it:** Opening the profile menu from the library's header.
- **What happens / what was expected:** It is positioned for the crate wall's header height and hangs at the wrong offset here. What was expected is the same placement relative to the button on both screens.
- **Reproduce:** Open the profile menu on `/library`, then on `/`, and compare (`SHELF-15`).
- **Why (from the code):** `src/components/library/ProfileDropdown.tsx:21` positions itself at a hard-coded `absolute top-[52px] right-3 z-30` rather than relative to the button that opened it.
- **Severity:** `low`. Cosmetic. Whether it is noticeable at the library's header height is a visual judgement not yet made.
- **Decision needed:** `fix`. Position it against its trigger.
- **Raised by:** [the library shelf](library/the-library-shelf.md#edge-cases)

### B-35: NO RECORDS FOUND is shown before any search has happened

- **Where the user meets it:** Arriving on the search tab. The idle screen, with an empty box and nothing typed, states that no records were found. It says the same thing after a search that failed.
- **What happens / what was expected:** The screen asserts a negative result it does not have. What was expected is an invitation to search.
- **Reproduce:** Open `/add` and read the results area before typing (`SEARCH-04`).
- **Why (from the code):** `src/pages/AddAlbums.tsx:147-148` shows the message whenever `!searching && query && results.length === 0`, and the results array is also empty before any request and after a failed one.
- **Severity:** `low`. A copy slip, though it does make a failure look like an answer.
- **Decision needed:** `fix`. Show it only after a search that completed and returned nothing.
- **Raised by:** [search and add](add/search-and-add.md#open-questions-and-verification), [failed requests and offline](cross-cutting/failed-requests-and-offline.md#edge-cases)

### B-36: Four components are in the source tree and unreachable

- **Where the user meets it:** Nowhere. `NowPlayingModal.tsx`, `ContextAlbumsModal.tsx`, `ModeSection.tsx`, and `AlbumCard.tsx` are in `src/components/` and nothing imports any of them.
- **What happens / what was expected:** No user can reach them. They describe a version of the product that no longer exists — a now-playing modal, a context-albums modal, the old mode sections and card layout — and they are the reason [the README](README.md#scope-decisions) records that unreachable components are not described.
- **Reproduce:** Search the source for each component name; each appears only in its own file.
- **Why (from the code):** Leftovers from the pre-crate design. No route, page, or component references them.
- **Severity:** `low`. Invisible to users; a cost only to whoever reads the code next, who will reasonably assume they are live.
- **Decision needed:** `product call`. Delete them, or keep them and say in a comment what they are for. Leaving them unmarked is the only option that misleads.
- **Raised by:** [the README's scope decisions](README.md#scope-decisions)

### B-37: Small copy and rendering slips

Individually trivial, listed together so none is lost.

- **The playlist tab's green success line does not say which list the records went to.** The LIBRARY tab's line does. `src/pages/AddAlbums.tsx:354` versus `:271`. (`PLIST-02`) `fix`.
- **A failed playlist load shows the error and NO ALBUMS IN THIS PLAYLIST at the same time.** Two contradictory statements in one place. (`PLIST-05`) `fix`.
- **The server sends a retry-after hint on a rate-limited Spotify request and the client discards it.** `lib/spotify.ts:97-100` computes the wait and `api/spotify/[[...path]].ts:53`, `:81`, `:104` send it as `retryAfter`; nothing in `src/` reads it. The one place it could surface is the import tabs, which show the raw error text. `fix`.
- **A blank name saves as "Untitled Crate" while the field's placeholder promises "My Crate".** `src/components/CrateEditorModal.tsx:151-165`. (`EDIT-02`) `fix`.
- **DELETE CRATE stays armed indefinitely.** Every other confirm in the product disarms itself; this one waits until the modal closes. `fix`.
- **An unknown URL renders a blank page.** There is no catch-all route in `src/App.tsx:29-46`, so a typo or a stale link gives the user nothing at all — no message, no navigation. Read from the router and not yet confirmed by hand. `fix`.
- **The project's own `CLAUDE.md` says `npm run dev` runs `vercel dev`.** It runs bare `vite` (`package.json:6`), which serves the client with no API routes, so anyone following the instructions gets a signed-out app that cannot load anything. Not user-facing, but it is the first thing a new contributor does. `fix`.

## Open questions and verification

- No entry here has been confirmed in the running product. The `verification/` checklists carry the item IDs cited above; each entry gains a **Status** line when a pass touches it, and an entry that turns out to be a documentation error will say so rather than being deleted.
- The unconfirmed items that stayed in the documents' own open questions are deliberately not here. They are questions the code could not answer — timings, what a browser does, what Spotify returns — rather than behaviors that look wrong.
- `B-13` is the one entry whose severity depends on an observation nobody has made. If a phone does complete the pick request, it drops to `low`.
- The merge ratio is worth revisiting after a verification pass: 54 checklist rows became 37 entries, which is a thinner collapse than expected, because Crate's defects are mostly independent rather than symptoms of a few missing handlers. The exceptions are the four families named in the summary.

Verified against Crate commit `8301127`.
