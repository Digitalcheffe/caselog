# Caselog — Codex Prompts

Use these prompts exactly as written. Copy and paste into chatgpt.com/codex.
Always make sure AGENTS.md is in the repo root before running any prompt.

---

## CHECKPOINT 1 — Foundation

### Issue 1
```
Read AGENTS.md fully before starting. Complete Issue #1: Project scaffold and repo structure. Create the full folder structure, ASP.NET Core Web API project, React + Vite TypeScript frontend, multi-stage Dockerfile, and docker-compose.yml. The container should start with docker compose up --build and GET /health should return 200. No features beyond what Issue #1 describes. Open a PR when complete.
```

### Issue 2
```
Read AGENTS.md fully before starting. Complete Issue #2: Database schema and EF Core setup. Implement the full CaselogDbContext with all entities from AGENTS.md, enable SQLite WAL mode on startup, create the initial migration covering all tables including the FTS5 virtual table via raw SQL, and apply migrations automatically on app start. Data layer only — no API endpoints. Open a PR when complete.
```

### Issue 3
```
Read AGENTS.md fully before starting. Complete Issue #3: API key authentication middleware. Implement the ApiKeyAuthenticationHandler that extracts the Bearer token, hashes it, looks up the matching UserApiKeys record, and sets the authenticated user identity. Apply authentication to all /api/* routes. Exclude /health and /public/* from auth. Seed a default admin user and API key on first startup if no users exist and log the key clearly to console. Return 401 RFC 7807 Problem Details on invalid or missing key. Open a PR when complete.
```

### Issue 4
```
Read AGENTS.md fully before starting. Complete Issue #4: Shelves, Notebooks, and Pages API. Implement full CRUD controllers for Shelves, Notebooks, and Pages. All responses use the { data, error } envelope. Support nested list endpoints (/api/shelves/{id}/notebooks, /api/notebooks/{id}/pages). Basic pagination on all list endpoints. CASCADE delete on shelf and notebook removes children. Wire FTS5 index on Page create, update, and delete. Return 404 Problem Details when entity not found. Open a PR when complete.
```

### Run all CP1 issues together
```
Read AGENTS.md fully before starting. Complete Issues #1, #2, #3, and #4 sequentially in that exact order. Complete and commit each issue fully before starting the next. These are the Checkpoint 1 issues: project scaffold, database schema, auth middleware, and Shelves/Notebooks/Pages API. Open a single PR for all four when done.
```

---

## CHECKPOINT 2 — Core Features

### Issue 5
```
Read AGENTS.md fully before starting. Complete Issue #5: Tags API. Implement the polymorphic tagging system. GET /api/tags returns all tags with usage counts. GET /api/tags/{name}/items returns all entities with that tag. POST /api/{entityType}/{id}/tags appends tags. DELETE /api/{entityType}/{id}/tags/{tag} removes a tag. Auto-apply source and type tags on all entity creation. Update the FTS5 search index tags field when tags change. Open a PR when complete.
```

### Issue 6
```
Read AGENTS.md fully before starting. Complete Issue #6: Notes API. Implement full CRUD for Notes. Notes can be standalone or attached to any entity via entityType and entityId. GET /api/pages/{id}/notes and GET /api/entries/{id}/notes return attached notes. Wire FTS5 index for note content. Notes support visibility field. Open a PR when complete.
```

### Issue 7
```
Read AGENTS.md fully before starting. Complete Issue #7: List system API. Implement CRUD for ListTypes, ListTypeFields, and ListEntries. Field types: text, number, boolean, date, select. Entry values stored as JSON in ListEntryFieldValues. Adding a new field to a ListType must not break existing entries — missing fields return null. Wire FTS5 index for list entry field values. Open a PR when complete.
```

### Issue 8
```
Read AGENTS.md fully before starting. Complete Issue #8: Mind maps API. Implement CRUD for MindMaps and MindMapNodes. Full node tree returned in GET /api/mindmaps/{id}. Each map has exactly one root node (ParentNodeId null). GET /api/mindmaps/{id}/export?format=png and ?format=svg return a placeholder response. Mind map node labels indexed in FTS5. Open a PR when complete.
```

