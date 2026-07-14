export interface TopKConfig {
  default: number;
  min: number;
  max: number;
}

export interface AppConfig {
  rag_top_k: TopKConfig;
  max_upload_bytes: number;
  supported_file_extensions: string[];
}

// Used as a graceful fallback while `/api/config` is loading or if it fails.
// The backend remains authoritative; these mirror the documented V2 defaults.
export const FALLBACK_CONFIG: AppConfig = {
  rag_top_k: { default: 5, min: 0, max: 20 },
  max_upload_bytes: 20 * 1024 * 1024,
  supported_file_extensions: ["txt", "pdf", "docx", "csv", "json"],
};
