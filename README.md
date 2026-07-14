# Knowledge Assistant Frontend

React and MUI frontend for the Knowledge Assistant RAG demo, built against the
V2 backend API (`docs/PRDv2.md` in the workspace root). The backend API is
expected at `http://localhost:8080/api` during local development.

## Prerequisites

- Node.js 24 LTS
- npm
- The FastAPI backend running with CORS enabled for `http://localhost:5173`
- The backend's ingestion **worker** process also running — file/text uploads
  are processed asynchronously by a separate worker, not the API process (see
  `assignment-rag-backend/README.md`); without it, ingestion jobs stay `queued`
  forever and never appear in the document list.

## Local Setup

```bash
nvm use
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`.

The only frontend environment variable is:

```env
VITE_API_BASE_URL=http://localhost:8080/api
```

The application stores the access token in `sessionStorage`, so authentication
ends when the browser tab session ends. Do not put credentials or access tokens
in frontend environment files.

Retrieval limits (Top K) and upload constraints (max file size, supported
extensions) are **not** frontend environment variables — they're read at
runtime from the backend's `GET /api/config` and always reflect the live
backend, never a value baked in at build time.

## Container

```bash
docker build --build-arg VITE_API_BASE_URL=https://api.example.com/api -t knowledge-assistant-frontend .
docker run --rm -p 8080:80 knowledge-assistant-frontend
```

The API base URL is baked into the Vite build through `VITE_API_BASE_URL`; provide the deployed backend URL with the Docker build argument.

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

## Current Scope (V2)

- **Chat**: streaming answers over SSE, conversation history, a Top K slider
  (0–20) initialized from the backend's `/api/config` and sent with every
  prompt — `0` performs no retrieval at all.
- **Citations**: inline `[N]` markers in the answer and a clickable source
  list both open a source drawer showing the cited passage highlighted among
  its surrounding extracted context, with a page/line/row/section/record
  location label. PDF sources additionally offer an "Original" tab that views
  the real file at the cited page. Citations persist and render identically
  after reopening a conversation.
- **Calculator tool activity**: live progress while Gemini's calculator tool
  runs during streaming, and the same activity restored on reopening a
  conversation. The display is generic across whatever tools the backend
  exposes, not hardcoded to the calculator.
- **Document ingestion**: paste text or upload a file (txt/pdf/docx/csv/json,
  up to the backend's configured size limit) through a durable, asynchronous
  job queue; the drawer shows each job's live processing stage and stays
  interactive while jobs run, including several at once. Client-side
  extension/size validation runs before any request is sent, using the live
  backend config as the source of truth. Generic key/value metadata rows are
  preserved; documents and conversations require confirmation before deletion.
- Auth is tab-scoped (`sessionStorage`); the layout is a responsive
  conversation sidebar, document drawer, and source drawer that collapse to
  full-width drawers on narrow viewports.
