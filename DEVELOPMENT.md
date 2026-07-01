# Development

For day-to-day development you run the services directly with Node (not Docker).

## Prerequisites

- [Node.js](https://nodejs.org/) and npm
- [PostgreSQL](https://www.postgresql.org/download/)

## Database

Create a database and a user with access to it. You do **not** need to create
any tables — TypeORM migrations run automatically when the backend starts and
build the schema for you.

## Backend

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

## Frontend

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

## Bot

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
