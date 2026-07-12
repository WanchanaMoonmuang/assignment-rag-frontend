import { apiRequest } from "../api/client";
import type { DocumentSummary, IngestDocumentRequest } from "./types";

export const documentKeys = { all: ["documents"] as const };
export const getDocuments = () => apiRequest<{ documents: DocumentSummary[] }>("/documents");
export const ingestDocument = (payload: IngestDocumentRequest) => apiRequest<{ document_id: string; document_name: string; chunks_created: number }>("/ingest", { method: "POST", body: payload });
export const deleteDocument = (id: string) => apiRequest<{ status: string }>("/documents/" + id, { method: "DELETE" });
