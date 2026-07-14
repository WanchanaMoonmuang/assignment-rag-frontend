// Turns inline citation markers like "[1]" into markdown links to a synthetic
// "#cite-N" fragment, ONLY when N is a valid 1-based index into the message's
// sources. Anything else (e.g. "[42]" with only 3 sources, or non-numeric
// brackets) is left as plain text. The resulting markdown is rendered through
// the same sanitized pipeline as the rest of the answer, so this never
// introduces raw HTML. The link text uses a doubled bracket, "[[1]](#cite-1)",
// because a bare "[1](#cite-1)" would have markdown strip the brackets from
// the rendered text, leaving just "1" and losing the visible marker.
export function linkifyCitations(content: string, sourceCount: number): string {
  if (sourceCount <= 0) return content;
  return content.replace(/\[(\d+)\]/g, (match, numStr: string) => {
    const index = Number(numStr);
    return index >= 1 && index <= sourceCount ? `[[${numStr}]](#cite-${index})` : match;
  });
}

export const CITATION_HREF_PREFIX = "#cite-";

export function citationIndexFromHref(href: string | undefined): number | null {
  if (!href?.startsWith(CITATION_HREF_PREFIX)) return null;
  const index = Number(href.slice(CITATION_HREF_PREFIX.length));
  return Number.isInteger(index) && index >= 1 ? index : null;
}
