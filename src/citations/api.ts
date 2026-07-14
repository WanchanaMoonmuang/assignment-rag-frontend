import { apiRequest, apiRequestBlob } from "../api/client";
import type { CitedChunkResponse } from "./types";

export const citationKeys = { detail: (documentId: string, chunkId: string) => ["cited-chunk", documentId, chunkId] as const };

export const getCitedChunk = (documentId: string, chunkId: string) =>
  apiRequest<CitedChunkResponse>(`/documents/${documentId}/chunks/${chunkId}`);

export const getOriginalFileBlob = (documentId: string) => apiRequestBlob(`/documents/${documentId}/file`);
