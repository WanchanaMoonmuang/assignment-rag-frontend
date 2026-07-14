import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import { API_BASE_URL } from "../api/client";

export const server = setupServer(
  http.get(API_BASE_URL + "/config", () => HttpResponse.json({ rag_top_k: { default: 5, min: 0, max: 20 }, max_upload_bytes: 20971520, supported_file_extensions: ["txt", "pdf", "docx", "csv", "json"] })),
  http.get(API_BASE_URL + "/conversations", () => HttpResponse.json({ conversations: [] })),
  http.get(API_BASE_URL + "/conversations/:id", ({ params }) => HttpResponse.json({ conversation_id: params.id, title: "Conversation", messages: [] })),
  http.get(API_BASE_URL + "/documents", () => HttpResponse.json({ documents: [] })),
);
