import { describe, expect, it, vi } from "vitest";

import { API_BASE_URL, configureApiAuth } from "../api/client";
import { streamChat } from "./api";

function streamResponse(body: string) {
  return new Response(body, { headers: { "content-type": "text/event-stream" } });
}

describe("streamChat", () => {
  it("parses SSE events and requires completion", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse('event: conversation\ndata: {"conversation_id":"c1","title":"Question"}\n\nevent: token\ndata: {"text":"Answer"}\n\nevent: done\ndata: {"status":"completed"}\n\n'));
    const events: string[] = [];
    await streamChat("Question", null, (event) => events.push(event.type));
    expect(events).toEqual(["conversation", "token", "done"]);
    expect(fetchMock).toHaveBeenCalledWith(API_BASE_URL + "/chat/stream", expect.objectContaining({ method: "POST" }));
    fetchMock.mockRestore();
  });

  it("rejects a stream that ends without done", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse('event: token\ndata: {"text":"partial"}\n\n'));
    await expect(streamChat("Question", null, () => undefined)).rejects.toThrow("ended before completion");
    fetchMock.mockRestore();
  });

  it("expires the session when stream setup returns 401", async () => {
    const onUnauthorized = vi.fn();
    const reset = configureApiAuth({ getToken: () => "expired", onUnauthorized });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ detail: "Invalid token" }), { status: 401, headers: { "content-type": "application/json" } }));
    await expect(streamChat("Question", null, () => undefined)).rejects.toThrow("Invalid token");
    expect(onUnauthorized).toHaveBeenCalledOnce();
    fetchMock.mockRestore();
    reset();
  });

  it("parses fragmented events and rejects SSE errors", async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(encoder.encode('event: token\ndata: {"text":"A"}\n\nevent: err')); controller.enqueue(encoder.encode('or\ndata: {"message":"Failed"}\n\n')); controller.close(); } });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(body, { headers: { "content-type": "text/event-stream" } }));
    await expect(streamChat("Question", null, () => undefined)).rejects.toThrow("Failed");
    fetchMock.mockRestore();
  });
});
