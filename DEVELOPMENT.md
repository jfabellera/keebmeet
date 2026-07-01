# Development

For day-to-day development you run the services directly with Node (not Docker).

## Prerequisites

- [Node.js](https://nodejs.org/) and npm
- [PostgreSQL](https://www.postgresql.org/download/)

## Database

Create a database and a user with access to it. You do **not** need to create
any tables — TypeORM migrations run automatically when the backend starts and
build the schema for you.

Each service reads its own `.env`. In every service directory, copy the
committed `.env.example` and fill in the blanks (each file documents its
variables):

```bash
cp .env.example .env
```

## Backend

```bash
cd backend
npm install
cp .env.example .env    # then fill in DB creds and secrets

# start each server in its own terminal (each applies pending migrations):
npm run dev        # API server
npm run devAuth    # Auth server
npm run devSocket  # Socket.IO server
```

## Frontend

```bash
cd frontend
npm install
cp .env.example .env    # server URLs must match the ports in backend/.env
npm run dev
```

## Bot

```bash
cd bot
npm install
cp .env.example .env    # DISCORD_BOT_TOKEN + INTERNAL_API_SECRET (matches backend)
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
