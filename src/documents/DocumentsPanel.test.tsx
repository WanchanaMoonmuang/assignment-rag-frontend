import { http, HttpResponse } from "msw";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { API_BASE_URL } from "../api/client";
import { renderApp } from "../test/render";
import { server } from "../test/server";
import { DocumentsPanel } from "./DocumentsPanel";

describe("DocumentsPanel", () => {
  it("starts text ingestion, tracks the job to completion, and shows the document", async () => {
    server.use(
      http.post(API_BASE_URL + "/ingestions/text", async ({ request }) => {
        expect(await request.json()).toMatchObject({ document_name: "Policy", content: "Refund terms" });
        return HttpResponse.json({ job_id: "job1", document_id: "d1", document_name: "Policy", status: "queued", stage: "queued", error: null }, { status: 202 });
      }),
      http.get(API_BASE_URL + "/ingestions/job1", () => HttpResponse.json({ job_id: "job1", document_id: "d1", document_name: "Policy", status: "completed", stage: "finalizing", error: null })),
      http.get(API_BASE_URL + "/documents", () => HttpResponse.json({ documents: [{ document_id: "d1", document_name: "Policy", source: "plain_text", chunks_count: 2, created_at: "2026-07-01T10:00:00Z", updated_at: "2026-07-01T10:05:00Z" }] })),
    );
    const user = userEvent.setup();
    renderApp(<DocumentsPanel open onClose={() => undefined} />);
    await user.click(screen.getByRole("tab", { name: "Add document" }));
    await user.type(screen.getByLabelText("Document name"), "Policy");
    await user.type(screen.getByLabelText("Content"), "Refund terms");
    await user.click(screen.getByRole("button", { name: "Ingest document" }));
    expect(await screen.findByText("Policy queued for ingestion.")).toBeInTheDocument();
    expect(await screen.findByText("Completed")).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText("Policy").length).toBeGreaterThan(0));
  });

  it("clears the success notice on its own instead of showing it forever", async () => {
    server.use(
      http.post(API_BASE_URL + "/ingestions/text", () => HttpResponse.json({ job_id: "job4", document_id: "d4", document_name: "Policy", status: "queued", stage: "queued", error: null }, { status: 202 })),
      http.get(API_BASE_URL + "/ingestions/job4", () => HttpResponse.json({ job_id: "job4", document_id: "d4", document_name: "Policy", status: "processing", stage: "embedding", error: null })),
    );
    const user = userEvent.setup();
    renderApp(<DocumentsPanel open onClose={() => undefined} />);
    await user.click(screen.getByRole("tab", { name: "Add document" }));
    await user.type(screen.getByLabelText("Document name"), "Policy");
    await user.type(screen.getByLabelText("Content"), "Refund terms");
    await user.click(screen.getByRole("button", { name: "Ingest document" }));
    expect(await screen.findByText("Policy queued for ingestion.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Policy queued for ingestion.")).not.toBeInTheDocument(), { timeout: 6000 });
  }, 10000);

  it("uploads a file, shows live stage progression, and completes", async () => {
    let calls = 0;
    server.use(
      http.post(API_BASE_URL + "/ingestions/file", () => HttpResponse.json({ job_id: "job2", document_id: "d2", document_name: "policy.pdf", status: "queued", stage: "queued", error: null }, { status: 202 })),
      http.get(API_BASE_URL + "/ingestions/job2", () => {
        calls += 1;
        if (calls === 1) return HttpResponse.json({ job_id: "job2", document_id: "d2", document_name: "policy.pdf", status: "processing", stage: "embedding", error: null });
        return HttpResponse.json({ job_id: "job2", document_id: "d2", document_name: "policy.pdf", status: "completed", stage: "finalizing", error: null });
      }),
    );
    const user = userEvent.setup();
    renderApp(<DocumentsPanel open onClose={() => undefined} />);
    await user.click(screen.getByRole("tab", { name: "Add document" }));
    await user.click(screen.getByRole("button", { name: "Upload file" }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const valid = new File(["%PDF-1.4 fake pdf bytes"], "policy.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [valid] } });
    await waitFor(() => expect(screen.getByLabelText("Document name")).toHaveValue("policy.pdf"));
    await user.click(screen.getByRole("button", { name: "Ingest document" }));
    expect(await screen.findByText("Embedding")).toBeInTheDocument();
    expect(await screen.findByText("Completed", {}, { timeout: 5000 })).toBeInTheDocument();
  }, 10000);

  it("rejects an unsupported extension and an oversized file before sending", async () => {
    const user = userEvent.setup();
    renderApp(<DocumentsPanel open onClose={() => undefined} />);
    await user.click(screen.getByRole("tab", { name: "Add document" }));
    await user.click(screen.getByRole("button", { name: "Upload file" }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const unsupported = new File(["x"], "policy.exe", { type: "application/octet-stream" });
    fireEvent.change(input, { target: { files: [unsupported] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("Unsupported file type");
    const oversized = new File([new Uint8Array(20 * 1024 * 1024 + 1)], "large.txt", { type: "text/plain" });
    fireEvent.change(input, { target: { files: [oversized] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("20 MiB limit");
  });

  it("tracks multiple concurrent ingestion jobs without blocking further submissions", async () => {
    server.use(
      http.post(API_BASE_URL + "/ingestions/text", async ({ request }) => {
        const body = (await request.json()) as { document_name: string };
        return HttpResponse.json({ job_id: `job-${body.document_name}`, document_id: `doc-${body.document_name}`, document_name: body.document_name, status: "queued", stage: "queued", error: null }, { status: 202 });
      }),
      http.get(API_BASE_URL + "/ingestions/:jobId", () => HttpResponse.json({ job_id: "job", document_id: "doc", document_name: "irrelevant", status: "processing", stage: "embedding", error: null })),
    );
    const user = userEvent.setup();
    renderApp(<DocumentsPanel open onClose={() => undefined} />);
    await user.click(screen.getByRole("tab", { name: "Add document" }));
    await user.type(screen.getByLabelText("Document name"), "First");
    await user.type(screen.getByLabelText("Content"), "Content A");
    await user.click(screen.getByRole("button", { name: "Ingest document" }));
    await screen.findByText("First queued for ingestion.");
    await user.click(screen.getByRole("tab", { name: "Add document" }));
    await user.type(screen.getByLabelText("Document name"), "Second");
    await user.type(screen.getByLabelText("Content"), "Content B");
    await user.click(screen.getByRole("button", { name: "Ingest document" }));
    await screen.findByText("Second queued for ingestion.");
    expect(await screen.findByText("First")).toBeInTheDocument();
    expect(await screen.findByText("Second")).toBeInTheDocument();
  });

  it("shows a safe error message for a job that fails", async () => {
    server.use(
      http.post(API_BASE_URL + "/ingestions/text", () => HttpResponse.json({ job_id: "job3", document_id: "d3", document_name: "Bad doc", status: "queued", stage: "queued", error: null }, { status: 202 })),
      http.get(API_BASE_URL + "/ingestions/job3", () => HttpResponse.json({ job_id: "job3", document_id: "d3", document_name: "Bad doc", status: "failed", stage: "extracting", error: { code: "extraction_failed", message: "Document could not be converted" } })),
    );
    const user = userEvent.setup();
    renderApp(<DocumentsPanel open onClose={() => undefined} />);
    await user.click(screen.getByRole("tab", { name: "Add document" }));
    await user.type(screen.getByLabelText("Document name"), "Bad doc");
    await user.type(screen.getByLabelText("Content"), "content");
    await user.click(screen.getByRole("button", { name: "Ingest document" }));
    expect(await screen.findByText("Document could not be converted")).toBeInTheDocument();
    const dismiss = await screen.findByLabelText("Dismiss Bad doc");
    await user.click(dismiss);
    await waitFor(() => expect(screen.queryByText("Document could not be converted")).not.toBeInTheDocument());
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
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByLabelText("Delete Policy")).not.toBeInTheDocument());
    expect(screen.getByText("Document deleted.")).toBeInTheDocument();
  });

  it("preserves user input after ingestion failure", async () => {
    server.use(http.post(API_BASE_URL + "/ingestions/text", () => HttpResponse.json({ detail: "Embedding unavailable" }, { status: 502 })));
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