### Issue 9
```
Read AGENTS.md fully before starting. Complete Issue #9: Page attachments API. Implement GET /api/pages/{id}/attachments returning all attached list entries and mind maps. POST and DELETE for attaching and detaching list entries and mind maps to pages. SortOrder maintained on attachments. Open a PR when complete.
```

### Issue 10
```
Read AGENTS.md fully before starting. Complete Issue #10: Follow-ups API. Implement GET /api/followups returning all open follow-ups across all entities with the response shape defined in AGENTS.md. POST /api/{entityType}/{id}/followup creates or updates a follow-up. DELETE /api/{entityType}/{id}/followup sets ClearedAt to now — preserve history, do not hard delete. Open a PR when complete.
```

### Issue 11
```
Read AGENTS.md fully before starting. Complete Issue #11: Search API. Implement GET /api/search with FTS5 unified search and guided query language parsing from the q parameter. Support tag:, shelf:, notebook:, source:, after:, type:, quoted phrases, and bare keyword matching. FTS5 weighted ranking: title > tags > summary > content. Results include entityType, entityId, title, snippet, tags, location, createdAt. Pagination via page and pageSize. Open a PR when complete.
```

### Issue 12
```
Read AGENTS.md fully before starting. Complete Issue #12: AI intake endpoint. Implement POST /api/intake accepting Content-Type: text/markdown with optional YAML frontmatter. Parse frontmatter fields: shelf, notebook, source, tags, follow_up, follow_up_note. File to correct shelf/notebook if specified, otherwise create standalone page. Apply source and tag metadata. Create FollowUp record if follow_up is true. Index in FTS5 immediately. Return { item_id, url }. Open a PR when complete.
```

### Run all CP2 issues together
```
Read AGENTS.md fully before starting. Complete Issues #5 through #12 sequentially in order. These are the Checkpoint 2 issues: Tags, Notes, List system, Mind maps, Page attachments, Follow-ups, Search, and AI intake. Complete and commit each issue fully before starting the next. Open a single PR for all eight when done.
```

---

## CHECKPOINT 3 — Auth, Users & Visibility

### Issue 13
```
Read AGENTS.md fully before starting. Complete Issue #13: User login and session auth. Implement POST /api/auth/login returning a JWT on success and POST /api/auth/logout. Both JWT and API key bearer tokens accepted as auth. BCrypt password hashing. Rate limit login to 5 attempts per minute per IP. Return 401 with generic message on invalid credentials. Open a PR when complete.
```

### Issue 14
```
Read AGENTS.md fully before starting. Complete Issue #14: TOTP two-factor authentication. Implement POST /api/auth/2fa/setup returning a QR code data URI and secret. POST /api/auth/2fa/verify validates the TOTP code. Login flow returns { requires2fa: true, token: partial-token } when 2FA is enabled, completed via /api/auth/2fa/verify. Use a standard .NET TOTP library. Open a PR when complete.
```

### Issue 15
```
Read AGENTS.md fully before starting. Complete Issue #15: API key management endpoints. Implement GET /api/apikeys listing the caller's keys (label, createdAt, lastUsedAt — never the hash). POST /api/apikeys generates a new key, returns raw value once only, stores hash. DELETE /api/apikeys/{id} revokes immediately. Open a PR when complete.
```

### Issue 16
```
Read AGENTS.md fully before starting. Complete Issue #16: User management (admin). Implement GET /api/users (admin only), POST /api/users (admin only), GET|PUT /api/users/{id}, DELETE /api/users/{id} (admin only, soft-disable). Members can only update their own profile. Non-admin access to /api/users returns 403. Send welcome email via SMTP if configured on user creation. Open a PR when complete.
```

### Issue 17
```
Read AGENTS.md fully before starting. Complete Issue #17: Content visibility and public sharing. Implement POST and PUT /api/{type}/{id}/publish to set visibility (private/internal/public) and public slug. GET /public/{slug} serves content unauthenticated for public items only — return 404 for private or internal. Auto-generate slug from title if not provided. Validate slug is URL-safe and unique. Open a PR when complete.
```

