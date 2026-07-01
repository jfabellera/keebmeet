# Deployment

Images are built by GitHub Actions and pushed to the GitHub Container Registry
(GHCR); the server pulls those pre-built images and never builds from source.
The whole stack runs on a single host — frontend, the three backend processes,
the bot, and PostgreSQL. Everything is served from one domain (the backends live
under `/api`, so there's no CORS), [Caddy](frontend/Caddyfile) provides HTTPS
automatically, and PostgreSQL data lives in a named volume that survives
redeploys.

## One-time GitHub setup

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

## On the server

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
