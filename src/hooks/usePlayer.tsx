import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { getSpotifyToken, playOnSpotify } from "../services/api";

interface CurrentTrack { name: string; artist: string; image_url: string | null; uri: string }

interface PlayerContextValue {
  available: boolean;
  // True when in-app playback should be attempted (desktop, SDK not failed).
  // Unlike `available`, this is true during the SDK's 1-2s startup window so
  // an early click waits for the device instead of falling back to the web app.
  canPlay: boolean;
  deviceId: string | null;
  currentTrack: CurrentTrack | null;
  paused: boolean;
  playAlbum(uri: string): Promise<void>;
  togglePlay(): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
}

const noop = async () => {};
const PlayerContext = createContext<PlayerContextValue>({
  available: false,
  canPlay: false,
  deviceId: null,
  currentTrack: null,
  paused: true,
  playAlbum: noop,
  togglePlay: noop,
  next: noop,
  previous: noop,
});

const SDK_SRC = "https://sdk.scdn.co/spotify-player.js";
const isMobile = () => /iPhone|iPad|Android/i.test(navigator.userAgent);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [available, setAvailable] = useState(false);
  // Desktop attempts in-app playback by default; cleared only if the SDK fails.
  const [canPlay, setCanPlay] = useState(!isMobile());
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [currentTrack, setCurrentTrack] = useState<CurrentTrack | null>(null);
  const [paused, setPaused] = useState(true);
  const playerRef = useRef<Spotify.Player | null>(null);
  // Refs mirror device/SDK state so playAlbum can poll for readiness without
  // capturing a stale closure value (the SDK fires `ready` ~1-2s after load).
  const deviceIdRef = useRef<string | null>(null);
  const sdkFailedRef = useRef(false);

  useEffect(() => {
    if (isMobile()) return; // desktop only

    const init = () => {
      const player = new window.Spotify.Player({
        name: "Crate Web Player",
        getOAuthToken: (cb) => {
          getSpotifyToken()
            .then(({ access_token }) => cb(access_token))
            .catch((e) => console.error("Spotify token fetch failed", e));
        },
      });
      playerRef.current = player;

      player.addListener("ready", ({ device_id }) => {
        deviceIdRef.current = device_id;
        setDeviceId(device_id);
        setAvailable(true);
      });
      player.addListener("not_ready", () => {
        deviceIdRef.current = null;
        setDeviceId(null);
      });
      player.addListener("player_state_changed", (state) => {
        if (!state) { setCurrentTrack(null); return; }
        const t = state.track_window.current_track;
        setCurrentTrack({
          name: t.name,
          artist: t.artists.map((a) => a.name).join(", "),
          image_url: t.album.images[0]?.url ?? null,
          uri: t.uri,
        });
        setPaused(state.paused);
      });
      const fail = (label: string) => (e: Spotify.Error) => {
        console.warn(`Spotify ${label}:`, e.message);
        sdkFailedRef.current = true;
        setAvailable(false);
        setCanPlay(false);
      };
      player.addListener("initialization_error", fail("init error"));
      player.addListener("account_error", fail("account error (Premium required)"));
      // NOTE: authentication_error is NOT treated as fatal. The SDK fires it from
      // a spurious internal `check_scope?scope=web-playback` 403 ("Token does not
      // satisfy scope") even when the token DOES hold the `streaming` scope — the
      // device still becomes `ready` and plays fine. (Verified: Spotify's OAuth
      // server reports `streaming` in the granted scopes, yet check_scope 403s.)
      // A genuine auth failure instead manifests as `ready` never firing, which
      // waitForDevice's timeout already handles. Killing the player here was what
      // forced the silent fallback to the Spotify web tab.
      player.addListener("authentication_error", (e) => {
        console.warn("Spotify auth error (non-fatal):", e.message);
      });

      player.connect();
    };

    // The SDK calls this global when the script finishes loading.
    if (window.Spotify) {
      init();
    } else {
      window.onSpotifyWebPlaybackSDKReady = init;
      if (!document.querySelector(`script[src="${SDK_SRC}"]`)) {
        const script = document.createElement("script");
        script.src = SDK_SRC;
        script.async = true;
        document.body.appendChild(script);
      }
    }

    return () => {
      playerRef.current?.disconnect();
      playerRef.current = null;
    };
  }, []);

  // Wait up to ~5s for the SDK to register a device. The `ready` event fires
  // 1-2s after page load, so a click immediately after load would otherwise
  // see no device and fall through to opening the Spotify web app.
  const waitForDevice = useCallback(async (): Promise<string> => {
    const deadlineMs = 5000;
    const stepMs = 100;
    let waited = 0;
    while (!deviceIdRef.current) {
      if (sdkFailedRef.current) throw new Error("Web player unavailable");
      if (waited >= deadlineMs) throw new Error("Web player not ready");
      await new Promise((r) => setTimeout(r, stepMs));
      waited += stepMs;
    }
    return deviceIdRef.current;
  }, []);

  const playAlbum = useCallback(async (uri: string) => {
    const id = await waitForDevice();
    await playOnSpotify(uri, id);
  }, [waitForDevice]);

  const togglePlay = useCallback(async () => { await playerRef.current?.togglePlay(); }, []);
  const next = useCallback(async () => { await playerRef.current?.nextTrack(); }, []);
  const previous = useCallback(async () => { await playerRef.current?.previousTrack(); }, []);

  return (
    <PlayerContext.Provider value={{ available, canPlay, deviceId, currentTrack, paused, playAlbum, togglePlay, next, previous }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerContextValue {
  return useContext(PlayerContext);
}