### Run all CP3 issues together
```
Read AGENTS.md fully before starting. Complete Issues #13 through #17 sequentially in order. These are the Checkpoint 3 issues: login and JWT auth, TOTP 2FA, API key management, admin user management, and content visibility. Complete and commit each issue fully before starting the next. Open a single PR for all five when done.
```

---

## CHECKPOINT 4 — Frontend

### Issue 18
```
Read AGENTS.md fully before starting. Complete Issue #18: React app shell, routing, and API client. Set up React Router with all routes from AGENTS.md. Build the API client module in src/api/ with Bearer token injection and { data, error } envelope unwrapping. API key stored in localStorage. Global error boundary. Loading and error states. Tailwind CSS configured. Dark mode via prefers-color-scheme. Basic layout: top nav, left sidebar, main content area. Open a PR when complete.
```

### Issue 19
```
Read AGENTS.md fully before starting. Complete Issue #19: Shelves, Notebooks, and Pages UI. Shelf browser, shelf detail, notebook detail, and page view with TipTap rich text editor. Auto-save on change debounced 1 second. Page metadata sidebar with tags, visibility, follow-up flag, attachments count. Breadcrumb trail. Unorganized view. Open a PR when complete.
```

### Issue 20
```
Read AGENTS.md fully before starting. Complete Issue #20: Search UI. Search bar in top nav with 300ms debounce. Search results page grouped by entity type with title, snippet, tags, location. Query language hint tooltip on focus. URL-based search state. Open a PR when complete.
```

### Issue 21
```
Read AGENTS.md fully before starting. Complete Issue #21: Lists UI. Lists index, list detail with field definitions panel and entries table. Add/edit/remove fields inline. Inline cell editing for all field types: text, number, boolean, date, select. Create new entry form generated from field definitions. Attach list entry to a page. Open a PR when complete.
```

### Issue 22
```
Read AGENTS.md fully before starting. Complete Issue #22: Mind map UI. Mind maps index. React Flow canvas editor. Add child nodes, double-click to edit label inline, delete node and subtree via context menu. Auto-layout top-down tree on first render. Attach mind map to a page. Open a PR when complete.
```

### Issue 23
```
Read AGENTS.md fully before starting. Complete Issue #23: Dashboard and Follow-ups UI. Dashboard with recently modified pages, open follow-up count badge, and quick capture text area that creates a standalone note. Follow-ups page listing all open follow-ups with clear button. Follow-up flag toggle on page detail sidebar. Empty states on all views. Open a PR when complete.
```

### Issue 24
```
Read AGENTS.md fully before starting. Complete Issue #24: Settings page. API key management with generate (show-once modal) and revoke. Profile: change email and password. 2FA: enroll via QR code and disable. SMTP configuration display (read-only). Instance info panel. Open a PR when complete.
```

### Issue 30
```
Read AGENTS.md fully before starting. Complete Issue #30: Design system foundation and theme tokens. Configure Tailwind with all custom color tokens from the Design System section of AGENTS.md. Define tokens as CSS custom properties in globals.css for dark (default) and light modes. Build ThemeProvider context and ThemeToggle component. Apply smooth theme transition on body only. Build a /dev/components showcase page (dev only) showing all base components in both themes. Open a PR when complete.
```

### Issue 31
```
Read AGENTS.md fully before starting. Complete Issue #31: Core UI component library. Build all reusable components from Tailwind primitives — no external component libraries. Components required: AppShell, TopNav, Sidebar, PageHeader, Card, CardGrid, MetadataLine, TagList, EmptyState, Badge, Input, Textarea, Select, Checkbox, Button (all variants), ConfirmDialog, Toast, Spinner, SkeletonCard. All components must work correctly in dark and light modes. Open a PR when complete.
```

### Issue 32
```
Read AGENTS.md fully before starting. Complete Issue #32: User management UI (admin). Build /admin/users list table, /admin/users/new create form, and /admin/users/{id} edit page. Include impersonation with persistent orange banner, last-admin protection, enable/disable toggle, and delete with ConfirmDialog. Non-admin access to /admin/* redirects to dashboard. Admin section visible in sidebar for admin users only. Open a PR when complete.
```

