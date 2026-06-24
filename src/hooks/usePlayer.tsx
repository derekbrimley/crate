import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { getSpotifyToken, playOnSpotify } from "../services/api";

interface CurrentTrack { name: string; artist: string; image_url: string | null; uri: string }

interface PlayerContextValue {
  available: boolean;
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
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [currentTrack, setCurrentTrack] = useState<CurrentTrack | null>(null);
  const [paused, setPaused] = useState(true);
  const playerRef = useRef<Spotify.Player | null>(null);

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
        setDeviceId(device_id);
        setAvailable(true);
      });
      player.addListener("not_ready", () => setDeviceId(null));
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
        setAvailable(false);
      };
      player.addListener("initialization_error", fail("init error"));
      player.addListener("authentication_error", fail("auth error"));
      player.addListener("account_error", fail("account error (Premium required)"));

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

  const playAlbum = useCallback(async (uri: string) => {
    if (!deviceId) throw new Error("Web player not ready");
    await playOnSpotify(uri, deviceId);
  }, [deviceId]);

  const togglePlay = useCallback(async () => { await playerRef.current?.togglePlay(); }, []);
  const next = useCallback(async () => { await playerRef.current?.nextTrack(); }, []);
  const previous = useCallback(async () => { await playerRef.current?.previousTrack(); }, []);

  return (
    <PlayerContext.Provider value={{ available, deviceId, currentTrack, paused, playAlbum, togglePlay, next, previous }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerContextValue {
  return useContext(PlayerContext);
}
