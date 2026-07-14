export interface SourceLocation {
  type: "line" | "page" | "row" | "record" | "section" | "dataset";
  start?: number;
  end?: number;
  label?: string;
}

export interface Source {
  document_id: string;
  document_name: string;
  chunk_id: string;
  snippet: string;
  score: number;
  source_format?: string;
  chunk_type?: string;
  location?: SourceLocation;
  metadata?: Record<string, unknown>;
}

export interface ToolActivity {
  name: string;
  arguments?: Record<string, unknown>;
  result?: unknown;
  error?: string;
  // Present on the streamed `tool_result` event; not persisted.
  status?: "requested" | "completed" | "failed";
  display_value?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  created_at?: string;
  sources?: Source[];
  tool_activity?: ToolActivity[];
  status?: "streaming" | "failed";
}

export interface ConversationSummary {
  conversation_id: string;
  title: string;
  created_at?: string;
  updated_at?: string;
  last_message_preview?: string;
}

export interface ConversationDetail {
  conversation_id: string;
  title: string;
  messages: ChatMessage[];
}
