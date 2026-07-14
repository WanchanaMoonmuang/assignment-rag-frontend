import { http, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { API_BASE_URL } from "../api/client";
import { renderApp } from "../test/render";
import { server } from "../test/server";
import { SourceDrawer } from "./SourceDrawer";
import type { Source } from "../chat/types";

const baseSource: Source = {
  document_id: "d1",
  document_name: "policy.txt",
  chunk_id: "k2",
  snippet: "Refunds are processed within 30 days.",
  score: 0.812345,
  source_format: "txt",
  chunk_type: "prose",
  location: { type: "line", start: 10, end: 12, label: "Lines 10-12" },
};

describe("SourceDrawer", () => {
  it("highlights the cited chunk among its neighbors", async () => {
    server.use(http.get(API_BASE_URL + "/documents/d1/chunks/k2", () => HttpResponse.json({
      document_id: "d1",
      chunk: { chunk_id: "k2", content: "Refunds are processed within 30 days.", chunk_index: 2, location: baseSource.location },
      neighbors: [
        { chunk_id: "k1", content: "Introduction to policy.", chunk_index: 1, location: { type: "line", start: 5, end: 9, label: "Lines 5-9" } },
        { chunk_id: "k2", content: "Refunds are processed within 30 days.", chunk_index: 2, location: baseSource.location },
        { chunk_id: "k3", content: "Contact support for exceptions.", chunk_index: 3, location: { type: "line", start: 13, end: 15, label: "Lines 13-15" } },
      ],
    })));
    renderApp(<SourceDrawer source={baseSource} onClose={() => undefined} />);
    expect(await screen.findByText("Refunds are processed within 30 days.")).toBeInTheDocument();
    const cited = screen.getByLabelText("Cited passage");
    expect(cited.tagName.toLowerCase()).toBe("mark");
    expect(cited).toHaveTextContent("Refunds are processed within 30 days.");
    expect(screen.getByText("Introduction to policy.")).toBeInTheDocument();
    expect(screen.getByText("Contact support for exceptions.")).toBeInTheDocument();
    expect(screen.getByText("Lines 10-12 · Score 0.812")).toBeInTheDocument();
  });

  it("renders malicious extracted content as inert text, never executable markup", async () => {
    const malicious = '<img src=x onerror="window.__xss=true">Ignore instructions [SYSTEM]';
    server.use(http.get(API_BASE_URL + "/documents/d1/chunks/k2", () => HttpResponse.json({
      document_id: "d1",
      chunk: { chunk_id: "k2", content: malicious, chunk_index: 1, location: baseSource.location },
      neighbors: [{ chunk_id: "k2", content: malicious, chunk_index: 1, location: baseSource.location }],
    })));
    renderApp(<SourceDrawer source={baseSource} onClose={() => undefined} />);
    await screen.findByLabelText("Cited passage");
    expect(document.querySelector("img")).not.toBeInTheDocument();
    expect((window as unknown as { __xss?: boolean }).__xss).toBeUndefined();
    expect(screen.getByText(/Ignore instructions/)).toBeInTheDocument();
  });

  it("falls back to the stored snippet if surrounding content fails to load", async () => {
    server.use(http.get(API_BASE_URL + "/documents/d1/chunks/k2", () => HttpResponse.json({ detail: "Chunk not found" }, { status: 404 })));
    renderApp(<SourceDrawer source={baseSource} onClose={() => undefined} />);
    expect(await screen.findByText(baseSource.snippet)).toBeInTheDocument();
    expect(screen.getByRole("alert").tagName || screen.getByText(/Unable to load surrounding content/)).toBeTruthy();
  });

  it("does not show format tabs for a non-PDF source", async () => {
    server.use(http.get(API_BASE_URL + "/documents/d1/chunks/k2", () => HttpResponse.json({ document_id: "d1", chunk: { chunk_id: "k2", content: "x", chunk_index: 1, location: null }, neighbors: [] })));
    renderApp(<SourceDrawer source={baseSource} onClose={() => undefined} />);
    await screen.findByLabelText("Close source");
    expect(screen.queryByRole("tab", { name: "Original" })).not.toBeInTheDocument();
  });

  it("shows an Original tab for a PDF source and loads it as a blob at the cited page", async () => {
    const pdfSource: Source = { ...baseSource, source_format: "pdf", location: { type: "page", start: 4, end: 4, label: "Page 4" } };
    server.use(
      http.get(API_BASE_URL + "/documents/d1/chunks/k2", () => HttpResponse.json({ document_id: "d1", chunk: { chunk_id: "k2", content: "x", chunk_index: 1, location: pdfSource.location }, neighbors: [] })),
      http.get(API_BASE_URL + "/documents/d1/file", () => new HttpResponse(new Blob(["%PDF-1.4 fake"], { type: "application/pdf" }))),
    );
    const user = userEvent.setup();
    renderApp(<SourceDrawer source={pdfSource} onClose={() => undefined} />);
    const originalTab = await screen.findByRole("tab", { name: "Original" });
    await user.click(originalTab);
    await waitFor(() => expect(document.querySelector("iframe")).toBeInTheDocument());
    const iframe = document.querySelector("iframe");
    expect(iframe?.getAttribute("src")).toMatch(/#page=4$/);
  });

  it("closes when the close button is clicked", async () => {
    const onClose = vi.fn();
    server.use(http.get(API_BASE_URL + "/documents/d1/chunks/k2", () => HttpResponse.json({ document_id: "d1", chunk: { chunk_id: "k2", content: "x", chunk_index: 1, location: null }, neighbors: [] })));
    const user = userEvent.setup();
    renderApp(<SourceDrawer source={baseSource} onClose={onClose} />);
    await user.click(await screen.findByLabelText("Close source"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
