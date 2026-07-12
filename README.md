# Knowledge Assistant Frontend

React and MUI frontend for the Knowledge Assistant RAG demo. The backend API is
expected at `http://localhost:8080/api` during local development.

## Prerequisites

- Node.js 24 LTS
- npm
- The FastAPI backend running with CORS enabled for `http://localhost:5173`

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

## Current Scope

The frontend includes login and tab-scoped authentication, streaming chat with
conversation history and citations, a responsive conversation drawer, and a
right-side document drawer for pasted text or client-read `.txt` ingestion.
Document metadata uses editable key/value rows; documents and conversations
require confirmation before deletion.
