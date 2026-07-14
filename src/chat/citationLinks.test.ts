import { describe, expect, it } from "vitest";

import { citationIndexFromHref, linkifyCitations } from "./citationLinks";

describe("linkifyCitations", () => {
  it("turns valid citation markers into markdown links that preserve the bracket display", () => {
    expect(linkifyCitations("Refunds take 30 days [1].", 2)).toBe("Refunds take 30 days [[1]](#cite-1).");
  });

  it("links multiple distinct markers", () => {
    expect(linkifyCitations("See [1] and [2].", 2)).toBe("See [[1]](#cite-1) and [[2]](#cite-2).");
  });

  it("leaves an out-of-range marker as plain text", () => {
    expect(linkifyCitations("See [5].", 2)).toBe("See [5].");
  });

  it("leaves everything untouched when there are no sources", () => {
    expect(linkifyCitations("General knowledge [1] answer.", 0)).toBe("General knowledge [1] answer.");
  });

  it("does not touch non-numeric brackets", () => {
    expect(linkifyCitations("A footnote [note] here.", 3)).toBe("A footnote [note] here.");
  });
});

describe("citationIndexFromHref", () => {
  it("extracts the index from a citation href", () => {
    expect(citationIndexFromHref("#cite-3")).toBe(3);
  });

  it("returns null for a non-citation href", () => {
    expect(citationIndexFromHref("https://example.com")).toBeNull();
  });

  it("returns null for an undefined href", () => {
    expect(citationIndexFromHref(undefined)).toBeNull();
  });

  it("returns null for a malformed citation href", () => {
    expect(citationIndexFromHref("#cite-abc")).toBeNull();
    expect(citationIndexFromHref("#cite-0")).toBeNull();
  });
});
