# Caselog

Caselog is a self-hosted personal knowledge management system built for people who want one place for notes, structured information, and visual thinking without dragging in a pile of external services.

It combines:

- **Pages** for freeform notes and long-form writing
- **Shelves** and **notebooks** for lightweight organization
- **Structured lists** for repeatable data
- **Mind maps** for visual relationships
- **Tags**, **follow-ups**, and **search** for retrieval
- **AI intake** for sending markdown directly into the system

Caselog is designed to run as a **single container** with an **ASP.NET Core API**, a **React frontend**, and **SQLite** for storage.

> Status: active build / early development. Core platform and feature areas are being implemented in checkpoints.

---

## Why Caselog

A lot of personal knowledge tools either force structure too early or scatter information across disconnected systems.

Caselog is meant to be a practical middle ground:

- Start with a simple note
- Add structure when it becomes useful
- Keep everything searchable
- Run it yourself
- Stay lightweight enough for a homelab or small server

The goal is a self-hosted knowledge system that can grow from quick notes into a longer-term working memory.

---

## Planned feature set

### Core knowledge model
- Shelves
- Notebooks
- Pages
- Standalone notes
- Unified search index

### Organization and retrieval
- Tagging across multiple entity types
- Follow-up tracking
- Location-aware search
- Search filters for type, tag, source, date, and exact phrase matching

### Structured data
- Custom list types
- Dynamic fields
- List entries with typed values
- Linking structured data to pages

### Visual thinking
- Mind maps
- Node trees
- Visual knowledge relationships
- Attaching mind maps to pages

### AI-friendly intake
- Markdown intake endpoint
- Optional YAML frontmatter
- Auto-placement into shelves and notebooks
- Source tagging
- Follow-up creation during intake

### Frontend experience
- React application shell
- Shelf, notebook, and page navigation
- Rich page editing
- Search UI
- Dashboard views
- Follow-ups view
- Settings page
- Dark mode
- PWA support

### Production-readiness goals
- Single-container deployment
- SQLite with WAL mode
- Background summary job
- Email notification jobs
- Healthcheck support
- Lean Docker image

---

## Tech stack

- **Backend:** ASP.NET Core Web API (.NET 8)
- **Frontend:** React + Vite + TypeScript
- **Database:** SQLite
- **Search:** SQLite FTS5
- **Container:** Docker
- **Styling:** Tailwind CSS

---

## Getting started

Caselog is intended to be easy to run in a homelab, lab environment, or lightweight server setup.

The application is packaged as a single container that serves both the API and frontend, while persisting SQLite data to a mounted path or volume.

### Requirements

- Docker
- Docker Compose

---

## Run locally with Docker Compose

Clone the repository:

```bash
git clone https://github.com/Digitalcheffe/caselog.git
cd caselog
```

Optionally set the app port. If you do nothing, Caselog defaults to `5000`.

```bash
export CASELOG_PORT=5000
```

Build and start the application:

```bash
docker compose -f docker/docker-compose.yml up --build
```

Verify the app is healthy:

```bash
curl http://localhost:${CASELOG_PORT:-5000}/health
```

If everything is working, open:

```text
http://localhost:5000
```

Or use whatever port you assigned through `CASELOG_PORT`.

---

## Manual Docker build

If you want to build and run the container manually instead of using Docker Compose, use the following process.

Build the image:

```bash
docker build --progress=plain -f docker/Dockerfile -t caselog-test .
```

Create a local data folder:

```bash
mkdir -p "$PWD/.data"
```

Run the container:

```bash
docker run --rm \
  -p 5000:5000 \
  -e CASELOG_PORT=5000 \
  -e CASELOG_DATA_PATH=/data/caselog.db \
  -e CASELOG_DB_PATH=/data/caselog.db \
  -v "$PWD/.data:/data" \
  --name caselog \
  caselog-test
```

Run a health check:

```bash
curl http://localhost:5000/health
```

---

## Portainer deployment

Caselog can also be deployed through Portainer.

### Option 1: Deploy as a stack from Git

In Portainer:

1. Create a new stack
2. Point the stack at this repository
3. Use the included compose file:
   - `docker/docker-compose.yml`
4. Set the required environment values:
   - `CASELOG_PORT` → exposed application port
   - `CASELOG_BUILD_CONTEXT` → optional build context value if your Portainer environment needs it

Example values:

```env
CASELOG_PORT=5000
CASELOG_BUILD_CONTEXT=..
```

If your Portainer host or compose setup supports named volumes cleanly, that is usually the easiest path for SQLite persistence.

### Option 2: Build directly from the Dockerfile

If you are building directly in Portainer instead of using the compose file:

- **Build context:** repository root
- **Dockerfile path:** `docker/Dockerfile`

When creating the container or stack, make sure you:

- map persistent storage to `/data`
- expose the application port you want to use
- set `CASELOG_PORT` if needed for your deployment model

---

## Data storage

Caselog stores its SQLite database at:

```text
/data/caselog.db
```

Persist `/data` to a host path or named volume so your data survives rebuilds, image updates, and the occasional “well that was a bad idea” redeploy.

---

## Health check

Caselog exposes a health endpoint for simple validation and monitoring:

```text
/health
```

Example:

```bash
curl http://localhost:5000/health
```

This is useful for:

- confirming the app is up after deployment
- validating Docker or Portainer health checks
- troubleshooting during builds and upgrades

---

## Development direction

Caselog is being built in checkpoints, roughly in this order:

1. Foundation and database
2. Core API features
3. Visibility and user features
4. React UI
5. Production polish and PWA support

This repository is public, but the project is still in active development and the feature set is not yet fully complete.

---

## Project goals

- Keep the stack self-hosted and understandable
- Avoid external service sprawl
- Make structure optional instead of mandatory
- Support both human writing and AI-assisted intake
- Stay lightweight enough to run comfortably in a homelab

---

## Contributing

This project is evolving quickly. If you open an issue or pull request, keep changes focused and aligned with the core direction of the app:

- single-container deployment
- SQLite-first design
- searchable knowledge workflows
- practical, low-friction UX

---

## License

Add the license you want to use here.
