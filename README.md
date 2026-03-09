# Caselog

Caselog is a self-hosted personal knowledge management system that combines notes, structured lists, and visual knowledge tools into a single searchable application powered by an ASP.NET Core API and a React frontend in one container.

## Run locally with Docker

1. (Optional) Set `CASELOG_PORT` (defaults to `5000`).
2. Build and start:
   ```bash
   docker compose -f docker/docker-compose.yml up --build
   ```
3. Verify health:
   ```bash
   curl http://localhost:${CASELOG_PORT:-5000}/health
   ```
