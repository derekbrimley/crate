// Minimal types for the Spotify Web Playback SDK (https://sdk.scdn.co/spotify-player.js)
export {};

declare global {
  interface Window {
    Spotify: typeof Spotify;
    onSpotifyWebPlaybackSDKReady: () => void;
  }

  namespace Spotify {
    interface PlayerInit {
      name: string;
      getOAuthToken: (cb: (token: string) => void) => void;
      volume?: number;
    }

    interface Image {
      url: string;
    }

    interface Track {
      uri: string;
      name: string;
      artists: { name: string; uri: string }[];
      album: { name: string; uri: string; images: Image[] };
    }

    interface PlaybackState {
      paused: boolean;
      track_window: { current_track: Track };
    }

    interface WebPlaybackInstance {
      device_id: string;
    }

    interface Error {
      message: string;
    }

    class Player {
      constructor(init: PlayerInit);
      connect(): Promise<boolean>;
      disconnect(): void;
      addListener(event: "ready" | "not_ready", cb: (instance: WebPlaybackInstance) => void): boolean;
      addListener(event: "player_state_changed", cb: (state: PlaybackState | null) => void): boolean;
      addListener(
        event: "initialization_error" | "authentication_error" | "account_error" | "playback_error",
        cb: (error: Error) => void
      ): boolean;
      togglePlay(): Promise<void>;
      nextTrack(): Promise<void>;
      previousTrack(): Promise<void>;
    }
  }
}
