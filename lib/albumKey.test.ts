import { describe, it, expect } from "vitest";
import { albumKey } from "./albumKey";

describe("albumKey", () => {
  it("treats editions of one album as the same", () => {
    expect(albumKey("Blue (Remastered)", "Joni Mitchell")).toBe(albumKey("Blue", "Joni Mitchell"));
    expect(albumKey("In Rainbows [Deluxe]", "Radiohead")).toBe(albumKey("in rainbows", "RADIOHEAD"));
  });

  it("keeps different albums apart", () => {
    expect(albumKey("Blue", "Joni Mitchell")).not.toBe(albumKey("Court and Spark", "Joni Mitchell"));
  });
});
