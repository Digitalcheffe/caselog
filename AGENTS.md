# Caselog — Agent Briefing

You are building **Caselog**, a self-hosted personal knowledge management system. Read this file completely before starting any task. All decisions should align with the philosophy, architecture, and constraints defined here.

---

## What You Are Building

Caselog is a self-hosted PKM system for a single user or small household. It combines freeform note-taking, structured list data, and visual mind maps into a unified, searchable knowledge base running in a single Docker container.

**Core philosophy:** Structure is optional and additive. Everything starts as a plain note. Structure emerges over time. The app never forces organization — it accommodates it when the user is ready.

Caselog is also an **AI memory layer**. External AI tools (Claude, ChatGPT, and others) write markdown directly into Caselog via a simple intake API endpoint.

---

## Tech Stack — Non-Negotiable

| Layer | Choice | Reason |
|---|---|---|
| Backend | ASP.NET Core Web API (C#) | Best SQLite/EF Core support, strong background job story, familiar to maintainer |
| ORM | Entity Framework Core | Provider abstraction, clean migrations |
| Database | SQLite (WAL mode) | Zero config, single container, single user |
| Search | SQLite FTS5 | Built in, no external service |
| Frontend | React + Vite (TypeScript) | PWA capable, single codebase for browser and mobile |
| Rich Editor | TipTap | WYSIWYG, markdown-based, slash commands |
| Mind Maps | React Flow | Best in class for node-based visual editors |
| Container | Single Docker container | API + static frontend files + SQLite volume |
| Styling | Tailwind CSS | Utility-first, no component library overhead |

**Do not introduce** external databases, managed cloud services, or additional containers. The entire app must run in one container. SQLite is the only database for the initial build.

---

## Project Structure

```
caselog/
├── src/
│   ├── Caselog.Api/              # ASP.NET Core Web API
│   │   ├── Controllers/
│   │   ├── Models/
│   │   ├── Services/
│   │   ├── Data/                 # EF Core DbContext, migrations
│   │   ├── Jobs/                 # Background hosted services
│   │   ├── Middleware/
│   │   └── Program.cs
│   └── caselog-ui/               # React + Vite frontend
│       ├── src/
│       │   ├── components/
│       │   ├── pages/
│       │   ├── hooks/
│       │   ├── api/              # API client layer
│       │   └── main.tsx
│       └── vite.config.ts
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
├── docs/
└── AGENTS.md
```

---

## Data Model

### Core Tables

```sql
Shelves
  Id (guid), Name, Description, CreatedAt, UpdatedAt

Notebooks
  Id (guid), ShelfId (nullable FK), Name, Description, CreatedAt, UpdatedAt

Pages
  Id (guid), NotebookId (nullable FK), Title, Content (markdown text),
  Visibility ('private'|'internal'|'public'), PublicSlug (nullable unique),
  CreatedAt, UpdatedAt

Tags
  Id (guid), Name (unique, lowercase, trimmed)

EntityTags
  EntityType ('page'|'list'|'listentry'|'mindmap'|'note'), EntityId (guid), TagId (guid)

ListTypes
  Id (guid), Name, Description,
  Visibility ('private'|'internal'|'public'), PublicSlug (nullable unique),
  CreatedAt

ListTypeFields
  Id (guid), ListTypeId (FK), FieldName, FieldType ('text'|'number'|'boolean'|'date'|'select'),
  Required (bool), SortOrder (int)

ListEntries
  Id (guid), ListTypeId (FK), CreatedAt, UpdatedAt

ListEntryFieldValues
  Id (guid), ListEntryId (FK), ListTypeFieldId (FK), Value (JSON text)

PageListAttachments
  Id (guid), PageId (FK), ListEntryId (FK), SortOrder (int)

Notes
  Id (guid), EntityType (nullable), EntityId (nullable guid),
  Content (markdown text),
  Visibility ('private'|'internal'|'public'), PublicSlug (nullable unique),
  CreatedAt, UpdatedAt

MindMaps
  Id (guid), Title,
  Visibility ('private'|'internal'|'public'), PublicSlug (nullable unique),
  CreatedAt, UpdatedAt

MindMapNodes
  Id (guid), MindMapId (FK), ParentNodeId (nullable FK self-referential),
  Label, Notes (text), SortOrder (int)

PageMindMapAttachments
  Id (guid), PageId (FK), MindMapId (FK)

FollowUps
  Id (guid), EntityType, EntityId (guid), Note (text), CreatedAt, ClearedAt (nullable)

PageSummaries
  Id (guid), PageId (FK unique), Summary (plain text), GeneratedAt

-- FTS5 virtual table for unified search
CREATE VIRTUAL TABLE search_index USING fts5(
  entity_type,
  entity_id,
  title,
  content,
  tags,
  summary
);
```

### Users & Auth (multi-user ready)

```sql
Users
  Id (guid), Email (unique), PasswordHash, Role ('admin'|'member'),
  TwoFactorEnabled (bool), TwoFactorSecret (nullable),
  CreatedAt, LastLoginAt (nullable)

UserApiKeys
  Id (guid), UserId (FK), KeyHash, Label, CreatedAt, LastUsedAt (nullable)
```

Every owned entity gets a `UserId` FK. Admin role has full access. Member role owns their own content and reads internal-visibility content.

---

## API Design

### Authentication
All `/api/*` endpoints require:
```
Authorization: Bearer {api-key}
```

API keys are per-user, hashed in storage, shown once on creation, revocable individually.

Public content is served unauthenticated at `/public/{slug}`.

### Full API Surface

```
# Structure
GET|POST        /api/shelves
GET|PUT|DELETE  /api/shelves/{id}
GET             /api/shelves/{id}/notebooks
GET|POST        /api/notebooks
GET|PUT|DELETE  /api/notebooks/{id}
GET             /api/notebooks/{id}/pages
GET|POST        /api/pages
GET|PUT|DELETE  /api/pages/{id}

# Lists
GET|POST        /api/lists
GET|PUT|DELETE  /api/lists/{id}
GET|POST        /api/lists/{id}/fields
PUT|DELETE      /api/lists/{id}/fields/{fieldId}
GET|POST        /api/lists/{id}/entries
GET|PUT|DELETE  /api/entries/{id}

# Notes
GET|POST        /api/notes
GET|PUT|DELETE  /api/notes/{id}
GET             /api/pages/{id}/notes
GET             /api/entries/{id}/notes

# Attachments
GET             /api/pages/{id}/attachments
POST|DELETE     /api/pages/{id}/lists        (attach/detach list entry)
POST|DELETE     /api/pages/{id}/mindmaps     (attach/detach mind map)

# Tags
GET             /api/tags
GET             /api/tags/{name}/items
POST            /api/{entityType}/{id}/tags
DELETE          /api/{entityType}/{id}/tags/{tag}

# Follow-ups
GET             /api/followups
POST            /api/{entityType}/{id}/followup
DELETE          /api/{entityType}/{id}/followup

# Search
GET             /api/search?q={query}&type=&tag=&shelf=&source=&after=

# AI Intake
POST            /api/intake           (text/markdown body, optional frontmatter)

# Visibility / Publishing
POST            /api/{type}/{id}/publish
PUT             /api/{type}/{id}/publish

# Public (unauthenticated)
GET             /public/{slug}

# Auth
POST            /api/auth/login
POST            /api/auth/logout
POST            /api/auth/2fa/setup
POST            /api/auth/2fa/verify

# API Keys
GET|POST        /api/apikeys
DELETE          /api/apikeys/{id}

# Users (admin only)
GET|POST        /api/users
GET|PUT|DELETE  /api/users/{id}
```

### AI Intake Endpoint

```
POST /api/intake
Content-Type: text/markdown
Authorization: Bearer {api-key}

---
shelf: Homelab
notebook: Proxmox
source: claude
tags: [networking, vlan]
follow_up: true
follow_up_note: Verify config held after reboot
---

Markdown content here...
```

- Optional frontmatter for filing hints and tags
- No frontmatter = drops into Unorganized (standalone page)
- Source tag automatically applied (`source:claude`, `source:manual`, `source:webhook`)
- Returns `{ item_id, url }` on success
- Immediately indexed in FTS5

### Search Query Language

Parsed from the `q` parameter:
```
tag:homelab
shelf:Cooking notebook:HotSauce
source:claude after:2026-03-01
"vlan trunk" tag:homelab
type:list tag:purchases
```

---

## Frontend Pages

```
/                    Dashboard — recent items, open follow-ups, quick capture
/shelves             Shelf browser
/shelves/{id}        Shelf detail — notebooks list
/notebooks/{id}      Notebook detail — pages list
/pages/{id}          Page view/edit — TipTap editor, attached lists, attached mind maps
/lists               All list types
/lists/{id}          List type — entries table view
/entries/{id}        Single entry — field values, attached notes
/mindmaps            All mind maps
/mindmaps/{id}       Mind map editor — React Flow canvas
/notes               All standalone notes
/search              Search results
/followups           Open follow-ups list
/unorganized         Items with no parent (shelf/notebook/page)
/settings            API keys, user profile, 2FA, SMTP config
/public/{slug}       Public read-only view (unauthenticated)
```

---

## Background Jobs

### Nightly Summary Job (IHostedService)
- Runs once per day at configurable time (default 2:00 AM)
- For every page modified in last 24 hours:
  1. Extract headings, first sentence of each section, list item labels, tags
  2. Generate plain text summary (deterministic — no AI call required)
  3. Store in `PageSummaries` table
  4. Update `search_index` FTS5 entry

### Follow-up Digest (IHostedService)
- Runs at configurable time (default 8:00 AM)
- Sends email digest of all open follow-ups via SMTP
- Skip if no open follow-ups

---

## Hosting & Environment

Single Docker container. No external services required.

```dockerfile
# Single container:
# - ASP.NET Core API (Kestrel)
# - React PWA served as static files from wwwroot
# - SQLite database on volume mount
# - Background job scheduler (ASP.NET hosted services)
```

### Environment Variables

```
CASELOG_API_KEY=                   # legacy single-key fallback (optional)
CASELOG_DATA_PATH=/data/caselog.db
CASELOG_PORT=5000
CASELOG_JWT_SECRET=                # for session tokens
CASELOG_SMTP_HOST=
CASELOG_SMTP_PORT=587
CASELOG_SMTP_USER=
CASELOG_SMTP_PASS=
CASELOG_SMTP_FROM=
CASELOG_NOTIFICATIONS_ENABLED=true
CASELOG_SUMMARY_JOB_TIME=02:00
CASELOG_DIGEST_JOB_TIME=08:00
```

---

## Testing

- Unit tests: xUnit for service layer logic
- Integration tests: WebApplicationFactory for API endpoints
- Frontend: Vitest for component and hook tests
- Run all tests before opening a PR: `dotnet test` and `npm run test`
- PRs should not be opened if tests fail

---

## Coding Standards

- C#: nullable reference types enabled, async/await throughout, no synchronous DB calls
- EF Core: no raw SQL except for FTS5 virtual table operations
- API responses: consistent `{ data, error, meta }` envelope shape
- Errors: RFC 7807 Problem Details format
- All GUIDs — no integer primary keys
- Soft deletes: not used — hard delete is fine, references handle cascade
- TypeScript: strict mode, no `any`
- React: functional components only, hooks for state, no class components
- API client: generated or hand-written fetch wrapper in `src/api/` — no raw fetch calls in components

---

## What Caselog Is Not

- Not a task manager — follow-up flags are signals only
- Not a calendar
- Not cloud-dependent — no external API calls required at runtime
- Not collaborative beyond household-scale multi-user
- Runs entirely in one container, always

---

## Checkpoint Model

Development is organized into checkpoints. Each checkpoint is a PR. A checkpoint is complete when:
1. All features for that checkpoint are implemented
2. All tests pass
3. Docker build succeeds
4. The app starts and the checkpoint features work end to end

**Do not merge features from a later checkpoint into an earlier checkpoint PR.** Keep them clean and scoped.
