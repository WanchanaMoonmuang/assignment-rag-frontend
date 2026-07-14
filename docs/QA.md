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
