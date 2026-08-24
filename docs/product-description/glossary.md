# Glossary

The vocabulary used across these documents. When a document uses one of these words, it means exactly this.

## The app

**Crate.** The product. A web app, mobile-first, dark, styled after a physical record crate: albums are drawn as *spines* standing in *rows*, and the visual metaphor is load-bearing enough that the UI's own words ("records", "crates", "shelves", "filed") are used in these documents in preference to database words ("items", "rows", "inserted").

**Screen.** One of the five routes the app can be at: the *crate wall* (`/`), the *library* (`/library`), the *add screen* (`/add`), the *listening log* (`/history`), and `/callback`, which renders the crate wall and exists only to catch the return from Spotify sign-in. There is no separate settings screen; every setting a user can change lives inside a *crate*.

**Panel.** A block that expands in place, in the flow of the page, pushing content below it down. The *album detail panel* and the two *audit panels* are panels. A panel does not dim the page behind it and does not trap scrolling.

**Modal.** An overlay that dims the page behind it, locks the page's scrolling, and closes when the dimmed area (the *backdrop*) is tapped. The *crate editor* is a modal; so is the album detail panel when it is opened from the listening log.

**Row.** One horizontal band of spines. On the crate wall a row holds up to four spines and is one *crate*; in the library a row holds up to fourteen and is just a slice of the shelf. Rows measure themselves: when a row is at least 600 px wide it draws taller spines, and when its spines would not fill the width it stretches them to fit.

## Records

**Record.** One album in the user's collection. The UI calls it a record; the database calls it an item. A record has a title, an artist, sleeve art, a Spotify id, the moment it was *filed*, and *metadata*. Every record is in exactly one of the two *lists*.

**The library.** All of the user's records, both lists together. "In the library" means the user has filed it; an album that only exists in Spotify search results is not in the library. The library is what the *library screen* shows and what every *library-source crate* draws from.

**Favorite.** A record in the first of the two lists — something the user already loves and wants to be reminded of. Marked with a star (★) and the app's orange. Nothing about a favorite makes it more likely to be picked except that the seeded Favorites crate only draws from favorites.

**Recommendation.** A record in the second list — something the user has been told to listen to but has not committed to. Marked with a diamond (◈) and cyan. A recommendation can be *promoted* to a favorite, which is a one-way move made from the album detail panel; there is no button anywhere that turns a favorite back into a recommendation, although the underlying route accepts one.

**Spotify id.** The album's id on Spotify. It is what identifies a record for the purpose of "is this already in the library" — the add screens compare by Spotify id, and the database refuses two records with the same Spotify id for the same user. It is not the same as the record's own id, which is a number the database assigns and which the *detail panel*, *picks*, and *duplicate marking* all use.

