# Knowledge Assistant Frontend Design

## 1. Purpose

Knowledge Assistant is a focused workspace for asking questions against ingested
documents. The interface should feel like a dependable internal tool: quiet,
compact, readable, and optimized for repeated chat and document-management work.

This document is the source of truth for the MVP frontend design. It covers the
login experience, conversation management, streaming chat, source citations,
document ingestion, responsive behavior, accessibility, and UI states.

## 2. Product Principles

1. **Chat is primary.** Conversation content and the composer receive most of the
   available space. Supporting tools must not crowd the answer-reading area.
2. **Sources are inspectable.** Grounded answers expose readable evidence after
   generation without overwhelming the message itself.
3. **System state is explicit.** Loading, streaming, empty, success, and failure
   states are visible and understandable.
4. **Actions are predictable.** Destructive actions require confirmation, and
   asynchronous actions prevent duplicate submissions.
5. **Density remains comfortable.** The workspace favors scanning and repeated
   use over decorative layouts, oversized type, or marketing-style composition.

## 3. Information Architecture

The authenticated product is a single workspace rather than a collection of
separate pages.

### Desktop

```text
+----------------------+-----------------------------------------------+
| Conversation sidebar | Top bar: conversation title     Documents User|
|                      +-----------------------------------------------+
| New conversation     |                                               |
| Conversation list    | Chat message history                          |
|                      |                                               |
|                      |                                               |
|                      +-----------------------------------------------+
|                      | Message composer                              |
+----------------------+-----------------------------------------------+
                                      < Document slide-over drawer
```

- The conversation sidebar is persistent at wide desktop sizes.
- The center chat column owns the remaining width and must remain readable when
  the document drawer or source drawer opens.
- Document management and citation/source inspection each open in their own
  right-side slide-over drawer (only one is meaningfully in use at a time).
- The composer area includes the Top K slider, initialized from backend
  runtime configuration.
- The top bar contains the current conversation title, document drawer action,
  and account menu with logout.
- Do not place the workspace sections inside decorative cards.

### Mobile

- Chat is the default and primary screen.
- Conversations open in a temporary left drawer.
- Documents open in a temporary right drawer.
- The top bar contains menu, current conversation title, and document actions.
- The composer stays anchored above the viewport bottom and mobile safe area.
- Drawers occupy the full viewport width on narrow devices and restore focus to
  their trigger when closed.

## 4. Visual System

### Style

Use a restrained light-mode system influenced by Swiss minimalism: clear grid,
high contrast, deliberate whitespace, and minimal elevation. Avoid gradients,
glass effects, decorative blobs, oversized headings, and excessive cards.

### Color Tokens

| Token | Value | Usage |
| --- | --- | --- |
| `background.default` | `#F7F8FA` | App background |
| `background.paper` | `#FFFFFF` | Drawers, menus, dialogs, composer |
| `text.primary` | `#18212F` | Primary copy and headings |
| `text.secondary` | `#526071` | Metadata and supporting text |
| `divider` | `#DDE2E8` | Borders and section separation |
| `primary.main` | `#2563EB` | Primary commands, focus, links |
| `primary.dark` | `#1D4ED8` | Hover and active states |
| `success.main` | `#16835D` | Completed ingestion and success |
| `warning.main` | `#B76E00` | Recoverable warning states |
| `error.main` | `#C9362B` | Errors and destructive actions |
| `assistant.surface` | `#FFFFFF` | Assistant message region |
| `user.surface` | `#EAF2FF` | User message bubble |
| `source.surface` | `#F2F5F8` | Citation excerpt background |

All normal text must meet WCAG AA contrast of at least 4.5:1. Color must never
be the only indicator of state.

### Typography

- Use `Source Sans 3` for the interface and message body. Fall back to
  `Inter`, `Roboto`, `Arial`, then `sans-serif`.
- Use `Lexend` sparingly for the product name and top-level headings. Fall back
  to the body stack if external fonts are unavailable.
- Base body text is 16px with a 1.5 line height. Metadata may use 13-14px.
- Chat Markdown uses the body size; code uses a system monospace stack.
- Letter spacing is `0`; font size does not scale with viewport width.

### Shape, Spacing, and Elevation

- Base spacing unit: 4px. Common spacing values: 8, 12, 16, 24, and 32px.
- Controls and message surfaces use a maximum 8px radius.
- Icon buttons are a stable 40x40px on desktop and at least 44x44px on touch
  layouts.
