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
  (see [Database migrations](#database-migrations)); there is no separate
  schema tool.

## Production deployment (Docker + GHCR)

Images are built by GitHub Actions and pushed to the GitHub Container Registry
(GHCR); the server pulls those pre-built images and never builds from source.
The whole stack runs on a single host — frontend, the three backend processes,
the bot, and PostgreSQL. Everything is served from one domain (the backends live
under `/api`, so there's no CORS), [Caddy](frontend/Caddyfile) provides HTTPS
automatically, and PostgreSQL data lives in a named volume that survives
redeploys.

### One-time GitHub setup

The frontend bakes its public URLs in at build time, so the
[Release workflow](.github/workflows/release.yml) needs them. Under
**Settings → Secrets and variables → Actions → Variables**, add repository
**Variables** (these are public values, not secrets): `PUBLIC_WEB_URL`,
`PUBLIC_API_URL`, `PUBLIC_AUTH_URL`, `PUBLIC_SOCKET_URL`, `DISCORD_CLIENT_ID`,
`DISCORD_REDIRECT_URI`.

Push to `main` (or run the workflow manually) to build and publish the images.
Then either make the three GHCR packages **public** so the server can pull
without credentials, or run `docker login ghcr.io` on the server with a
read-only token.

### On the server

The server needs only Docker, [docker-compose.yml](docker-compose.yml), and a
`.env` — no source, no build.

1. **Install Docker** (includes the `docker compose` plugin):

   ```bash
   curl -fsSL https://get.docker.com | sh
   ```

2. **Point DNS** at the host — a single A record for your domain (`example.com`
   → server IP). Make sure ports 80 and 443 are open so Caddy can issue certs.

3. **Copy the compose file and configure secrets.** Copy
   `docker-compose.yml` and `.env.example` to the server, then fill in
   `.env` — `DOMAIN`, the `PUBLIC_*` URLs, the database password, and
   the app/integration secrets. `.env` is gitignored and lives only on the
   server — never commit it. The `PUBLIC_*` values must match the GitHub
   Variables above.

   ```bash
   cp .env.example .env
   # generate secrets with, e.g.:  openssl rand -base64 32
   ```

4. **Deploy.**

   ```bash
   docker compose pull
   docker compose up -d
   ```

On first boot the backend applies pending migrations automatically, so the
database schema is created without any manual step. To **redeploy**, push to
`main` (CI rebuilds the images) then re-run the two commands above.

## Local development

For day-to-day development you run the services directly with Node (not Docker).

### Prerequisites

- [Node.js](https://nodejs.org/) and npm
- [PostgreSQL](https://www.postgresql.org/download/)

### Database

Create a database and a user with access to it. You do **not** need to create
any tables — TypeORM migrations run automatically when the backend starts and
build the schema for you.

### Backend

1. Install dependencies.

   ```bash
   cd backend
   npm install
   ```

2. Create a `.env` file in `backend/` (ports may vary to taste):

   ```bash
   KEEBMEET_API_SERVER_HOSTNAME=localhost
   KEEBMEET_API_SERVER_PORT=3000
   KEEBMEET_AUTH_SERVER_HOSTNAME=localhost
   KEEBMEET_AUTH_SERVER_PORT=3001
   KEEBMEET_SOCKET_SERVER_HOSTNAME=localhost
   KEEBMEET_SOCKET_SERVER_PORT=3002

   KEEBMEET_API_URL=http://localhost:3000
   KEEBMEET_SOCKET_URL=http://localhost:3002
   # Origin allowed by CORS — must match the frontend dev server URL below.
   KEEBMEET_WEB_URL=http://localhost:5173

   KEEBMEET_DATABASE_HOST=localhost
   KEEBMEET_DATABASE_PORT=5432
   KEEBMEET_DATABASE_NAME=
   KEEBMEET_DATABASE_USER=
   KEEBMEET_DATABASE_PASSWORD=

   JWT_ACCESS_SECRET=
   AES_ENCRYPTION_KEY=
   INTERNAL_API_SECRET=

   GCP_API_KEY=
   EVENTBRITE_API_KEY=
   EVENTBRITE_CLIENT_SECRET=

   DISCORD_CLIENT_ID=
   DISCORD_CLIENT_SECRET=
   DISCORD_BOT_TOKEN=
   DISCORD_REDIRECT_URI=http://localhost:5173/auth/discord/callback
   ```

3. Start each server in its own terminal (each applies pending migrations on
   startup):

   ```bash
   npm run dev        # API server
   npm run devAuth    # Auth server
   npm run devSocket  # Socket.IO server
   ```

### Frontend

1. Install dependencies.

   ```bash
   cd frontend
   npm install
   ```

2. Create a `.env` file in `frontend/`. Make sure the server URLs match the
   ports set in the backend `.env` above.

   ```bash
   VITE_KEEBMEET_API_SERVER_URL=http://localhost:3000
   VITE_KEEBMEET_AUTH_SERVER_URL=http://localhost:3001
   VITE_KEEBMEET_SOCKET_SERVER_URL=http://localhost:3002
   VITE_KEEBMEET_APP_URL=http://localhost:5173

   VITE_DISCORD_CLIENT_ID=
   VITE_DISCORD_REDIRECT_URI=http://localhost:5173/auth/discord/callback
   ```

3. Run the app.

   ```bash
   npm run dev
   ```

### Bot

1. Install dependencies.

   ```bash
   cd bot
   npm install
   ```

2. Create a `.env` file in `bot/` (see [bot/.env.example](bot/.env.example)):

   ```bash
   DISCORD_BOT_TOKEN=
   KEEBMEET_API_URL=http://localhost:3000
   INTERNAL_API_SECRET=
   ```

3. Run the bot.

   ```bash
   npm run dev
   ```

## Database migrations

The schema is managed entirely by TypeORM migrations in
[`backend/src/migrations/`](backend/src/migrations). `synchronize` is off in
every environment, and the backend runs pending migrations automatically on
startup (`migrationsRun`), so a fresh database is built from the migrations.

When you change an entity, generate and review a migration:

```bash
cd backend
npm run migration:generate -- src/migrations/<DescriptiveName>
```

- **Generate against a database that is already at the latest migration** (not a
  `synchronize`-managed one), otherwise the diff will be empty. A fresh DB with
  `npm run migration:run` applied works well.
- Review the generated SQL — auto-generated migrations can turn renames into
  drop+add (data loss) or need defaults for new non-null columns.
- Commit the migration file; it is the source of truth for production.

Other commands:

```bash
npm run migration:run      # apply pending migrations
npm run migration:revert   # roll back the most recent migration
```
