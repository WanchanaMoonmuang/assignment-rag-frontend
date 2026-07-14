import { http, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { API_BASE_URL } from "../api/client";
import { ChatWorkspace } from "./ChatWorkspace";
import { renderApp } from "../test/render";
import { server } from "../test/server";

describe("ChatWorkspace", () => {
  it("shows sources after the stream completes", async () => {
    server.use(http.post(API_BASE_URL + "/chat/stream", () => new HttpResponse('event: conversation\ndata: {"conversation_id":"c1","title":"Policy"}\n\nevent: token\ndata: {"text":"Answer"}\n\nevent: sources\ndata: [{"document_id":"d1","document_name":"policy.txt","chunk_id":"k1","snippet":"Refund within 30 days","score":0.9}]\n\nevent: done\ndata: {"status":"completed"}\n\n', { headers: { "content-type": "text/event-stream" } })));
    const user = userEvent.setup();
    renderApp(<ChatWorkspace />);
    const input = screen.getByRole("textbox", { name: "Question" });
    await user.type(input, "What is the policy?");
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    expect(input).toHaveValue("What is the policy?\n");
    const send = screen.getByRole("button", { name: "Send message" });
    await waitFor(() => expect(send).toBeEnabled());
    await user.keyboard("{Enter}");
    expect(await screen.findByText("Sources (1)")).toBeInTheDocument();
    expect(screen.getByText(/Refund within 30 days/)).toBeInTheDocument();
  });

  it("opens the source drawer from an inline [1] citation marker", async () => {
    server.use(
      http.post(API_BASE_URL + "/chat/stream", () => new HttpResponse('event: conversation\ndata: {"conversation_id":"c1","title":"Policy"}\n\nevent: token\ndata: {"text":"Refunds take 30 days [1]."}\n\nevent: sources\ndata: [{"document_id":"d1","document_name":"policy.txt","chunk_id":"k1","snippet":"Refunds are processed within 30 days.","score":0.9,"source_format":"txt"}]\n\nevent: done\ndata: {"status":"completed"}\n\n', { headers: { "content-type": "text/event-stream" } })),
      http.get(API_BASE_URL + "/documents/d1/chunks/k1", () => HttpResponse.json({ document_id: "d1", chunk: { chunk_id: "k1", content: "Refunds are processed within 30 days.", chunk_index: 1, location: null }, neighbors: [] })),
    );
    const user = userEvent.setup();
    renderApp(<ChatWorkspace />);
    await user.type(screen.getByRole("textbox", { name: "Question" }), "What is the refund policy?");
    const send = screen.getByRole("button", { name: "Send message" });
    await waitFor(() => expect(send).toBeEnabled());
    await user.keyboard("{Enter}");
    await screen.findByText("Sources (1)");
    await user.click(screen.getByRole("button", { name: "[1]" }));
    expect(await screen.findByLabelText("Close source")).toBeInTheDocument();
    expect(screen.getAllByText("policy.txt").length).toBeGreaterThan(0);
  });

  it("opens the source drawer from clicking a source in the disclosure list", async () => {
    server.use(
      http.post(API_BASE_URL + "/chat/stream", () => new HttpResponse('event: conversation\ndata: {"conversation_id":"c1","title":"Policy"}\n\nevent: token\ndata: {"text":"Answer."}\n\nevent: sources\ndata: [{"document_id":"d1","document_name":"policy.txt","chunk_id":"k1","snippet":"Refunds are processed within 30 days.","score":0.9,"source_format":"txt"}]\n\nevent: done\ndata: {"status":"completed"}\n\n', { headers: { "content-type": "text/event-stream" } })),
      http.get(API_BASE_URL + "/documents/d1/chunks/k1", () => HttpResponse.json({ document_id: "d1", chunk: { chunk_id: "k1", content: "Refunds are processed within 30 days.", chunk_index: 1, location: null }, neighbors: [] })),
    );
    const user = userEvent.setup();
    renderApp(<ChatWorkspace />);
    await user.type(screen.getByRole("textbox", { name: "Question" }), "What is the refund policy?");
    const send = screen.getByRole("button", { name: "Send message" });
    await waitFor(() => expect(send).toBeEnabled());
    await user.keyboard("{Enter}");
    await user.click(await screen.findByText("Sources (1)"));
    await user.click(screen.getByText(/policy.txt/));
    expect(await screen.findByLabelText("Close source")).toBeInTheDocument();
  });

  it("renders persisted citations identically and lets them be clicked after reopening a conversation", async () => {
    server.use(
      http.get(API_BASE_URL + "/conversations", () => HttpResponse.json({ conversations: [{ conversation_id: "c1", title: "Policy", created_at: "2026-07-01T10:00:00Z", updated_at: "2026-07-01T10:05:00Z" }] })),
      http.get(API_BASE_URL + "/conversations/c1", () => HttpResponse.json({ conversation_id: "c1", title: "Policy", messages: [
        { role: "user", content: "What is the refund policy?" },
        { role: "assistant", content: "Refunds take 30 days [1].", sources: [{ document_id: "d1", document_name: "policy.txt", chunk_id: "k1", snippet: "Refunds are processed within 30 days.", score: 0.9, source_format: "txt" }] },
      ] })),
      http.get(API_BASE_URL + "/documents/d1/chunks/k1", () => HttpResponse.json({ document_id: "d1", chunk: { chunk_id: "k1", content: "Refunds are processed within 30 days.", chunk_index: 1, location: null }, neighbors: [] })),
    );
    const user = userEvent.setup();
    renderApp(<ChatWorkspace />);
    await user.click(await screen.findByText("Policy"));
    expect(await screen.findByText(/Refunds take 30 days/)).toBeInTheDocument();
    expect(await screen.findByText("Sources (1)")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "[1]" }));
    expect(await screen.findByLabelText("Close source")).toBeInTheDocument();
  });

  it("initializes the Top K slider from backend config default", async () => {
    server.use(http.get(API_BASE_URL + "/config", () => HttpResponse.json({ rag_top_k: { default: 7, min: 0, max: 20 }, max_upload_bytes: 20971520, supported_file_extensions: ["txt"] })));
    renderApp(<ChatWorkspace />);
    expect(await screen.findByText("Retrieved chunks (Top K): 7")).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /Retrieved chunks/ })).toHaveAttribute("aria-valuenow", "7");
  });

  it("restores persisted history after a stream ends early", async () => {
    server.use(
      http.post(API_BASE_URL + "/chat/stream", () => new HttpResponse('event: conversation\ndata: {"conversation_id":"c1","title":"Policy"}\n\nevent: token\ndata: {"text":"partial"}\n\n', { headers: { "content-type": "text/event-stream" } })),
      http.get(API_BASE_URL + "/conversations/c1", () => HttpResponse.json({ conversation_id: "c1", title: "Policy", messages: [{ role: "user", content: "What is the policy?" }, { role: "assistant", content: "Saved answer" }] })),
    );
    const user = userEvent.setup();
    renderApp(<ChatWorkspace />);
    await user.type(screen.getByRole("textbox", { name: "Question" }), "What is the policy?");
    await user.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByText("Saved answer")).toBeInTheDocument();
  });

  it("restores the draft after a deterministic stream failure", async () => {
    server.use(http.post(API_BASE_URL + "/chat/stream", () => HttpResponse.json({ detail: "Invalid question" }, { status: 422 })));
    const user = userEvent.setup();
    renderApp(<ChatWorkspace />);
    const input = screen.getByRole("textbox", { name: "Question" });
    await user.type(input, "Retry this");
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid question");
    expect(input).toHaveValue("Retry this");
  });

  it("confirms and completes conversation deletion", async () => {
    let deleted = false;
    server.use(
      http.get(API_BASE_URL + "/conversations", () => HttpResponse.json({ conversations: deleted ? [] : [{ conversation_id: "c1", title: "Policy", created_at: "2026-07-01T10:00:00Z", updated_at: "2026-07-01T10:05:00Z" }] })),
      http.delete(API_BASE_URL + "/conversations/c1", () => { deleted = true; return HttpResponse.json({ status: "success" }); }),
    );
    const user = userEvent.setup();
    renderApp(<ChatWorkspace />);
    await user.click(await screen.findByLabelText("Delete Policy"));
    expect(screen.getByRole("dialog")).toHaveTextContent("Delete conversation?");
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByLabelText("Delete Policy")).not.toBeInTheDocument());
  });
});
