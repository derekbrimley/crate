import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import {
  getSpotifyDevices,
  getPlaybackState,
  controlPlayback,
  playOnSpotify,
} from "../services/api";

/**
 * Playback is remote-only: Crate never renders audio itself. It either hands the
 * album to a Spotify app that is already active, or deep-links into the Spotify
 * app on this device and starts the album there once it wakes up. Either way a
 * real Spotify client decodes the audio, so that device's own quality setting —
 * including lossless — applies.
 */

interface CurrentTrack { name: string; artist: string; image_url: string | null; uri: string }

interface PlayerContextValue {
  deviceName: string | null;
  supportsVolume: boolean;
  currentTrack: CurrentTrack | null;
  paused: boolean;
  position: number;
  duration: number;
  volume: number;
  playAlbum(uri: string, offset?: number): Promise<void>;
  togglePlay(): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  setVolume(v: number): Promise<void>;
}

const noop = async () => {};
const PlayerContext = createContext<PlayerContextValue>({
  deviceName: null,
  supportsVolume: false,
  currentTrack: null,
  paused: true,
  position: 0,
  duration: 0,
  volume: 1,
  playAlbum: noop,
  togglePlay: noop,
  next: noop,
  previous: noop,
  seek: noop,
  setVolume: noop,
});

const POLL_PLAYING_MS = 5000;
const POLL_IDLE_MS = 20000;

/** Browser-tab players cap at 256kbps, so they're never a playback target. */
function isWebPlayer(device: { name: string }): boolean {
  return /web player/i.test(device.name ?? "");
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [supportsVolume, setSupportsVolume] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<CurrentTrack | null>(null);
  const [paused, setPaused] = useState(true);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);

  // Drives the poll cadence without making the poll effect depend on state.
  const isPlayingRef = useRef(false);
  // Baseline for interpolating position between polls: { position, at }.
  const positionBaseRef = useRef<{ position: number; at: number }>({ position: 0, at: 0 });
  // Suppresses state polling from clobbering an optimistic update that the
  // Spotify API hasn't caught up to yet (its state lags commands by ~1s).
  const suppressPollUntilRef = useRef(0);
  const volumeTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const seekTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const applyState = useCallback((state: Awaited<ReturnType<typeof getPlaybackState>>) => {
    if (state.playing) {
      setCurrentTrack({
        name: state.playing.name,
        artist: state.playing.artist,
        image_url: state.playing.image_url,
        uri: state.playing.uri,
      });
      setPaused(state.playing.paused);
      setPosition(state.playing.position);
      setDuration(state.playing.duration);
      isPlayingRef.current = !state.playing.paused;
      positionBaseRef.current = { position: state.playing.position, at: performance.now() };
    } else {
      setCurrentTrack(null);
      setPaused(true);
      isPlayingRef.current = false;
    }
    if (state.device) {
      setDeviceName(state.device.name);
      setSupportsVolume(state.device.supports_volume);
      if (typeof state.device.volume_percent === "number") {
        setVolumeState(state.device.volume_percent / 100);
      }
    }
  }, []);

  const pollState = useCallback(async () => {
    if (performance.now() < suppressPollUntilRef.current) return;
    try {
      applyState(await getPlaybackState());
    } catch (err) {
      console.warn("Spotify state poll failed", err);
    }
  }, [applyState]);

  // Poll playback state, faster while something is playing. Skipped while the
  // tab is hidden so a backgrounded tab doesn't burn Spotify's rate limit.
  // The cadence is read from a ref rather than from state deps: applyState
  // builds a fresh track object each poll, so depending on it here would
  // re-run this effect — and fire an immediate poll — on every response.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      if (cancelled) return;
      if (document.visibilityState === "visible") await pollState();
      if (cancelled) return;
      timer = setTimeout(tick, isPlayingRef.current ? POLL_PLAYING_MS : POLL_IDLE_MS);
    };
    void tick();

    // Coming back from the Spotify app is the moment playback most likely
    // changed, so re-sync immediately rather than waiting for the next tick.
    const onVisible = () => { if (document.visibilityState === "visible") void pollState(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pollState]);

  // Advance position locally between polls so the seek bar moves smoothly.
  useEffect(() => {
    if (paused || !currentTrack) return;
    const timer = setInterval(() => {
      const { position: base, at } = positionBaseRef.current;
      setPosition(Math.min(base + (performance.now() - at), duration || Infinity));
    }, 500);
    return () => clearInterval(timer);
  }, [paused, duration, currentTrack]);

  /**
   * Play an album. If a Spotify app is already active, hand it straight over —
   * no app switch. Otherwise open the Spotify app on this device (the album URI
   * is itself the deep link) and have the server start the album as soon as that
   * app registers as a device.
   */
  const playAlbum = useCallback(async (uri: string, offset?: number) => {
    let active: string | undefined;
    try {
      const { devices } = await getSpotifyDevices();
      active = devices.find((d) => d.is_active && !isWebPlayer(d))?.id;
    } catch (err) {
      console.warn("Spotify device list failed", err);
    }

    if (active) {
      await playOnSpotify(uri, active, offset);
      setTimeout(() => { void pollState(); }, 700);
      return;
    }

    // Fire the play request before navigating: it is marked keepalive so it
    // survives this page being backgrounded when Spotify takes the foreground.
    const started = playOnSpotify(uri, undefined, offset, { waitForDevice: true })
      .catch((err) => { console.warn("Spotify play failed", err); });
    window.location.href = uri;
    await started;
    void pollState();
  }, [pollState]);

  // Transport commands carry no device id: they act on whatever is currently
  // active, which is by definition the thing the user is listening to.
  const command = useCallback(async (
    action: "resume" | "pause" | "next" | "previous" | "seek" | "volume",
    value?: number
  ) => {
    try {
      await controlPlayback(action, undefined, value);
    } catch (err) {
      console.warn(`Spotify ${action} failed`, err);
    }
    // Re-sync once Spotify has caught up, lifting the suppression window first
    // so this confirming poll isn't the one that gets skipped.
    setTimeout(() => {
      suppressPollUntilRef.current = 0;
      void pollState();
    }, 1400);
  }, [pollState]);

  const togglePlay = useCallback(async () => {
    const nextPaused = !paused;
    setPaused(nextPaused); // optimistic
    isPlayingRef.current = !nextPaused; // keeps the poll cadence in step
    suppressPollUntilRef.current = performance.now() + 1200;
    await command(nextPaused ? "pause" : "resume");
  }, [paused, command]);

  const next = useCallback(async () => { await command("next"); }, [command]);
  const previous = useCallback(async () => { await command("previous"); }, [command]);

  const seek = useCallback(async (positionMs: number) => {
    setPosition(positionMs);
    positionBaseRef.current = { position: positionMs, at: performance.now() };
    suppressPollUntilRef.current = performance.now() + 1500;
    // Debounced: dragging the bar would otherwise fire a request per pixel.
    clearTimeout(seekTimerRef.current);
    seekTimerRef.current = setTimeout(() => { void command("seek", positionMs); }, 250);
  }, [command]);

  const setVolume = useCallback(async (v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    clearTimeout(volumeTimerRef.current);
    volumeTimerRef.current = setTimeout(() => {
      void command("volume", Math.round(clamped * 100));
    }, 250);
  }, [command]);

  return (
    <PlayerContext.Provider
      value={{
        deviceName, supportsVolume,
        currentTrack, paused, position, duration, volume,
        playAlbum, togglePlay, next, previous, seek, setVolume,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerContextValue {
  return useContext(PlayerContext);
}