- Use borders to establish structure. Reserve shadows for drawers, menus,
  dialogs, and the sticky composer edge.
- Hover and focus transitions last 150-200ms and never move or resize controls.
- Use MUI icons consistently; do not use emoji or custom inline SVG icons.

## 5. Core Experiences

### Login

- Center a compact login form with the product name, username, password, and
  full-width sign-in button. Do not show registration or password-reset links.
- Use visible labels, password visibility control, Enter-to-submit behavior,
  disabled submit while pending, and an announced inline error.
- Store the access token in `sessionStorage` only.
- Validate the stored token through `GET /auth/me` when the app initializes.
- Any authenticated request returning `401` clears the session and returns the
  user to login with a session-expired message.

### Conversation Navigation

- The sidebar header contains the Knowledge Assistant wordmark and an icon
  button for a new conversation.
- List conversations newest-updated first using title, last-message preview,
  and relative updated time. Truncate long text without changing row height.
- Selecting a conversation loads its history and closes the drawer on mobile.
- New conversation clears the active conversation and presents the chat empty
  state. The backend creates it when the first question is sent.
- Conversation deletion uses a confirmation dialog naming the conversation.
  After deletion, select the next available conversation or show a new empty
  conversation when none remain.
- Sidebar states: loading skeletons, empty state, retryable error, populated,
  selected, and delete-pending.

### Chat

- Constrain message content to a readable maximum width while allowing the chat
  region itself to fill available space.
- User messages use a compact right-aligned tinted bubble. Assistant messages
  use a left-aligned unframed layout with an assistant icon and source section.
- Render assistant content as sanitized Markdown supporting paragraphs,
  headings, lists, links, blockquotes, inline code, fenced code, and tables.
  External links open safely in a new tab. Wide code blocks and tables scroll
  within their own bounds, never the page.
- The empty state contains a short invitation to ask about available documents.
  It must not present undocumented prompt suggestions as product capabilities.
- The composer is a multiline input with a send icon. Enter sends; Shift+Enter
  inserts a newline. Empty or whitespace-only questions cannot be sent.
- Disable the composer and conversation switching while the active response is
  streaming to prevent ambiguous state and duplicate turns.

### Streaming Lifecycle

The client uses authenticated `fetch` against `POST /chat/stream` and parses the
SSE response incrementally. Native `EventSource` is not suitable because the
endpoint is a protected POST request.

1. Optimistically append the user message and an empty assistant placeholder.
2. Before parsing, require a successful HTTP response with a
   `text/event-stream` content type. Parse ordinary JSON error responses through
   the shared API error handler instead of passing them to the SSE parser.
3. Show a compact thinking indicator until the first `token` event.
4. On `conversation`, store the returned ID/title and update the conversation
   list without interrupting the stream.
5. On each `token`, append text to the assistant placeholder and keep the view
   pinned only when the user is already near the bottom.
6. On `sources`, attach citations but do not display them before answer content.
7. On `done`, mark the assistant message complete, enable controls, and refresh
   conversation metadata.
8. On an SSE `error`, malformed stream, network loss, or premature EOF, retain
   the partial answer, label it incomplete, and show an announced error action.

For an HTTP `401`, `404`, or `422` response, the request was rejected before
the user message was stored. Remove the empty assistant placeholder, mark the
optimistic user message as unsent, and restore its question to the composer. A
`401` follows global session-expiry handling. A `404` also removes the stale
conversation, refreshes the list, and returns to a new-conversation state.

For any other non-success response, missing response, connection loss, malformed
content type, or in-stream failure, persistence may already have occurred. Keep
partial content when present, refresh the conversation list and active history,
and reconcile the optimistic message with server state. If history confirms the
message was not stored, restore it as a safe draft. Otherwise retain it as a
failed turn and warn that asking again creates a new turn and may duplicate the
question. Never automatically retry an ambiguous or in-stream failure.

### Citations

- Show citations only after the assistant response completes (gated on the
  message not currently streaming, not on a separate readiness flag — a
  reopened/persisted message is never "streaming", so its citations render
  immediately, identically to a freshly completed one).
- Inline numeric markers (`[1]`, `[2]`, ...) inside the rendered Markdown
  answer are clickable and map 1-based to the message's `sources[]` array,
  matching the backend's prompt-numbering convention. Only markers whose
  number is a valid source index become links; anything else (an
  out-of-range number, non-numeric brackets) stays plain text. This is
  implemented as a markdown-string transform before rendering (`[1]` →
  `[[1]](#cite-1)`, so the visible bracket is preserved) plus a custom link
  renderer that intercepts `#cite-N` hrefs — never by injecting raw HTML.
