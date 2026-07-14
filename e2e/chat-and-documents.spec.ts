import { expect, test } from "@playwright/test";

import { openAuthenticatedWorkspace } from "./helpers";

const CONFIG_BODY = JSON.stringify({
  rag_top_k: { default: 5, min: 0, max: 20 },
  max_upload_bytes: 20971520,
  supported_file_extensions: ["txt", "pdf", "docx", "csv", "json"],
});

test.beforeEach(async ({ page }) => {
  await page.route("**/api/config", (route) => route.fulfill({ status: 200, contentType: "application/json", body: CONFIG_BODY }));
  await page.route("**/api/conversations", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ conversations: [] }) }));
  await page.route("**/api/documents", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ documents: [] }) }));
});

test("streams a chat answer at a chosen Top K and shows sources", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openAuthenticatedWorkspace(page);

  let sentTopK: number | null = null;
  await page.route("**/api/chat/stream", async (route) => {
    const body = route.request().postDataJSON() as { top_k?: number };
    sentTopK = body.top_k ?? null;
    const sse = [
      'event: conversation\ndata: {"conversation_id":"c1","title":"Policy"}\n\n',
      'event: metadata\ndata: {"request_id":"r1","top_k":0}\n\n',
      'event: token\ndata: {"text":"Refunds take 30 days [1]."}\n\n',
      'event: sources\ndata: [{"document_id":"d1","document_name":"policy.txt","chunk_id":"k1","snippet":"Refunds are processed within 30 days.","score":0.9,"source_format":"txt","location":{"type":"line","start":1,"end":1,"label":"Lines 1-1"}}]\n\n',
      'event: done\ndata: {"status":"completed"}\n\n',
    ].join("");
    await route.fulfill({ status: 200, contentType: "text/event-stream", body: sse });
  });

  const slider = page.getByRole("slider", { name: /Retrieved chunks/ });
  await slider.focus();
  await slider.press("Home"); // drag Top K to its minimum (0)

  await page.getByRole("textbox", { name: "Question" }).fill("What is the refund policy?");
  await page.getByRole("button", { name: "Send message" }).click();

  await expect(page.getByText("Sources (1)")).toBeVisible();
  expect(sentTopK).toBe(0);
});

test("uploads a file and shows its ingestion job progress to completion", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openAuthenticatedWorkspace(page);

  let pollCount = 0;
  await page.route("**/api/ingestions/file", (route) =>
    route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ job_id: "job1", document_id: "d1", document_name: "notes.txt", status: "queued", stage: "queued", error: null }) }),
  );
  await page.route("**/api/ingestions/job1", (route) => {
    pollCount += 1;
    const body = pollCount === 1
      ? { job_id: "job1", document_id: "d1", document_name: "notes.txt", status: "processing", stage: "embedding", error: null }
      : { job_id: "job1", document_id: "d1", document_name: "notes.txt", status: "completed", stage: "finalizing", error: null };
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });

  await page.getByRole("button", { name: "Open documents" }).click();
  await page.getByRole("tab", { name: "Add document" }).click();
  await page.getByRole("button", { name: "Upload file" }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("Some notes.") });
  await page.getByRole("button", { name: "Ingest document" }).click();

  await expect(page.getByText("notes.txt queued for ingestion.")).toBeVisible();
  await expect(page.getByText("Embedding")).toBeVisible();
  await expect(page.getByText("Completed")).toBeVisible({ timeout: 10_000 });
});

test("reopens a conversation and renders its persisted citation identically to a fresh one", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.route("**/api/conversations", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ conversations: [{ conversation_id: "c1", title: "Policy", created_at: "2026-07-01T10:00:00Z", updated_at: "2026-07-01T10:05:00Z" }] }),
  }));
  await page.route("**/api/conversations/c1", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      conversation_id: "c1",
      title: "Policy",
      messages: [
        { role: "user", content: "What is the refund policy?" },
        { role: "assistant", content: "Refunds take 30 days [1].", sources: [{ document_id: "d1", document_name: "policy.txt", chunk_id: "k1", snippet: "Refunds are processed within 30 days.", score: 0.9, source_format: "txt", location: { type: "line", start: 1, end: 1, label: "Lines 1-1" } }] },
      ],
    }),
  }));
  await page.route("**/api/documents/d1/chunks/k1", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      document_id: "d1",
      chunk: { chunk_id: "k1", content: "Refunds are processed within 30 days.", chunk_index: 1, location: { type: "line", start: 1, end: 1, label: "Lines 1-1" } },
      neighbors: [{ chunk_id: "k1", content: "Refunds are processed within 30 days.", chunk_index: 1, location: { type: "line", start: 1, end: 1, label: "Lines 1-1" } }],
    }),
  }));
  await openAuthenticatedWorkspace(page);

  await page.getByText("Policy").click();
  await expect(page.getByText(/Refunds take 30 days/)).toBeVisible();
  await expect(page.getByText("Sources (1)")).toBeVisible();

  // Citation inspection: clicking the inline marker opens the source drawer
  // showing the exact location and score persisted with the message.
  await page.getByRole("button", { name: "[1]" }).click();
  await expect(page.getByLabel("Close source")).toBeVisible();
  // Scoped to the drawer subtitle specifically: the sources dropdown behind
  // it shows the same "location · score" text for this single-source fixture.
  await expect(page.locator('[title="Lines 1-1"]')).toHaveText("Lines 1-1 · Score 0.900");
  await expect(page.getByLabel("Cited passage")).toContainText("Refunds are processed within 30 days.");
});
