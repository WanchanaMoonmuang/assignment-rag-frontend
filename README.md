# Knowledge Assistant — Frontend

React + MUI single-page app for **Knowledge Assistant**, a RAG chatbot: sign in,
upload or paste documents, and ask questions in a streaming chat with inline
citations back to the exact source passage. Built against the V2 backend API in
`../assignment-rag-backend`.

See [`../docs/PRDv2.md`](../docs/PRDv2.md) for the product contract this
implements, [`DESIGN.md`](DESIGN.md) for the UI/UX specification, and
[`../docs/diagram-user-journey.md`](../docs/diagram-user-journey.md) for a
visual walkthrough of the flow described below.

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Project layout](#project-layout)
- [Prerequisites](#prerequisites)
- [Local setup](#local-setup)
- [Configuration](#configuration)
- [Checks](#checks)
- [Container](#container)
- [Troubleshooting](#troubleshooting)

## Features

- **Chat**: streaming answers over Server-Sent Events, persisted conversation
  history, and a Top K slider (0–20) that controls how many retrieved chunks
  ground each answer — initialized from the backend's own runtime config, never
  hardcoded. `0` skips retrieval entirely (foundation-knowledge-only answers).
- **Citations**: inline `[N]` markers in the answer and a clickable source list
  both open a source drawer showing the cited passage highlighted among its
  surrounding extracted context, with a page/line/row/section/record location
  label. PDF sources additionally offer an "Original" tab that opens the real
  file at the cited page. Citations render identically whether freshly streamed
  or reopened from a saved conversation.
- **Calculator tool activity**: live progress while Gemini's calculator tool
  runs during streaming (and the same activity restored when a conversation is
  reopened). The display is generic across whatever tools the backend exposes,
  not hardcoded to the calculator specifically.
- **Document ingestion**: paste text or upload a file (txt/pdf/docx/csv/json, up
  to the backend's configured size limit) through a durable, asynchronous job
  queue. The documents drawer shows each job's live processing stage and stays
  interactive while jobs run, including several at once. Extension/size
  validation runs client-side before any request is sent, using the live
  backend config as the source of truth — never a hardcoded assumption.
  Generic key/value metadata rows are preserved; documents and conversations
  require confirmation before deletion.
- Tab-scoped auth (bearer token in `sessionStorage`, cleared when the tab
  closes); a responsive layout — conversation sidebar, document drawer, and
  source drawer collapse into full-width drawers on narrow viewports.

## Tech Stack

- **Framework**: React 19 + TypeScript, built with Vite
- **UI**: MUI (Material UI) v9 + Emotion, `react-markdown` + `rehype-sanitize`
  for safe Markdown rendering (extracted document content is never inserted as
  raw HTML)
- **Server state**: TanStack Query (`@tanstack/react-query`)
- **Streaming**: raw authenticated `fetch` + `eventsource-parser` (not the
  native `EventSource`, since the endpoint needs bearer auth on a `POST`)
- **Testing**: Vitest + React Testing Library (unit/component, mocked with
  MSW), Playwright (responsive e2e journeys)
- **Tooling**: ESLint + `typescript-eslint`, `tsc -b` for typechecking

## Project Layout

```text
src/
  chat/                Chat UI, streaming SSE client, inline-citation-link logic
  citations/           Source inspection drawer (extracted content + PDF original tab)
  documents/           Document drawer: ingestion (paste/upload), job polling, deletion
  auth/                AuthContext (login state), tab-scoped token storage
  config/              Runtime config (Top K bounds, upload limits) from /api/config
  api/                 Shared authenticated fetch wrapper and error handling
  layouts/             Responsive workspace shell (sidebar/drawer chrome)
  features/auth/       Login view
  components/          Small shared components (loader, error boundary)
  theme.ts             MUI theme (design tokens, responsive touch targets)
e2e/                   Playwright specs (responsive layout + full user flows)
```

Each feature folder owns its own `api.ts`, `types.ts`, component, and colocated
`*.test.tsx` — API response types mirror the backend contract directly rather
than being redefined ad hoc.

## Prerequisites

- Node.js 24 LTS and npm
- The backend **API** running with CORS enabled for `http://localhost:5173`
  (`assignment-rag-backend`)
- The backend's ingestion **worker** process also running — file/text uploads
  are processed asynchronously by a separate process, not the API; without it,
  ingestion jobs stay `queued` forever and never appear in the document list

## Local Setup

```bash
nvm use
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`.

## Configuration

The only frontend environment variable is:

```env
VITE_API_BASE_URL=http://localhost:8080/api
```

Retrieval limits (Top K) and upload constraints (max file size, supported
extensions) are **not** frontend environment variables — they're read at
runtime from the backend's `GET /api/config` and always reflect the live
backend, never a value baked in at build time.

The access token lives in `sessionStorage`, so authentication ends when the tab
session ends. Never put credentials, access tokens, or the backend's database/
model keys in frontend environment files.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Responsive Playwright journeys run with:

```bash
npm run test:e2e
```

This starts its own dev server automatically (`playwright.config.ts`'s
`webServer`); it does not require `npm run dev` to already be running. It does
require a real Playwright browser install (`npx playwright install chromium`)
and, on Linux, the browser's OS-level shared libraries — see Playwright's own
`npx playwright install-deps` (requires root) if the browser fails to launch.

## Container

```bash
docker build --build-arg VITE_API_BASE_URL=https://api.example.com/api -t knowledge-assistant-frontend .
docker run --rm -p 8080:80 knowledge-assistant-frontend
```

The API base URL is baked into the Vite build through `VITE_API_BASE_URL`;
provide the deployed backend URL with the Docker build argument — it cannot be
changed at container runtime.

## Troubleshooting

- **Ingestion jobs stuck at "Queued"**: the backend worker process isn't
  running. Start it alongside the API (see the backend's own README).
- **401 immediately after a page refresh**: expected — the token lives in
  `sessionStorage`, not persistent storage, by design (see [Configuration](#configuration)).
- **Top K slider or upload limits look wrong**: they come from the live
  backend's `/api/config`, not this app's build. Confirm `VITE_API_BASE_URL`
  points at the backend you expect.
- **`npm run test:e2e` fails to launch a browser**: Playwright needs its
  browser binaries and, on Linux, root access to install OS-level shared
  libraries (`sudo npx playwright install-deps`). This is an environment
  limitation, not a test failure.
