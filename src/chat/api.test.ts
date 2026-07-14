import { describe, expect, it, vi } from "vitest";

import { API_BASE_URL, configureApiAuth } from "../api/client";
import { streamChat } from "./api";

function streamResponse(body: string) {
  return new Response(body, { headers: { "content-type": "text/event-stream" } });
}

describe("streamChat", () => {
  it("parses SSE events and requires completion", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse('event: conversation\ndata: {"conversation_id":"c1","title":"Question"}\n\nevent: metadata\ndata: {"request_id":"r1","top_k":5}\n\nevent: token\ndata: {"text":"Answer"}\n\nevent: done\ndata: {"status":"completed"}\n\n'));
    const events: string[] = [];
    await streamChat("Question", null, 5, (event) => events.push(event.type));
    expect(events).toEqual(["conversation", "metadata", "token", "done"]);
    expect(fetchMock).toHaveBeenCalledWith(API_BASE_URL + "/chat/stream", expect.objectContaining({ method: "POST" }));
    fetchMock.mockRestore();
  });

  it("sends the selected top_k in the request body", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse('event: done\ndata: {"status":"completed"}\n\n'));
    await streamChat("Question", "c1", 0, () => undefined);
    const [, requestInit] = fetchMock.mock.calls[0] ?? [];
    const body: unknown = JSON.parse((requestInit as RequestInit).body as string);
    expect(body).toMatchObject({ question: "Question", conversation_id: "c1", top_k: 0 });
    fetchMock.mockRestore();
  });

  it("parses tool_call and tool_result events", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse('event: tool_call\ndata: {"name":"calculator","status":"requested"}\n\nevent: tool_result\ndata: {"name":"calculator","status":"completed","display_value":"42"}\n\nevent: done\ndata: {"status":"completed"}\n\n'));
    const events: string[] = [];
    await streamChat("Question", null, 5, (event) => events.push(event.type));
    expect(events).toEqual(["tool_call", "tool_result", "done"]);
    fetchMock.mockRestore();
  });

  it("rejects a stream that ends without done", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse('event: token\ndata: {"text":"partial"}\n\n'));
    await expect(streamChat("Question", null, 5, () => undefined)).rejects.toThrow("ended before completion");
    fetchMock.mockRestore();
  });

  it("expires the session when stream setup returns 401", async () => {
    const onUnauthorized = vi.fn();
    const reset = configureApiAuth({ getToken: () => "expired", onUnauthorized });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ detail: "Invalid token" }), { status: 401, headers: { "content-type": "application/json" } }));
    await expect(streamChat("Question", null, 5, () => undefined)).rejects.toThrow("Invalid token");
    expect(onUnauthorized).toHaveBeenCalledOnce();
    fetchMock.mockRestore();
    reset();
  });

  it("parses fragmented events and rejects SSE errors", async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(encoder.encode('event: token\ndata: {"text":"A"}\n\nevent: err')); controller.enqueue(encoder.encode('or\ndata: {"message":"Failed"}\n\n')); controller.close(); } });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(body, { headers: { "content-type": "text/event-stream" } }));
    await expect(streamChat("Question", null, 5, () => undefined)).rejects.toThrow("Failed");
    fetchMock.mockRestore();
  });
});
