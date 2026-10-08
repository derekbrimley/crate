import { describe, it, expect } from "vitest";
import { parsePlayTarget, isRepeatPlay, REPLAY_WINDOW_SECONDS } from "./plays";

describe("parsePlayTarget", () => {
  it("reads album and playlist URIs", () => {
    expect(parsePlayTarget("spotify:album:4aawyAB9vmqN3uQ7FjRGTy")).toEqual({
      mediaType: "album",
      externalId: "4aawyAB9vmqN3uQ7FjRGTy",
    });
    expect(parsePlayTarget("spotify:playlist:37i9dQZF1DXcBWIGoYBM5M")).toEqual({
      mediaType: "playlist",
      externalId: "37i9dQZF1DXcBWIGoYBM5M",
    });
  });

  it("ignores anything that isn't an album or playlist", () => {
    expect(parsePlayTarget("spotify:track:abc")).toBeNull();
    expect(parsePlayTarget("spotify:artist:abc")).toBeNull();
    expect(parsePlayTarget("https://open.spotify.com/album/abc")).toBeNull();
    expect(parsePlayTarget("")).toBeNull();
  });
});

describe("isRepeatPlay", () => {
  const now = 1_000_000;

  it("counts a first play", () => {
    expect(isRepeatPlay(null, now)).toBe(false);
  });

  it("skips a replay inside the window", () => {
    expect(isRepeatPlay(now - 60, now)).toBe(true);
  });

  it("counts a replay once the window has passed", () => {
    expect(isRepeatPlay(now - REPLAY_WINDOW_SECONDS, now)).toBe(false);
  });
});
