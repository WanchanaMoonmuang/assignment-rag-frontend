import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import { API_BASE_URL } from "../api/client";

export const server = setupServer(
  http.get(API_BASE_URL + "/conversations", () => HttpResponse.json({ conversations: [] })),
  http.get(API_BASE_URL + "/conversations/:id", ({ params }) => HttpResponse.json({ conversation_id: params.id, title: "Conversation", messages: [] })),
  http.get(API_BASE_URL + "/documents", () => HttpResponse.json({ documents: [] })),
);
