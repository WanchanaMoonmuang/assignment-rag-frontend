export interface Source {
  document_id: string;
  document_name: string;
  chunk_id: string;
  snippet: string;
  score: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  created_at?: string;
  sources?: Source[];
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
