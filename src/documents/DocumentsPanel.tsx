import AddRounded from "@mui/icons-material/AddRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import RefreshRounded from "@mui/icons-material/RefreshRounded";
import UploadFileRounded from "@mui/icons-material/UploadFileRounded";
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Drawer, IconButton, List, ListItem, ListItemText, Stack, Tab, Tabs, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ChangeEvent, type MouseEvent, type SyntheticEvent, useEffect, useRef, useState } from "react";

import { useConfig } from "../config/api";
import { deleteDocument, documentKeys, getDocuments, getIngestionJob, isTerminalIngestionStatus, jobKeys, startFileIngestion, startTextIngestion } from "./api";
import type { DocumentSummary, IngestionJob } from "./types";

type MetadataRow = { key: string; value: string };
type Mode = "paste" | "upload";
function formatDate(value: string) { return new Date(value).toLocaleString(); }
function formatBytes(bytes: number) { return `${Math.round(bytes / (1024 * 1024))} MiB`; }

const STAGE_LABELS: Record<string, string> = { queued: "Queued", converting: "Converting", extracting: "Extracting", chunking: "Chunking", embedding: "Embedding", finalizing: "Finalizing" };
function jobStatusLabel(job: IngestionJob): string {
  if (job.status === "completed") return "Completed";
  if (job.status === "failed") return job.error?.message ?? "Failed";
  return job.stage ? (STAGE_LABELS[job.stage] ?? job.stage) : "Processing";
}

function IngestionJobRow({ jobId, documentName, onSettled, onDismiss }: { jobId: string; documentName: string; onSettled: () => void; onDismiss: () => void }) {
  const settledRef = useRef(false);
  const job = useQuery({
    queryKey: jobKeys.detail(jobId),
    queryFn: () => getIngestionJob(jobId),
    refetchInterval: (query) => (query.state.data && isTerminalIngestionStatus(query.state.data.status) ? false : 1500),
  });
  useEffect(() => {
    if (job.data && isTerminalIngestionStatus(job.data.status) && !settledRef.current) {
      settledRef.current = true;
      onSettled();
    }
  }, [job.data, onSettled]);
  const current = job.data;
  const terminal = current ? isTerminalIngestionStatus(current.status) : false;
  const failed = current?.status === "failed";
  return (
    <ListItem secondaryAction={terminal ? <IconButton aria-label={`Dismiss ${documentName}`} onClick={onDismiss}><CloseRounded /></IconButton> : undefined}>
      <ListItemText
        primary={documentName}
        secondary={<Typography component="span" variant="body2" color={failed ? "error" : "text.secondary"}>{current ? jobStatusLabel(current) : job.isError ? "Unable to load job status." : "Loading..."}</Typography>}
      />
      {!terminal ? <CircularProgress size={16} sx={{ ml: 2 }} aria-label={`${documentName} in progress`} /> : null}
    </ListItem>
  );
}

