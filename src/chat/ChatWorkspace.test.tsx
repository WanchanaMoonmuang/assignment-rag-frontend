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

  it("shows calculator tool activity while streaming, then the resolved result", async () => {
    server.use(http.post(API_BASE_URL + "/chat/stream", () => new HttpResponse(
      'event: conversation\ndata: {"conversation_id":"c1","title":"Math"}\n\n' +
      'event: tool_call\ndata: {"name":"calculator","status":"requested"}\n\n' +
      'event: tool_result\ndata: {"name":"calculator","status":"completed","display_value":"4183"}\n\n' +
      'event: token\ndata: {"text":"47 times 89 is 4183."}\n\n' +
      'event: done\ndata: {"status":"completed"}\n\n',
      { headers: { "content-type": "text/event-stream" } },
    )));
    const user = userEvent.setup();
    renderApp(<ChatWorkspace />);
    await user.type(screen.getByRole("textbox", { name: "Question" }), "What is 47 times 89?");
    await user.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByText("Calculator: 4183")).toBeInTheDocument();
    expect(screen.getByText(/47 times 89 is 4183/)).toBeInTheDocument();
  });

  it("shows a controlled error for an invalid calculator expression", async () => {
    server.use(http.post(API_BASE_URL + "/chat/stream", () => new HttpResponse(
      'event: conversation\ndata: {"conversation_id":"c1","title":"Math"}\n\n' +
      'event: tool_call\ndata: {"name":"calculator","status":"requested"}\n\n' +
      'event: tool_result\ndata: {"name":"calculator","status":"failed","display_value":"Calculation failed"}\n\n' +
      'event: token\ndata: {"text":"I could not evaluate that expression."}\n\n' +
      'event: done\ndata: {"status":"completed"}\n\n',
      { headers: { "content-type": "text/event-stream" } },
    )));
    const user = userEvent.setup();
    renderApp(<ChatWorkspace />);
    await user.type(screen.getByRole("textbox", { name: "Question" }), "Calculate 1 / 0 * banana");
    await user.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByText(/Calculator error/)).toBeInTheDocument();
  });

  it("pairs multiple calculator calls in one turn with their own results", async () => {
    server.use(http.post(API_BASE_URL + "/chat/stream", () => new HttpResponse(
      'event: conversation\ndata: {"conversation_id":"c1","title":"Math"}\n\n' +
      'event: tool_call\ndata: {"name":"calculator","status":"requested"}\n\n' +
      'event: tool_result\ndata: {"name":"calculator","status":"completed","display_value":"10"}\n\n' +
      'event: tool_call\ndata: {"name":"calculator","status":"requested"}\n\n' +
      'event: tool_result\ndata: {"name":"calculator","status":"completed","display_value":"20"}\n\n' +
      'event: token\ndata: {"text":"Both results are ready."}\n\n' +
      'event: done\ndata: {"status":"completed"}\n\n',
      { headers: { "content-type": "text/event-stream" } },
    )));
    const user = userEvent.setup();
    renderApp(<ChatWorkspace />);
    await user.type(screen.getByRole("textbox", { name: "Question" }), "Calculate 5+5 and 10+10");
    await user.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByText("Calculator: 10")).toBeInTheDocument();
    expect(screen.getByText("Calculator: 20")).toBeInTheDocument();
  });

  it("restores persisted tool activity identically after reopening a conversation", async () => {
    server.use(
      http.get(API_BASE_URL + "/conversations", () => HttpResponse.json({ conversations: [{ conversation_id: "c1", title: "Math", created_at: "2026-07-01T10:00:00Z", updated_at: "2026-07-01T10:05:00Z" }] })),
      http.get(API_BASE_URL + "/conversations/c1", () => HttpResponse.json({ conversation_id: "c1", title: "Math", messages: [
        { role: "user", content: "What is 47 times 89?" },
        { role: "assistant", content: "47 times 89 is 4183.", tool_activity: [{ name: "calculator", arguments: { expression: "47*89" }, result: 4183 }] },
      ] })),
    );
    const user = userEvent.setup();
    renderApp(<ChatWorkspace />);
    await user.click(await screen.findByText("Math"));
    expect(await screen.findByText("Calculator (expression: 47*89): 4183")).toBeInTheDocument();
  });

  it("renders a hypothetical future tool it has never seen before, without any calculator-specific assumption", async () => {
    server.use(http.post(API_BASE_URL + "/chat/stream", () => new HttpResponse(
      'event: conversation\ndata: {"conversation_id":"c1","title":"Weather"}\n\n' +
      'event: tool_call\ndata: {"name":"weather_lookup","status":"requested"}\n\n' +
      'event: tool_result\ndata: {"name":"weather_lookup","status":"completed","display_value":"72F, clear"}\n\n' +
      'event: token\ndata: {"text":"It is 72F and clear."}\n\n' +
      'event: done\ndata: {"status":"completed"}\n\n',
      { headers: { "content-type": "text/event-stream" } },
    )));
    const user = userEvent.setup();
    renderApp(<ChatWorkspace />);
    await user.type(screen.getByRole("textbox", { name: "Question" }), "What's the weather?");
    await user.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByText("Weather lookup: 72F, clear")).toBeInTheDocument();
  });

  it("renders a hypothetical future tool's persisted activity with unrelated argument shapes generically", async () => {
    server.use(
      http.get(API_BASE_URL + "/conversations", () => HttpResponse.json({ conversations: [{ conversation_id: "c2", title: "Lookup", created_at: "2026-07-01T10:00:00Z", updated_at: "2026-07-01T10:05:00Z" }] })),
      http.get(API_BASE_URL + "/conversations/c2", () => HttpResponse.json({ conversation_id: "c2", title: "Lookup", messages: [
        { role: "user", content: "Find the customer" },
        { role: "assistant", content: "Found it.", tool_activity: [{ name: "customer_lookup", arguments: { customer_id: 42, active: true }, error: "Customer not found" }] },
      ] })),
    );
    const user = userEvent.setup();
    renderApp(<ChatWorkspace />);
    await user.click(await screen.findByText("Lookup"));
    expect(await screen.findByText("Customer lookup error: Customer not found")).toBeInTheDocument();
  });

  it("renders a boolean persisted tool result, not just string/number", async () => {
    server.use(
      http.get(API_BASE_URL + "/conversations", () => HttpResponse.json({ conversations: [{ conversation_id: "c3", title: "Availability", created_at: "2026-07-01T10:00:00Z", updated_at: "2026-07-01T10:05:00Z" }] })),
      http.get(API_BASE_URL + "/conversations/c3", () => HttpResponse.json({ conversation_id: "c3", title: "Availability", messages: [
        { role: "user", content: "Is X1 in stock?" },
        { role: "assistant", content: "Yes, it is.", tool_activity: [{ name: "availability_check", arguments: { sku: "X1" }, result: true }] },
      ] })),
    );
    const user = userEvent.setup();
    renderApp(<ChatWorkspace />);
    await user.click(await screen.findByText("Availability"));
    expect(await screen.findByText("Availability check (sku: X1): true")).toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByLabelText("Delete Policy")).not.toBeInTheDocument());
  });
});
