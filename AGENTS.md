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

## Design System

Caselog's visual identity is derived from the **Painfully Useful** Ghost theme. The design should feel like a premium editorial tool — not a generic SaaS dashboard. Both modes are first-class. Neither is an afterthought.

### Color Tokens

Define these as Tailwind CSS custom properties in `tailwind.config.ts` and as CSS variables in `globals.css`. Use semantic token names — never hardcode hex values in components.

```css
/* Dark mode (default) */
--color-bg-base:        #111111;   /* page background */
--color-bg-surface:     #1e1e1e;   /* cards, panels, sidebar */
--color-bg-elevated:    #242424;   /* modals, dropdowns, hover states */
--color-border:         #2e2e2e;   /* card borders, dividers */
--color-text-primary:   #f5f5f5;   /* headings, primary content */
--color-text-secondary: #a0a0a0;   /* metadata, labels, placeholders */
--color-text-muted:     #606060;   /* disabled, tertiary text */
--color-accent:         #f97316;   /* orange — CTAs, links, dates, tags, active states */
--color-accent-hover:   #ea6c0a;   /* orange darkened for hover */
--color-accent-subtle:  #f9731620; /* orange at low opacity for backgrounds */
--color-success:        #22c55e;
--color-warning:        #eab308;
--color-danger:         #ef4444;

/* Light mode */
--color-bg-base:        #f5f5f5;
--color-bg-surface:     #ffffff;
--color-bg-elevated:    #f0f0f0;
--color-border:         #e0e0e0;
--color-text-primary:   #111111;
--color-text-secondary: #555555;
--color-text-muted:     #999999;
--color-accent:         #f97316;   /* same orange — it works in both modes */
--color-accent-hover:   #ea6c0a;
--color-accent-subtle:  #f9731615;
```

### Typography

```css
/* Font stack */
--font-sans: 'Inter', system-ui, sans-serif;       /* body, UI */
--font-mono: 'JetBrains Mono', 'Fira Code', monospace; /* code blocks */

/* Scale */
--text-xs:   0.75rem;   /* metadata, badges */
--text-sm:   0.875rem;  /* labels, secondary text */
--text-base: 1rem;      /* body */
--text-lg:   1.125rem;  /* card titles */
--text-xl:   1.25rem;   /* section headers */
--text-2xl:  1.5rem;    /* page titles */
--text-3xl:  1.875rem;  /* hero headings */

/* Heading style: bold weight, tight tracking */
/* Metadata style: uppercase, letter-spacing: 0.08em, text-secondary */
/* Tag style: uppercase, text-xs, accent color, no background */
```

### Component Patterns

**Cards**
- Background: `bg-surface`
- Border: `1px solid border`
- Border radius: `8px`
- Padding: `16px`
- Image thumbnails: full-width, `aspect-ratio: 16/9`, `border-radius: 6px`, `object-fit: cover`
- Title: bold, `text-lg`, `text-primary`
- Metadata line: `text-xs uppercase tracking-wide text-secondary` — date • read time or entity type
- Accent elements (tags, dates, type labels): `color: accent`
- Hover: slight `bg-elevated` lift, no heavy shadow

**Navigation**
- Top bar: `bg-base` (not surface), full-width, `border-bottom: 1px solid border`
- Logo left, nav links center-left, search + theme toggle + user avatar right
- Active nav link: `accent` color underline
- Theme toggle: sun/moon icon button, `bg-elevated` pill

**Buttons**
- Primary: `bg-accent text-white font-semibold rounded-md px-4 py-2` — matches the orange "My Account" / "Join free" buttons on PU
- Secondary: `border border-border text-primary bg-transparent rounded-md px-4 py-2`
- Danger: `bg-danger text-white`
- Ghost: `text-accent` no background, hover underline

**Tags / Badges**
- Inline tags: `text-xs uppercase tracking-wide color-accent` — no pill background, just colored text
- Category pills (sidebar): `border border-border rounded-full px-3 py-1 text-sm text-primary`

**Sidebar (article/page layout)**
- Right sidebar: `bg-surface border border-border rounded-lg p-4`
- Section headers: `text-sm font-semibold text-primary uppercase tracking-wide mb-3`

**Forms / Inputs**
- Background: `bg-elevated`
- Border: `1px solid border`
- Focus ring: `2px solid accent`
- Border radius: `6px`
- Label: `text-sm text-secondary uppercase tracking-wide`

**Dividers**
- `1px solid border` — subtle, never heavy

### Theme Switching

- Default: respect `prefers-color-scheme` system setting
- User override: toggle stored in `localStorage` as `caselog-theme: 'dark' | 'light'`
- Toggle button in top nav — sun icon in dark mode, moon icon in light mode
- Apply theme class (`dark` / `light`) on `<html>` element
- All color tokens switch via CSS custom properties — no JS class toggling on individual components
- Transitions: `transition: background-color 0.2s ease, color 0.2s ease` on `body` only — not on every element (causes jank)

