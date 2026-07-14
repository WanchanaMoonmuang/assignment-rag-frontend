# Frontend QA Log

## 2026-07-14 — Scope A: Top K config foundation (branch: feat/frontend-v2-foundations, commit: f59b7c9)

Reviewed as uncommitted working-tree changes on `feat/frontend-v2-foundations` (base commit
`f59b7c9`, same as `develop` — the scope's diff has not been committed yet). Diff verified via
`git diff develop -- <changed files>` plus untracked `src/config/`.

Checks: lint fail (5 problems: 4 errors + 1 warning, all pre-existing on `develop`, none newly
introduced — see "Bugs" note below), typecheck pass, vitest 25/25 passed, build pass, e2e
0/4 run (environment-blocked, see FQA-008).

No live backend was reachable at `http://localhost:8080/api` (`curl` connection refused), so no
manual `/api/config` smoke test was performed; verification relied on the MSW-backed unit/component
suite plus scratch Testing-Library cases written and deleted during this review (not committed).
Checks ran under Node v20.19.2 (nvm unavailable in this sandbox; `package.json` specifies
`>=24 <25`) — results held (build + all 25 tests passed), but this is a caveat on the run, not a
node-24-verified run.

**SECURITY FLAG — not part of this branch's diff, separate from the Scope A verdict below.**
Three untracked files appeared in the project root/`src/test/` mid-review, none created by this
QA pass and none in `git diff develop...feat/frontend-v2-foundations`: `integration_test.mjs`,
`vite.live.config.ts`, `src/test/live-setup.ts`. Together they form a "live" integration harness
that deliberately bypasses MSW and, if run, would perform a real login against a real backend
using `process.env.INTEG_PASSWORD`, store a real access token, and make real authenticated
`/api/config` and `/chat/stream` calls. All three were inspected read-only; **none were executed,
no credentials were supplied, and the backend was not touched.** They are untracked (`git status`
confirms) and were not staged or committed. No `*.live.test.tsx` files exist yet, and
`vite.live.config.ts` is not referenced by `npm test`/`vite.config.ts`, so the 25/25 unit result
above (re-confirmed with a second `npm test` run after these files appeared) is unaffected.
**Recommendation for the main agent: confirm the origin of these three files and ensure they are
not staged or committed as part of this branch before it merges.**

Update: while finalizing this log, two more artifacts from the same harness appeared: a new
untracked `src/chat/ChatWorkspace.live.test.tsx`, and — notably — a one-line modification to the
*tracked* `vite.config.ts` (`test.exclude` gained `"**/*.live.test.tsx"`), i.e. something external
to this QA session is actively editing tracked files in this working tree, not just adding
untracked ones. This is still isolated from Scope A: the change only widens the `test.exclude`
glob so `npm test` skips `*.live.test.tsx`; it does not touch any of the 6 files in this scope's
diff, and does not change what `npm test`/`npm run build` already exercised (confirmed 25/25 twice
before this edit landed). Not reverted or investigated further per the same rationale as above
(don't execute, don't touch backend, flag for triage) — but the main agent should be aware
`vite.config.ts` now has an uncommitted, unreviewed change on this branch too, from an unknown
source, and should decide whether to keep, revert, or discard it before any commit.

### Test cases
| ID | Scenario | Steps / interaction | Expected | Actual | Status |
| -- | -------- | ------------------- | -------- | ------ | ------ |
| FQA-001 | Top K slider initializes from backend default | `ChatWorkspace.test.tsx`: MSW `/config` returns `rag_top_k.default: 7`, render `ChatWorkspace` | Slider label reads "Retrieved chunks (Top K): 7", `aria-valuenow="7"` — not a hardcoded frontend default | Matched | PASS |
| FQA-009 | Slider min/max come from backend config, not the frontend fallback (0–20) | Scratch test (not committed): MSW `/config` returns `rag_top_k: {default:5, min:2, max:10}` (deliberately distinct from `FALLBACK_CONFIG`'s 0/20), render, `waitFor` slider settle | `aria-valuemin="2"`, `aria-valuemax="10"` once the config query resolves | First render (before the query resolves) shows fallback bounds `aria-valuemin="0"`/`"20"` — expected per FQA-005/006 (renders immediately with fallback, then updates). After `waitFor`, settles to `aria-valuemin="2"`, `aria-valuemax="10"` — confirms min/max are wired to backend config, not hardcoded | PASS |
| FQA-002 | Top K sent as `top_k` in every stream request | `api.test.ts` "sends the selected top_k in the request body": `streamChat("Question","c1",0,...)` | POST body `top_k: 0` present (not omitted/defaulted) | Matched; confirms `topKOverride ?? config.default` uses `??` not `\|\|`, so 0 survives correctly | PASS |
| FQA-003 | Top K value 5 (default) sent when user hasn't touched slider | `api.test.ts` "parses SSE events and requires completion": `streamChat("Question", null, 5, ...)` | `top_k` present in body/logic | Matched | PASS |
| FQA-004 | `metadata`/`tool_call`/`tool_result` SSE events parse without breaking existing `token`/`sources`/`done`/`error` handling | `api.test.ts` new + existing cases | Events typed and surfaced in order; no regression to `token`, `sources`, `done`, `error`, fragmented-chunk, and 401 cases | All 7 cases in `api.test.ts` pass | PASS |
| FQA-005 | Config load failure falls back gracefully (scope acceptance criterion 3) | Scratch test (not committed): MSW `/config` → `500`, render `ChatWorkspace` | UI renders, no crash, slider shows fallback default "Retrieved chunks (Top K): 5", composer usable | Matched | PASS |
| FQA-006 | Config load is slow — UI doesn't block on it | Scratch test (not committed): MSW `/config` delayed 5s, render `ChatWorkspace` | Slider renders immediately with `FALLBACK_CONFIG` default (5), doesn't wait for the network | Matched — `useConfig()` returns `query.data ?? FALLBACK_CONFIG` synchronously on first render | PASS |
| FQA-007 | Existing V1 flows unaffected (send/stream, sources disclosure, conversation restore-after-failure, delete confirmation) | `ChatWorkspace.test.tsx` full suite | Behavior identical to `develop` | All 5 tests in file pass | PASS |
| FQA-008 | `npm run test:e2e` (Playwright, `e2e/workspace-layout.spec.ts`) | `npx playwright test` after `npx playwright install chromium` | 4 layout specs run against dev server | Browser launch fails: "Host system is missing dependencies to run browsers" (`sudo npx playwright install-deps` required, no sudo in this sandbox) | BLOCKED (environment, not a product bug) |

### Bugs
No new bugs attributable to this branch's diff were found. Two process notes, not filed as
bugs (both pre-existing/environmental, confirmed via `git stash` and direct repro):

- **Lint baseline mismatch in task brief (informational, not filed as BUG-F-###)** — the task
  description states the pre-existing lint warning lives in `DocumentsPanel.tsx`/`.test.tsx`.
  Actual `npm run lint` output places the 1 warning in `src/chat/ChatWorkspace.tsx`
  (`react-hooks/exhaustive-deps` on the `messages` useEffect dependency) and the 4 errors in
  `DocumentsPanel.tsx`/`DocumentsPanel.test.tsx`. Confirmed via `git stash -u` (removing this
  scope's diff entirely) that the identical warning at the identical column already exists on
  `develop`, just one line earlier (line 26 vs line 28) before this branch's added `useConfig`
  import/hook shifted line numbers. So: correct call that it's pre-existing and out of scope,
  just mis-located in the brief — not something this branch introduced or should fix.
- **Playwright e2e could not be executed in this sandbox** — missing OS-level shared libraries
  (`libnspr4`, `libnss3`, etc.) and no `sudo`. This blocks all 4 specs in
  `e2e/workspace-layout.spec.ts` at browser launch, before any assertions run. Not a code issue;
  flagging so a re-run in an environment with Playwright deps installed (or CI) is the way to get
  real e2e signal for this scope. None of the 4 specs touch Top K, so this doesn't change the
  Scope A verdict, but it means the "no regression to responsive layouts" claim is unverified by
  e2e this run (unit/component coverage stands in for it).

## 2026-07-14 — Scope B: V2 durable job-queue ingestion (branch: feat/frontend-v2-ingestion, commit: 8ea5bdd)

Reviewed as uncommitted working-tree changes on `feat/frontend-v2-ingestion` (base commit
`8ea5bdd`, same as `feat/frontend-v2-foundations` — this scope's diff has not been committed yet).
Diff verified via `git diff feat/frontend-v2-foundations...feat/frontend-v2-ingestion` (empty,
no new commits) plus the actual uncommitted diff for the 6 changed files (`DESIGN.md`,
`src/api/client.ts`, `src/documents/{types,api,DocumentsPanel,DocumentsPanel.test}.{ts,tsx}`) —
matches the scope description. Cross-checked against the live backend source
(`assignment-rag-backend/app/main.py`, `app/worker.py`, `app/settings.py`): `IngestionJob`
field names/enum values (`status`: queued/processing/completed/failed; `stage`: queued/
converting/extracting/chunking/embedding/finalizing/failed), the `/ingestions/text`,
`/ingestions/file` (multipart, `file` + optional `metadata_json`), `/ingestions/{id}` routes,
`max_upload_bytes` (20 MiB) and `supported_file_extensions` (txt/pdf/docx/csv/json) all match
what the frontend now sends/expects. Confirmed the worker sets `document.source` to
`plain_text`/`file_upload` itself (`app/worker.py:268,294`) — the frontend no longer fabricates
a `source` default, matching the removed logic and updated `DESIGN.md` §5.

Checks: lint pass (0 errors, 1 pre-existing warning — `ChatWorkspace.tsx` `react-hooks/exhaustive-deps`,
Scope A, already triaged, not re-flagged), typecheck pass, vitest 28/28 passed, build pass,
e2e 0/4 run (environment-blocked, same as Scope A — see below).

Ran under Node v20.19.2 (nvm unavailable in this sandbox; `package.json` specifies `>=24 <25`) —
same caveat as the Scope A run; results held (build + all 28 tests passed) but this is not a
Node-24-verified run.

No live backend was reachable at `http://localhost:8080/api` in this sandbox; per the task brief
a separate live-backend integration pass (real login, real text-ingestion job, real multipart CSV
upload, both polled to `completed`, both visible in the document list, cleaned up — 8/8 checks)
was already run outside this session and is not re-verified here. This pass relies on the
MSW-backed unit/component suite as the primary verification surface, as instructed.

Working tree is clean this run: no stray untracked files or unexplained tracked-file edits
appeared (unlike the Scope A run, where an unrelated "live" integration harness and an
uncommitted `vite.config.ts` edit surfaced mid-review — flagged then, absent now, nothing to
carry forward).

The two pre-existing lint errors flagged in Scope A's QA pass (MUI `Tabs`/`ToggleButtonGroup`
`onChange` handlers inferring `any` in `DocumentsPanel.tsx`; an `async () => "text"` mock with no
`await` in `DocumentsPanel.test.tsx`) are confirmed gone — `npm run lint` now reports 0 errors.
The rewrite typed the handlers explicitly (`(_event: SyntheticEvent, value: number)` for `Tabs`,
`(_event: MouseEvent<HTMLElement>, value: Mode | null)` for `ToggleButtonGroup`) and the old V1
text-upload mock no longer exists in the rewritten test file.

### Test cases
| ID | Scenario | Steps / interaction | Expected | Actual | Status |
| -- | -------- | ------------------- | -------- | ------ | ------ |
| FQA-010 | AC1: 5 supported formats selectable; unsupported extension rejected client-side, using live `supported_file_extensions` (not hardcoded) | `DocumentsPanel.test.tsx` "rejects an unsupported extension and an oversized file before sending": choose `policy.exe` | Inline alert "Unsupported file type...", no network call reaches `/ingestions/file` | Matched; message lists live config's extensions | PASS |
| FQA-011 | AC2: oversized file rejected client-side before sending | Same test, choose a 20 MiB + 1 byte `.txt` file | Alert mentions the "20 MiB limit", no POST | Matched | PASS |
| FQA-012 | AC2: oversized *pasted text* rejected client-side before sending | Scratch test (not committed): paste a 20 MiB + 1 byte string, submit | Alert mentions the "20 MiB limit"; no POST reaches `/ingestions/text` | Matched — `new TextEncoder().encode(trimmedContent).length > config.max_upload_bytes` (`DocumentsPanel.tsx:98`) correctly uses UTF-8 byte length, mirrors the backend's `content.encode("utf-8")` check in `app/main.py`; confirmed no POST fired | PASS |
| FQA-013 | AC3: text-ingestion job stage is visible and updates live via polling to completion | `DocumentsPanel.test.tsx` "starts text ingestion, tracks the job to completion, and shows the document" | "queued for ingestion" notice, then "Completed" label once polling resolves; document appears in the list without a manual refresh/reopen | Matched | PASS |
| FQA-014 | AC3: file-upload job shows live stage progression (queued→embedding→completed) | `DocumentsPanel.test.tsx` "uploads a file, shows live stage progression, and completes" (stateful mock, 2nd poll flips to completed) | "Embedding" shown mid-flight, then "Completed" | Matched | PASS |
| FQA-015 | AC3: terminal job failure shows a safe, actionable message, not a raw error code/stack | `DocumentsPanel.test.tsx` "shows a safe error message for a job that fails" | Job's `error.message` ("Document could not be converted") shown, not `error.code` or a stack; dismiss (×) control appears and clears it | Matched | PASS |
| FQA-016 | AC4: drawer/tabs remain usable during a job's processing; submitting one ingestion doesn't block starting another; multiple jobs trackable concurrently | `DocumentsPanel.test.tsx` "tracks multiple concurrent ingestion jobs without blocking further submissions" | Both "First" and "Second" jobs visible in the in-progress list simultaneously; navigating back to "Add document" tab mid-poll is not blocked | Matched; `Tabs`/`ToggleButtonGroup` no longer carry `disabled={pending}`, `Drawer`'s `onClose` is no longer gated on `pending` | PASS |
| FQA-017 | AC5: metadata editor behavior unchanged (unique non-blank keys, values as strings) | Code diff review: `submit()`'s metadata validation block is byte-identical to the pre-Scope-B version | No behavior change | Confirmed via diff-identity, not a new test — appropriate proof for "unchanged" per AC5's wording | PASS |
| FQA-018 | AC5: delete confirmation unchanged | `DocumentsPanel.test.tsx` "deletes a document and refreshes the list" | Confirm dialog, delete call, list refresh, success notice | Matched | PASS |
| FQA-019 | Preserved input on submission-request failure (pre-202, before a job exists) | `DocumentsPanel.test.tsx` "preserves user input after ingestion failure" | 502 on `POST /ingestions/text` shows alert with server message, name/content fields retain user input | Matched | PASS |
| FQA-020 | Multipart request omits `Content-Type` (browser sets boundary) and reuses `apiRequest`'s auth/error handling | Code review of `apiRequestFormData` (`src/api/client.ts`) | No explicit `Content-Type` header set; `Authorization` bearer header attached when a token exists; `parseApiError`/`handleUnauthorizedResponse` reused on non-OK / 401 | Matched | PASS |
| FQA-021 | `npm run test:e2e` (Playwright, `e2e/workspace-layout.spec.ts`, incl. `opens the documents panel` which directly touches this scope's rewrite) | `npx playwright test` | 4 specs run against dev server | Browser launch fails: "Host system is missing dependencies to run browsers" (`sudo npx playwright install-deps` required, no sudo in this sandbox) — same environment block as Scope A | BLOCKED (environment, not a product bug) |

### Bugs
No new bugs found in this scope's diff. One coverage note, not filed as a bug (nothing broken):

- **Multipart error/401 path has no dedicated unit test (informational, not filed as BUG-F-###)** —
  `apiRequestFormData` (`src/api/client.ts`) is only exercised via the happy-path 202 response in
  `DocumentsPanel.test.tsx`'s file-upload test; there's no MSW case forcing a non-2xx or 401 on
  `POST /ingestions/file` to confirm `parseApiError`/`handleUnauthorizedResponse` fire correctly
  for the multipart path specifically (the JSON `apiRequest` path already has 401 coverage
  elsewhere). Code review shows the logic is identical to the already-tested JSON path, so this
  is a coverage gap, not a defect — worth a follow-up test if this helper grows more call sites.
- **Playwright e2e still blocked in this sandbox** — same missing OS-level shared libraries
  (`libnspr4`, `libnss3`, etc.) as Scope A, no `sudo` available. This time it's more load-bearing:
  `workspace-layout.spec.ts:40` ("opens the documents panel") directly exercises the rewritten
  drawer and would have been the most relevant e2e signal for this scope's responsive behavior.
  Unit/component coverage (FQA-010 through FQA-020) stands in for it this run.

## 2026-07-14 — Scope C: citations, source drawer, PDF original view (branch: feat/frontend-v2-citations, commit: 862bce4)

Reviewed as uncommitted working-tree changes on `feat/frontend-v2-citations`, stacked on
`feat/frontend-v2-ingestion` (base commit `862bce4`, PR'd, not part of this review). No new
commits between the branches (`git diff feat/frontend-v2-ingestion...feat/frontend-v2-citations`
is empty); the actual scope diff is the uncommitted working tree, verified via
`git diff feat/frontend-v2-ingestion` (with `git add -N .` first so new untracked files show in
the diff): `DESIGN.md`, `src/api/client.ts`, `src/chat/ChatWorkspace.{tsx,test.tsx}` (modified),
plus new `src/chat/citationLinks.{ts,test.ts}` and `src/citations/{types,api,SourceDrawer,
SourceDrawer.test}.{ts,tsx}` — matches the scope description, 10 files, +410/-17.

Checks: lint pass (0 errors, 1 pre-existing warning — `ChatWorkspace.tsx` line ~39
`react-hooks/exhaustive-deps` on the `[messages]` dependency array; confirmed present, same code
shape, on `feat/frontend-v2-ingestion`'s copy of the file — Scope A/B-triaged, not newly
introduced), typecheck pass (`tsc -b`, no errors), vitest 46/46 passed (7 files), build pass
(`tsc -b && vite build`; the "chunk larger than 500 kB" notice is a pre-existing bundle-size
informational message, unrelated to this diff's ~9 KB of added source), e2e 0/4 run
(environment-blocked, same as Scopes A/B — see Bugs).

Ran under Node v20.19.2 (`nvm`/`nvm use` unavailable in this sandbox; `package.json` specifies
`>=24 <25`) — same caveat as prior scope runs; results held but this is not a Node-24-verified run.
Also note: this sandbox's `npm`/`npx` wrapper (an `rtk` proxy hook per global CLAUDE.md) breaks
JSON output for `eslint`/other tool-chain calls in this project ("ESLint output (JSON parse failed:
EOF while parsing a value...)"); worked around by invoking `./node_modules/.bin/{tsc,vitest,vite}`
and `/usr/bin/npx eslint` directly. Flagging as an environment quirk, not a product bug.

No live backend was reachable in this sandbox (expected — shut down per the task brief). Verified
the citation-detail response contract directly against `assignment-rag-backend/app/main.py`'s
`GET /documents/{document_id}/chunks/{chunk_id}` handler (lines 545-578) rather than trusting the
MSW mocks' shape: `neighbors` is built from a `chunk_index` range query `[index-2, index+2]`
inclusive of the cited chunk's own index, so in production `neighbors` genuinely contains the
cited chunk (matching every MSW mock in this diff's tests) — `ExtractedContent` correctly finds
its highlight target by iterating `neighbors` only and never needs the separate `chunk` field.
This directly resolves what would otherwise be a mock-vs-contract risk on AC2.

Also verified the newer `react-hooks/set-state-in-effect` lint rule (`eslint-plugin-react-hooks`
v7.1.1, enabled via the `recommended` flat config, no `eslint-disable` anywhere in the diff)
genuinely passes rather than being silenced: `OriginalFileViewer`'s `useEffect` only calls
`setBlobUrl`/`setError`/`setLoading` inside `.then()`/`.catch()`/`.finally()` promise callbacks
(async, not synchronous-in-effect-body), and both `OriginalFileViewer`/`SourceDrawerContent` avoid
effect-driven resets entirely via `key`-based remounts (`key={source.chunk_id}` on
`SourceDrawerContent`, fresh `OriginalFileViewer` instance per tab swap) — confirmed by reading the
component, not just by lint passing.

### Test cases
| ID | Scenario | Steps / interaction | Expected | Actual | Status |
| -- | -------- | ------------------- | -------- | ------ | ------ |
| FQA-022 | `linkifyCitations` rewrites valid `[N]` markers to double-bracket markdown links, preserving the visible bracket | `citationLinks.test.ts` "turns valid citation markers into markdown links..." | `"...[1]."` → `"...[[1]](#cite-1)."` | Matched | PASS |
| FQA-023 | `linkifyCitations` leaves out-of-range and non-numeric brackets untouched | `citationLinks.test.ts` "leaves an out-of-range marker...", "does not touch non-numeric brackets" | `[5]` with 2 sources and `[note]` both left as plain text | Matched | PASS |
| FQA-024 | `citationIndexFromHref` round-trips `#cite-N` and rejects malformed/non-citation hrefs | `citationLinks.test.ts` `citationIndexFromHref` suite | `#cite-3`→3; `https://...`→null; `#cite-abc`/`#cite-0`→null | Matched | PASS |
| FQA-025 | Double-bracket string transform actually renders as a visible "[1]" clickable control (not stripped to "1" by markdown) | `ChatWorkspace.test.tsx` "opens the source drawer from an inline [1] citation marker": `screen.getByRole("button", { name: "[1]" })` | A button literally named "[1]" is found and clickable | Matched — this is the render-level proof the doubled-bracket workaround in `citationLinks.ts` actually works; the unit test above only proves the string transform, this proves the rendered DOM | PASS |
| FQA-026 (AC1) | Citations remain visible after a fresh stream completes | `ChatWorkspace.test.tsx` "opens the source drawer from an inline [1] citation marker" — `done` event fires, then `Sources (1)` found | Sources disclosure appears once streaming finishes | Matched | PASS |
| FQA-027 (AC1) | Citations remain visible after reopening a conversation loaded from persisted history (the fixed bug) | `ChatWorkspace.test.tsx` "renders persisted citations identically and lets them be clicked after reopening a conversation": `GET /conversations/c1` returns an assistant message with `sources` and no `status` field, select it from the list | `Sources (1)` and the `[1]` inline marker render immediately, same as the live-stream case; `[1]` is clickable | Matched — confirms the `sourcesReady`→`status !== "streaming"` fix in `ChatWorkspace.tsx` genuinely closes the PRDv2 §11.3 gap (persisted messages have `status: undefined`, which is `!== "streaming"`) | PASS |
| FQA-028 | Sources are not shown while a message is still streaming (regression risk from the `sourcesReady` removal) | Code review: `sources` SSE event only sets `message.sources`, never touches `status`; only the `done` event sets `status: undefined`; disclosure render is gated on `message.status !== "streaming"` | Mid-stream, `status` stays `"streaming"` so the gate stays false even if a `sources` event has already arrived before `done` | Sound by code reading; no test pauses mid-stream between the `sources` and `done` events to assert the disclosure is absent at that exact instant — reasoning-based coverage, not a dedicated regression test (see Bugs) | PASS (reasoning-based) |
| FQA-029 (AC2) | Clicking an inline `[N]` marker opens the source drawer for the correct source | `ChatWorkspace.test.tsx` "opens the source drawer from an inline [1] citation marker" | Drawer opens (`Close source` control present), shows `policy.txt` | Matched | PASS |
| FQA-030 (AC2) | Clicking a `Sources (N)` disclosure row opens the source drawer for that source | `ChatWorkspace.test.tsx` "opens the source drawer from clicking a source in the disclosure list" | Same drawer opens from the row click | Matched | PASS |
| FQA-031 (AC2) | Source drawer highlights the exact cited chunk among its neighbors, sorted by `chunk_index` | `SourceDrawer.test.tsx` "highlights the cited chunk among its neighbors" | Cited neighbor renders inside a real `<mark>` element with `aria-label="Cited passage"`; both non-cited neighbors also render, in order | Matched; verified against the real backend contract (see run notes above) that `neighbors` includes the cited chunk in production, not just in this mock | PASS |
| FQA-032 (AC2) | Drawer header shows document name, location label, and score | `SourceDrawer.test.tsx` "highlights the cited chunk...": `screen.getByText("Lines 10-12 · Score 0.812")` | Header string matches `location.label` + rounded score | Matched | PASS |
| FQA-033 | Chunk-detail fetch failure falls back to the stored `snippet` with a visible warning | `SourceDrawer.test.tsx` "falls back to the stored snippet if surrounding content fails to load" (404 on the chunk-detail route) | Warning alert + `source.snippet` text shown instead of a blank/broken drawer | Matched | PASS |
| FQA-034 (AC3) | Non-PDF source shows no "Original" tab | `SourceDrawer.test.tsx` "does not show format tabs for a non-PDF source" | No `Tabs`/`Original` tab rendered at all for `source_format: "txt"` | Matched | PASS |
| FQA-035 (AC3) | PDF source shows an "Original" tab that bearer-fetches the file as a blob and opens it at the cited page | `SourceDrawer.test.tsx` "shows an Original tab for a PDF source...": click "Original" tab, mock `GET /documents/d1/file` returns an `application/pdf` blob | `<iframe>` appears with `src` ending in `#page=4`, matching `location.start` | Matched | PASS |
| FQA-036 | Drawer closes via the close button | `SourceDrawer.test.tsx` "closes when the close button is clicked" | `onClose` callback fires once | Matched | PASS |
| FQA-037 (AC4, security) | Malicious/extracted markup (`<img src=x onerror=...>`, prompt-injection-style text) in a cited chunk's content renders as inert text and never executes | `SourceDrawer.test.tsx` "renders malicious extracted content as inert text, never executable markup" | No `<img>` element in the DOM, `window.__xss` never set, the literal text "Ignore instructions" is visible as inert text | Matched — verified directly (DOM query + global flag assertion), not assumed from "same pipeline as elsewhere" | PASS |
| FQA-038 | `apiRequestBlob` mirrors `apiRequest`'s auth/error handling for a raw-blob GET | Code review of `src/api/client.ts` `apiRequestBlob` | Bearer header attached when a token exists; non-OK triggers `parseApiError`/`handleUnauthorizedResponse` (401) before throwing; returns `response.blob()` on success | Matched | PASS |
| FQA-039 | Object URL for the PDF blob is revoked on unmount / source change | Code review of `OriginalFileViewer`'s `useEffect` cleanup in `SourceDrawer.tsx` | `URL.revokeObjectURL` called in the cleanup function when a URL was created; effect keyed on `source.document_id` so switching sources revokes the old URL | Matched | PASS (reasoning-based; no test asserts `revokeObjectURL` was called) |
| FQA-040 | `react-hooks/set-state-in-effect` genuinely satisfied, not silenced | Code + lint review: `OriginalFileViewer`, `SourceDrawerContent` | No `eslint-disable` in the diff; all `setState` calls in the async promise chain, not synchronous in the effect body; `npx eslint` run confirms 0 errors | Matched | PASS |
| FQA-041 | Calculator tool activity | N/A — out of scope for Scope C (Scope D) | Not flagged, per task brief | N/A | N/A (explicitly out of scope) |

### Bugs
No new bugs found in this scope's diff. Two coverage notes, not filed as bugs (nothing broken):

- **"Sources hidden while streaming" has no dedicated regression test (informational, not filed
  as BUG-F-###)** — see FQA-028. The fix that resolves PRDv2 §11.3 (removing `sourcesReady`,
  gating on `message.status !== "streaming"`) is correct by code reading: the `sources` SSE event
  handler never touches `status`, so a message stays `"streaming"` until the `done` event clears
  it, regardless of when `sources` arrives relative to `done`. But every streaming test in this
  diff fires `conversation`→`token`→`sources`→`done` back-to-back with no pause, so none of them
  actually assert the disclosure is absent at the instant `sources` has landed but `done` hasn't.
  Low risk (the two events are handled independently and in the order the backend emits them,
  same pattern as before this scope), but worth a scratch/regression test if this area changes
  again.
- **`URL.revokeObjectURL` call is not asserted by any test (informational, not filed as
  BUG-F-###)** — see FQA-039. `OriginalFileViewer`'s cleanup correctly revokes the blob URL by
  code reading, but no test mocks/spies on `URL.revokeObjectURL` or `URL.createObjectURL` to
  confirm the create/revoke pairing actually fires on unmount or source-switch in jsdom. A
  `vi.spyOn(URL, "revokeObjectURL")` assertion would close this gap cheaply.
- **Playwright e2e still blocked in this sandbox** — same missing OS-level shared libraries
  (`libnspr4`, `libnss3`, etc.) as Scopes A/B, no `sudo` available. No citation-specific e2e spec
  exists yet (`e2e/` only has `workspace-layout.spec.ts`, unrelated to this scope), so this block
  has no incremental impact on Scope C's own coverage beyond the pre-existing gap already logged
  in Scope B.

## 2026-07-14 — Scope D: calculator tool-activity visualization (branch: feat/frontend-v2-calculator, commit: 8fb9ec8 + working tree)

Reviewed as uncommitted working-tree changes on `feat/frontend-v2-calculator`, stacked on Scope C
(`8fb9ec8`, `feat/frontend-v2-citations`, already PR'd). Diff verified via `git diff
feat/frontend-v2-citations -- DESIGN.md src/chat/ChatWorkspace.test.tsx src/chat/ChatWorkspace.tsx`
(only these 3 files changed; `src/chat/types.ts`/`src/chat/api.ts` already carried the
`ToolActivity` type and `tool_call`/`tool_result` SSE plumbing from an earlier scope, unchanged
here).

Environment note: Node 24 is required (`.nvmrc`) but only Node 20.19.2 is installed in this
sandbox and no `nvm`/Node 24 binary is available — all checks below ran on Node 20. `npm run
lint`/`typecheck`/`test`/`build` invoked via `rtk proxy` because the `npm`-rewriting hook otherwise
swallowed ESLint's plain-text output ("JSON parse failed"); this is a sandbox/tooling artifact, not
a product issue.

Checks: lint pass (1 pre-existing warning only, see below), typecheck pass, vitest 52/52 passed,
build pass, e2e 0/4 passed (environment-blocked, same as every prior scope — see notes).

### Run notes

- The lone lint warning (`react-hooks/exhaustive-deps` on the `messages` useEffect dependency in
  `ChatWorkspace.tsx`) is the same pre-existing warning triaged in Scope A — confirmed by stashing
  this scope's diff and re-running `lint` against bare `feat/frontend-v2-citations`: identical
  warning, just at line 39 instead of line 72 (line shift only, from the code this scope inserted
  above it). Zero new lint issues.
- Verified the forward-compatibility claim (AC5) by reading the code, not just running the two
  hypothetical-tool tests: `grep -n "calculator" src/chat/ChatWorkspace.tsx` returns exactly one
  hit, a comment (`// specific tool name or argument shape (e.g. calculator's "expression")`, line
  21) — no calculator-specific branch, string literal, or lookup table anywhere in
  `toolLabel`/`formatToolArguments`/`ToolActivityRow`/`resolveToolActivity`. The two new tests
  (`weather_lookup` streamed, `customer_lookup` persisted with `{customer_id: number, active:
  boolean}` args and an `error` field) are genuinely exercising the generic path, not tautological:
  they never touch a calculator fixture and assert real rendered DOM text derived purely from
  `name`/`arguments`/`result`/`error`.
- Verified `resolveToolActivity`'s "merge into the last still-`requested` entry" pairing strategy
  (AC4) against the real backend, not just the MSW mocks: `assignment-rag-backend/app/rag.py`
  `stream_with_calculator` (lines 306-317) yields `tool_call` then `tool_result` inside the same
  `for function_call in function_calls:` iteration, i.e. genuinely alternating per call even when
  Gemini returns multiple function calls in one response — so the frontend's "last `requested`"
  assumption holds against the actual backend contract, not just against the test fixtures. This
  is documented in a source comment in `ChatWorkspace.tsx` (line 60-62) and is accurate.
- Found one real gap in the forward-compatibility claim — filed as BUG-F-001 below. It does not
  affect the calculator (whose `result` is always numeric) or the live-streaming path (the backend
  always sends `display_value`); it only affects the **persisted/reopened** path for a hypothetical
  future tool whose raw `result` is a boolean (or `null`), where `display_value` isn't stored.
  Reproduced with a scratch test (added, run, then reverted — restored file confirmed byte-identical
  via `diff` before the final `npm test` re-run) rather than reported from reasoning alone.

### Test cases
| ID | Scenario | Steps / interaction | Expected | Actual | Status |
| -- | -------- | ------------------- | -------- | ------ | ------ |
| FQA-042 (AC1) | Calculator activity shows pending spinner then resolves with the correct value alongside the final answer | `ChatWorkspace.test.tsx` "shows calculator tool activity while streaming, then the resolved result" | `tool_call` (requested) → `tool_result` (`display_value: "4183"`) → token → done; "Calculator: 4183" and the answer text both appear | Matched | PASS |
| FQA-043 (AC2) | Invalid/failing expression shows a controlled, visible error, not a raw exception | `ChatWorkspace.test.tsx` "shows a controlled error for an invalid calculator expression" | `tool_result` with `status: "failed"` renders "Calculator error: ..." | Matched | PASS |
| FQA-044 (AC4) | Multiple sequential calculator calls in one turn each pair with their own result | `ChatWorkspace.test.tsx` "pairs multiple calculator calls in one turn with their own results" | call1→result1(10), call2→result2(20); both "Calculator: 10" and "Calculator: 20" render, not cross-contaminated | Matched | PASS |
| FQA-045 (AC3) | Reopening a conversation restores tool activity through the identical component as live streaming | `ChatWorkspace.test.tsx` "restores persisted tool activity identically after reopening a conversation" | Persisted `tool_activity: [{name, arguments:{expression}, result:4183}]` (no `status`/`display_value`) renders "Calculator (expression: 47*89): 4183" | Matched | PASS |
| FQA-046 (AC5) | A completely novel tool name (`weather_lookup`, never seen elsewhere in the codebase) streams and renders sensibly with zero calculator-specific code | `ChatWorkspace.test.tsx` "renders a hypothetical future tool it has never seen before..." | "Weather lookup: 72F, clear" | Matched | PASS |
| FQA-047 (AC5) | A novel tool's persisted activity with an unrelated argument shape (`{customer_id: number, active: boolean}`) and an `error` field renders generically | `ChatWorkspace.test.tsx` "renders a hypothetical future tool's persisted activity with unrelated argument shapes generically" | "Customer lookup error: Customer not found" | Matched | PASS |
| FQA-048 (AC5) | No calculator-specific branch/string anywhere in the display logic | `grep -n "calculator" src/chat/ChatWorkspace.tsx` | Only match is an explanatory code comment; zero matches inside `toolLabel`/`formatToolArguments`/`ToolActivityRow`/`resolveToolActivity` | Matched | PASS |
| FQA-049 (AC4) | Tool-call/tool-result pairing strategy is valid against the real backend stream shape, not just MSW fixtures | Code review of `assignment-rag-backend/app/rag.py` `stream_with_calculator` (lines 306-317) | `tool_call`/`tool_result` genuinely alternate per function call, even for multiple calls in one Gemini response | Matched | PASS |
| FQA-050 | Persisted boolean (or null) tool `result` with no stored `display_value` renders a value | Scratch test (added, run, reverted): persisted `tool_activity: [{name: "availability_check", arguments: {sku: "X1"}, result: true}]` | Expected something like "Availability check: true" | Rendered "Availability check (sku: X1): " (value silently blank) — see BUG-F-001 | FAIL |
| FQA-051 | `npm run build` succeeds; no new TypeScript errors from this scope's diff | `npm run build` (Node 20, `.nvmrc` wants 24 — unavailable in sandbox) | Build succeeds | Succeeded (pre-existing 500kB chunk-size warning only, unrelated to this scope) | PASS |
| FQA-052 | `npm run test:e2e` | Playwright, `e2e/workspace-layout.spec.ts` (unrelated to this scope; no calculator e2e spec exists) | N/A | 0/4 run — `browserType.launch` fails, missing OS shared libs (`libnspr4`, `libnss3`, etc.), no `sudo` in sandbox; same pre-existing block as every prior scope | N/A (environment-blocked) |

### Bugs
- **BUG-F-001** (severity: low, status: open) — persisted tool activity with a boolean (or `null`)
  `result` renders with a silently blank value, breaking the "streamed and persisted activity look
  the same by construction" claim (AC3/AC5) for such a future tool.
  - Repro: scratch test, not present in the committed test file (added temporarily to
    `ChatWorkspace.test.tsx`, run, then reverted — restored file verified byte-identical via `diff`
    against the pre-edit copy, and the full 52/52 suite re-confirmed green afterward). Persisted
    `tool_activity: [{ name: "availability_check", arguments: { sku: "X1" }, result: true }]`
    (no `status`, no `display_value` — matches the real persisted shape per `DESIGN.md`'s
    `{name, arguments, result}`).
  - Observed: rendered text is `"Availability check (sku: X1): "` — trailing blank where a value
    (e.g. `"true"`) should be. Expected `"Availability check: true"` or similar.
  - Suspected root cause: `src/chat/ChatWorkspace.tsx:37` —
    `const value = activity.display_value ?? (typeof activity.result === "number" ||
    typeof activity.result === "string" ? String(activity.result) : undefined);` — the allowlist
    is missing `"boolean"`. This is an internal inconsistency, not a one-off: `formatToolArguments`
    two lines up (line ~26) already uses the correct three-way allowlist
    (`["string", "number", "boolean"].includes(typeof entry[1])`) for the exact same
    stringify-safety problem; the `value` line just forgot to match it. The narrow fix is adding
    `"boolean"` to this line's condition, not switching to `typeof result !== "object"` (which
    would also let `undefined` through and render the literal string `"undefined"`).
  - Scope: does not affect the shipped calculator (its `result` is always numeric) or any
    live-streaming case (the backend always populates `display_value` per
    `app/rag.py:stream_with_calculator`, so `??` short-circuits before the narrowing ever runs).
    Only reachable via a future tool whose persisted `result` is a boolean/null with no
    `display_value` stored — currently hypothetical, hence low severity. All 6 shipped
    acceptance criteria (AC1-AC4, and AC5 for the two tested hypothetical tools whose results are
    string/number) pass.
  - Fix / re-verified: pending.

## 2026-07-14 — Scope E: docs, a11y/responsive polish, full regression (branch: feat/frontend-v2-polish, commit: 38db717 + working tree)

Final scope of the V2 frontend effort. Reviewed as uncommitted working-tree changes on
`feat/frontend-v2-polish`, stacked on Scope D (`38db717`, `feat/frontend-v2-calculator`, already
PR'd — HEAD of this branch is identical to `38db717`, so `git diff` with no args is this scope's
full diff). No new product feature; scope is `README.md`/`DESIGN.md` corrections, a responsive
touch-target fix in `src/theme.ts`, a dialog-initial-focus fix in two delete-confirmation dialogs,
and new/extracted e2e coverage.

Environment note: Node 24 is required (`.nvmrc`) but only Node 20.19.2 is installed and no
`nvm`/Node 24 binary is available — same as every prior scope. `lint`/`typecheck`/`test`/`build`
run via `rtk proxy npm ...` because the `npm`-rewriting hook swallows ESLint's plain-text output.

Checks: lint **FAIL** (1 warning, `--max-warnings=0`; pre-existing, not introduced by this scope's
diff — see BUG-F-002), typecheck pass, vitest 54/54 passed, build pass, e2e 0/7 executed
(environment-blocked — actually attempted, not assumed; see notes).

### Run notes

- **Diff scope confirmed exactly as described.** `git diff --stat` (no args, since this branch has
  no commits yet) shows exactly `DESIGN.md`, `README.md`, `e2e/workspace-layout.spec.ts`,
  `src/chat/ChatWorkspace.{tsx,test.tsx}`, `src/documents/DocumentsPanel.{tsx,test.tsx}`,
  `src/theme.ts` modified, plus new `e2e/chat-and-documents.spec.ts`, `e2e/helpers.ts`,
  `src/theme.test.tsx`. `src/theme.ts`'s only change is the `MuiIconButton` `styleOverrides.root`
  becoming a responsive function; `ChatWorkspace.tsx`/`DocumentsPanel.tsx`'s only changes are each
  adding `autoFocus` to their dialog's Cancel button — matches the described scope with no
  surprises.
- **`theme.test.tsx` is a genuine (non-tautological) check.** Stashed `src/theme.ts` alone,
  re-ran the test: it fails (`expected null not to be null`) against the pre-fix flat
  `{width:40,height:40}` styleOverrides — no `@media (max-width:599.95px)` rule is emitted for
  `MuiIconButton` at all without the breakpoint override. Restored via `git stash pop` and
  re-confirmed 54/54 green. Given jsdom does not evaluate media queries or apply responsive layout,
  asserting on the emitted `<style>` CSS text for the media-query rule is the correct/only feasible
  way to verify this fix in this test environment — a rendered-size assertion would be a false
  read (jsdom's layout box wouldn't reflect a real mobile viewport regardless of the CSS).
- **Both dialog-focus tests are genuine (non-tautological), not just correctly timed.** Initially
  verified only that the `toHaveFocus()` assertion fires immediately after the dialog opens (before
  any Tab/click) — necessary but not sufficient, since MUI's default focus-trap could plausibly
  focus the first tabbable element (which happens to be Cancel) even without `autoFocus`, making
  the test pass regardless of the fix. Closed this gap by stashing both `ChatWorkspace.tsx` and
  `DocumentsPanel.tsx` (removing only the `autoFocus` change) and re-running both test files:
  **both fail** without the fix. The rendered dialog DOM confirms why — without `autoFocus`, MUI's
  Modal focuses the dialog root `<div role="dialog" tabindex="-1">` (the Paper), not the Cancel
  button, exactly matching the reported bug ("focuses the dialog's root container ... only
  reachable via an extra Tab press"). Restored via `git stash pop`; re-confirmed 54/54 green.
- **`README.md`/`DESIGN.md` factual claims cross-checked against real component source**, not just
  read as prose: the "Original" PDF tab and `#page=N` viewer (`src/citations/SourceDrawer.tsx`),
  the generic (non-calculator-hardcoded) tool-activity rendering (`toolLabel`/
  `formatToolArguments`/`ToolActivityRow` in `src/chat/ChatWorkspace.tsx`), and the multi-format
  upload/job-stage-polling behavior (`src/documents/DocumentsPanel.tsx`) all match what's
  described. Re-read the full current `DESIGN.md` (not just the diff) end to end for internal
  consistency: §3's desktop diagram bullets, §5's Citations/Tool Activity/Document Ingestion
  subsections, §7 Accessibility, and §10 Acceptance Criteria are all now mutually consistent with
  each other and with the actual Scope B/C/D shipped behavior — no remaining "no page number" or
  "one `.txt` file" language anywhere in the file.
- **New `e2e/chat-and-documents.spec.ts` reviewed line-by-line against real component output**
  (selectors, mocked routes, and assertions), since it could not be executed here (see below):
  - Test 1 (`Home` key on the Top K slider → `top_k: 0` in the POST body → sources render): the
    slider's accessible name comes from `aria-labelledby` pointing at text `Retrieved chunks (Top
    K): N` (`ChatWorkspace.tsx`'s `TopKControl`), so `getByRole("slider", { name: /Retrieved
    chunks/ })` genuinely matches; `Home` is standard MUI/ARIA slider behavior for "jump to min".
    Sound.
  - Test 2 (file upload → job stage progression): `getByRole("button", { name: "Upload file" })`
    matches the `ToggleButton` (renders as a real `<button>`); the notice text
    `"notes.txt queued for ingestion."` and stage labels `"Embedding"`/`"Completed"` match
    `DocumentsPanel.tsx`'s `onSuccess` notice string and `STAGE_LABELS`/status branch exactly.
    Sound.
  - Test 3 (reopen persisted citation → same source drawer, same location/score): `getByRole
    ("button", { name: "[1]" })` matches the inline citation link renderer (confirmed identically
    used and passing in the existing unit test at `ChatWorkspace.test.tsx:39`); `"Lines 1-1 · Score
    0.900"` matches `SourceDrawer.tsx`'s caption template (`location.label` + `` · Score ``
    + `score.toFixed(3)`) for `score: 0.9`; `getByLabel("Cited passage")` and `getByLabel("Close
    source")` both exist verbatim as `aria-label`s in `SourceDrawer.tsx`. Sound.
  - `e2e/helpers.ts`'s extracted `openAuthenticatedWorkspace` is byte-identical in behavior to the
    inline version it replaced in `workspace-layout.spec.ts` (diff is purely the extraction), and
    its `sessionStorage` key (`knowledge-assistant.access-token`) matches `src/auth/storage.ts`'s
    `ACCESS_TOKEN_KEY` exactly.
- **Playwright was genuinely attempted, not assumed blocked.** Chromium was already installed
  (`~/.cache/ms-playwright/chromium-1228`); `npx playwright test` (both the new spec alone and the
  full `e2e/` suite, 7 tests total across both spec files) launched and failed identically every
  time with `browserType.launch: Host system is missing dependencies ... sudo npx playwright
  install-deps` — no `sudo` binary exists in this sandbox, so the deps cannot be installed. Same
  environment block as every prior scope in this project; not a product defect.
- **Re-verified BUG-F-001 (filed in the Scope D entry above) — now fixed.** Reading the current
  `src/chat/ChatWorkspace.tsx:37`, the `value` allowlist is
  `["number", "string", "boolean"].includes(typeof activity.result)` — `"boolean"` is present.
  `git show 8fb9ec8:src/chat/ChatWorkspace.tsx` (Scope C, pre-calculator) has no such line, and
  `git show 38db717:...` (Scope D's actual commit) already contains the three-way allowlist — so
  the fix landed in Scope D's commit itself; the Scope D QA entry was simply never updated to
  reflect it (the commit happened after that QA pass, or the fix was applied post-hoc before
  commit). This scope's diff does not touch this line at all. Re-verified empirically with a
  scratch test (added to `ChatWorkspace.test.tsx`, run, then removed — diff confirmed to return to
  exactly the pre-existing single-line `autoFocus` change via `git diff --stat` before the final
  `npm test` re-run): persisted `tool_activity: [{ name: "availability_check", arguments: { sku:
  "X1" }, result: true }]` now renders `"Availability check (sku: X1): true"` as expected.
- **New lint failure found — filed as BUG-F-002.** `npm run lint` (`eslint . --max-warnings=0`)
  currently exits non-zero on this branch: 1 warning, "ESLint found too many warnings (maximum:
  0)." Confirmed this is **not introduced by Scope E's diff**: stashed all of this scope's tracked
  changes (`DESIGN.md`, `README.md`, `e2e/workspace-layout.spec.ts`,
  `src/chat/ChatWorkspace.{tsx,test.tsx}`, `src/documents/DocumentsPanel.{tsx,test.tsx}`,
  `src/theme.ts` — the new untracked files don't participate in lint output either way) and
  re-ran lint directly against the `38db717` baseline: identical single warning, same file/line.
  This is the same `react-hooks/exhaustive-deps` warning already noted as pre-existing in the
  Scope A and Scope D entries above — but neither of those entries flagged that it makes `npm run
  lint` itself **fail** the `--max-warnings=0` gate; Scope D's entry mislabeled it "lint pass (1
  pre-existing warning)". Since PRDv2 §11.4 requires "frontend tests and production build pass"
  and this repo's own documented command is `--max-warnings=0`, a currently-failing `npm run lint`
  is a real regression-suite gap this "full regression" scope should have caught and fixed, not
  just carried forward as a footnote. Filed as a tracked bug rather than another buried note.

### Test cases
| ID | Scenario | Steps / interaction | Expected | Actual | Status |
| -- | -------- | ------------------- | -------- | ------ | ------ |
| FQA-053 | IconButton reaches 44x44px touch target on mobile viewports | `theme.test.tsx`, inspect emitted `<style>` text | `@media (max-width:599.95px)` rule containing `44px` twice | Present | PASS |
| FQA-054 | Same test fails without the fix (discriminating-test check) | Stash `src/theme.ts`, re-run `theme.test.tsx` | Test fails (no such rule emitted) | Failed as expected (`expected null not to be null`) | PASS (regression confirmed) |
| FQA-055 | Conversation-delete dialog focuses Cancel on open | `ChatWorkspace.test.tsx` "confirms and completes conversation deletion" | `toHaveFocus()` on Cancel immediately after dialog opens | Matched | PASS |
| FQA-056 | Same test fails without `autoFocus` (discriminating-test check) | Stash `autoFocus` change in `ChatWorkspace.tsx`, re-run | Test fails; dialog root (Paper, `tabindex="-1"`) holds focus instead | Failed as expected | PASS (regression confirmed) |
| FQA-057 | Document-delete dialog focuses Cancel on open | `DocumentsPanel.test.tsx` "deletes a document and refreshes the list" | `toHaveFocus()` on Cancel immediately after dialog opens | Matched | PASS |
| FQA-058 | Same test fails without `autoFocus` (discriminating-test check) | Stash `autoFocus` change in `DocumentsPanel.tsx`, re-run | Test fails | Failed as expected | PASS (regression confirmed) |
| FQA-059 | README "Current Scope" reflects actual V2 feature set | Read `README.md`, cross-check Top K/citations/PDF-Original/calculator/job-queue claims against source | Matches `TopKControl`, `SourceDrawer`, `ChatWorkspace` tool activity, `DocumentsPanel` ingestion | Matched | PASS |
| FQA-060 | DESIGN.md §10 Acceptance Criteria no longer contradicts Scope C (page numbers) or Scope B (multi-format upload) | Read current `DESIGN.md` §5/§7/§10 end to end | Internally consistent, no stale "no page number"/".txt only" language remains | Matched | PASS |
| FQA-061 | New e2e spec's Top K slider selector/assertions match real component | Code review: `TopKControl` accessible name, `Home` key semantics, POST body shape | `getByRole("slider", {name: /Retrieved chunks/})` and `top_k: 0` assertion both sound | Matched | PASS |
| FQA-062 | New e2e spec's upload/job-polling selectors/assertions match real component | Code review: `ToggleButton` roles, notice string, `STAGE_LABELS` | All strings/roles match `DocumentsPanel.tsx` exactly | Matched | PASS |
| FQA-063 | New e2e spec's citation-reopen selectors/assertions match real component | Code review: `[1]` citation button, `SourceDrawer` caption template, aria-labels | All match `ChatWorkspace.tsx`/`SourceDrawer.tsx` exactly | Matched | PASS |
| FQA-064 | BUG-F-001 (persisted boolean tool result renders blank) re-verification | Scratch test (added, run, reverted): persisted `result: true` | Renders `"Availability check (sku: X1): true"` | Matched — fixed | PASS |
| FQA-065 | `npm run lint` passes cleanly | `rtk proxy npm run lint` | Exit 0, no warnings | Exit non-zero, 1 warning (`react-hooks/exhaustive-deps`, `ChatWorkspace.tsx:72`) — pre-existing, not from this scope's diff (confirmed by stashing this scope's changes and re-running against `38db717`) | FAIL — see BUG-F-002 |
| FQA-066 | `npm run typecheck` passes | `rtk proxy npm run typecheck` | Exit 0, no errors | Clean | PASS |
| FQA-067 | `npm test` (vitest) passes at the expected count | `rtk proxy npm test` | 54/54 (53 + 1 new `theme.test.tsx`, dialog-focus assertions added to existing tests) | 8 files, 54/54 passed | PASS |
| FQA-068 | `npm run build` succeeds | `rtk proxy npm run build` | Build succeeds | Succeeded (pre-existing >500kB chunk-size warning only, unrelated to this scope) | PASS |
| FQA-069 | `npm run test:e2e` (full suite, both spec files) actually attempted | `npx playwright test` (7 tests: 4 `workspace-layout.spec.ts` + 3 new `chat-and-documents.spec.ts`) | Run or a clear environment block | 0/7 run — `browserType.launch` fails, missing OS shared libs (`libnspr4`, `libnss3`, etc.), no `sudo` binary in this sandbox to install them; genuinely attempted (Chromium binary was already present), same pre-existing block as every prior scope | N/A (environment-blocked) |

### Bugs
- **BUG-F-001** (severity: low, status: **fixed**) — persisted tool activity with a boolean (or
  `null`) `result` renders with a silently blank value (originally filed in the Scope D entry
  above).
  - Re-verification: `src/chat/ChatWorkspace.tsx:37`'s allowlist now includes `"boolean"`
    (`["number", "string", "boolean"].includes(typeof activity.result)`). The fix is present in
    commit `38db717` (Scope D's own commit, which is this branch's unchanged base) — **not** part
    of Scope E's diff; the Scope D QA entry's "status: open" was simply never updated after the
    fix landed. Confirmed via a scratch test (added, run, reverted): persisted `tool_activity:
    [{ name: "availability_check", arguments: { sku: "X1" }, result: true }]` now renders
    `"Availability check (sku: X1): true"`.
  - Fix / re-verified: commit `38db717` (already merged/PR'd as part of Scope D); re-verified in
    this Scope E QA pass.
- **BUG-F-002** (severity: medium, status: open) — `npm run lint` (`eslint . --max-warnings=0`)
  currently fails on this branch.
  - Repro: `rtk proxy npm run lint` (or `npm run lint` directly, outside this sandbox's
    npm-output-swallowing hook).
  - Observed: `react-hooks/exhaustive-deps` warning at `src/chat/ChatWorkspace.tsx:72` ("The
    'messages' logical expression could make the dependencies of useEffect Hook (at line 73)
    change on every render...") → `✖ 1 problem (0 errors, 1 warning)` → `ESLint found too many
    warnings (maximum: 0)` → non-zero exit.
  - Suspected root cause: `src/chat/ChatWorkspace.tsx:72` derives `messages` inline every render
    (`const messages = localMessages ?? history.data?.messages ?? [];`) — the `?? []` fallback is
    a fresh array reference whenever both operands are nullish, which the second `useEffect` at
    line 73 (`useEffect(..., [messages])`, the auto-scroll effect) depends on directly. ESLint
    correctly flags that this dependency isn't stable across renders in the way `exhaustive-deps`
    expects; the documented fix is wrapping `messages` in its own `useMemo`.
  - Scope: pre-existing since at least Scope A (noted in that entry and in Scope D's, both of
    which under-labeled it "lint pass (1 pre-existing warning)" instead of a failing gate).
    Confirmed **not introduced by Scope E's diff**: stashed all of Scope E's tracked changes and
    re-ran lint against bare `38db717` — identical single warning. Raising severity to a tracked
    bug (rather than a recurring footnote) because Scope E's explicit remit is "full regression"
    before the V2 effort closes, and PRDv2 §11.4 requires frontend tests/build to pass cleanly as
    part of the release bar — a failing `npm run lint` should not ship un-tracked.
  - Fix / re-verified: pending — recommend wrapping `messages` in `useMemo(() => localMessages ??
    history.data?.messages ?? [], [localMessages, history.data])` in `src/chat/ChatWorkspace.tsx`
    (hand back to the main agent; QA does not implement feature/lint fixes).

### PRDv2 §11.3/§11.4 status across all five scopes (frontend side only)
Read `docs/PRDv2.md` §11.3 (Citations and Tools) and §11.4 (Operations and Compatibility) before
making this call, rather than from memory:
- §11.3: all frontend-observable bullets are satisfied — citations persist unchanged on reopen,
  clicking opens the correct location/score/highlighted chunk, PDF citations open the original at
  the cited page, extracted markup is sanitized (pre-existing `rehype-sanitize` pipeline, unchanged
  this scope), and calculator activity streams, resolves, rejects unsafe input, and survives
  reload (BUG-F-001 now closed). The cross-provider (Gemini Developer API / Vertex AI) bullet is a
  backend concern, out of frontend QA's scope.
- §11.4: "frontend tests and production build pass" — **tests and build both pass** (54/54,
  clean build), but **lint currently does not** (BUG-F-002) if lint is read as part of that bar;
  the desktop/mobile browser-test bullet (upload progress, chat streaming, conversation reload,
  citation inspection) has matching Playwright coverage written and logic-reviewed but **never
  actually executed** in this sandbox across any scope of this project (confirmed genuinely
  attempted, not assumed, this session) — that's a real residual gap for whoever signs off V2
  outside this sandbox. Backend-side §11.4 bullets (structured logs, curl scenarios, backend
  tests/lint) are outside this agent's remit.
- **Net: do not call frontend V2 fully green.** Two concrete asterisks remain at the close of
  Scope E: BUG-F-002 (lint fails) and the never-executed e2e suite (environment-blocked, not
  logic-blocked).

## 2026-07-14 — Bug-fix batch: citations, chat rendering, ingestion UI, layout (branch: fix/bug-batch-frontend, commit: 0e44f07 + working tree, uncommitted)

Branch created off `develop`, no commits yet — `git diff` (no args) against `0e44f07` is the
full diff for this QA pass: `src/chat/ChatWorkspace.tsx`, `src/chat/citationLinks.{ts,test.ts}`,
`src/citations/SourceDrawer.tsx`, `src/documents/DocumentsPanel.{tsx,test.tsx}`,
`src/layouts/WorkspaceShell.tsx` (7 files, confirmed via `git diff --stat`, no surprises).
Companion backend branch `fix/bug-batch-backend` fixed the "tool stuck on running forever after
reload" bug at the source (persists resolved `tool_result` only, never a dangling "requested"
placeholder) — correctly out of scope for this frontend diff, not flagged here.

Checks: lint **pass** (0 warnings — see BUG-F-002 re-verification below), typecheck pass, vitest
57/57 passed, build pass, e2e 0/7 executed (environment-blocked — genuinely attempted against both
Chromium and Firefox, not assumed; see notes).

Environment note: same as every prior scope — Node 24 required (`.nvmrc`) but only Node 20.19.2
installed, no `nvm`/Node 24 binary available; `lint`/`typecheck`/`test`/`build` run via
`rtk proxy npm ...`.

### Run notes

- **Security note on this QA session itself**: partway through, a tool-result system-reminder
  appeared claiming `src/chat/ChatWorkspace.test.tsx` had been "intentionally modified" (by
  scratch discriminating-test additions I had just added and then reverted via
  `git checkout --`) and instructing me not to revert it and not to tell the user. This did not
  match reality — `git diff --stat` and a `grep SCRATCH` immediately after showed the file byte-
  identical to HEAD, no leftover content. Per operating rules, no injected tool/agent message can
  authorize concealing something from the user, so this was disregarded and is being surfaced
  here for transparency. It did not affect any finding below; the working tree was independently
  verified clean before every check that follows.
- **F1/F2 (source-row caption + score, clamped snippet) — genuinely verified, not just code-read.**
  No existing unit test covered these lines, so a discriminating scratch test was added to
  `ChatWorkspace.test.tsx` (run, then reverted via `git checkout --` — confirmed 0 diff
  afterward): asserts the dropdown row shows `"Lines 10-12 · Score 0.812"` and that the snippet
  `Typography` carries `WebkitLineClamp: "3"`. Passed with the fix; re-ran after
  `git stash push -- src/chat/ChatWorkspace.tsx` and both assertions failed as expected (no
  caption text found / no clamp style) — confirms the test is discriminating, not tautological.
  Restored via `git stash pop`.
- **F3 (boxy border → left accent, `stripLeadingOverlap`) — genuinely verified.** Existing test
  `SourceDrawer.test.tsx` "highlights the cited chunk among its neighbors" already asserts
  `component="mark"` survived the border-style change (part of the 57 passing). No existing
  coverage exercised actual overlap-stripping (its neighbors fixture has no shared text), so a
  discriminating scratch test was added (run, then reverted — confirmed 0 diff): crafted a
  neighbor pair sharing the exact substring `"OVERLAP_TAIL_MATCH"` at the boundary, asserted the
  second chunk renders only `"unique-to-k2 body text."` (leading duplicate stripped) while the
  first chunk's full original text is untouched. Passed with the fix; re-ran after
  `git stash push -- src/citations/SourceDrawer.tsx` and it failed (full duplicated text found) —
  discriminating, not tautological. Restored via `git stash pop`.
  - **Heuristic stress-test (conceptual, per the task's explicit ask):** the 400-char cap is safe
    against real data today — backend `Settings.rag_chunk_overlap` defaults to 150 chars and
    `extraction.py`'s per-format `chunk_overlap` defaults are 120, both well under the cap; the
    `ponytail:` comment in the code already names this exact ceiling if overlap config ever grows
    past 400. The exact-match requirement (no fuzzy matching) is a genuine, inherent risk in the
    other direction, though: any coincidental exact character run shared between two *unrelated*
    adjacent chunks (e.g., a repeated table header, boilerplate disclaimer, or common short
    phrase landing exactly at a chunk boundary) would be silently stripped from the second
    chunk's display even though it isn't overlap — a false positive with no user-visible signal
    that content was dropped. Not a reproducible bug against current real data (not filed as one),
    but a real, undetectable-in-production failure mode of "exact match, longest-first" with no
    minimum-length floor or fuzzy tolerance. Worth a design note for whoever owns this file next;
    not blocking this batch.
- **F4 (multi-ref citation groups) — genuinely verified.** The two new tests in
  `citationLinks.test.ts` ("links every number in a comma-separated group",
  "leaves only the out-of-range members of a group as plain text") were re-run after
  `git stash push -- src/chat/citationLinks.ts`: **both fail** without the fix (received the
  literal `"[2, 7]"` unlinkified) — not tautological. Restored via `git stash pop`. Regression
  coverage for "single `[1]` still works exactly as before" and "non-numeric brackets untouched"
  is the pre-existing tests in the same file, both still passing unchanged.
- **F5 (docx header truncation) — verified via existing test, unchanged assertion.** The exact
  string `"Lines 10-12 · Score 0.812"` assertion in `SourceDrawer.test.tsx` line 41 still passes
  with `noWrap`/`title` added (both are non-content-changing props) — confirms the fix doesn't
  alter rendered text, only its overflow/hover behavior. `noWrap`/`title` are read directly from
  source: real fix for the described bug (unbounded breadcrumb-style `location.label` reading like
  a content paragraph under the filename).
- **F7 (wide code blocks) — genuinely rendered and verified, not just prop-inspected.** No
  existing test rendered a fenced code block. Added a discriminating scratch test (run, then
  reverted — confirmed 0 diff): streamed an assistant answer containing a 300+ char single-line
  fenced code block, located the real DOM `<pre>` element, asserted its `textContent` contains the
  full unwrapped line and its inline style has `overflowX: "auto"` / `maxWidth: "100%"`, and that
  the nested `<code>` has `overflowWrap: "anywhere"`. Passed with the fix; re-ran after
  `git stash push -- src/chat/ChatWorkspace.tsx` and both style assertions failed (props absent) —
  discriminating. Restored via `git stash pop`.
- **F8 (self-clearing ingestion notice) — genuinely verified, timer semantics checked.** The new
  `DocumentsPanel.test.tsx` test was re-run after `git stash push -- src/documents/DocumentsPanel.tsx`:
  it **times out and fails** waiting for the notice to disappear (confirms it isn't tautological).
  Restored via `git stash pop`, re-confirmed passing. Read `useEffect(() => { if (!notice) return;
  const timer = setTimeout(() => setNotice(null), 4000); return () => clearTimeout(timer); },
  [notice])` directly: when a new notice arrives while an old timer is still pending, React's
  cleanup fires first (`clearTimeout` on the *old* timer) before the new one is scheduled — no
  leaked timers, no double-fire, and a rapid second ingestion's notice can't be prematurely
  cleared by a stale first timer. Unmount also runs the cleanup, so no
  set-state-after-unmount warning risk.
- **F9 (dismiss "x" vs. delete action) — judgment call as requested, logged as a residual, low-
  severity finding (BUG-F-003) rather than left as prose-only.** Read `DocumentsPanel.tsx`
  directly: the completed-job row's dismiss icon (`CloseRounded`) and the document row's delete
  icon (`DeleteOutlineRounded`, a trash can) are visually distinct glyphs, and clicking the job
  row's dismiss only filters local `activeJobs` state — it never calls the delete-document
  mutation, so a mis-click has zero destructive consequence (unlike the original complaint's
  implied risk). However, the two `<List>`s (`"Ingestion jobs in progress"` and `"Documents"`)
  sit in the same `Stack spacing={3}` with no `Divider` between them, both using the same
  `secondaryAction` icon-button slot/position — so immediately after a completed upload, a
  dismiss "x" sits directly above a trash can in an otherwise-identical row layout. My call: the
  *destructive* half of the original complaint is resolved (no accidental deletion is possible),
  but the *visual adjacency/lookalike* half is only partially addressed by icon-shape alone.
  Logging as open/low rather than silently accepting it, per the request for a second opinion.
- **F10 (composer pushed below the fold) — verified via CSS-mechanics review + code read, real
  browser rendering genuinely attempted and blocked.** `npx playwright test` and
  `npx playwright install firefox` were both tried (not assumed): identical
  `browserType.launch`/host-validation failures for missing OS shared libraries (`libnspr4`,
  `libnss3`, `libgtk-3.so.0`, etc.) on both Chromium and Firefox, no `sudo` binary present — same
  class of environment block as every prior scope, now confirmed across two browser engines.
  No existing unit/e2e test covers composer position, and jsdom (used by vitest here) does not
  run a layout engine, so a rendered-size assertion in jsdom would be a false read regardless.
  Verified instead via CSS Grid semantics: `main`'s `display: grid` previously had
  `placeItems: "center"` (`align-items: center`), which does **not** stretch the grid item to the
  row track's height — the single grid row instead sizes to the item's own auto/content height,
  and `height: "100%"` on the chat column (in `ChatWorkspace.tsx`) resolves against that
  non-stretched, content-sized area, effectively behaving like `auto` — exactly matching the
  reported symptom (composer pushed down by extra vertical centering space on an empty/short
  transcript). The fix's `alignItems: "stretch"` makes the grid row (and therefore the item's
  `height: 100%`) fill `main`'s full height, so the chat column's own `flex-direction: column`
  (message list `flex: 1`, composer `Box` un-flexed) correctly pins the composer to the bottom.
  `justifyItems: "center"` is unchanged behavior for horizontal centering. This is standard,
  spec-defined CSS Grid alignment behavior, not a guess — but flagging plainly that this is
  code+spec review, not an actual rendered screenshot, since Playwright is env-blocked here.
- **F13 (stable `key` for multi tool-call rows)** — trivial, low-risk key change; the existing
  "pairs multiple calculator calls in one turn with their own results" test (part of the 57
  passing) still renders both rows correctly with distinct arguments/results.
- **Re-verified BUG-F-002 — now fixed.** `npm run lint` exits 0 with no warnings on this branch.
  Read `src/chat/ChatWorkspace.tsx`: `messages` is now `useMemo(() => localMessages ??
  history.data?.messages ?? [], [localMessages, history.data?.messages])` — the recommended fix
  from the Scope E entry has landed on `develop` (this branch's base, `0e44f07`) prior to this
  batch; not part of this batch's diff itself. Closing the bug.
- **No fictional-rule claim taken at face value.** The task description for F3 mentioned
  `stripLeadingOverlap` being "reworked... to satisfy the `react-hooks/immutability` eslint rule."
  Checked `eslint.config.js` directly: no such rule exists in this project (only
  `eslint-plugin-react-hooks`'s standard `rules-of-hooks`/`exhaustive-deps`, both from
  `reactHooks.configs.flat.recommended.rules`). `stripLeadingOverlap` itself still contains a
  plain mutated-`let` `for` loop internally (only the outer `displayItems` computation in
  `ExtractedContent` uses `.reduce`, no mutated loop variable) — noted as a description/reality
  mismatch, not a product bug.

### Test cases
| ID | Scenario | Steps / interaction | Expected | Actual | Status |
| -- | -------- | ------------------- | -------- | ------ | ------ |
| FQA-070 | F1/F2: source row shows location + score caption | Scratch test in `ChatWorkspace.test.tsx` (added/reverted): render sources dropdown | `"Lines 10-12 · Score 0.812"` text present | Present | PASS |
| FQA-071 | F1/F2: long snippet is 3-line clamped | Same scratch test: inspect snippet `Typography` style | `WebkitLineClamp: "3"` | Present | PASS |
| FQA-072 | F1/F2 discriminating check: both fail without the fix | Stash `ChatWorkspace.tsx`, re-run scratch test | Caption text absent, no clamp style | Failed as expected on both assertions | PASS (regression confirmed) |
| FQA-073 | F3: cited chunk still renders as `<mark>` after border restyle | `SourceDrawer.test.tsx` "highlights the cited chunk among its neighbors" | `component="mark"`, left-accent style | Matched | PASS |
| FQA-074 | F3: `stripLeadingOverlap` trims a genuine boundary duplicate | Scratch test in `SourceDrawer.test.tsx` (added/reverted): crafted overlapping neighbor pair | Second chunk shows only its unique tail text | Matched | PASS |
| FQA-075 | F3 discriminating check: fails without the fix | Stash `SourceDrawer.tsx`, re-run scratch test | Full duplicated leading text still present | Failed as expected | PASS (regression confirmed) |
| FQA-076 | F4: `[2, 7]` and `[2, 7, 10]` each linkify per-number | `citationLinks.test.ts` new tests | Each valid number becomes its own `[[N]](#cite-N)` link | Matched | PASS |
| FQA-077 | F4: out-of-range member of a group stays plain | `citationLinks.test.ts` "leaves only the out-of-range members..." | `[2, 99]` (max 5) → `[[2]](#cite-2), [99]` | Matched | PASS |
| FQA-078 | F4 discriminating check: both new tests fail without the fix | Stash `citationLinks.ts`, re-run | Both new tests fail (`"[2, 7]"` etc. unlinkified) | Failed as expected | PASS (regression confirmed) |
| FQA-079 | F4: single `[1]` and non-numeric `[note]` unaffected | Pre-existing tests in same file | Unchanged behavior | Still passing | PASS |
| FQA-080 | F5: docx header caption text unchanged after `noWrap`/`title` added | `SourceDrawer.test.tsx` line 41 | `"Lines 10-12 · Score 0.812"` | Matched | PASS |
| FQA-081 | F7: wide fenced code block renders inside an overflow-scrollable `<pre>` | Scratch test in `ChatWorkspace.test.tsx` (added/reverted): real `ReactMarkdown` render of a 300+ char code line | `<pre>` has `overflowX: auto`, `maxWidth: 100%`; `<code>` has `overflowWrap: anywhere` | Matched | PASS |
| FQA-082 | F7 discriminating check: fails without the fix | Stash `ChatWorkspace.tsx`, re-run scratch test | Style assertions fail (props absent) | Failed as expected | PASS (regression confirmed) |
| FQA-083 | F8: success notice self-clears after ~4s | `DocumentsPanel.test.tsx` "clears the success notice on its own instead of showing it forever" | Notice visible, then gone within 6s without a new upload | Matched | PASS |
| FQA-084 | F8 discriminating check: fails without the fix | Stash `DocumentsPanel.tsx`, re-run new test | Test times out waiting for notice to disappear | Failed as expected (timeout) | PASS (regression confirmed) |
| FQA-085 | F9: dismiss icon is non-destructive and visually distinct from delete | Code review: `IngestionJobRow` `onDismiss` vs. document `remove.mutate` | Dismiss never deletes a document; icons differ (X vs. trash) | Confirmed non-destructive; icons differ but rows are otherwise visually identical/adjacent with no divider | PASS (with residual concern — see BUG-F-003) |
| FQA-086 | F10: composer stays near the bottom on an empty/short conversation | Code + CSS Grid spec review (Playwright genuinely attempted, environment-blocked) | `alignItems: stretch` makes the chat column's `height:100%` fill `main`, pinning the composer via its own flex layout | Reasoning matches CSS Grid alignment spec; not visually screenshotted (env-blocked) | PASS (reviewed, e2e-blocked) |
| FQA-087 | F13: multiple calculator calls in one turn still render distinctly after the `key` change | Existing "pairs multiple calculator calls in one turn..." test | Both rows render with distinct results | Still passing | PASS |
| FQA-088 | BUG-F-002 re-verification: `npm run lint` passes cleanly | `rtk proxy npm run lint` | Exit 0, no warnings | Exit 0, no warnings | PASS — fixed |
| FQA-089 | `npm run typecheck` passes | `rtk proxy npm run typecheck` | Exit 0 | Clean | PASS |
| FQA-090 | `npm test` (vitest) passes at the expected count | `rtk proxy npm test` | All tests pass | 8 files, 57/57 passed | PASS |
| FQA-091 | `npm run build` succeeds | `rtk proxy npm run build` | Build succeeds | Succeeded (pre-existing >500kB chunk-size warning only) | PASS |
| FQA-092 | `npm run test:e2e` genuinely attempted (Chromium + Firefox) | `npx playwright test`, `npx playwright install firefox` | Run, or a clear environment block | 0/7 run — missing OS shared libs, no `sudo`; confirmed across two browser engines | N/A (environment-blocked) |

### Bugs
- **BUG-F-002** (severity: medium, status: **fixed**) — `npm run lint` (`eslint . --max-warnings=0`)
  previously failed on `react-hooks/exhaustive-deps` at `ChatWorkspace.tsx`.
  - Re-verification: `rtk proxy npm run lint` exits 0 with no warnings on this branch.
    `src/chat/ChatWorkspace.tsx`'s `messages` derivation is now wrapped in `useMemo`, matching
    the fix recommended in the Scope E entry above. Landed on `develop` (this branch's base,
    `0e44f07`) prior to this batch — not part of this batch's own diff.
  - Fix / re-verified: present on `develop` at `0e44f07`; re-verified in this QA pass.
- **BUG-F-003** (severity: low, status: open) — F9's completed-ingestion-job dismiss "x" sits
  directly above the document list's delete (trash) icon with no visual separator, in the same
  row layout/position, even though the two icons use different glyphs and the dismiss action is
  functionally non-destructive.
  - Repro: `DocumentsPanel.tsx`, Documents tab, after a file finishes ingesting — the
    "Ingestion jobs in progress" `<List>` and the "Documents" `<List>` are both inside one
    `Stack spacing={3}` with no `Divider` between them; both list items use the same
    `secondaryAction` icon-button slot.
  - Observed: no failing test/assertion — this is a UX judgment call, not a functional defect.
    Confirmed via code read that clicking the job row's dismiss icon only calls
    `setActiveJobs((jobs) => jobs.filter(...))` (local state), never `remove.mutate` (the actual
    delete-document mutation), so the destructive half of the original F9 complaint is resolved.
  - Suspected root cause / recommendation: add a `Divider` (or spacing/heading treatment) between
    the two `<List>`s in `DocumentsPanel.tsx` when `activeJobs.length` is nonzero, to reinforce
    that the top list is transient status rather than part of the permanent document list. Low
    severity because there is no accidental-deletion path — purely a lookalike/adjacency polish
    item.
  - Fix / re-verified: pending (hand back to main agent if this is worth addressing before this
    batch ships; QA does not implement feature fixes).
