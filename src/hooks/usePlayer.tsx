import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import {
  getSpotifyDevices,
  getPlaybackState,
  controlPlayback,
  playOnSpotify,
} from "../services/api";
import type { SpotifyDevice } from "../types";

/**
 * Playback is remote-only: Crate never renders audio itself. Every play routes
 * through Spotify Connect to a real Spotify client (phone, tablet, desktop app,
 * speaker), so that device's own audio-quality setting applies — including
 * lossless, which the browser Web Playback SDK could never do.
 */

interface CurrentTrack { name: string; artist: string; image_url: string | null; uri: string }

interface PlayerContextValue {
  devices: SpotifyDevice[];
  deviceId: string | null;
  deviceName: string | null;
  supportsVolume: boolean;
  currentTrack: CurrentTrack | null;
  paused: boolean;
  position: number;
  duration: number;
  volume: number;
  pickerOpen: boolean;
  openPicker(): void;
  closePicker(): void;
  selectDevice(id: string): void;
  refreshDevices(): Promise<SpotifyDevice[]>;
  playAlbum(uri: string, offset?: number): Promise<void>;
  togglePlay(): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  setVolume(v: number): Promise<void>;
}

const noop = async () => {};
const PlayerContext = createContext<PlayerContextValue>({
  devices: [],
  deviceId: null,
  deviceName: null,
  supportsVolume: false,
  currentTrack: null,
  paused: true,
  position: 0,
  duration: 0,
  volume: 1,
  pickerOpen: false,
  openPicker: () => {},
  closePicker: () => {},
  selectDevice: () => {},
  refreshDevices: async () => [],
  playAlbum: noop,
  togglePlay: noop,
  next: noop,
  previous: noop,
  seek: noop,
  setVolume: noop,
});

const DEVICE_KEY = "crate.spotify_device_id";
const POLL_PLAYING_MS = 5000;
const POLL_IDLE_MS = 20000;

