import React, { useState, useEffect, useRef } from "react";
import { VinylDisc } from "../VinylDisc";
import { getAlbumDetails, deleteAlbum, addAlbum, promoteAlbum, sendRecommendation, getRecentRecipients } from "../../services/api";
import type { Item, AlbumTrack, ArtistAlbum, SentRecommendation, PlaylistInfo } from "../../types";
import { usePlayer } from "../../hooks/usePlayer";
import { mediaTypeOf, spotifyUriOf } from "../../lib/media";

interface DetailPanelProps {
  item: Item;
  pickCount: number;
  lastPickedTs: number | null;
  onClose: () => void;
  onRemove: (item: Item) => void;
  onPlay?: () => void;
  // Where plays from this panel start (a crate id, "library", ...); the server
  // records it as the pick's mode.
  playSource?: string;
  onPromote?: (item: Item) => void;
  // Fired with the freshly created library row after an "add to library" —
  // lets a caller holding a not-yet-saved item swap in the real one.
  onAdd?: (item: Item) => void;
  // When true, hide library-mutating actions (remove / favorite / send).
  // Used when opened from a read-only context like the History log.
  readOnly?: boolean;
}

function formatLastPlayed(ts: number | null): string {
  if (!ts) return "—";
  const days = Math.floor((Date.now() / 1000 - ts) / (60 * 60 * 24));
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function formatDuration(ms: number): string {
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

function daysAgo(ts: number | null): number {
  if (!ts) return Infinity;
  return Math.floor((Date.now() / 1000 - ts) / (60 * 60 * 24));
}

interface CachedDetails {
  genres: string[];
  artistAlbums: ArtistAlbum[];
  tracks: AlbumTrack[];
  sentTo: SentRecommendation[];
  playlist: PlaylistInfo | null;
}

const detailsCache = new Map<string, CachedDetails>();

export function DetailPanel({ item, pickCount, lastPickedTs, onClose, onRemove, onPlay, playSource, onPromote, onAdd, readOnly = false }: DetailPanelProps) {
  const player = usePlayer();
  const mediaType = mediaTypeOf(item);
  const isPlaylistItem = mediaType === "playlist";
  const cached = detailsCache.get(item.external_id);
  const [genres, setGenres] = useState<string[]>(cached?.genres || []);
  const [artistAlbums, setArtistAlbums] = useState<ArtistAlbum[]>(cached?.artistAlbums || []);
  const [tracks, setTracks] = useState<AlbumTrack[]>(cached?.tracks || []);
  const [sentTo, setSentTo] = useState<SentRecommendation[]>(cached?.sentTo || []);
  const [playlistInfo, setPlaylistInfo] = useState<PlaylistInfo | null>(cached?.playlist ?? null);
  const [loadingDetails, setLoadingDetails] = useState(!cached);
  const [addingAlbums, setAddingAlbums] = useState<Set<string>>(new Set());
  const [addedAlbums, setAddedAlbums] = useState<Map<string, "favorite" | "recommendation">>(() => {
    const initial = new Map<string, "favorite" | "recommendation">();
    if (cached?.artistAlbums) {
      for (const a of cached.artistAlbums) {
        if (a.already_added) initial.set(a.spotify_id, a.already_added);
      }
    }
    return initial;
  });
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const [removing, setRemoving] = useState(false);
  const removeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [promoting, setPromoting] = useState(false);
  const [promoted, setPromoted] = useState(false);
  const [addingToList, setAddingToList] = useState<"favorite" | "recommendation" | null>(null);
  const [addedToList, setAddedToList] = useState<"favorite" | "recommendation" | null>(null);

  // Anything with a non-positive id isn't a library row: AI suggestions arrive
  // with id 0 (Crates.tsx reassigns them to negative synthetic ids to avoid key
  // collisions), and so does whatever is playing on Spotify but isn't saved yet.
  // Those get "add to library" buttons instead of the library-mutating ones.
  const inLibrary = item.id > 0;

  const parsedMeta = (() => {
    const m = item.metadata;
    if (!m) return null;
    if (typeof m === "object") return m as Record<string, unknown>;
    try { return JSON.parse(m) as Record<string, unknown>; } catch { return null; }
  })();
  const isFriendRec = parsedMeta?._friend_rec === true;
  const friendSenderName = isFriendRec ? (parsedMeta?._sender_name as string | null) : null;

  // An album already on the favorites list has nothing to promote to. Recommendations
  // — including friend recs, which arrive as list_type "recommendation" — keep the button.
  // Not every caller filters this (Crates passes onPromote for whatever is selected), so
  // the check lives here rather than at the call sites.
  const alreadyFavorite = item.list_type === "favorite";

  const [sendFormOpen, setSendFormOpen] = useState(false);
  const [sendEmail, setSendEmail] = useState("");
  const [sendStatus, setSendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [sendError, setSendError] = useState("");
  const [recentRecipients, setRecentRecipients] = useState<{ display_name: string | null; email: string | null }[]>([]);
  const [recipientsLoaded, setRecipientsLoaded] = useState(false);

  useEffect(() => {
    if (sendFormOpen && !recipientsLoaded) {
      getRecentRecipients()
        .then((data) => setRecentRecipients(data.recipients))
        .catch(() => {})
        .finally(() => setRecipientsLoaded(true));
    }
  }, [sendFormOpen, recipientsLoaded]);

  const handleSend = async () => {
    if (!sendEmail.trim()) return;
    setSendStatus("sending");
    setSendError("");
    try {
      await sendRecommendation({
        email: sendEmail.trim(),
        album: {
          title: item.title,
          creator: item.creator,
          image_url: item.image_url,
          external_id: item.external_id,
          external_uri: item.external_uri,
          external_url: item.external_url,
        },
      });
      detailsCache.delete(item.external_id);
      const refreshed = await getAlbumDetails(item.external_id);
      setSentTo(refreshed.sent_to ?? []);
      detailsCache.set(item.external_id, { genres: refreshed.genres, artistAlbums: refreshed.artist_albums, tracks: refreshed.tracks, sentTo: refreshed.sent_to ?? [], playlist: null });
      setSendStatus("sent");
      setTimeout(() => {
        setSendFormOpen(false);
        setSendStatus("idle");
        setSendEmail("");
      }, 1500);
    } catch (err: unknown) {
      setSendStatus("error");
      const msg = err instanceof Error ? err.message : "Failed to send";
      setSendError(msg.includes("404") ? "No user found with that email" : msg.includes("yourself") ? "Can't send to yourself" : "Failed to send");
    }
  };

  useEffect(() => {
    if (detailsCache.has(item.external_id)) {
      const c = detailsCache.get(item.external_id)!;
      setGenres(c.genres);
      setArtistAlbums(c.artistAlbums);
      setTracks(c.tracks);
      setSentTo(c.sentTo);
      setPlaylistInfo(c.playlist);
      setLoadingDetails(false);
      const initial = new Map<string, "favorite" | "recommendation">();
      for (const a of c.artistAlbums) {
        if (a.already_added) initial.set(a.spotify_id, a.already_added);
      }
      setAddedAlbums(initial);
      return;
    }
    let cancelled = false;
    setLoadingDetails(true);
    getAlbumDetails(item.external_id, mediaType)
      .then((data) => {
        if (cancelled) return;
        detailsCache.set(item.external_id, { genres: data.genres, artistAlbums: data.artist_albums, tracks: data.tracks, sentTo: data.sent_to ?? [], playlist: data.playlist ?? null });
        setGenres(data.genres);
        setArtistAlbums(data.artist_albums);
        setTracks(data.tracks);
        setSentTo(data.sent_to ?? []);
        setPlaylistInfo(data.playlist ?? null);
        const initial = new Map<string, "favorite" | "recommendation">();
        for (const a of data.artist_albums) {
          if (a.already_added) initial.set(a.spotify_id, a.already_added);
        }
        setAddedAlbums(initial);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingDetails(false); });
    return () => { cancelled = true; };
  }, [item.external_id, mediaType]);

  const handleAddAlbum = async (album: ArtistAlbum, listType: "favorite" | "recommendation") => {
    setAddingAlbums((prev) => new Set([...prev, album.spotify_id]));
    try {
      await addAlbum({
        spotify_id: album.spotify_id,
        title: album.title,
        artist: album.artist,
        image_url: album.image_url || undefined,
        spotify_uri: album.spotify_uri,
        spotify_url: album.spotify_url,
        list_type: listType,
      });
      setAddedAlbums((prev) => new Map(prev).set(album.spotify_id, listType));
    } catch {}
    setAddingAlbums((prev) => {
      const next = new Set(prev);
      next.delete(album.spotify_id);
      return next;
    });
  };

  useEffect(() => {
    return () => {
      if (removeTimerRef.current) clearTimeout(removeTimerRef.current);
    };
  }, []);

  const handleRemoveClick = async () => {
    if (isFriendRec) {
      onRemove(item);
      return;
    }
    if (!removeConfirm) {
      setRemoveConfirm(true);
      removeTimerRef.current = setTimeout(() => setRemoveConfirm(false), 2000);
    } else {
      if (removeTimerRef.current) clearTimeout(removeTimerRef.current);
      setRemoving(true);
      try {
        await deleteAlbum(item.id);
        onRemove(item);
      } catch {
        setRemoving(false);
        setRemoveConfirm(false);
      }
    }
  };

  const handlePromote = async () => {
    if (promoting || promoted) return;
    setPromoting(true);
    try {
      if (!isFriendRec) await promoteAlbum(item.id);
      setPromoted(true);
      onPromote?.(item);
    } catch {}
    setPromoting(false);
  };

  const handleAddToLibrary = async (targetList: "favorite" | "recommendation") => {
    setAddingToList(targetList);
    try {
      const { item: created } = await addAlbum({
        spotify_id: item.external_id,
        title: item.title,
        artist: item.creator,
        image_url: item.image_url || undefined,
        spotify_uri: item.external_uri ?? undefined,
        spotify_url: item.external_url ?? undefined,
        list_type: targetList,
        media_type: mediaType,
      });
      setAddedToList(targetList);
      onAdd?.(created);
    } catch {}
    setAddingToList(null);
  };

  const lastPlayedDays = daysAgo(lastPickedTs);
  const isRecent = lastPlayedDays <= 7;
  const multiDisc = tracks.some((t) => t.disc > 1);

  const contextUri = spotifyUriOf(item);

  const playingUri = player.currentTrack?.uri ?? null;

  // Album tracks play by list index. A playlist's track list skips entries
  // Spotify can't play, so its tracks carry their real playlist position.
  const handlePlayTrack = async (trackIndex: number) => {
    if (!contextUri) return;
    const offset = isPlaylistItem ? tracks[trackIndex].number - 1 : trackIndex;
    onPlay?.();
    await player.playAlbum(contextUri, offset, playSource);
  };

  return (
    <div
      className="animate-panel-open"
      style={{
        background: "rgb(var(--c-elevated))",
        borderTop: "2px solid rgb(var(--c-accent))",
        borderBottom: "1px solid rgb(var(--c-border))",
        padding: "13px 14px 14px",
      }}
    >
      {/* Header: art + info */}
      <div className="flex gap-3 mb-3">
        <div
          className="shrink-0 flex items-center justify-center"
          style={{
            width: 82,
            height: 82,
            background: item.image_url
              ? undefined
              : "linear-gradient(145deg, rgba(40,30,20,0.8) 0%, rgba(0,0,0,0.7) 100%)",
            boxShadow: "3px 5px 16px rgba(0,0,0,0.8), inset 0 0 0 1px rgb(var(--c-hi) / calc(0.05 * var(--tint-hi)))",
          }}
        >
          {item.image_url ? (
            <img src={item.image_url} alt={item.title} className="w-full h-full object-cover block" />
          ) : (
            <VinylDisc size={44} />
          )}
        </div>

        <div className="flex-1 overflow-hidden">
          <div
            className="font-display leading-none mb-0.5 truncate"
            style={{ fontSize: 22, color: "rgb(var(--c-text))", letterSpacing: "0.04em" }}
          >
            {item.title.toUpperCase()}
          </div>
          <div
            className="font-mono uppercase mb-1"
            style={{ fontSize: 10, color: "rgb(var(--c-muted))", letterSpacing: "0.1em" }}
          >
            {item.creator}
          </div>
          {isPlaylistItem && (
            <div className="font-mono mb-1" style={{ fontSize: 10, color: "rgb(var(--c-muted))", letterSpacing: "0.08em" }}>
              ≡ PLAYLIST{playlistInfo ? ` · ${playlistInfo.total_tracks} TRACKS` : ""}
            </div>
          )}
          {item.list_type === "recommendation" && !isFriendRec && (
            <div className="font-mono mb-1" style={{ fontSize: 10, color: "rgb(var(--c-rec))", letterSpacing: "0.08em" }}>
              ◈ RECOMMENDATION
            </div>
          )}
          {isFriendRec && friendSenderName && (
            <div className="font-mono mb-1" style={{ fontSize: 10, color: "rgb(var(--c-friend))", letterSpacing: "0.05em" }}>
              From {friendSenderName}
            </div>
          )}

          <div className="flex gap-1">
            <div
              className="flex-1"
              style={{ background: "rgb(var(--c-surface))", border: "1px solid rgb(var(--c-border))", padding: "4px 5px" }}
            >
              <div className="font-mono uppercase" style={{ fontSize: 10, color: "rgb(var(--c-muted))", letterSpacing: "0.1em", marginBottom: 1 }}>
                LAST PLAYED
              </div>
              <div className="font-mono" style={{ fontSize: 10, color: isRecent ? "rgb(var(--c-neon))" : "rgb(var(--c-text))", fontWeight: 500 }}>
                {formatLastPlayed(lastPickedTs)}
              </div>
            </div>
            <div
              className="flex-1"
              style={{ background: "rgb(var(--c-surface))", border: "1px solid rgb(var(--c-border))", padding: "4px 5px" }}
            >
              <div className="font-mono uppercase" style={{ fontSize: 10, color: "rgb(var(--c-muted))", letterSpacing: "0.1em", marginBottom: 1 }}>
                PLAYS
              </div>
              <div className="font-mono" style={{ fontSize: 10, color: "rgb(var(--c-accent))", fontWeight: 600 }}>
                {pickCount > 0 ? `×${pickCount}` : "—"}
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="shrink-0 self-start flex items-center justify-center cursor-pointer"
          style={{
            width: 22,
            height: 22,
            background: "transparent",
            border: "1px solid rgb(var(--c-border))",
            color: "rgb(var(--c-muted))",
            fontSize: 10,
          }}
        >
          ✕
        </button>
      </div>
      
      {/* Actions */}
      <div className="flex gap-1.5" style={{ marginBottom: 10 }}>
        <button
          onClick={async () => {
            if (!contextUri) return;
            onPlay?.();
            await player.playAlbum(contextUri, undefined, playSource);
          }}
          className="flex-1 flex items-center justify-center gap-1 text-center font-mono cursor-pointer"
          style={{
            fontSize: 10,
            padding: "6px 0",
            border: "1px solid rgb(var(--c-spotify) / calc(0.3 * var(--tint)))",
            color: "rgb(var(--c-spotify))",
            background: "rgb(var(--c-spotify) / calc(0.07 * var(--tint)))",
            letterSpacing: "0.1em",
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
          PLAY ON SPOTIFY
        </button>
        {!inLibrary ? (
          addedToList ? (
            <span
              className="font-mono flex items-center px-2"
              style={{ fontSize: 10, color: addedToList === "favorite" ? "rgb(var(--c-accent))" : "rgb(var(--c-rec))", border: "1px solid currentColor", background: addedToList === "favorite" ? "rgb(var(--c-accent) / calc(0.1 * var(--tint)))" : "rgb(var(--c-rec) / calc(0.1 * var(--tint)))" }}
            >
              {addedToList === "favorite" ? "★ ADDED" : "◈ ADDED"}
            </span>
          ) : (
            <>
              <button
                onClick={() => handleAddToLibrary("favorite")}
                disabled={addingToList !== null}
                className="font-mono cursor-pointer disabled:opacity-50"
                style={{ fontSize: 10, padding: "6px 10px", border: "1px solid rgb(var(--c-accent) / calc(0.5 * var(--tint)))", color: "rgb(var(--c-accent))", background: "rgb(var(--c-accent) / calc(0.1 * var(--tint)))", letterSpacing: "0.08em" }}
              >
                {addingToList === "favorite" ? "…" : "★ FAV"}
              </button>
              <button
                onClick={() => handleAddToLibrary("recommendation")}
                disabled={addingToList !== null}
                className="font-mono cursor-pointer disabled:opacity-50"
                style={{ fontSize: 10, padding: "6px 10px", border: "1px solid rgb(var(--c-rec) / calc(0.4 * var(--tint)))", color: "rgb(var(--c-rec))", background: "rgb(var(--c-rec) / calc(0.1 * var(--tint)))", letterSpacing: "0.08em" }}
              >
                {addingToList === "recommendation" ? "…" : "◈ REC"}
              </button>
            </>
          )
        ) : (
          <>
            {onPromote && (!alreadyFavorite || promoted) && (
              <button
                onClick={handlePromote}
                disabled={promoting || promoted}
                className="font-mono cursor-pointer disabled:opacity-60"
                style={{
                  fontSize: 10,
                  padding: "6px 10px",
                  border: promoted ? "1px solid rgb(var(--c-accent) / calc(0.6 * var(--tint)))" : "1px solid rgb(var(--c-accent) / calc(0.35 * var(--tint)))",
                  color: "rgb(var(--c-accent))",
                  background: promoted ? "rgb(var(--c-accent) / calc(0.15 * var(--tint)))" : "transparent",
                  letterSpacing: "0.08em",
                }}
                title="Move to favorites"
              >
                {promoting ? "★ …" : promoted ? "★ FAVED" : isFriendRec ? "★ ADD TO FAVORITES" : "★ FAVORITE"}
              </button>
            )}
            {!promoted && !readOnly && (
              <button
                onClick={handleRemoveClick}
                disabled={removing}
                className="font-mono cursor-pointer disabled:opacity-60"
                style={{
                  fontSize: 10,
                  padding: "6px 10px",
                  border: removeConfirm ? "1px solid rgb(var(--c-danger) / calc(0.5 * var(--tint)))" : "1px solid rgb(var(--c-danger-deep) / calc(0.35 * var(--tint)))",
                  color: "rgb(var(--c-danger))",
                  background: removeConfirm ? "rgb(var(--c-danger-deep) / calc(0.15 * var(--tint)))" : "transparent",
                }}
              >
                {removing ? "…" : isFriendRec ? "DISMISS" : removeConfirm ? "REMOVE?" : "REMOVE"}
              </button>
            )}
          </>
        )}
      </div>
      {/* Send to Friend — friend recommendations only carry albums. */}
      {!isFriendRec && inLibrary && !readOnly && !isPlaylistItem && (
        <div style={{ marginBottom: 10 }}>
          {!sendFormOpen ? (
            <button
              onClick={() => setSendFormOpen(true)}
              className="font-mono cursor-pointer w-full"
              style={{
                fontSize: 10,
                padding: "5px 0",
                border: "1px solid rgb(var(--c-friend) / calc(0.35 * var(--tint)))",
                color: "rgb(var(--c-friend))",
                background: "transparent",
                letterSpacing: "0.1em",
              }}
            >
              SEND TO FRIEND
            </button>
          ) : (
            <div style={{ border: "1px solid rgb(var(--c-friend) / calc(0.35 * var(--tint)))", padding: "8px" }}>
              {recentRecipients.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {recentRecipients.map((r) => (
                    <button
                      key={r.email}
                      onClick={() => setSendEmail(r.email || "")}
                      className="font-mono cursor-pointer"
                      style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        border: sendEmail === r.email ? "1px solid rgb(var(--c-friend) / calc(0.7 * var(--tint)))" : "1px solid rgb(var(--c-border))",
                        color: sendEmail === r.email ? "rgb(var(--c-friend))" : "rgb(var(--c-text))",
                        background: sendEmail === r.email ? "rgb(var(--c-friend) / calc(0.1 * var(--tint)))" : "transparent",
                      }}
                    >
                      {r.display_name || r.email}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-1.5">
                <input
                  type="email"
                  value={sendEmail}
                  onChange={(e) => { setSendEmail(e.target.value); if (sendStatus === "error") setSendStatus("idle"); }}
                  placeholder="friend@email.com"
                  className="flex-1 bg-transparent outline-none font-mono"
                  style={{ fontSize: 10, color: "rgb(var(--c-text))", border: "1px solid rgb(var(--c-border))", padding: "4px 6px" }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
                  disabled={sendStatus === "sending" || sendStatus === "sent"}
                />
                <button
                  onClick={handleSend}
                  disabled={sendStatus === "sending" || sendStatus === "sent" || !sendEmail.trim()}
                  className="font-mono cursor-pointer disabled:opacity-50"
                  style={{ fontSize: 10, padding: "4px 8px", border: "1px solid rgb(var(--c-friend) / calc(0.5 * var(--tint)))", color: "rgb(var(--c-friend))", background: "rgb(var(--c-friend) / calc(0.1 * var(--tint)))", letterSpacing: "0.08em" }}
                >
                  {sendStatus === "sending" ? "…" : sendStatus === "sent" ? "SENT!" : "SEND"}
                </button>
                <button
                  onClick={() => { setSendFormOpen(false); setSendEmail(""); setSendStatus("idle"); setSendError(""); }}
                  className="font-mono cursor-pointer"
                  style={{ fontSize: 10, padding: "4px 6px", border: "1px solid rgb(var(--c-border))", color: "rgb(var(--c-muted))", background: "transparent" }}
                >
                  ✕
                </button>
              </div>
              {sendStatus === "error" && sendError && (
                <div className="font-mono mt-1" style={{ fontSize: 10, color: "rgb(var(--c-danger))" }}>
                  {sendError}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sent to */}
      {!isFriendRec && inLibrary && sentTo.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div className="font-mono uppercase" style={{ fontSize: 10, color: "rgb(var(--c-muted))", letterSpacing: "0.1em", marginBottom: 4 }}>
            SENT TO
          </div>
          <div className="flex flex-wrap gap-1">
            {sentTo.map((s, i) => (
              <span
                key={i}
                className="font-mono"
                style={{ fontSize: 10, padding: "2px 6px", border: "1px solid rgb(var(--c-friend) / calc(0.35 * var(--tint)))", color: "rgb(var(--c-friend))" }}
              >
                {s.recipient_name || s.recipient_email || "Unknown"}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Genres — albums only. A playlist shows its description instead. */}
      {isPlaylistItem ? (
        playlistInfo?.description ? (
          <p className="font-mono" style={{ fontSize: 10, color: "rgb(var(--c-muted))", marginBottom: 10, lineHeight: 1.5 }}>
            {playlistInfo.description}
          </p>
        ) : null
      ) : (
        <div style={{ minHeight: 28, marginBottom: 10 }}>
          {loadingDetails ? (
            <div className="flex gap-1">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse" style={{ width: 50 + i * 15, height: 22, background: "rgb(var(--c-surface))", border: "1px solid rgb(var(--c-border))" }} />
              ))}
            </div>
          ) : genres.length > 0 ? (
            <div className="flex gap-1 flex-wrap">
              {genres.map((g) => (
                <span
                  key={g}
                  className="font-mono"
                  style={{ fontSize: 10, padding: "2px 6px", border: "1px solid rgb(var(--c-accent) / calc(0.35 * var(--tint)))", color: "rgb(var(--c-accent))", letterSpacing: "0.08em" }}
                >
                  {g}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {/* Track list */}
      <div style={{ marginBottom: 10 }}>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="font-mono uppercase shrink-0" style={{ fontSize: 10, color: "rgb(var(--c-muted))", letterSpacing: "0.1em" }}>
            TRACKS
          </span>
          <div className="flex-1 h-px" style={{ background: "rgb(var(--c-border))" }} />
          {!loadingDetails && tracks.length > 0 && (
            <span className="font-mono" style={{ fontSize: 10, color: "rgb(var(--c-muted))" }}>
              {tracks.length}
            </span>
          )}
        </div>
        <div style={{ minHeight: 100 }}>
          {loadingDetails ? (
            <div>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse" style={{ height: 18, marginBottom: 4, background: "rgb(var(--c-surface))", width: `${60 + (i * 17) % 40}%` }} />
              ))}
            </div>
          ) : tracks.length > 0 ? (
            <div>
              {tracks.map((track, i) => {
                const showDiscHeader = multiDisc && (i === 0 || track.disc !== tracks[i - 1].disc);
                return (
                  <React.Fragment key={`${track.disc}-${track.number}`}>
                    {showDiscHeader && (
                      <div className="font-mono" style={{ fontSize: 10, color: "rgb(var(--c-accent))", letterSpacing: "0.15em", paddingTop: 4, paddingBottom: 2 }}>
                        DISC {track.disc}
                      </div>
                    )}
                    <div
                      className="flex items-baseline gap-2 py-0.5 cursor-pointer"
                      onClick={() => handlePlayTrack(i)}
                      style={{
                        background: playingUri && track.uri === playingUri ? "rgb(var(--c-spotify) / calc(0.12 * var(--tint)))" : undefined,
                      }}
                      title="Play this track"
                    >
                      <span className="font-mono shrink-0 text-right" style={{ fontSize: 10, color: playingUri && track.uri === playingUri ? "rgb(var(--c-spotify))" : "rgb(var(--c-muted) / calc(0.5 * var(--tint)))", width: 18 }}>
                        {playingUri && track.uri === playingUri ? "▶" : track.number}
                      </span>
                      <span className="font-mono truncate flex-1" style={{ fontSize: 10, color: playingUri && track.uri === playingUri ? "rgb(var(--c-spotify))" : "rgb(var(--c-text))" }}>
                        {track.name}
                      </span>
                      <span className="font-mono shrink-0" style={{ fontSize: 10, color: "rgb(var(--c-muted) / calc(0.4 * var(--tint)))" }}>
                        {formatDuration(track.duration_ms)}
                      </span>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {/* More by artist — albums only */}
      {!isPlaylistItem && (
        <div style={{ minHeight: 100, marginBottom: 10 }}>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-mono uppercase shrink-0" style={{ fontSize: 10, color: "rgb(var(--c-muted))", letterSpacing: "0.1em" }}>
              MORE BY {item.creator.toUpperCase()}
            </span>
            <div className="flex-1 h-px" style={{ background: "rgb(var(--c-border))" }} />
          </div>
          {loadingDetails ? (
            <div className="flex gap-1.5 pb-1">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="shrink-0" style={{ width: 72 }}>
                  <div className="animate-pulse" style={{ width: 72, height: 72, background: "rgb(var(--c-surface))" }} />
                  <div className="animate-pulse" style={{ height: 12, marginTop: 3, background: "rgb(var(--c-surface))", width: "80%" }} />
                </div>
              ))}
            </div>
          ) : artistAlbums.length > 0 ? (
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
              {artistAlbums.slice(0, 10).map((album) => {
                const added = addedAlbums.get(album.spotify_id);
                const isAdding = addingAlbums.has(album.spotify_id);
                return (
                  <div key={album.spotify_id} className="shrink-0" style={{ width: 72 }}>
                    <div
                      className="relative"
                      style={{
                        width: 72,
                        height: 72,
                        background: album.image_url ? undefined : "rgb(var(--c-surface))",
                        boxShadow: "2px 3px 8px rgba(0,0,0,0.6)",
                      }}
                    >
                      {album.image_url ? (
                        <img
                          src={album.image_url}
                          alt={album.title}
                          className="w-full h-full object-cover block"
                          loading="lazy"
                          draggable={false}
                          style={{ filter: added ? "brightness(0.4)" : undefined }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <VinylDisc size={28} />
                        </div>
                      )}
                      {added && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <span className="font-mono" style={{ fontSize: 10, color: added === "favorite" ? "rgb(var(--c-accent))" : "rgb(var(--c-rec))" }}>
                            {added === "favorite" ? "★ FAV" : "◈ REC"}
                          </span>
                        </div>
                      )}
                      {isAdding && (
                        <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
                          <div className="animate-spin" style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgb(var(--c-accent))", borderTopColor: "transparent" }} />
                        </div>
                      )}
                    </div>
                    <div
                      className="font-mono truncate"
                      style={{ fontSize: 10, color: "rgb(var(--c-text))", marginTop: 2, letterSpacing: "0.02em" }}
                      title={album.title}
                    >
                      {album.title}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono" style={{ fontSize: 10, color: "rgb(var(--c-muted))" }}>
                        {album.total_tracks} trk{album.total_tracks !== 1 ? "s" : ""}
                      </span>
                      <span className="font-mono" style={{ fontSize: 10, color: "rgb(var(--c-muted))" }}>
                        {album.release_date?.slice(0, 4)}
                      </span>
                    </div>
                    {!added && !isAdding ? (
                      <div className="flex gap-1 mt-1">
                        <button
                          onClick={() => handleAddAlbum(album, "favorite")}
                          className="font-mono cursor-pointer"
                          style={{ fontSize: 10, padding: "1px 4px", border: "1px solid rgb(var(--c-accent) / calc(0.4 * var(--tint)))", color: "rgb(var(--c-accent))", background: "rgb(var(--c-accent) / calc(0.08 * var(--tint)))" }}
                          title="Add to favorites"
                        >
                          ★
                        </button>
                        <button
                          onClick={() => handleAddAlbum(album, "recommendation")}
                          className="font-mono cursor-pointer"
                          style={{ fontSize: 10, padding: "1px 4px", border: "1px solid rgb(var(--c-rec) / calc(0.4 * var(--tint)))", color: "rgb(var(--c-rec))", background: "rgb(var(--c-rec) / calc(0.08 * var(--tint)))" }}
                          title="Add to recommendations"
                        >
                          ◈
                        </button>
                        <a
                          href={album.spotify_uri}
                          className="flex items-center justify-center no-underline"
                          style={{ padding: "1px 4px", border: "1px solid rgb(var(--c-spotify) / calc(0.3 * var(--tint)))", color: "rgb(var(--c-spotify))", background: "rgb(var(--c-spotify) / calc(0.06 * var(--tint)))" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                          </svg>
                        </a>
                      </div>
                    ) : added ? (
                      <a
                        href={album.spotify_uri}
                        className="flex items-center gap-1 font-mono no-underline mt-1"
                        style={{ fontSize: 10, color: "rgb(var(--c-spotify))" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                        </svg>
                        Spotify
                      </a>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : !loadingDetails ? (
            <p className="font-mono italic" style={{ fontSize: 10, color: "rgb(var(--c-muted) / calc(0.5 * var(--tint)))" }}>
              No other albums found
            </p>
          ) : null}
        </div>
      )}

      
    </div>
  );
}
