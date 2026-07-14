import { apiRequest, apiRequestFormData } from "../api/client";
import type { DocumentSummary, IngestionJob } from "./types";

export const documentKeys = { all: ["documents"] as const };
export const jobKeys = { detail: (jobId: string) => ["ingestion-job", jobId] as const };

export const getDocuments = () => apiRequest<{ documents: DocumentSummary[] }>("/documents");
export const deleteDocument = (id: string) => apiRequest<{ status: string }>("/documents/" + id, { method: "DELETE" });

export interface TextIngestionRequest {
  document_name: string;
  content: string;
  metadata?: Record<string, string>;
}

export const startTextIngestion = (payload: TextIngestionRequest) =>
  apiRequest<IngestionJob>("/ingestions/text", { method: "POST", body: payload });

export function startFileIngestion(file: File, metadata?: Record<string, string>) {
  const formData = new FormData();
  formData.append("file", file);
  if (metadata && Object.keys(metadata).length > 0) formData.append("metadata_json", JSON.stringify(metadata));
  return apiRequestFormData<IngestionJob>("/ingestions/file", formData);
}

export const getIngestionJob = (jobId: string) => apiRequest<IngestionJob>(`/ingestions/${jobId}`);

export const isTerminalIngestionStatus = (status: IngestionJob["status"]) => status === "completed" || status === "failed";
