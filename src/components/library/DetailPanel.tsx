import React, { useState, useEffect, useRef } from "react";
import { VinylDisc } from "../VinylDisc";
import { getAlbumDetails, deleteAlbum, addAlbum, promoteAlbum, sendRecommendation, getRecentRecipients, playOnSpotify } from "../../services/api";
import type { Item, AlbumTrack, ArtistAlbum, SentRecommendation } from "../../types";
import { usePlayer } from "../../hooks/usePlayer";

interface DetailPanelProps {
  item: Item;
  pickCount: number;
  lastPickedTs: number | null;
  onClose: () => void;
  onRemove: (item: Item) => void;
  onPlay?: () => void;
  onPromote?: (item: Item) => void;
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

const detailsCache = new Map<string, { genres: string[]; artistAlbums: ArtistAlbum[]; tracks: AlbumTrack[]; sentTo: SentRecommendation[] }>();

export function DetailPanel({ item, pickCount, lastPickedTs, onClose, onRemove, onPlay, onPromote }: DetailPanelProps) {
  const player = usePlayer();
  const cached = detailsCache.get(item.external_id);
  const [genres, setGenres] = useState<string[]>(cached?.genres || []);
  const [artistAlbums, setArtistAlbums] = useState<ArtistAlbum[]>(cached?.artistAlbums || []);
  const [tracks, setTracks] = useState<AlbumTrack[]>(cached?.tracks || []);
  const [sentTo, setSentTo] = useState<SentRecommendation[]>(cached?.sentTo || []);
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
  const removeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [promoting, setPromoting] = useState(false);
  const [promoted, setPromoted] = useState(false);
  const [addingToList, setAddingToList] = useState<"favorite" | "recommendation" | null>(null);
  const [addedToList, setAddedToList] = useState<"favorite" | "recommendation" | null>(null);

  const isAiSuggested = item.id === 0 && (() => {
    const m = item.metadata;
    if (!m) return false;
    if (typeof m === "object") return (m as Record<string, unknown>)._ai_suggested === true;
    try { return (JSON.parse(m) as Record<string, unknown>)._ai_suggested === true; } catch { return false; }
  })();

  const parsedMeta = (() => {
    const m = item.metadata;
    if (!m) return null;
    if (typeof m === "object") return m as Record<string, unknown>;
    try { return JSON.parse(m) as Record<string, unknown>; } catch { return null; }
  })();
  const isFriendRec = parsedMeta?._friend_rec === true;
  const friendSenderName = isFriendRec ? (parsedMeta?._sender_name as string | null) : null;

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
      detailsCache.set(item.external_id, { genres: refreshed.genres, artistAlbums: refreshed.artist_albums, tracks: refreshed.tracks, sentTo: refreshed.sent_to ?? [] });
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
    getAlbumDetails(item.external_id)
      .then((data) => {
        if (cancelled) return;
        detailsCache.set(item.external_id, { genres: data.genres, artistAlbums: data.artist_albums, tracks: data.tracks, sentTo: data.sent_to ?? [] });
        setGenres(data.genres);
        setArtistAlbums(data.artist_albums);
        setTracks(data.tracks);
        setSentTo(data.sent_to ?? []);
        const initial = new Map<string, "favorite" | "recommendation">();
        for (const a of data.artist_albums) {
          if (a.already_added) initial.set(a.spotify_id, a.already_added);
        }
        setAddedAlbums(initial);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingDetails(false); });
    return () => { cancelled = true; };
  }, [item.external_id]);

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
      try {
        await deleteAlbum(item.id);
        onRemove(item);
      } catch {
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
      await addAlbum({
        spotify_id: item.external_id,
        title: item.title,
        artist: item.creator,
        image_url: item.image_url || undefined,
        spotify_uri: item.external_uri ?? undefined,
        spotify_url: item.external_url ?? undefined,
        list_type: targetList,
      });
      setAddedToList(targetList);
    } catch {}
    setAddingToList(null);
  };

  const lastPlayedDays = daysAgo(lastPickedTs);
  const isRecent = lastPlayedDays <= 7;
  const multiDisc = tracks.some((t) => t.disc > 1);

  return (
    <div
      className="animate-panel-open"
      style={{
        background: "#1a1210",
        borderTop: "2px solid #ff5e00",
        borderBottom: "1px solid #3d2815",
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
            boxShadow: "3px 5px 16px rgba(0,0,0,0.8), inset 0 0 0 1px rgba(255,255,255,0.05)",
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
            style={{ fontSize: 22, color: "#f2e8d2", letterSpacing: "0.04em" }}
          >
            {item.title.toUpperCase()}
          </div>
          <div
            className="font-mono uppercase mb-1"
            style={{ fontSize: 10, color: "#907558", letterSpacing: "0.1em" }}
          >
            {item.creator}
          </div>
          {item.list_type === "recommendation" && !isFriendRec && (
            <div className="font-mono mb-1" style={{ fontSize: 10, color: "#00b4c8", letterSpacing: "0.08em" }}>
              ◈ RECOMMENDATION
            </div>
          )}
          {isFriendRec && friendSenderName && (
            <div className="font-mono mb-1" style={{ fontSize: 10, color: "#a855f7", letterSpacing: "0.05em" }}>
              From {friendSenderName}
            </div>
          )}

          <div className="flex gap-1">
            <div
              className="flex-1"
              style={{ background: "#0f0a0c", border: "1px solid #3d2815", padding: "4px 5px" }}
            >
              <div className="font-mono uppercase" style={{ fontSize: 10, color: "#907558", letterSpacing: "0.1em", marginBottom: 1 }}>
                LAST PLAYED
              </div>
              <div className="font-mono" style={{ fontSize: 10, color: isRecent ? "#39ff14" : "#f2e8d2", fontWeight: 500 }}>
                {formatLastPlayed(lastPickedTs)}
              </div>
            </div>
            <div
              className="flex-1"
              style={{ background: "#0f0a0c", border: "1px solid #3d2815", padding: "4px 5px" }}
            >
              <div className="font-mono uppercase" style={{ fontSize: 10, color: "#907558", letterSpacing: "0.1em", marginBottom: 1 }}>
                PLAYS
              </div>
              <div className="font-mono" style={{ fontSize: 10, color: "#ff5e00", fontWeight: 600 }}>
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
            border: "1px solid #3d2815",
            color: "#907558",
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
            const uri = item.external_uri || (item.external_id ? `spotify:album:${item.external_id}` : null);
            const url = item.external_url || uri;
            if (!url && !uri) return;
            onPlay?.();
            if (/iPhone|iPad|Android/i.test(navigator.userAgent)) {
              if (url) window.location.href = url;
              return;
            }
            if (uri && player.canPlay) {
              try {
                await player.playAlbum(uri);
                return;
              } catch { /* fall through */ }
            }
            if (uri) {
              try {
                await playOnSpotify(uri);
                return;
              } catch { /* fall through */ }
            }
            if (url) window.open(url, "_blank");
          }}
          className="flex-1 flex items-center justify-center gap-1 text-center font-mono cursor-pointer"
          style={{
            fontSize: 10,
            padding: "6px 0",
            border: "1px solid rgba(29,185,84,0.3)",
            color: "#1DB954",
            background: "rgba(29,185,84,0.07)",
            letterSpacing: "0.1em",
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
          PLAY ON SPOTIFY
        </button>
        {isAiSuggested ? (
          addedToList ? (
            <span
              className="font-mono flex items-center px-2"
              style={{ fontSize: 10, color: addedToList === "favorite" ? "#ff5e00" : "#00b4c8", border: "1px solid currentColor", background: addedToList === "favorite" ? "rgba(255,94,0,0.1)" : "rgba(0,180,200,0.1)" }}
            >
              {addedToList === "favorite" ? "★ ADDED" : "◈ ADDED"}
            </span>
          ) : (
            <>
              <button
                onClick={() => handleAddToLibrary("favorite")}
                disabled={addingToList !== null}
                className="font-mono cursor-pointer disabled:opacity-50"
                style={{ fontSize: 10, padding: "6px 10px", border: "1px solid rgba(255,94,0,0.5)", color: "#ff5e00", background: "rgba(255,94,0,0.1)", letterSpacing: "0.08em" }}
              >
                {addingToList === "favorite" ? "…" : "★ FAV"}
              </button>
              <button
                onClick={() => handleAddToLibrary("recommendation")}
                disabled={addingToList !== null}
                className="font-mono cursor-pointer disabled:opacity-50"
                style={{ fontSize: 10, padding: "6px 10px", border: "1px solid rgba(0,180,200,0.4)", color: "#00b4c8", background: "rgba(0,180,200,0.1)", letterSpacing: "0.08em" }}
              >
                {addingToList === "recommendation" ? "…" : "◈ REC"}
              </button>
            </>
          )
        ) : (
          <>
            {onPromote && (
              <button
                onClick={handlePromote}
                disabled={promoting || promoted}
                className="font-mono cursor-pointer disabled:opacity-60"
                style={{
                  fontSize: 10,
                  padding: "6px 10px",
                  border: promoted ? "1px solid rgba(255,94,0,0.6)" : "1px solid rgba(255,94,0,0.35)",
                  color: "#ff5e00",
                  background: promoted ? "rgba(255,94,0,0.15)" : "transparent",
                  letterSpacing: "0.08em",
                }}
                title="Move to favorites"
              >
                {promoting ? "★ …" : promoted ? "★ FAVED" : isFriendRec ? "★ ADD TO FAVORITES" : "★ FAVORITE"}
              </button>
            )}
            {!promoted && (
              <button
                onClick={handleRemoveClick}
                className="font-mono cursor-pointer"
                style={{
                  fontSize: 10,
                  padding: "6px 10px",
                  border: removeConfirm ? "1px solid rgba(255,85,85,0.5)" : "1px solid rgba(180,0,0,0.35)",
                  color: "#ff5555",
                  background: removeConfirm ? "rgba(180,0,0,0.15)" : "transparent",
                }}
              >
                {isFriendRec ? "DISMISS" : removeConfirm ? "REMOVE?" : "REMOVE"}
              </button>
            )}
          </>
        )}
      </div>
      {/* Send to Friend */}
      {!isFriendRec && !isAiSuggested && (
        <div style={{ marginBottom: 10 }}>
          {!sendFormOpen ? (
            <button
              onClick={() => setSendFormOpen(true)}
              className="font-mono cursor-pointer w-full"
              style={{
                fontSize: 10,
                padding: "5px 0",
                border: "1px solid rgba(168,85,247,0.35)",
                color: "#a855f7",
                background: "transparent",
                letterSpacing: "0.1em",
              }}
            >
              SEND TO FRIEND
            </button>
          ) : (
            <div style={{ border: "1px solid rgba(168,85,247,0.35)", padding: "8px" }}>
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
                        border: sendEmail === r.email ? "1px solid rgba(168,85,247,0.7)" : "1px solid #3d2815",
                        color: sendEmail === r.email ? "#a855f7" : "#f2e8d2",
                        background: sendEmail === r.email ? "rgba(168,85,247,0.1)" : "transparent",
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
                  style={{ fontSize: 10, color: "#f2e8d2", border: "1px solid #3d2815", padding: "4px 6px" }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
                  disabled={sendStatus === "sending" || sendStatus === "sent"}
                />
                <button
                  onClick={handleSend}
                  disabled={sendStatus === "sending" || sendStatus === "sent" || !sendEmail.trim()}
                  className="font-mono cursor-pointer disabled:opacity-50"
                  style={{ fontSize: 10, padding: "4px 8px", border: "1px solid rgba(168,85,247,0.5)", color: "#a855f7", background: "rgba(168,85,247,0.1)", letterSpacing: "0.08em" }}
                >
                  {sendStatus === "sending" ? "…" : sendStatus === "sent" ? "SENT!" : "SEND"}
                </button>
                <button
                  onClick={() => { setSendFormOpen(false); setSendEmail(""); setSendStatus("idle"); setSendError(""); }}
                  className="font-mono cursor-pointer"
                  style={{ fontSize: 10, padding: "4px 6px", border: "1px solid #3d2815", color: "#907558", background: "transparent" }}
                >
                  ✕
                </button>
              </div>
              {sendStatus === "error" && sendError && (
                <div className="font-mono mt-1" style={{ fontSize: 10, color: "#ff5555" }}>
                  {sendError}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sent to */}
      {!isFriendRec && !isAiSuggested && sentTo.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div className="font-mono uppercase" style={{ fontSize: 10, color: "#907558", letterSpacing: "0.1em", marginBottom: 4 }}>
            SENT TO
          </div>
          <div className="flex flex-wrap gap-1">
            {sentTo.map((s, i) => (
              <span
                key={i}
                className="font-mono"
                style={{ fontSize: 10, padding: "2px 6px", border: "1px solid rgba(168,85,247,0.35)", color: "#a855f7" }}
              >
                {s.recipient_name || s.recipient_email || "Unknown"}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Genres */}
      <div style={{ minHeight: 28, marginBottom: 10 }}>
        {loadingDetails ? (
          <div className="flex gap-1">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse" style={{ width: 50 + i * 15, height: 22, background: "#0f0a0c", border: "1px solid #3d2815" }} />
            ))}
          </div>
        ) : genres.length > 0 ? (
          <div className="flex gap-1 flex-wrap">
            {genres.map((g) => (
              <span
                key={g}
                className="font-mono"
                style={{ fontSize: 10, padding: "2px 6px", border: "1px solid rgba(255,94,0,0.35)", color: "#ff5e00", letterSpacing: "0.08em" }}
              >
                {g}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* Track list */}
      <div style={{ marginBottom: 10 }}>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="font-mono uppercase shrink-0" style={{ fontSize: 10, color: "#907558", letterSpacing: "0.1em" }}>
            TRACKS
          </span>
          <div className="flex-1 h-px" style={{ background: "#3d2815" }} />
          {!loadingDetails && tracks.length > 0 && (
            <span className="font-mono" style={{ fontSize: 10, color: "#907558" }}>
              {tracks.length}
            </span>
          )}
        </div>
        <div style={{ minHeight: 100 }}>
          {loadingDetails ? (
            <div>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse" style={{ height: 18, marginBottom: 4, background: "#0f0a0c", width: `${60 + (i * 17) % 40}%` }} />
              ))}
            </div>
          ) : tracks.length > 0 ? (
            <div>
              {tracks.map((track, i) => {
                const showDiscHeader = multiDisc && (i === 0 || track.disc !== tracks[i - 1].disc);
                return (
                  <React.Fragment key={`${track.disc}-${track.number}`}>
                    {showDiscHeader && (
                      <div className="font-mono" style={{ fontSize: 10, color: "#ff5e00", letterSpacing: "0.15em", paddingTop: 4, paddingBottom: 2 }}>
                        DISC {track.disc}
                      </div>
                    )}
                    <div className="flex items-baseline gap-2 py-0.5">
                      <span className="font-mono shrink-0 text-right" style={{ fontSize: 10, color: "rgba(144,117,88,0.5)", width: 18 }}>
                        {track.number}
                      </span>
                      <span className="font-mono truncate flex-1" style={{ fontSize: 10, color: "#f2e8d2" }}>
                        {track.name}
                      </span>
                      <span className="font-mono shrink-0" style={{ fontSize: 10, color: "rgba(144,117,88,0.4)" }}>
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

      {/* More by artist */}
      <div style={{ minHeight: 100, marginBottom: 10 }}>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="font-mono uppercase shrink-0" style={{ fontSize: 10, color: "#907558", letterSpacing: "0.1em" }}>
            MORE BY {item.creator.toUpperCase()}
          </span>
          <div className="flex-1 h-px" style={{ background: "#3d2815" }} />
        </div>
        {loadingDetails ? (
          <div className="flex gap-1.5 pb-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="shrink-0" style={{ width: 72 }}>
                <div className="animate-pulse" style={{ width: 72, height: 72, background: "#0f0a0c" }} />
                <div className="animate-pulse" style={{ height: 12, marginTop: 3, background: "#0f0a0c", width: "80%" }} />
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
                      background: album.image_url ? undefined : "#0f0a0c",
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
                        <span className="font-mono" style={{ fontSize: 10, color: added === "favorite" ? "#ff5e00" : "#00b4c8" }}>
                          {added === "favorite" ? "★ FAV" : "◈ REC"}
                        </span>
                      </div>
                    )}
                    {isAdding && (
                      <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
                        <div className="animate-spin" style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid #ff5e00", borderTopColor: "transparent" }} />
                      </div>
                    )}
                  </div>
                  <div
                    className="font-mono truncate"
                    style={{ fontSize: 10, color: "#f2e8d2", marginTop: 2, letterSpacing: "0.02em" }}
                    title={album.title}
                  >
                    {album.title}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono" style={{ fontSize: 10, color: "#907558" }}>
                      {album.total_tracks} trk{album.total_tracks !== 1 ? "s" : ""}
                    </span>
                    <span className="font-mono" style={{ fontSize: 10, color: "#907558" }}>
                      {album.release_date?.slice(0, 4)}
                    </span>
                  </div>
                  {!added && !isAdding ? (
                    <div className="flex gap-1 mt-1">
                      <button
                        onClick={() => handleAddAlbum(album, "favorite")}
                        className="font-mono cursor-pointer"
                        style={{ fontSize: 10, padding: "1px 4px", border: "1px solid rgba(255,94,0,0.4)", color: "#ff5e00", background: "rgba(255,94,0,0.08)" }}
                        title="Add to favorites"
                      >
                        ★
                      </button>
                      <button
                        onClick={() => handleAddAlbum(album, "recommendation")}
                        className="font-mono cursor-pointer"
                        style={{ fontSize: 10, padding: "1px 4px", border: "1px solid rgba(0,180,200,0.4)", color: "#00b4c8", background: "rgba(0,180,200,0.08)" }}
                        title="Add to recommendations"
                      >
                        ◈
                      </button>
                      <a
                        href={album.spotify_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center no-underline"
                        style={{ padding: "1px 4px", border: "1px solid rgba(29,185,84,0.3)", color: "#1DB954", background: "rgba(29,185,84,0.06)" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                        </svg>
                      </a>
                    </div>
                  ) : added ? (
                    <a
                      href={album.spotify_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 font-mono no-underline mt-1"
                      style={{ fontSize: 10, color: "#1DB954" }}
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
          <p className="font-mono italic" style={{ fontSize: 10, color: "rgba(144,117,88,0.5)" }}>
            No other albums found
          </p>
        ) : null}
      </div>

      
    </div>
  );
}
