# KeebMeet

A way to manage large-scale meetups for Tex Mechs.

## Architecture

The project has four parts:

- **Backend** (`backend/`) — a TypeScript/Express API backed by PostgreSQL via
  TypeORM. It runs as three processes: the **API** server, the **Auth** server,
  and a **Socket.IO** server for real-time meetup updates.
- **Frontend** (`frontend/`) — a React + Vite single-page app.
- **Bot** (`bot/`) — a Discord bot for handling meetup RSVPs.
- **Database** — PostgreSQL. The schema is managed by **TypeORM migrations**
  (see [DEVELOPMENT.md](DEVELOPMENT.md#database-migrations)); there is no
  separate schema tool.

## Documentation

- **[DEVELOPMENT.md](DEVELOPMENT.md)** — local development setup (backend,
  frontend, bot) and the database migration workflow.
- **[DEPLOY.md](DEPLOY.md)** — production deployment via Docker images published
  to GHCR by GitHub Actions.
