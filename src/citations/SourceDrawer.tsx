import CloseRounded from "@mui/icons-material/CloseRounded";
import { Alert, Box, CircularProgress, Divider, Drawer, IconButton, Stack, Tab, Tabs, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type SyntheticEvent } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import type { Source } from "../chat/types";
import { citationKeys, getCitedChunk, getOriginalFileBlob } from "./api";

function ExtractedContent({ source }: { source: Source }) {
  const detail = useQuery({
    queryKey: citationKeys.detail(source.document_id, source.chunk_id),
    queryFn: () => getCitedChunk(source.document_id, source.chunk_id),
  });

  if (detail.isLoading) return <Stack sx={{ alignItems: "center", pt: 4 }}><CircularProgress aria-label="Loading source content" /></Stack>;

  if (detail.isError || !detail.data) {
    return <Stack spacing={2}>
      <Alert severity="warning">Unable to load surrounding content. Showing the saved excerpt instead.</Alert>
      <Typography component="p">{source.snippet}</Typography>
    </Stack>;
  }

  const neighbors = [...detail.data.neighbors].sort((a, b) => a.chunk_index - b.chunk_index);
  // Adjacent chunks are split with overlap for retrieval quality, so the start
  // of a chunk often repeats the tail of the previous one; strip that before
  // display. ponytail: naive char-level suffix/prefix match capped at 400
  // chars; upgrade to a real diff if chunk_overlap ever exceeds that.
  const displayItems = neighbors.reduce<{ neighbor: (typeof neighbors)[number]; displayContent: string }[]>(
    (items, neighbor) => {
      const previousContent = items.at(-1)?.neighbor.content ?? "";
      return [...items, { neighbor, displayContent: stripLeadingOverlap(previousContent, neighbor.content) }];
    },
    [],
  );
  return <Stack spacing={2}>
    {displayItems.map(({ neighbor, displayContent }) => {
      const cited = neighbor.chunk_id === source.chunk_id;
      const body = <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>{displayContent}</ReactMarkdown>;
      return cited
        ? <Box key={neighbor.chunk_id} component="mark" aria-label="Cited passage" sx={{ display: "block", bgcolor: "action.hover", borderLeft: 3, borderColor: "primary.main", color: "text.primary", px: 3, py: 2 }}>{body}</Box>
        : <Box key={neighbor.chunk_id} sx={{ color: "text.secondary", px: 1 }}>{body}</Box>;
    })}
  </Stack>;
}

function stripLeadingOverlap(previous: string, current: string): string {
  const maxCheck = Math.min(previous.length, current.length, 400);
  for (let length = maxCheck; length > 0; length--) {
    if (previous.slice(-length) === current.slice(0, length)) return current.slice(length);
  }
  return current;
}

// Keyed by source.document_id from the caller so a new document mounts a fresh
// instance instead of needing an effect to reset loading/error state.
function OriginalFileViewer({ source }: { source: Source }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;
    getOriginalFileBlob(source.document_id)
      .then((blob) => {
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setBlobUrl(createdUrl);
      })
      .catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : "Unable to load the original file."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [source.document_id]);

  if (loading) return <Stack sx={{ alignItems: "center", pt: 4 }}><CircularProgress aria-label="Loading original file" /></Stack>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!blobUrl) return null;
  const page = source.location?.start ?? 1;
  return <Box component="iframe" title={`${source.document_name} original`} src={`${blobUrl}#page=${page}`} sx={{ width: "100%", height: "100%", minHeight: 400, border: 0 }} />;
}

// Keyed by source.chunk_id from the caller so a new citation mounts a fresh
// instance (tab reset to 0) instead of needing an effect to reset tab state.
function SourceDrawerContent({ source }: { source: Source }) {
  const [tab, setTab] = useState(0);
  const isPdf = source.source_format === "pdf";
  return <>
    {isPdf ? <Tabs value={tab} onChange={(_event: SyntheticEvent, value: number) => setTab(value)} variant="fullWidth" aria-label="Source views"><Tab label="Content" /><Tab label="Original" /></Tabs> : null}
    <Box sx={{ flex: 1, overflowY: "auto", p: 3, minHeight: 0 }}>
      {tab === 0 || !isPdf ? <ExtractedContent source={source} /> : <OriginalFileViewer source={source} />}
    </Box>
  </>;
}

export function SourceDrawer({ source, onClose }: { source: Source | null; onClose: () => void }) {
  return <Drawer anchor="right" open={Boolean(source)} onClose={onClose} slotProps={{ paper: { sx: { width: { xs: "100%", sm: 420 }, maxWidth: "100vw", display: "flex", flexDirection: "column" } } }}>
    <Stack direction="row" sx={{ height: 64, px: 3, alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
      <Stack sx={{ minWidth: 0 }}>
        <Typography variant="h3" noWrap>{source?.document_name}</Typography>
        <Typography variant="caption" color="text.secondary" noWrap title={source?.location?.label}>{source ? `${source.location?.label ?? "Location unavailable"} · Score ${source.score.toFixed(3)}` : ""}</Typography>
      </Stack>
      <IconButton aria-label="Close source" onClick={onClose}><CloseRounded /></IconButton>
    </Stack>
    <Divider />
    {source ? <SourceDrawerContent key={source.chunk_id} source={source} /> : null}
  </Drawer>;
}
