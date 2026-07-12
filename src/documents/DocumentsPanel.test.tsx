import { http, HttpResponse } from "msw";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { API_BASE_URL } from "../api/client";
import { renderApp } from "../test/render";
import { server } from "../test/server";
import { DocumentsPanel } from "./DocumentsPanel";

describe("DocumentsPanel", () => {
  it("ingests text and reports the created chunk count", async () => {
    server.use(http.post(API_BASE_URL + "/ingest", async ({ request }) => {
      expect(await request.json()).toMatchObject({ document_name: "Policy", content: "Refund terms", metadata: { source: "plain_text" } });
      return HttpResponse.json({ document_id: "d1", document_name: "Policy", chunks_created: 2 });
    }));
    const user = userEvent.setup();
    renderApp(<DocumentsPanel open onClose={() => undefined} />);
    await user.click(screen.getByRole("tab", { name: "Add document" }));
    await user.type(screen.getByLabelText("Document name"), "Policy");
    await user.type(screen.getByLabelText("Content"), "Refund terms");
    await user.click(screen.getByRole("button", { name: "Ingest document" }));
    expect(await screen.findByText("Policy ingested with 2 chunks.")).toBeInTheDocument();
  });

  it("deletes a document and refreshes the list", async () => {
    let deleted = false;
    server.use(
      http.get(API_BASE_URL + "/documents", () => HttpResponse.json({ documents: deleted ? [] : [{ document_id: "d1", document_name: "Policy", source: "plain_text", chunks_count: 2, created_at: "2026-07-01T10:00:00Z", updated_at: "2026-07-01T10:05:00Z" }] })),
      http.delete(API_BASE_URL + "/documents/d1", () => { deleted = true; return HttpResponse.json({ status: "success" }); }),
    );
    const user = userEvent.setup();
    renderApp(<DocumentsPanel open onClose={() => undefined} />);
    await user.click(await screen.findByLabelText("Delete Policy"));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByLabelText("Delete Policy")).not.toBeInTheDocument());
    expect(screen.getByText("Document deleted.")).toBeInTheDocument();
  });

  it("reads a valid txt file and rejects unsupported or oversized files", async () => {
    const user = userEvent.setup();
    renderApp(<DocumentsPanel open onClose={() => undefined} />);
    await user.click(screen.getByRole("tab", { name: "Add document" }));
    await user.click(screen.getByRole("button", { name: "Upload .txt" }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const invalid = new File(["x"], "policy.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [invalid] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("Only .txt files are supported.");
    const oversized = new File([new Uint8Array(1024 * 1024 + 1)], "large.txt", { type: "text/plain" });
    fireEvent.change(input, { target: { files: [oversized] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("1 MB or smaller");
    const valid = new File(["ignored"], "policy.txt", { type: "text/plain" });
    Object.defineProperty(valid, "text", { value: async () => "Refund terms" });
    fireEvent.change(input, { target: { files: [valid] } });
    await waitFor(() => expect(screen.getByLabelText("Document name")).toHaveValue("policy.txt"));
    expect(screen.getByLabelText("Content")).toHaveValue("Refund terms");
  });

  it("preserves user input after ingestion failure", async () => {
    server.use(http.post(API_BASE_URL + "/ingest", () => HttpResponse.json({ detail: "Embedding unavailable" }, { status: 502 })));
    const user = userEvent.setup();
    renderApp(<DocumentsPanel open onClose={() => undefined} />);
    await user.click(screen.getByRole("tab", { name: "Add document" }));
    await user.type(screen.getByLabelText("Document name"), "Policy");
    await user.type(screen.getByLabelText("Content"), "Refund terms");
    await user.click(screen.getByRole("button", { name: "Ingest document" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Embedding unavailable");
    expect(screen.getByLabelText("Document name")).toHaveValue("Policy");
    expect(screen.getByLabelText("Content")).toHaveValue("Refund terms");
  });
});
