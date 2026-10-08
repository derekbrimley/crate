import { describe, it, expect } from "vitest";
import { matchPlaylists } from "./playlistSearch";
import type { SpotifyPlaylistInfo } from "../types";

function pl(name: string, owner = "me"): SpotifyPlaylistInfo {
  return {
    id: name, name, owner, image_url: null, track_count: 10,
    uri: `spotify:playlist:${name}`, url: "", already_added: null,
  };
}

describe("matchPlaylists", () => {
  const all = [pl("Jazz for a chill morning"), pl("Road Trip"), pl("Gym", "Sam")];

  it("returns everything for an empty query", () => {
    expect(matchPlaylists(all, "  ")).toHaveLength(3);
  });

  it("matches every word, in any order, ignoring case", () => {
    expect(matchPlaylists(all, "CHILL jazz").map((p) => p.name)).toEqual(["Jazz for a chill morning"]);
    expect(matchPlaylists(all, "jazz road")).toEqual([]);
  });

  it("matches the owner too", () => {
    expect(matchPlaylists(all, "sam").map((p) => p.name)).toEqual(["Gym"]);
  });
});