- Also keep a collapsed `Sources (N)` disclosure below the answer when
  sources exist; each row is clickable too and opens the same source drawer.
  Each row shows the source's `[N]` index, document name, and `snippet`.
- If the response has no sources, omit the source disclosure. Never create a
  citation from answer text alone.
- Clicking a citation (inline marker or disclosure row) opens the **source
  drawer**: a slide-over on desktop, a full-width/full-screen drawer on
  mobile (reusing the same responsive drawer sizing as the document panel).
  The header shows document name, the source's `location.label` (page,
  line range, data rows, section, or record — whatever the backend
  computed), and the retrieval score.
- The drawer body fetches `GET /api/documents/{id}/chunks/{chunk_id}` and
  renders the returned neighbor chunks (sorted by `chunk_index`) through the
  same sanitized-Markdown pipeline used for chat answers — extracted
  document content is never inserted as raw HTML. The exact cited chunk is
  wrapped in a semantic `<mark>` element so it's visually distinguished from
  its surrounding context. If the surrounding-content fetch fails, fall back
  to the stored `snippet` with a visible warning rather than showing nothing.
- For a PDF source, the drawer also shows an **Original** tab: it
  bearer-fetches `GET /api/documents/{id}/file`, creates a temporary blob
  URL, and displays it in an embedded viewer at `#page=N` (the cited page).
  The blob URL is revoked when the drawer closes or a different source is
  opened.

### Tool Activity (Calculator and Future Tools)

- While streaming, the SSE `tool_call` (`{name, status:"requested"}`) and
  `tool_result` (`{name, status, display_value}`) events render as a small
  row above the answer text: a spinner while requested, then the resolved
  value or a visible error once the result arrives. A `tool_result` always
  resolves the most recent still-pending call, so multiple invocations in
  one turn pair correctly with their own results in order.
- Reopening a conversation renders the same activity from the persisted
  `tool_activity` field (`{name, arguments, result}` or `{name, arguments,
  error}`) through the identical row component — there is no separate
  "restored" rendering path, so streamed and persisted activity look the
  same by construction.
- Tool activity is shown as soon as it arrives, independent of whether the
  answer text has completed streaming — unlike citations, which wait for
  the message to finish.
- **The row is generic across whatever tools the backend exposes**, not
  hardcoded to the calculator: the label is derived from the tool's `name`
  (e.g. `calculator` → "Calculator", `weather_lookup` → "Weather lookup"),
  and arguments are rendered as generic `key: value` pairs rather than
  assuming a specific field like calculator's `expression`. A backend adding
  a new tool needs no frontend change for its activity to display sensibly.

### Document Drawer

- The drawer header contains title, refresh, and close icon buttons.
- Provide two tabs: `Documents` and `Add document`.
- The document list shows document name, source type, chunk count, created or
  updated time, and a delete icon with tooltip.
- Refresh preserves the selected tab and visibly updates the list.
- Deletion requires a confirmation dialog naming the document and explaining
  that its chunks will no longer be available to answers.
- List states: loading skeletons, empty state, retryable error, populated, and
  delete-pending.

### Document Ingestion

- Use a segmented control for `Paste text` and `Upload file` modes.
- Paste mode includes document name and multiline content fields.
- Upload mode accepts one file of any extension in `GET /api/config`'s
  `supported_file_extensions` (txt, pdf, docx, csv, json) and defaults the
  editable document name to the file name. The file itself is sent as-is
  (multipart), never read into the content field. Reject an unsupported
  extension or a file/pasted-text payload above `max_upload_bytes` (20 MiB)
  before sending, using the live config values, not hardcoded ones.
- Both modes include a generic key/value metadata editor. Rows have key, value,
  and remove controls, plus an add-row command. Keys must be non-empty and
  unique; blank rows are omitted. Values are sent as strings. Metadata no
  longer needs a `source` default — the backend worker sets the document's
  `source` field itself (`plain_text` or `file_upload`) during finalization.
- Submission starts a durable ingestion job (`POST /ingestions/text` or
  `POST /ingestions/file`) and returns immediately once the job is accepted
  (`202`); it does not wait for conversion/embedding to finish. The drawer and
  its tabs stay fully interactive during processing — submitting does not
  disable navigation, only the in-flight submission's own form fields.