**Metadata.** A bag of extra facts about a record, filled in from Spotify when the record is filed: `genres` (taken from the album's artists, not the album), `release_date`, and `total_tracks`. Metadata is best-effort — if Spotify does not answer when a record is filed, the record is still filed, without it. Missing release dates and track counts can be filled in later by the *backfill*. Genres cannot: nothing backfills them, so a record filed in bulk by an import — which never asks Spotify about the artists — has no genres for as long as it exists.

**Genre.** A string from Spotify's artist genres, like `indie pop` or `classic rock`. Genres are the only thing filter rules can match against besides year, artist, list, plays, and last played, and they are the reason the nine seeded *context crates* have any contents at all. A record whose metadata never arrived has no genres and therefore falls out of every genre-filtered crate silently.

**Release year.** The first four characters of `release_date`, read as a number. A record with no release date has no year and is excluded by every year rule, including a rule as loose as "after 1000".

**Track.** One song on an album. Tracks are fetched from Spotify when the album detail panel opens and are not stored. Tapping a track plays the album from that track onward — except on a phone or tablet, where the hand-off to the Spotify app can only carry the album and it starts from the beginning.

## Crates

**Crate.** A named, saved rule for choosing a few records to put in front of the user, plus the row on the crate wall that shows the result. A crate is not a folder: records are not put into it, they are drawn into it each time the wall loads. Two crates can show the same record at once, and a crate can come up empty.

**Crate definition.** Everything a crate is made of: its name, its *source*, its *strategy*, its *filter rules*, its *count*, and its *position*. Definitions are saved together as one setting on the user's account, so saving any change to one crate writes all of them.

**Source.** Where a crate draws from: `library` (the user's own records) or `friends` (albums other users have sent). Friends-source crates are [out of scope](README.md#scope-decisions).

**Strategy.** How a crate picks from its *pool*. There are five: **weighted** (the *selection engine*, honoring cooldown and recency), **random** (an even draw), **pool with AI** (`ai_pool` — Claude picks from the user's own filtered records, given a prompt), **new with AI** (`ai_new` — Claude suggests albums that are *not* in the library), and **hybrid** (a third of the count from `ai_new`, the rest from the weighted engine). Weighted is what every seeded crate except Surprise Me and From Friends uses.

**Filter rules and match mode.** Zero or more conditions on a record — year, genre, artist, list, plays, last played — combined with either AND or OR. An empty rule set matches every record. A rule with a blank value is ignored rather than matching nothing, so a half-typed rule does not empty the crate. [The selection engine](foundations/selection-engine.md) owns the operators and their exact meanings.

**Pool.** The records a crate could show: its source's records, narrowed by its filter rules. The pool is computed fresh on every load. A crate whose pool is empty shows an empty row; a crate whose pool is smaller than its *count* shows the whole pool.

**Count.** How many records a crate puts on its row, from 1 to 7. A crate created by hand starts at 4. The thirteen crates Crate seeds for a new account start at 2, because they inherit it from a setting whose default is 2.

**Position.** A crate's place on the wall, top to bottom, numbered from 0. Positions are renumbered whenever a crate is moved or deleted, and are what the wall sorts by.

**Slow crate.** A crate whose strategy has to ask Claude: `ai_new` and `hybrid` always, and `ai_pool` only when its prompt is not blank. Slow crates are left out of the first load of the crate wall and fetched afterwards, one request each and all at once, so the rest of the wall does not wait for them. See [AI crates](crates/ai-crates.md).

**Suggestion.** A record on the wall that is not in the library — something Claude proposed. A suggestion looks like a record but has a negative id, a cyan bar along the bottom of its spine, and no *pick* recorded when it is chosen. Suggestions cannot be favorited, removed, or promoted, and vanish on the next load.

## Selection and picks

**Pick.** A durable record that the user chose an album at a moment in time, saved with the crate that produced it. Picks are what the *listening log* lists and what the *selection engine* reads to decide what is overexposed. One pick is written each time the user chooses a real record from the crate wall — including when the playback that was attempted alongside it fails.

**Play count.** How many picks a record has. Shown as `×3` under the word PLAYS in the *album detail panel*, and as a small label on a spine when the library is sorted by PLAYS. A record with no picks shows `—` in the panel and no label at all in the library. It counts choices made in Crate, not listens; playing an album in the Spotify app does not raise it.

**Last played.** The most recent pick's time. The *album detail panel* shows it under the words LAST PLAYED as Today, Yesterday, `3d ago`, `2w ago`, or `5mo ago`, coloured green when it is within the last seven days. A record with no picks reads `—` — not "never". The library shows a shorter form (`0d`, `3d`, `2w`, `5mo`) on the spine when it is sorted by RECENT, and nothing at all for a record with no picks.

**Cooldown.** The number of days after a pick during which a record is ineligible for a weighted crate — its weight is zero, so it cannot be drawn at all. Three days by default. Cooldown does not affect random, AI, or hybrid-AI draws, so a record can reappear the day after it was picked from a crate with a different strategy.

**Weight.** A number the weighted engine gives each eligible record, larger for records the user has not heard in a while and for records never picked at all. [The selection engine](foundations/selection-engine.md) owns every weight number in the product; no other document restates them.

**Eligible.** A record in the pool whose weight is above zero. A record inside its cooldown is in the pool but not eligible.

## The interaction

**Arrive.** The first phase: the user reaches a screen, opens a panel, or opens a modal. What is loaded, what is focused, what is prefilled, and what is remembered from a previous visit is all decided here.

**Leave untouched.** The second phase: the user leaves without changing anything — navigates away, closes the panel, taps the backdrop. Nothing is written. Saying so is a claim a tester can check, and in a handful of places in Crate it is not true.

**First change.** The third phase: the first act that makes the screen *dirty* — a character typed into search, a slider moved, a rule added, a spine selected. What that instant fixes for the rest of the interaction (which record is in hand, which crate is being edited, what the original values were) is decided here.

**While working.** The fourth phase: what updates as the user keeps going, what is recomputed from scratch versus accumulated, what is disabled meanwhile, and what happens live without asking (a debounced search firing, a filter re-running on every keystroke).

**Commit.** The fifth phase: what is written and where the user lands. In Crate a commit is almost always one HTTP request; the document says what is written, whether the screen waits for the answer, what it shows if the answer never comes, and whether the change can be undone.

**Dirty.** A screen or panel is dirty from its *first change* until it commits or is discarded. Crate has no unsaved-changes warning anywhere: leaving a dirty crate editor, a dirty filter set, or a half-typed search discards it silently and without asking.

**Optimistic.** A change that is shown as done before the server has confirmed it. Removing a record, promoting a record, and favoriting a record from a spine are all optimistic and none of them has a visible failure path: if the request fails, the screen keeps showing the change until the next full load undoes it.

## Input

**Tap.** A single click or touch. These documents say "tap" for both, because every interactive element in Crate responds to a plain click and nothing depends on touch versus mouse — except *hover*, which touch devices cannot produce.

**Hover.** The pointer resting on an element. Hovering a spine lifts it and widens it enough to show the sleeve art, and reveals the star button that files it as a favorite. On a touch device there is no hover, so the star button on a spine cannot be reached at all.

**Two-click confirm.** A destructive button that arms on the first tap and acts on the second. The detail panel's remove button arms for two seconds and disarms itself; the crate editor's delete button arms and stays armed until the modal closes. A third pattern — the browser's own `confirm()` dialog — is used when deleting marked duplicates.

**Debounce.** Waiting for the user to stop typing before acting. The album search waits 400 ms after the last keystroke. Nothing else in Crate debounces: filter rules, sorting, and the genre picker's own filter box all re-run on every keystroke against data already in the browser.

**Slider stop.** The crate editor's four sliders do not take arbitrary values. Each has five stops, and dragging snaps to the nearest one. [The selection engine](foundations/selection-engine.md#what-the-editor-can-set-and-what-it-cannot) lists the stops and their labels; [the crate editor](crates/the-crate-editor.md) describes using them.

## Events that end or interrupt

**Dismiss.** Closing something without deciding anything: tapping Close, tapping the backdrop, or tapping the same spine again. A dismiss discards nothing that was not already discarded, because in Crate everything a panel can change is committed the instant it is changed rather than at the end.

**Commit.** Writing the change. Named as a phase above; used as an event here for the moment the request is sent.

**Interrupt.** Anything that ends an interaction without the user deciding to: the network dropping, the session expiring, a reload, the tab closing, Spotify handing playback to another device. Every document answers the same nine interrupt questions in the same order, listed in the [document template](README.md#document-template).

**Silent failure.** A request that fails with nothing shown to the user — the skeleton clears, the section renders as if it were empty, and the reason appears only in the browser's console. This is the default failure mode for every load in Crate and for most writes. It is described once in [failed requests and offline](cross-cutting/failed-requests-and-offline.md) and referred to from there.

## The session

**Session.** One signed-in visit in one browser tab, from sign-in to sign-out, reload, or tab close. Reloading the page ends the session and starts a new one; the sign-in itself survives, because Supabase keeps it in local storage.

**The session cache.** The store that holds what has been loaded this session: the crate wall's crates, the library's records, the listening log's entries, the crate definitions, and the per-record play counts. Each of the three screens loads once per session and then never again on its own. Nothing expires and nothing polls. Only an explicit action refreshes anything, and the actions that do are listed in [navigation and loading](foundations/navigation-and-loading.md).

**Loaded.** A screen is loaded once its first fetch has *succeeded*. A fetch that fails leaves the screen not loaded: its skeleton clears and it renders as though the account were empty, and nothing retries for as long as the user stays on it — but the next time that screen is opened, it tries again from scratch. Navigating away and back is therefore a retry, and the only one the product offers besides reloading.

**Session flag.** A one-shot marker in the browser's session storage. There is exactly one: `crate_backfill_done`, which stops the library from asking the server to fill in missing release dates and track counts more than once per session.

## Account and Spotify

**Signed in.** Authenticated to Crate. Two ways in: email and password, or Spotify. Either way a user can use the library, the crate wall, the listening log, and filter rules.

**Linked to Spotify.** Signed in *and* holding Spotify tokens on the account. Anything that acts *as the user* on Spotify needs this: importing from the Spotify library or a playlist, and playing anything. Anything that only reads Spotify's public catalogue does not, because the server asks with Crate's own application credentials instead — the album search, and an album's tracks, genres, and other albums by the same artist all work for any signed-in user. A user who signed up with email and password is signed in but not linked, and the add screen tells them so and offers a Spotify sign-in.

**Premium.** A paid Spotify subscription, required by Spotify for the *web player*. Without it the in-app player refuses to start and Crate falls back to handing playback to whatever Spotify app the user already has open.

**The access token.** The short-lived Spotify credential Crate holds on the user's behalf. It is refreshed by the server, invisibly, whenever it is within a minute of expiring or whenever Spotify rejects it once. The user never sees a "reconnect Spotify" prompt; if the refresh cannot succeed, individual Spotify-dependent features fail one at a time instead.

**The web player.** Crate's own Spotify player, registered with Spotify under the device name "Crate Web Player". It only exists on desktop-width browsers with a Premium account; where it exists, the *player bar* appears and playback happens in the tab.

**Device.** Somewhere Spotify can play. Crate's web player is one; the user's phone or desktop Spotify app is another. Playback started by Crate goes to the web player when it is ready and to whatever device Spotify considers active otherwise — and if Spotify considers none active, the attempt fails with a message saying to open Spotify first, which [is never shown to the user](foundations/playback.md).

## The interface

**Spine.** A record drawn edge-on: a narrow vertical block, 46 px wide, 170 px tall (212 px in a wide row), tinted a colour derived from the record's id so the same record is always the same colour. Selected spines lift 24 px; hovered spines lift 7 px and widen. A recommendation carries a ◈ badge; a *suggestion* carries a cyan bar along the bottom.

**Sleeve.** The album's cover art. Shown inside a spine when it is wide enough, in the detail panel, in the listening log, and in the add screens' result rows. When there is no art, a drawn vinyl disc stands in.

**The player bar.** A fixed bar just above the bottom navigation, present only when the web player is available *and* something is playing. It holds the sleeve, the track and artist, a seek bar, previous/play/next, and — on wide viewports only — a volume slider.

**The bottom navigation.** A fixed two-item bar: CRATES and LIBRARY. The add screen and the listening log are not in it; they are reached from a button on the library screen and from the profile menu respectively, or by typing the URL.

**Toast.** A short-lived message. There is one in the product: the add screen's confirmation after a bulk import, which reads `FILED n RECORDS → …` and clears itself after three seconds.

**Skeleton.** Grey pulsing blocks in the shape of the content that is loading. Every screen shows skeletons on its first load and never again for the rest of the session, because the *session cache* holds the result.

**Empty state.** What a screen shows when it has nothing: a drawn vinyl disc, a large word (EMPTY, NO RECORDS FOUND), and a line of instruction. Empty states and *silent failures* look identical, which is why a failed load is indistinguishable from an empty library.

## Units

**Seconds versus milliseconds.** Everything durable is in whole seconds since the epoch: when a record was filed, when a pick happened, when a Spotify token expires. Everything about playback is in milliseconds: track length, the position in a track, the seek step. Days are computed from seconds and truncated, so "3 days ago" means at least 72 hours ago.

**Days since.** The number of days between a past moment and now. Every *decision* uses it fractionally, to the second: the *cooldown* boundary, the recency tiers, and the `plays` and `last played` filter rules all compare a fractional number of days, so "3 days" means exactly 72 hours. Every *display* floors it, so the library and the detail panel say "3d ago" for anything between three and four days. Both are computed by subtracting and dividing rather than by calendar date, so time zones never enter into it.

**Viewport width.** Two thresholds matter and they are not the same. The player hook decides a browser is mobile — and refuses to build the web player — from the user agent, not the width. The layout switches to wide spines when a *row* measures at least 600 px, and shows the volume slider at Tailwind's `sm` breakpoint (640 px). A narrow desktop window therefore gets the web player but the mobile layout.