### Layout Grid

- Max content width: `1200px` centered
- Standard page: full-width sidebar nav (left, `240px`) + main content area
- Article/page view: main content (`65%`) + right sidebar (`320px`) with gap
- Mobile: sidebar collapses to hamburger menu, single column layout
- Spacing scale: `4px` base unit — use multiples (`8`, `12`, `16`, `24`, `32`, `48`)

### Do Not

- Do not use generic component libraries (shadcn, MUI, Ant Design) — build components from Tailwind primitives
- Do not use heavy drop shadows — the dark theme uses border + elevation, not shadows
- Do not use blue as a primary accent — orange is the brand color, use it consistently
- Do not use rounded-full on rectangular elements — `rounded-md` (6-8px) is the standard
- Do not animate everything — motion should be purposeful (hover states, theme transition, modal open/close only)

---

## User Management

Caselog supports multiple users with role-based access. The admin user manages all other users through a dedicated UI.

### Roles

| Role | Capabilities |
|---|---|
| Admin | Full access to all content, user management, instance settings |
| Member | Own content + read internal-visibility content from other users |

### User Management Pages

```
/admin/users              List all users — name, email, role, last login, status
/admin/users/new          Create new user form
/admin/users/{id}         Edit user — name, email, role, enable/disable account
```

Admin-only. Non-admin access redirects to dashboard with 403 toast.

### User Management Features

- **List users** — table view: avatar initial, name, email, role badge, last login date, active/disabled status badge
- **Create user** — form: email, display name, role (admin/member), temporary password (auto-generated, shown once, user prompted to change on first login)
- **Edit user** — change display name, email, role. Cannot demote the last admin.
- **Disable user** — toggle — disables login without deleting data. Disabled badge shown in user list.
- **Delete user** — admin only, requires confirmation dialog — hard delete of user record. Content they created is reassigned to admin or orphaned (admin chooses).
- **Force password reset** — sends reset email if SMTP configured, otherwise shows a one-time reset link to copy
- **Impersonate user** — admin can view the app as a specific user (read-only impersonation for support purposes). Banner shown at top when impersonating. Exit impersonation button always visible.

### User Profile (self-service, all users)

Available at `/settings/profile`:
- Change display name
- Change email (requires current password confirmation)
- Change password (requires current password)
- Upload avatar (stored as base64 or small file, shown as initials fallback if none)
- Enroll / disable 2FA
- View and manage own API keys

### API Endpoints

```
GET    /api/admin/users              # admin only — list all users
POST   /api/admin/users              # admin only — create user
GET    /api/admin/users/{id}         # admin only — get user detail
PUT    /api/admin/users/{id}         # admin only — update user
DELETE /api/admin/users/{id}         # admin only — delete user
POST   /api/admin/users/{id}/disable # admin only — disable account
POST   /api/admin/users/{id}/enable  # admin only — enable account
POST   /api/admin/users/{id}/impersonate # admin only — get impersonation token
POST   /api/admin/users/{id}/reset-password # admin only — trigger reset

GET    /api/profile                  # own profile
PUT    /api/profile                  # update own profile
POST   /api/profile/avatar           # upload avatar
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
/settings/profile    Own profile — name, email, password, avatar, 2FA, API keys
/admin/users         User list (admin only)
/admin/users/new     Create user (admin only)
/admin/users/{id}    Edit user (admin only)
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

## Goal
Fix Caselog Docker build/deploy issues and SQLite/EF Core initialization issues, then verify with real commands.

## Repo layout
- Docker assets: `docker/`
- API: `src/Caselog.Api`
- UI: `src/caselog-ui`

## Key expectations
- Capture real errors, not just wrapper messages
- Prefer minimal, correct fixes
- Verify Docker build and app startup before finishing
- If EF migrations are missing, add them properly and ensure startup uses them safely

## Investigation checklist
1. Inspect:
   - `docker/Dockerfile`
   - `docker/docker-compose.yml`
   - `src/Caselog.Api/Caselog.Api.csproj`
   - `src/Caselog.Api/Program.cs`
2. Search for:
   - `Migrations`
   - `DbContext`
   - `Users`
   - migration history reset logic
3. Reproduce:
   - `dotnet restore`
   - `dotnet publish`
   - `docker build`
4. Verify final state:
   - image builds
   - app starts
   - SQLite required tables exist

## Useful commands
- `find . -maxdepth 4 \( -name "*.csproj" -o -name "Directory.Build.props" -o -name "Directory.Build.targets" -o -name "NuGet.Config" -o -name "global.json" -o -name "*.sln" \) | sort`
- `dotnet restore ./src/Caselog.Api/Caselog.Api.csproj`
- `dotnet publish ./src/Caselog.Api/Caselog.Api.csproj -c Release -o /tmp/caselog-publish /p:UseAppHost=false`
- `docker build -f docker/Dockerfile -t caselog-test .`
