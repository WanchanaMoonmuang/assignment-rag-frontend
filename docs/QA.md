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
