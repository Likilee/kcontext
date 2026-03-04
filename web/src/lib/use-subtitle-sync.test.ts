import { describe, expect, it } from "vitest";
import { findActiveChunkIndex } from "./use-subtitle-sync";

const CHUNKS = [
  { startTime: 0.0, duration: 2.5, text: "First chunk" },
  { startTime: 2.5, duration: 3.0, text: "Second chunk" },
  { startTime: 7.0, duration: 2.0, text: "Third chunk (gap before)" },
];

describe("findActiveChunkIndex", () => {
  it("returns correct index for time within first chunk", () => {
    expect(findActiveChunkIndex(CHUNKS, 1.0)).toBe(0);
  });

  it("returns correct index for time within second chunk", () => {
    expect(findActiveChunkIndex(CHUNKS, 3.5)).toBe(1);
  });

  it("returns correct index at exact chunk start boundary", () => {
    expect(findActiveChunkIndex(CHUNKS, 2.5)).toBe(1);
  });

  it("returns previous chunk index for time in gap between chunks", () => {
    expect(findActiveChunkIndex(CHUNKS, 6.0)).toBe(1);
  });

  it("returns -1 for time before all chunks", () => {
    expect(findActiveChunkIndex(CHUNKS, -1.0)).toBe(-1);
  });

  it("returns last chunk index for time after all chunks", () => {
    expect(findActiveChunkIndex(CHUNKS, 100.0)).toBe(2);
  });

  it("returns -1 for empty chunks array", () => {
    expect(findActiveChunkIndex([], 5.0)).toBe(-1);
  });

  it("handles single chunk correctly", () => {
    const single = [{ startTime: 0, duration: 5, text: "only" }];
    expect(findActiveChunkIndex(single, 2.5)).toBe(0);
    expect(findActiveChunkIndex(single, 5.0)).toBe(0);
  });

  it("returns previous chunk at exact chunk end boundary", () => {
    expect(findActiveChunkIndex(CHUNKS, 2.5 + 3.0)).toBe(1);
  });
});