/** Devices that render audio in a browser tab — never auto-selected. */
function isWebPlayer(device: SpotifyDevice): boolean {
  return /web player/i.test(device.name);
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [devices, setDevices] = useState<SpotifyDevice[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(
    () => localStorage.getItem(DEVICE_KEY)
  );
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [supportsVolume, setSupportsVolume] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<CurrentTrack | null>(null);
  const [paused, setPaused] = useState(true);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Mirrors deviceId so callbacks can read the latest value without re-binding.
  const deviceIdRef = useRef<string | null>(deviceId);
  // Drives the poll cadence without making the poll effect depend on state.
  const isPlayingRef = useRef(false);
  // A play request deferred until the user picks a device in the modal.
  const pendingPlayRef = useRef<{ uri: string; offset?: number } | null>(null);
  // Baseline for interpolating position between polls: { position, at }.
  const positionBaseRef = useRef<{ position: number; at: number }>({ position: 0, at: 0 });
  // Suppresses state polling from clobbering an optimistic update that the
  // Spotify API hasn't caught up to yet (its state lags commands by ~1s).
  const suppressPollUntilRef = useRef(0);
  const volumeTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const seekTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const rememberDevice = useCallback((id: string | null) => {
    deviceIdRef.current = id;
    setDeviceId(id);
    if (id) localStorage.setItem(DEVICE_KEY, id);
    else localStorage.removeItem(DEVICE_KEY);
  }, []);

  const refreshDevices = useCallback(async (): Promise<SpotifyDevice[]> => {
    try {
      const { devices: all } = await getSpotifyDevices();
      // Browser-tab players are dropped entirely: they cap at 256kbps, which is
      // the whole reason playback moved off the in-app SDK.
      const list = all.filter((d) => !isWebPlayer(d));
      setDevices(list);
      // A remembered device that isn't in the list is just asleep (Spotify only
      // reports apps that are open), so the preference is kept — resolveDevice
      // checks liveness before using it, and a genuinely dead device is cleared
      // when a command comes back NO_DEVICE.
      return list;
    } catch (err) {
      console.warn("Spotify device list failed", err);
      return [];
    }
  }, []);

  /**
   * Pick the device to play on: the remembered one if it's still online, else
   * the currently active one, else the only one available. Returns null when
   * the choice is ambiguous (say phone and tablet both idle) or there's nothing
   * to play on — the caller opens the picker in that case.
   */
  const resolveDevice = useCallback(async (): Promise<string | null> => {
    const list = await refreshDevices();
    if (list.length === 0) return null;

    const remembered = deviceIdRef.current;
    if (remembered && list.some((d) => d.id === remembered)) return remembered;

    const active = list.find((d) => d.is_active);
    if (active) { rememberDevice(active.id); return active.id; }

    if (list.length === 1) { rememberDevice(list[0].id); return list[0].id; }

    return null;
  }, [refreshDevices, rememberDevice]);

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
      // Follow along if playback was started from the Spotify app directly, so
      // the transport controls target whatever is actually playing. Web players
      // are never adopted — routing to one would silently cap quality.
      const name = state.device.name ?? "";
      if (state.device.id && state.device.id !== deviceIdRef.current && !/web player/i.test(name)) {
        rememberDevice(state.device.id);
      }
    }
  }, [rememberDevice]);

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

    const onVisible = () => { if (document.visibilityState === "visible") void pollState(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pollState]);

  useEffect(() => { void refreshDevices(); }, [refreshDevices]);

  // Advance position locally between polls so the seek bar moves smoothly.
  useEffect(() => {
    if (paused || !currentTrack) return;
    const timer = setInterval(() => {
      const { position: base, at } = positionBaseRef.current;
      setPosition(Math.min(base + (performance.now() - at), duration || Infinity));
    }, 500);
    return () => clearInterval(timer);
  }, [paused, duration, currentTrack]);

  /** Start an album on an already-resolved device. */
  const playOnDevice = useCallback(async (id: string, uri: string, offset?: number) => {
    try {
      await playOnSpotify(uri, id, offset);
    } catch (err) {
      // The device dropped off between the list call and the play call — re-list
      // and let the user pick rather than failing silently.
      if ((err as { code?: string }).code === "NO_DEVICE") {
        rememberDevice(null);
        await refreshDevices();
        pendingPlayRef.current = { uri, offset };
        setPickerOpen(true);
        return;
      }
      throw err;
    }
    suppressPollUntilRef.current = 0;
    setTimeout(() => { void pollState(); }, 700);
  }, [refreshDevices, rememberDevice, pollState]);

  const playAlbum = useCallback(async (uri: string, offset?: number) => {
    const id = await resolveDevice();
    if (!id) {
      // Hold the request so picking a device starts this album immediately
      // instead of making the user hit play a second time.
      pendingPlayRef.current = { uri, offset };
      setPickerOpen(true);
      return;
    }
    await playOnDevice(id, uri, offset);
  }, [resolveDevice, playOnDevice]);

  const selectDevice = useCallback((id: string) => {
    rememberDevice(id);
    setPickerOpen(false);
    const pending = pendingPlayRef.current;
    pendingPlayRef.current = null;
    if (pending) void playOnDevice(id, pending.uri, pending.offset);
  }, [rememberDevice, playOnDevice]);

  const command = useCallback(async (
    action: "resume" | "pause" | "next" | "previous" | "seek" | "volume",
    value?: number
  ) => {
    try {
      await controlPlayback(action, deviceIdRef.current ?? undefined, value);
    } catch (err) {
      if ((err as { code?: string }).code === "NO_DEVICE") {
        rememberDevice(null);
        await refreshDevices();
        setPickerOpen(true);
        return;
      }
      throw err;
    }
    // Re-sync once Spotify has caught up, lifting the suppression window first
    // so this confirming poll isn't the one that gets skipped.
    setTimeout(() => {
      suppressPollUntilRef.current = 0;
      void pollState();
    }, 1400);
  }, [pollState, refreshDevices, rememberDevice]);

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
        devices, deviceId, deviceName, supportsVolume,
        currentTrack, paused, position, duration, volume,
        pickerOpen,
        openPicker: () => { void refreshDevices(); setPickerOpen(true); },
        closePicker: () => { pendingPlayRef.current = null; setPickerOpen(false); },
        selectDevice, refreshDevices,
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
