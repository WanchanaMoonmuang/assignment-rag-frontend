export type IngestionStatus = "queued" | "processing" | "completed" | "failed";
export type IngestionStage = "queued" | "converting" | "extracting" | "chunking" | "embedding" | "finalizing" | "failed";

export interface IngestionJobError {
  code: string;
  message: string;
}

export interface IngestionJob {
  job_id: string;
  document_id: string;
  document_name: string;
  status: IngestionStatus;
  stage: IngestionStage | null;
  error: IngestionJobError | null;
}

export interface DocumentSummary {
  document_id: string;
  document_name: string;
  source: string;
  chunks_count: number;
  created_at: string;
  updated_at: string;
}
