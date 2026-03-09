# Caselog — GitHub Issues by Checkpoint

Paste each issue into GitHub. The **Label** field maps to GitHub labels you should create first.
Create these labels before importing issues:

- `checkpoint-1` (color: #0075ca)
- `checkpoint-2` (color: #e4e669)
- `checkpoint-3` (color: #d93f0b)
- `checkpoint-4` (color: #0e8a16)
- `checkpoint-5` (color: #5319e7)
- `backend` (color: #1d76db)
- `frontend` (color: #cc317c)
- `infrastructure` (color: #bfd4f2)
- `auth` (color: #f9d0c4)

---

## CHECKPOINT 1 — Foundation
**Goal:** The app builds, starts, and has a working database with the full schema.
**PR gates:** Docker container starts. API health check returns 200. All migrations apply cleanly. No frontend required yet.

---

### Issue 1 — Project scaffold and repo structure
**Labels:** `checkpoint-1` `infrastructure`

Set up the full project structure as defined in AGENTS.md.

Tasks:
- Create `src/Caselog.Api` ASP.NET Core Web API project (.NET 8)
- Create `src/caselog-ui` Vite + React + TypeScript project
- Create `docker/Dockerfile` — multi-stage build, copies compiled React output into `wwwroot` of the API project, single container output
- Create `docker/docker-compose.yml` — mounts `/data` volume for SQLite, maps port from `CASELOG_PORT` env var
- Create `.gitignore` for both .NET and Node projects
- Create `README.md` with a one-paragraph description of Caselog and basic run instructions
- Verify `docker compose up` starts the container and the API responds on the configured port

Acceptance criteria:
- `docker compose up --build` succeeds with no errors
- `GET /health` returns `200 OK`
- Container starts cleanly from a fresh clone with no manual steps beyond `docker compose up`

---

### Issue 2 — Database schema and EF Core setup
**Labels:** `checkpoint-1` `backend`

Implement the full EF Core data model and migrations.

Tasks:
- Install EF Core with SQLite provider
- Create `CaselogDbContext` with all entities from AGENTS.md data model
- Enable SQLite WAL mode on startup via `PRAGMA journal_mode=WAL`
- Create initial migration covering all tables: Shelves, Notebooks, Pages, Tags, EntityTags, ListTypes, ListTypeFields, ListEntries, ListEntryFieldValues, PageListAttachments, Notes, MindMaps, MindMapNodes, PageMindMapAttachments, FollowUps, PageSummaries, Users, UserApiKeys
- Create FTS5 virtual table `search_index` via raw SQL in migration (EF Core does not model virtual tables)
- Apply migrations on startup automatically
- All primary keys are GUIDs
- Visibility fields default to 'private'

Acceptance criteria:
- App starts and applies migrations automatically against a fresh SQLite file
- All tables exist with correct columns and FK constraints
- FTS5 virtual table exists
- WAL mode confirmed via `PRAGMA journal_mode`

---

### Issue 3 — API key authentication middleware
**Labels:** `checkpoint-1` `backend` `auth`

Implement bearer token authentication using per-user API keys.

Tasks:
- Implement `ApiKeyAuthenticationHandler` — extracts `Authorization: Bearer {key}` header, hashes the key, looks up matching `UserApiKeys` record, sets authenticated user identity
- Register as ASP.NET Core authentication scheme
- Apply `[Authorize]` to all `/api/*` controllers
- Exclude `/health`, `/public/*` routes from auth requirement
- Update `LastUsedAt` on the `UserApiKeys` record on each authenticated request
- Seed a default admin user and one API key on first startup if no users exist (log the generated key to console clearly)
- Return 401 with RFC 7807 Problem Details on missing or invalid key

Acceptance criteria:
- `GET /api/shelves` with no auth header returns 401
- `GET /api/shelves` with valid bearer key returns 200
- Default admin key logged to console on first startup
- `LastUsedAt` updates on each request

---

### Issue 4 — Shelves, Notebooks, and Pages API
**Labels:** `checkpoint-1` `backend`

Implement the core knowledge hierarchy CRUD endpoints.

Tasks:
- `ShelvesController` — full CRUD, all responses use `{ data, error }` envelope
- `NotebooksController` — full CRUD, `GET /api/shelves/{id}/notebooks` returns notebooks for a shelf
- `PagesController` — full CRUD, `GET /api/notebooks/{id}/pages` returns pages for a notebook
- All list endpoints support basic pagination (`?page=1&pageSize=25`)
- All responses include `createdAt` and `updatedAt`
- DELETE cascades to child entities (notebook delete removes its pages, shelf delete removes its notebooks and their pages)
- Return 404 Problem Details when entity not found
- Wire up FTS5 index on Page create/update — index `title` and `content` fields

Acceptance criteria:
- Full CRUD works for all three resources via curl/Postman
- Nested list endpoints work (`/api/shelves/{id}/notebooks`, `/api/notebooks/{id}/pages`)
- Creating a page adds a row to `search_index`
- Updating a page updates the `search_index` row
- Deleting a page removes the `search_index` row

---

## CHECKPOINT 2 — Core Features
**Goal:** The complete backend API is functional. All endpoints work. Search works. AI intake works.
**PR gates:** All API endpoints return correct responses. FTS5 search returns ranked results. `POST /api/intake` accepts markdown with frontmatter and creates a page.

---

### Issue 5 — Tags API
**Labels:** `checkpoint-2` `backend`

Implement the polymorphic tagging system.

Tasks:
- `TagsController` — `GET /api/tags` returns all tags with usage count per tag
- `GET /api/tags/{name}/items` returns all entities tagged with this name (pages, notes, list entries, mind maps) — unified response shape with `entityType`, `entityId`, `title`, `location`
- `POST /api/{entityType}/{id}/tags` — body: `{ "tags": ["homelab", "proxmox"] }` — appends tags, creates tag records if they don't exist, lowercases all input
- `DELETE /api/{entityType}/{id}/tags/{tag}` — removes specific tag from entity
- Auto-apply source tags on all create operations: `source:manual` for API creates, `source:webhook` for intake
- Auto-apply type tags: `type:page`, `type:note`, `type:list`, `type:mindmap`
- Update `search_index` tags field when tags change on any entity

Acceptance criteria:
- Tag an entity, verify it appears in `GET /api/tags/{name}/items`
- Tags are lowercase and deduplicated
- Source and type tags auto-applied on entity creation
- Search index tags field updated when tags change

---

### Issue 6 — Notes API
**Labels:** `checkpoint-2` `backend`

Implement freeform notes attached to any entity or standalone.

Tasks:
- `NotesController` — full CRUD
- `GET /api/notes` — all standalone notes (no EntityType/EntityId set)
- `POST /api/notes` — body includes optional `entityType` and `entityId` for attachment
- `GET /api/pages/{id}/notes` — all notes attached to a page
- `GET /api/entries/{id}/notes` — all notes attached to a list entry
- Notes have markdown `content` field
- Wire FTS5 index for note content on create/update/delete
- Notes support visibility field (private/internal/public) and public_slug

Acceptance criteria:
- Create a standalone note, verify it appears in `GET /api/notes`
- Create a note attached to a page, verify it appears in `GET /api/pages/{id}/notes`
- Note content searchable via FTS5

---

### Issue 7 — List system API
**Labels:** `checkpoint-2` `backend`

Implement the structured list system (Tana Super Tag equivalent).

Tasks:
- `ListsController` — CRUD for `ListTypes`
- `GET|POST /api/lists`, `GET|PUT|DELETE /api/lists/{id}`
- Fields: `GET|POST /api/lists/{id}/fields`, `PUT|DELETE /api/lists/{id}/fields/{fieldId}`
- Field types: `text`, `number`, `boolean`, `date`, `select`
- Entries: `GET|POST /api/lists/{id}/entries`, `GET|PUT|DELETE /api/entries/{id}`
- Entry values stored as JSON in `ListEntryFieldValues`
- `PUT /api/entries/{id}` accepts partial field updates — only provided fields are updated
- Adding a new field to a ListType does not require migrating existing entries — missing fields return null
- Wire FTS5 index for list entry field values on create/update

Acceptance criteria:
- Create a list type with 3 fields
- Create entries with field values
- Add a new field to the list type, verify existing entries still return without error (new field value is null)
- Entry field values searchable via FTS5

---

### Issue 8 — Mind maps API
**Labels:** `checkpoint-2` `backend`

Implement the mind map data API and export endpoint.

Tasks:
- `MindMapsController` — CRUD for `MindMaps` and `MindMapNodes`
- `GET|POST /api/mindmaps`, `GET|PUT|DELETE /api/mindmaps/{id}`
- Node operations embedded in mind map CRUD — full node tree returned in `GET /api/mindmaps/{id}` response
- Nodes are a tree: `ParentNodeId` null = root node, each map has exactly one root
- `GET /api/mindmaps/{id}/export?format=png` and `?format=svg` — return placeholder response for now (full rendering is a frontend concern, export implementation is deferred to a later checkpoint)
- Mind map node labels indexed in FTS5

Acceptance criteria:
- Create a mind map with a 3-level node tree
- `GET /api/mindmaps/{id}` returns full tree structure
- Node labels searchable via FTS5

---

### Issue 9 — Page attachments API
**Labels:** `checkpoint-2` `backend`

Implement the system for attaching lists and mind maps to pages.

Tasks:
- `GET /api/pages/{id}/attachments` — returns all attached list entries and mind maps for a page, with type indicator
- `POST /api/pages/{id}/lists` — body: `{ "entryId": "..." }` — attaches list entry to page
- `DELETE /api/pages/{id}/lists/{entryId}` — detaches
- `POST /api/pages/{id}/mindmaps` — body: `{ "mindMapId": "..." }` — attaches mind map to page
- `DELETE /api/pages/{id}/mindmaps/{mapId}` — detaches
- `SortOrder` is maintained on attachments, support reorder via PUT

Acceptance criteria:
- Attach a list entry to a page, verify it appears in `GET /api/pages/{id}/attachments`
- Attach a mind map to a page, verify it appears in attachments
- Detach both, verify they no longer appear

---

### Issue 10 — Follow-ups API
**Labels:** `checkpoint-2` `backend`

Implement the follow-up flagging system.

Tasks:
- `FollowUpsController`
- `GET /api/followups` — all open (ClearedAt is null) follow-ups across all entities. Response shape per AGENTS.md: `{ id, title, type, location, follow_up_note, created_at, source }`
- `POST /api/{entityType}/{id}/followup` — body: `{ "note": "..." }` — creates or updates follow-up on entity
- `DELETE /api/{entityType}/{id}/followup` — sets ClearedAt to now (not hard delete — preserve history)
- `source` field derived from the entity's source tag

Acceptance criteria:
- Flag a page for follow-up
- `GET /api/followups` returns it with correct shape
- Clear it, verify it no longer appears in open follow-ups

---

### Issue 11 — Search API
**Labels:** `checkpoint-2` `backend`

Implement FTS5 unified search with query language parsing.

Tasks:
- `SearchController` — `GET /api/search?q={query}&type=&tag=&shelf=&source=&after=`
- Parse guided query language from `q` parameter:
  - `tag:homelab` — filter by tag
  - `shelf:Name notebook:Name` — filter by location
  - `source:claude` — filter by source tag
  - `after:2026-03-01` — filter by createdAt
  - `type:page` — filter by entity type
  - `"quoted phrase"` — exact phrase match
  - Bare words — FTS5 keyword match
- FTS5 weighted ranking: title > tags > summary > content
- Results include: `entityType`, `entityId`, `title`, `snippet` (FTS5 snippet), `tags`, `location`, `createdAt`
- Pagination: `?page=1&pageSize=25`

Acceptance criteria:
- `?q=homelab` returns pages with homelab in title or content
- `?q=tag:proxmox` returns only items tagged proxmox
- `?q=source:claude` returns only items created via intake
- `?q="exact phrase"` matches phrase exactly
- Results ranked by relevance (title matches rank higher than content matches)

---

### Issue 12 — AI intake endpoint
**Labels:** `checkpoint-2` `backend`

Implement the `POST /api/intake` endpoint for AI tool integration.

Tasks:
- Accept `Content-Type: text/markdown` with optional YAML frontmatter
- Parse frontmatter fields: `shelf`, `notebook`, `source`, `tags` (array), `follow_up` (bool), `follow_up_note` (string)
- If `shelf`/`notebook` specified: create or find matching shelf and notebook, file the page there
- If no location hints: create standalone page (Unorganized)
- Apply source tag: use `source` frontmatter value if provided, default to `source:webhook`
- Apply all tags from frontmatter tags array
- If `follow_up: true`: create a FollowUp record with `follow_up_note`
- Index in FTS5 immediately
- Return `{ "item_id": "...", "url": "/pages/{id}" }`
- Return 400 Problem Details on malformed markdown or missing required fields

Acceptance criteria:
- POST markdown with frontmatter, verify page created in correct shelf/notebook
- POST markdown with no frontmatter, verify standalone page created
- `follow_up: true` in frontmatter creates a FollowUp record
- Response contains `item_id`
- New page immediately appears in search results

---

## CHECKPOINT 3 — Auth, Users & Visibility
**Goal:** Multi-user login, 2FA, user management, and content visibility all work.
**PR gates:** Login flow works. 2FA enroll and verify works. Admin can manage users. Public slugs serve unauthenticated content.

---

### Issue 13 — User login and session auth
**Labels:** `checkpoint-3` `backend` `auth`

Implement username/password login and JWT session tokens alongside API key auth.

Tasks:
- `POST /api/auth/login` — body: `{ "email", "password" }` — returns short-lived JWT on success
- `POST /api/auth/logout` — invalidates token (server-side denylist or short expiry)
- JWT used as alternative auth alongside API key bearer tokens — both schemes accepted
- Password hashing: BCrypt
- Rate limit login attempts (5 per minute per IP — use simple in-memory rate limiter)
- Return 401 on invalid credentials with generic message (no user enumeration)

Acceptance criteria:
- Valid login returns JWT
- JWT accepted on `GET /api/shelves`
- Invalid password returns 401
- 6th login attempt within a minute returns 429

---

### Issue 14 — TOTP two-factor authentication
**Labels:** `checkpoint-3` `backend` `auth`

Implement TOTP 2FA.

Tasks:
- `POST /api/auth/2fa/setup` — generates TOTP secret, returns QR code data URI and secret for display
- `POST /api/auth/2fa/verify` — body: `{ "code": "123456" }` — validates TOTP code, enables 2FA on user account if not yet enabled
- Login flow: if user has 2FA enabled, initial login returns `{ "requires2fa": true, "token": "partial-token" }` instead of full JWT. Client calls `POST /api/auth/2fa/verify` with the partial token + TOTP code to get full JWT
- Use a standard .NET TOTP library (no homebrew TOTP implementation)

Acceptance criteria:
- Setup returns valid QR code scannable by Google Authenticator
- Correct TOTP code completes login
- Wrong TOTP code returns 401
- 2FA disabled user logs in without 2FA challenge

---

### Issue 15 — API key management endpoints
**Labels:** `checkpoint-3` `backend` `auth`

Implement per-user API key management.

Tasks:
- `GET /api/apikeys` — list caller's API keys (returns label, createdAt, lastUsedAt — never returns the key hash)
- `POST /api/apikeys` — body: `{ "label": "n8n integration" }` — generates new key, returns the raw key **once only** in response, stores hash
- `DELETE /api/apikeys/{id}` — revokes key immediately

Acceptance criteria:
- Create a key, verify it authenticates successfully
- Delete the key, verify it no longer authenticates (returns 401)
- Key value not returned after initial creation response

---

### Issue 16 — User management (admin)
**Labels:** `checkpoint-3` `backend` `auth`

Implement admin user management endpoints.

Tasks:
- `GET /api/users` — admin only, returns all users (no password hashes)
- `POST /api/users` — admin only, creates new user account, sends welcome email via SMTP if configured
- `GET|PUT /api/users/{id}` — admin can update any user, member can only update their own profile
- `DELETE /api/users/{id}` — admin only, soft-disable account (set disabled flag, do not delete data)
- `PUT /api/users/{id}` — members can update their own email, password (requires current password), display name
- Non-admin access to `/api/users` returns 403

Acceptance criteria:
- Admin creates a second user
- Second user logs in and accesses their own content
- Second user cannot access `/api/users` list
- Admin can disable a user account

---

### Issue 17 — Content visibility and public sharing
**Labels:** `checkpoint-3` `backend`

Implement the three-tier visibility model and public slug serving.

Tasks:
- `POST /api/{type}/{id}/publish` — body: `{ "visibility": "public", "slug": "proxmox-vlan-fix" }` — sets visibility and slug. Validates slug is URL-safe, unique across the instance
- `PUT /api/{type}/{id}/publish` — update visibility or slug
- `GET /public/{slug}` — unauthenticated endpoint, returns content only if visibility is 'public'. Returns 404 for private/internal content (do not reveal existence)
- `GET /api/{type}` list endpoints filter by visibility: admins see all, members see own + internal, unauthenticated sees nothing (covered by auth middleware)
- Auto-generate slug from title if not provided (slugify: lowercase, hyphens, truncate at 60 chars, append short ID suffix to ensure uniqueness)

Acceptance criteria:
- Set page to public with a custom slug
- `GET /public/{slug}` returns page content without auth header
- `GET /public/nonexistent` returns 404
- Set page back to private, verify `/public/{slug}` now returns 404
- Internal page not accessible at `/public/` but visible to authenticated members

---

## CHECKPOINT 4 — Frontend
**Goal:** A working React UI covering all core workflows. No polish required — functional is the bar.
**PR gates:** All listed pages render without errors. Core CRUD operations work through the UI. Search returns results.

---

### Issue 18 — React app shell, routing, and API client
**Labels:** `checkpoint-4` `frontend`

Set up the frontend foundation.

Tasks:
- React Router with routes matching all pages defined in AGENTS.md
- API client module in `src/api/` — thin fetch wrapper that injects `Authorization: Bearer {key}` header from stored key, handles `{ data, error }` envelope unwrapping
- API key stored in `localStorage` on first entry, cleared on logout
- Global error boundary — catches unhandled errors, displays user-friendly fallback
- Loading states and error states for all async operations
- Tailwind CSS configured
- Dark mode support (system preference via `prefers-color-scheme`)
- Basic layout: top nav with search bar, left sidebar with shelf/notebook tree, main content area

Acceptance criteria:
- App loads and shows login/API key entry screen when no key stored
- After entering valid key, app loads dashboard
- All routes render without console errors
- Dark mode activates based on system preference

---

### Issue 19 — Shelves, Notebooks, and Pages UI
**Labels:** `checkpoint-4` `frontend`

Implement the core navigation and page editing flow.

Tasks:
- Shelf browser page — list of shelves with notebook count, create/rename/delete shelf inline
- Shelf detail — notebooks list, create/rename/delete notebook
- Notebook detail — pages list with title, last updated, tag chips
- Page view/edit — TipTap rich text editor, auto-saves on change (debounced 1s), shows last saved timestamp
- Page metadata sidebar — tags, visibility, follow-up flag, attachments count
- Create page button available from notebook view and global nav
- Breadcrumb trail: Shelf > Notebook > Page
- Unorganized view — pages/notes with no parent

Acceptance criteria:
- Create a shelf, create a notebook inside it, create a page inside that
- Edit page content in TipTap, verify auto-save works
- Navigate via breadcrumbs
- Unorganized view shows items with no parent

---

### Issue 20 — Search UI
**Labels:** `checkpoint-4` `frontend`

Implement the search experience.

Tasks:
- Search bar in top nav, triggers on Enter or 300ms debounce
- Search results page — grouped by entity type, shows title, snippet, tags, location path
- Click result navigates to the entity
- Query language hint tooltip — shows available filter syntax when search bar is focused
- URL-based search state (`/search?q=...`) so searches are bookmarkable and shareable

Acceptance criteria:
- Type a query, results appear
- Results link to correct entities
- Filter syntax works in search bar (`tag:homelab`, `source:claude`)
- Back button returns to search results

---

### Issue 21 — Lists UI
**Labels:** `checkpoint-4` `frontend`

Implement the list type and entry management UI.

Tasks:
- Lists index — all list types, create new list type
- List detail — field definitions panel, entries table
- Add/edit/remove fields from list type inline (no page reload)
- Entries table — columns match field definitions, inline cell editing
- Create new entry — form generated from field definitions
- Support all field types: text input, number input, checkbox (boolean), date picker, select dropdown
- Attach a list entry to a page from within the list detail view

Acceptance criteria:
- Create a list type with 4 fields of different types
- Create 5 entries, edit values inline
- Add a new field, verify existing entries show null for new field without error
- Attach an entry to a page, verify it appears in that page's attachments

---

### Issue 22 — Mind map UI
**Labels:** `checkpoint-4` `frontend`

Implement the mind map editor.

Tasks:
- Mind maps index — list of all mind maps
- Mind map editor — React Flow canvas
- Add child node to any node via button or keyboard shortcut
- Double-click node to edit label inline
- Delete node (and its subtree) via context menu or keyboard
- Drag nodes to reorder within their parent
- Attach mind map to a page from within the editor
- Auto-layout on first render (top-down tree layout)

Acceptance criteria:
- Create a mind map with at least 3 levels of nodes
- Edit a node label inline
- Delete a node with children, verify subtree removed
- Attach mind map to a page

---

### Issue 23 — Dashboard and Follow-ups UI
**Labels:** `checkpoint-4` `frontend`

Implement the dashboard and follow-up views.

Tasks:
- Dashboard — recently modified pages (last 10), open follow-up count badge, quick capture text area (creates a standalone note on submit)
- Follow-ups page — list of all open follow-ups with entity title, location, note, and created date. Click to navigate to entity. Clear button marks as resolved.
- Follow-up flag toggle available on Page detail sidebar
- Empty states for all views (no items message, create CTA)

Acceptance criteria:
- Dashboard shows recent pages
- Quick capture creates a standalone note
- Follow-up flagged on a page appears in follow-ups list
- Clearing a follow-up removes it from the list

---

### Issue 24 — Settings page
**Labels:** `checkpoint-4` `frontend`

Implement the settings and profile UI.

Tasks:
- API key management — list keys with label and last used date, generate new key (show once modal), revoke
- Profile — change email, change password
- 2FA — enroll (QR code display + confirm code), disable
- SMTP configuration display (read-only — env var driven, shown for reference)
- Instance info — version, database provider, data path

Acceptance criteria:
- Generate a new API key, copy it from the show-once modal
- Enroll in 2FA using a real authenticator app
- Disable 2FA
- Profile email update persists

---

## CHECKPOINT 5 — Polish & Production Readiness
**Goal:** Ready to run as a real daily driver. Docker image is lean. Nightly jobs run. Email notifications work.
**PR gates:** Docker image under 300MB. Nightly summary job runs and updates search index. Email digest sends. PWA installs on mobile.

---

### Issue 25 — Nightly summary background job
**Labels:** `checkpoint-5` `backend`

Implement the nightly page summary job.

Tasks:
- `IHostedService` implementation — `SummaryGenerationJob`
- Configurable run time via `CASELOG_SUMMARY_JOB_TIME` env var (default 02:00)
- For each page modified in last 24 hours:
  1. Parse markdown content — extract H1/H2/H3 headings
  2. Extract first sentence of each paragraph
  3. Collect all tag names on the page
  4. Concatenate into plain text summary
  5. Upsert `PageSummaries` record
  6. Update `search_index` summary field for the page
- Log job start, pages processed count, and duration
- Does not require any external AI API — deterministic extraction only

Acceptance criteria:
- Job runs at configured time
- Modify a page, wait for job, verify `PageSummaries` record created/updated
- Search for content that only appears in the summary, verify it returns the page

---

### Issue 26 — Email notifications
**Labels:** `checkpoint-5` `backend`

Implement SMTP email notifications.

Tasks:
- Email service abstraction — `IEmailService` with SMTP implementation
- If `CASELOG_NOTIFICATIONS_ENABLED=false` or SMTP not configured: log instead of send (no errors)
- **Follow-up digest** (`IHostedService`): runs at `CASELOG_DIGEST_JOB_TIME` (default 08:00), sends one email listing all open follow-ups. Skip if none open. Plain text + simple HTML.
- **AI intake notification**: send email when item created via `POST /api/intake`. Subject: "New item added to Caselog: {title}". Include item title, source tag, location, and a link.
- **Weekly summary**: runs Sunday 09:00, sends count of items created that week, top tags used
- Use `MailKit` for SMTP — not `System.Net.Mail`

Acceptance criteria:
- Configure SMTP to a test mailbox
- `POST /api/intake` triggers notification email within 30 seconds
- Follow-up digest email arrives at configured time and lists open items
- Disabling notifications (`CASELOG_NOTIFICATIONS_ENABLED=false`) suppresses all emails without errors

---

### Issue 27 — PWA configuration and offline support
**Labels:** `checkpoint-5` `frontend`

Make the React app a proper installable PWA.

Tasks:
- `manifest.json` — app name, icons (at minimum 192x192 and 512x512 SVG-based), theme color, `display: standalone`
- Service worker via Vite PWA plugin — cache recent pages for offline read
- Offline indicator in UI — banner when service worker detects no network
- Install prompt handling — show "Add to home screen" CTA when browser fires `beforeinstallprompt`
- App icons — clean, simple design using the Caselog wordmark or a simple logbook icon. No placeholder icons.

Acceptance criteria:
- Chrome shows "Install app" option for the site
- Installed on Android homescreen, opens in standalone mode
- Recently viewed pages readable offline (content from cache)
- Offline banner appears when network disconnected

---

### Issue 28 — Docker image optimization and healthcheck
**Labels:** `checkpoint-5` `infrastructure`

Optimize the production Docker image.

Tasks:
- Multi-stage Dockerfile: Node build stage (React), .NET build stage, final runtime stage (ASP.NET runtime only — no SDK)
- Final image based on `mcr.microsoft.com/dotnet/aspnet:8.0-alpine`
- React build output copied into `wwwroot` of the published API
- Image size target: under 300MB
- `HEALTHCHECK` instruction in Dockerfile: `curl -f http://localhost:${CASELOG_PORT}/health || exit 1`
- `.dockerignore` excludes `node_modules`, `obj`, `bin`, `.git`, test projects
- `docker-compose.yml` includes restart policy, volume for `/data`, and all required env vars as comments

Acceptance criteria:
- `docker build` produces image under 300MB
- `docker inspect` shows HEALTHCHECK configured
- Container restarts automatically after crash (restart: unless-stopped)
- Fresh `docker compose up` from clean clone runs with zero manual steps

---

### Issue 29 — End-to-end smoke test suite
**Labels:** `checkpoint-5` `backend` `frontend`

Implement a minimal smoke test suite that validates the full stack works together.

Tasks:
- Backend integration tests using `WebApplicationFactory<Program>`:
  - Auth: valid key passes, invalid key fails
  - CRUD cycle: create shelf → notebook → page → verify search returns page → delete page → verify search no longer returns it
  - Intake: POST markdown → verify page created → verify follow-up created when frontmatter includes it
  - Follow-ups: create, list, clear
- Frontend: Vitest unit tests for the API client module (mock fetch, verify envelope unwrapping and error handling)
- All tests run via `dotnet test` and `npm run test`
- Both commands exit 0 before any PR is merged

Acceptance criteria:
- `dotnet test` passes with no failures
- `npm run test` passes with no failures
- Tests run in CI (add simple GitHub Actions workflow that runs both test commands on push to main and on PR)

---

## Notes for Codex

- Tackle one issue at a time. Complete it fully before starting the next.
- Do not mix checkpoint concerns. A Checkpoint 3 feature should not appear in a Checkpoint 1 PR.
- Open one PR per checkpoint, not one PR per issue. Accumulate all checkpoint issues into a single branch and PR.
- Branch naming: `checkpoint-1`, `checkpoint-2`, etc.
- Commit frequently with clear messages: `feat: add shelves CRUD controller`, `fix: FTS5 index not updating on page edit`
- If you encounter an ambiguity not covered in AGENTS.md, make a reasonable decision, implement it, and leave a comment in the code explaining the decision.
- Do not add features not described in AGENTS.md or the issues. Scope is intentional.