### Issue 33
```
Read AGENTS.md fully before starting. Complete Issue #33: User profile and self-service settings UI. Build /settings/profile with three tabs: Profile (avatar, name, email), Security (password change, 2FA enrollment, active sessions), API Keys (list, generate once modal, revoke). Avatar shows initials monogram fallback. Email change requires current password confirmation. Open a PR when complete.
```

### Run all CP4 issues together
```
Read AGENTS.md fully before starting. Complete Issues #18, #19, #20, #21, #22, #23, #24, #30, #31, #32, and #33 sequentially in that order. These are the Checkpoint 4 issues covering the full React frontend. Complete and commit each issue fully before starting the next. Issues #30 and #31 (design system and component library) must be completed before any other frontend issues as everything builds on them. Open a single PR for all when done.
```

---

## CHECKPOINT 5 — Polish & Production Readiness

### Issue 25
```
Read AGENTS.md fully before starting. Complete Issue #25: Nightly summary background job. Implement SummaryGenerationJob as IHostedService. Configurable run time via CASELOG_SUMMARY_JOB_TIME env var. For each page modified in last 24 hours extract headings, first sentences, and tags to generate a plain text summary. Upsert PageSummaries record and update FTS5 search_index summary field. Log job start, pages processed, and duration. No external AI API required. Open a PR when complete.
```

### Issue 26
```
Read AGENTS.md fully before starting. Complete Issue #26: Email notifications. Implement IEmailService with MailKit SMTP implementation. If SMTP not configured log instead of error. Implement follow-up digest IHostedService at configurable time. Send AI intake notification email on POST /api/intake. Send weekly summary on Sunday 09:00. CASELOG_NOTIFICATIONS_ENABLED=false suppresses all emails silently. Open a PR when complete.
```

### Issue 27
```
Read AGENTS.md fully before starting. Complete Issue #27: PWA configuration and offline support. Add manifest.json with proper icons and standalone display mode. Service worker via Vite PWA plugin caching recent pages. Offline indicator banner. Install prompt handling. App icons using clean Caselog logbook design — no placeholders. Open a PR when complete.
```

### Issue 28
```
Read AGENTS.md fully before starting. Complete Issue #28: Docker image optimization and healthcheck. Multi-stage Dockerfile: Node build stage, .NET build stage, final Alpine runtime stage only. Target image size under 300MB. Add HEALTHCHECK instruction. Proper .dockerignore. docker-compose.yml with restart policy, volume, and env var comments. Open a PR when complete.
```

### Issue 29
```
Read AGENTS.md fully before starting. Complete Issue #29: End-to-end smoke test suite. Backend integration tests using WebApplicationFactory covering: auth, full CRUD cycle with search verification, intake with follow-up, and follow-up lifecycle. Frontend Vitest unit tests for the API client module. Add GitHub Actions workflow running dotnet test and npm run test on push to main and on PRs. All tests must pass before opening the PR. Open a PR when complete.
```

### Run all CP5 issues together
```
Read AGENTS.md fully before starting. Complete Issues #25 through #29 sequentially in order. These are the Checkpoint 5 issues: nightly summary job, email notifications, PWA, Docker optimization, and smoke tests. Complete and commit each issue fully before starting the next. Open a single PR for all five when done.
```

---

## Feedback Prompts

### When something is broken after a merge
```
Read AGENTS.md. Issue #[N] was merged but the following is not working correctly: [describe what's broken]. The expected behavior per AGENTS.md is [describe expected]. Please investigate and fix. Open a PR with the fix.
```

### When you want Codex to review its own work
```
Read AGENTS.md. Review the current state of the codebase against the acceptance criteria for Issue #[N]. List anything that is missing or incorrect. Fix any gaps and open a PR.
```

### When starting a new checkpoint after the previous one is verified
```
Read AGENTS.md fully. Checkpoint [N] is complete and verified. Begin Checkpoint [N+1] starting with Issue #[first issue number]. Follow the checkpoint model defined in AGENTS.md — do not mix concerns from different checkpoints.
```
