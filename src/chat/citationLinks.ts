// Turns inline citation markers like "[1]" or a comma-separated group like
// "[2, 7]" into markdown links to a synthetic "#cite-N" fragment, one link per
// number, ONLY when N is a valid 1-based index into the message's sources.
// Each invalid number (e.g. "[42]" with only 3 sources) is left as plain text;
// non-numeric brackets aren't matched at all. The resulting markdown is
// rendered through the same sanitized pipeline as the rest of the answer, so
// this never introduces raw HTML. The link text uses a doubled bracket,
// "[[1]](#cite-1)", because a bare "[1](#cite-1)" would have markdown strip
// the brackets from the rendered text, leaving just "1" and losing the
// visible marker.
export function linkifyCitations(content: string, sourceCount: number): string {
  if (sourceCount <= 0) return content;
  return content.replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, (_match, group: string) => {
    return group
      .split(",")
      .map((part) => part.trim())
      .map((numStr) => {
        const index = Number(numStr);
        return index >= 1 && index <= sourceCount ? `[[${numStr}]](#cite-${index})` : `[${numStr}]`;
      })
      .join(", ");
  });
}

export const CITATION_HREF_PREFIX = "#cite-";

export function citationIndexFromHref(href: string | undefined): number | null {
  if (!href?.startsWith(CITATION_HREF_PREFIX)) return null;
  const index = Number(href.slice(CITATION_HREF_PREFIX.length));
  return Number.isInteger(index) && index >= 1 ? index : null;
}
