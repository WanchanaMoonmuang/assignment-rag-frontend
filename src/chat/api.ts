import { createParser } from "eventsource-parser";

import { API_BASE_URL, ApiError, apiRequest, handleUnauthorizedResponse, parseApiError } from "../api/client";
import { tokenStorage } from "../auth/storage";
import type { ConversationDetail, ConversationSummary, Source, ToolActivity } from "./types";

export const conversationKeys = {
  all: ["conversations"] as const,
  detail: (id: string) => ["conversations", id] as const,
};

export const getConversations = () => apiRequest<{ conversations: ConversationSummary[] }>("/conversations");
export const getConversation = (id: string) => apiRequest<ConversationDetail>(`/conversations/${id}`);
export const deleteConversation = (id: string) => apiRequest<{ status: string }>(`/conversations/${id}`, { method: "DELETE" });

export type StreamEvent =
  | { type: "conversation"; conversation_id: string; title: string }
  | { type: "metadata"; request_id: string; top_k: number }
  | { type: "token"; text: string }
  | { type: "tool_call"; activity: ToolActivity }
  | { type: "tool_result"; activity: ToolActivity }
  | { type: "sources"; sources: Source[] }
  | { type: "done" }
  | { type: "error"; message: string };

export async function streamChat(
  question: string,
  conversationId: string | null,
  topK: number,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const token = tokenStorage.get();
  const response = await fetch(`${API_BASE_URL}/chat/stream`, {
    method: "POST",
    headers: { Accept: "text/event-stream", "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ conversation_id: conversationId, question, top_k: topK }),
    signal,
  });
  if (!response.ok) {
    if (response.status === 401) handleUnauthorizedResponse();
    throw await parseApiError(response);
  }
  if (!response.headers.get("content-type")?.includes("text/event-stream") || !response.body) {
    throw new ApiError(response.status, "The server returned an invalid streaming response.");
  }

  let streamErrorMessage: string | null = null;
  let receivedDone = false;
  const parser = createParser({ onEvent(event) {
    try {
      const data: unknown = JSON.parse(event.data);
      if (event.event === "conversation" && typeof data === "object" && data && "conversation_id" in data && "title" in data) onEvent({ type: "conversation", conversation_id: String(data.conversation_id), title: String(data.title) });
      if (event.event === "metadata" && typeof data === "object" && data && "request_id" in data && "top_k" in data) onEvent({ type: "metadata", request_id: String(data.request_id), top_k: Number(data.top_k) });
      if (event.event === "token" && typeof data === "object" && data && "text" in data) onEvent({ type: "token", text: String(data.text) });
      if (event.event === "tool_call" && typeof data === "object" && data && "name" in data) onEvent({ type: "tool_call", activity: data as ToolActivity });
      if (event.event === "tool_result" && typeof data === "object" && data && "name" in data) onEvent({ type: "tool_result", activity: data as ToolActivity });
      if (event.event === "sources" && Array.isArray(data)) onEvent({ type: "sources", sources: data as Source[] });
      if (event.event === "done") { receivedDone = true; onEvent({ type: "done" }); }
      if (event.event === "error" && typeof data === "object" && data && "message" in data) { streamErrorMessage = String(data.message); onEvent({ type: "error", message: String(data.message) }); }
    } catch { streamErrorMessage = "The streamed response could not be read."; }
  }});
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.feed(decoder.decode(value, { stream: true }));
  }
  parser.feed(decoder.decode());
  if (streamErrorMessage) throw new ApiError(502, streamErrorMessage);
  if (!receivedDone) throw new ApiError(502, "The response stream ended before completion.");
}
