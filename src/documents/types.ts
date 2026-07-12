export interface DocumentSummary {
  document_id: string;
  document_name: string;
  source: string;
  chunks_count: number;
  created_at: string;
  updated_at: string;
}

export interface IngestDocumentRequest {
  document_name: string;
  content: string;
  metadata?: Record<string, string>;
}
