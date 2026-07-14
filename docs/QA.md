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