export function DocumentsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const config = useConfig();
  const [tab, setTab] = useState(0); const [mode, setMode] = useState<Mode>("paste"); const [name, setName] = useState(""); const [content, setContent] = useState(""); const [selectedFile, setSelectedFile] = useState<File | null>(null); const [metadata, setMetadata] = useState<MetadataRow[]>([]); const [notice, setNotice] = useState<string | null>(null); const [error, setError] = useState<string | null>(null); const [deleteTarget, setDeleteTarget] = useState<DocumentSummary | null>(null); const [activeJobs, setActiveJobs] = useState<{ jobId: string; documentName: string }[]>([]);
  const documents = useQuery({ queryKey: documentKeys.all, queryFn: getDocuments, enabled: open });

  // Success notices are transient status, not a permanent record - fade them on
  // their own rather than leaving the previous file's message up indefinitely
  // (and rather than adding a close "x" that could be mistaken for delete).
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  function resetForm() { setName(""); setContent(""); setSelectedFile(null); setMetadata([]); setMode("paste"); setTab(0); }
  function trackJob(job: IngestionJob) { setActiveJobs((jobs) => [...jobs, { jobId: job.job_id, documentName: job.document_name }]); }

  const textIngest = useMutation({ mutationFn: startTextIngestion, onSuccess: (job) => { setNotice(job.document_name + " queued for ingestion."); trackJob(job); resetForm(); }, onError: (caught) => setError(caught instanceof Error ? caught.message : "Unable to start ingestion.") });
  const fileIngest = useMutation({ mutationFn: ({ file, metadata: meta }: { file: File; metadata: Record<string, string> }) => startFileIngestion(file, meta), onSuccess: (job) => { setNotice(job.document_name + " queued for ingestion."); trackJob(job); resetForm(); }, onError: (caught) => setError(caught instanceof Error ? caught.message : "Unable to start ingestion.") });
  const pending = textIngest.isPending || fileIngest.isPending;
  const remove = useMutation({ mutationFn: deleteDocument, onSuccess: async () => { setNotice("Document deleted."); setDeleteTarget(null); await queryClient.invalidateQueries({ queryKey: documentKeys.all }); }, onError: (caught) => setError(caught instanceof Error ? caught.message : "Unable to delete document.") });

  function updateMetadata(index: number, field: keyof MetadataRow, value: string) { setMetadata((items) => items.map((item, current) => current === index ? { ...item, [field]: value } : item)); }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || pending) return;
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!config.supported_file_extensions.includes(extension)) { setError(`Unsupported file type. Supported: ${config.supported_file_extensions.join(", ")}.`); return; }
    if (file.size > config.max_upload_bytes) { setError(`File exceeds the ${formatBytes(config.max_upload_bytes)} limit.`); return; }
    setSelectedFile(file);
    if (!name.trim()) setName(file.name);
    setError(null);
  }

  function submit() {
    const trimmedName = name.trim();
    if (!trimmedName) { setError("Document name is required."); return; }
    const entries = metadata.filter((item) => item.key.trim());
    if (entries.some((item) => !item.value.trim()) || new Set(entries.map((item) => item.key.trim())).size !== entries.length) { setError("Metadata keys must be unique and values cannot be blank."); return; }
    const metadataObject = Object.fromEntries(entries.map((item) => [item.key.trim(), item.value]));

    if (mode === "upload") {
      if (!selectedFile) { setError("Choose a file to upload."); return; }
      if (selectedFile.size > config.max_upload_bytes) { setError(`File exceeds the ${formatBytes(config.max_upload_bytes)} limit.`); return; }
      setError(null); setNotice(null);
      fileIngest.mutate({ file: selectedFile, metadata: metadataObject });
      return;
    }

    const trimmedContent = content.trim();
    if (!trimmedContent) { setError("Document content is required."); return; }
    if (new TextEncoder().encode(trimmedContent).length > config.max_upload_bytes) { setError(`Content exceeds the ${formatBytes(config.max_upload_bytes)} limit.`); return; }
    setError(null); setNotice(null);
    textIngest.mutate({ document_name: trimmedName, content: trimmedContent, metadata: metadataObject });
  }

  return <Drawer anchor="right" open={open} onClose={onClose} slotProps={{ paper: { sx: { width: { xs: "100%", sm: 420 }, maxWidth: "100vw" } } }}><Stack sx={{ height: "100%" }}><Stack direction="row" sx={{ height: 64, px: 3, alignItems: "center", justifyContent: "space-between" }}><Typography variant="h3">Documents</Typography><Stack direction="row"><IconButton aria-label="Refresh documents" onClick={() => void documents.refetch()}><RefreshRounded /></IconButton><IconButton aria-label="Close documents" onClick={onClose}><CloseRounded /></IconButton></Stack></Stack><Divider /><Tabs value={tab} onChange={(_event: SyntheticEvent, value: number) => setTab(value)} variant="fullWidth" aria-label="Document views"><Tab label="Documents" /><Tab label="Add document" /></Tabs><Box sx={{ flex: 1, overflowY: "auto", p: 3 }}>{notice ? <Alert severity="success" sx={{ mb: 3 }}>{notice}</Alert> : null}{error ? <Alert severity="error" role="alert" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert> : null}{tab === 0 ? <Stack spacing={3}>{activeJobs.length ? <><List aria-label="Ingestion jobs in progress">{activeJobs.map((job) => <IngestionJobRow key={job.jobId} jobId={job.jobId} documentName={job.documentName} onSettled={() => void queryClient.invalidateQueries({ queryKey: documentKeys.all })} onDismiss={() => setActiveJobs((jobs) => jobs.filter((item) => item.jobId !== job.jobId))} />)}</List><Divider /></> : null}{documents.isLoading ? <Typography>Loading documents...</Typography> : null}{documents.isError ? <Alert severity="error" action={<Button color="inherit" onClick={() => void documents.refetch()}>Retry</Button>}>Unable to load documents.</Alert> : null}{documents.data?.documents.length === 0 && !activeJobs.length ? <Typography color="text.secondary">No documents have been ingested.</Typography> : null}<List aria-label="Documents">{documents.data?.documents.map((document) => <ListItem key={document.document_id} secondaryAction={<IconButton aria-label={"Delete " + document.document_name} onClick={() => setDeleteTarget(document)} disabled={remove.isPending}><DeleteOutlineRounded /></IconButton>}><ListItemText primary={document.document_name} secondary={[document.source, document.chunks_count + " chunks", "Created: " + formatDate(document.created_at), "Updated: " + formatDate(document.updated_at)].join(" | ")} /></ListItem>)}</List></Stack> : <Stack spacing={3}><ToggleButtonGroup exclusive value={mode} onChange={(_event: MouseEvent<HTMLElement>, value: Mode | null) => value && setMode(value)} fullWidth disabled={pending}><ToggleButton value="paste">Paste text</ToggleButton><ToggleButton value="upload">Upload file</ToggleButton></ToggleButtonGroup>{mode === "upload" ? <Stack spacing={1}><Button component="label" variant="outlined" startIcon={<UploadFileRounded />} disabled={pending}>{selectedFile ? selectedFile.name : "Choose file"}<input hidden type="file" accept={config.supported_file_extensions.map((ext) => "." + ext).join(",")} onChange={chooseFile} /></Button><Typography variant="caption" color="text.secondary">Supported: {config.supported_file_extensions.join(", ")}. Max {formatBytes(config.max_upload_bytes)}.</Typography></Stack> : null}<TextField label="Document name" value={name} disabled={pending} onChange={(event) => setName(event.target.value)} />{mode === "paste" ? <TextField label="Content" multiline minRows={8} value={content} disabled={pending} onChange={(event) => setContent(event.target.value)} /> : null}<Typography variant="subtitle2">Metadata</Typography>{metadata.map((item, index) => <Stack key={index} direction="row" spacing={2}><TextField label="Key" value={item.key} disabled={pending} onChange={(event) => updateMetadata(index, "key", event.target.value)} /><TextField fullWidth label="Value" value={item.value} disabled={pending} onChange={(event) => updateMetadata(index, "value", event.target.value)} /><IconButton aria-label="Remove metadata" disabled={pending} onClick={() => setMetadata((items) => items.filter((_, current) => current !== index))}><DeleteOutlineRounded /></IconButton></Stack>)}<Button variant="text" onClick={() => setMetadata((items) => [...items, { key: "", value: "" }])} disabled={pending}>Add metadata</Button><Button variant="contained" startIcon={pending ? <CircularProgress size={16} color="inherit" /> : <AddRounded />} onClick={submit} disabled={pending}>Ingest document</Button></Stack>}</Box></Stack><Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}><DialogTitle>Delete document?</DialogTitle><DialogContent><Typography>{deleteTarget?.document_name} and its chunks will no longer be available to answers.</Typography></DialogContent><DialogActions><Button autoFocus onClick={() => setDeleteTarget(null)}>Cancel</Button><Button color="error" onClick={() => deleteTarget && remove.mutate(deleteTarget.document_id)} disabled={remove.isPending}>Delete</Button></DialogActions></Dialog></Drawer>;
}
