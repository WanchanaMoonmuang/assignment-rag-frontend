import type { SourceLocation } from "../chat/types";

export interface CitedChunk {
  chunk_id: string;
  content: string;
  chunk_index: number;
  location: SourceLocation | null;
  metadata?: Record<string, unknown>;
}

export interface ChunkNeighbor {
  chunk_id: string;
  content: string;
  chunk_index: number;
  location: SourceLocation | null;
}

export interface CitedChunkResponse {
  document_id: string;
  chunk: CitedChunk;
  neighbors: ChunkNeighbor[];
}