- After submission, the job is polled (`GET /ingestions/{job_id}`) and shown
  in an "in progress" list above the document list, with its current stage
  (`Converting`/`Extracting`/`Chunking`/`Embedding`/`Finalizing`) or a safe
  failure message. Multiple jobs can be tracked concurrently — starting a
  second ingestion does not interrupt or hide the first. A completed job
  refreshes the document list; a terminal job (completed or failed) gets a
  dismiss control once reviewed.
- Preserve user input after a submission-request failure (e.g. a 4xx/5xx on
  the initial `POST`, before a job exists).

## 6. Responsive Rules

| Viewport | Behavior |
| --- | --- |
| `< 768px` | Both side areas become full-width temporary drawers; compact top bar; 16px content padding |
| `768-1023px` | Conversations use a 320px temporary drawer; documents use a right drawer up to 420px; chat fills width |
| `1024-1439px` | Persistent 280px conversation sidebar; 420px right document drawer overlays chat |
| `>= 1440px` | Persistent 304px sidebar; centered readable chat content; right drawer up to 420px |

- Verify layouts at 375, 768, 1024, and 1440px.
- No page-level horizontal scrolling is allowed.
- Message content, filenames, previews, and buttons must wrap or truncate within
  stable dimensions.
- The on-screen keyboard must not hide the mobile composer or current message.

## 7. Accessibility and Interaction

- All form controls have persistent labels and associated error descriptions.
- All icon-only buttons have accessible names and MUI tooltips where useful.
- Keyboard focus is visible and follows dialog/drawer focus-trap conventions.
- Dialogs focus the safest action initially; Escape closes non-pending dialogs.
- Loading and streaming updates use restrained live regions so token-by-token
  output does not overwhelm screen readers. Announce completion once.
- Errors use `role="alert"`; success feedback uses a polite live region.
- Respect `prefers-reduced-motion`; remove nonessential transitions when set.
- Maintain at least 44x44px touch targets on mobile.

## 8. Frontend Architecture Guidance

- Stack: Vite, React, TypeScript, MUI, MUI Icons, Vitest, React Testing Library.
- API base URL: `VITE_API_BASE_URL`, defaulting locally to
  `http://localhost:8080/api`.
- Keep authentication, API transport, SSE parsing, server data, and view state
  separate. API response types should mirror the backend contract.
- Centralize authenticated requests and `401` handling.
- Use an `AbortController` for stream cleanup on logout or app teardown. Do not
  abort an active stream through ordinary navigation because navigation is
  disabled while streaming.
- Keep unsent composer text local to the active draft conversation.

## 9. Required UI States

Every asynchronous surface must implement the applicable states below:

| State | Required behavior |
| --- | --- |
| Initial loading | Stable skeletons; no layout shift |
| Empty | Explain what is absent and expose the relevant primary action |
| Pending | Disable duplicate actions and preserve context |
| Streaming | Progressive answer, thinking before first token, stop navigation |
| Success | Confirm completion without blocking the workflow |
| Validation error | Inline field message with focus moved to first invalid field |
| API error | Human-readable message and retry where retry is safe |
| Unauthorized | Clear session and return to login |
| Not found | Remove stale item, refresh list, and select a valid fallback |

## 10. Acceptance Criteria

- A user can sign in, refresh within the same tab, and remain authenticated until
  the session expires or the tab session ends.
- A user can create, select, continue, and delete conversations with clear state
  at every step.
- Streamed Markdown renders progressively without unsafe HTML or page overflow.
- Inline citation markers and the source disclosure list both appear only once
  the message has finished (not mid-stream) and open the same source drawer;
  the drawer shows the backend's actual location label (page, line range,
  data rows, section, or record) rather than a hardcoded "no page" assumption.
- A failed stream preserves partial content and offers manual resend without an
  automatic duplicate message.
- A user can ingest pasted text or upload a file in any backend-supported
  format (txt/pdf/docx/csv/json) with editable generic metadata, see its
  ingestion job progress through to completion, and see the resulting
  document in the list.
- A user can refresh and delete documents through the drawer.
- Destructive document and conversation actions require confirmation.
- Calculator tool activity is visible while streaming and identical when a
  conversation is reopened, for the calculator and for any future tool the
  backend adds.
- The workspace remains usable by keyboard and at 375, 768, 1024, and 1440px
  without incoherent overlap or page-level horizontal scrolling.
- Automated tests cover login, session expiry, conversation workflows, SSE
  event parsing, Markdown safety, citations, source inspection, tool activity,
  ingestion validation, job polling, metadata behavior, document deletion, and
  responsive drawer behavior.

