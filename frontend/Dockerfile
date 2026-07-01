# syntax=docker/dockerfile:1
# Build context is the repo ROOT (workspace build) — see .github/workflows/release.yml.

# ---- build stage: produce the static SPA ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY bot/package.json ./bot/
# Install only the frontend + shared workspaces (no backend native deps).
RUN npm ci --workspace=@keebmeet/frontend --workspace=@keebmeet/shared --include-workspace-root
# The frontend type-checks against shared's declarations, so build shared first.
COPY shared ./shared
RUN npm run build --workspace=@keebmeet/shared
COPY frontend ./frontend

# Vite INLINES these values into the JS bundle at build time — they are not read
# at runtime. They must be the PUBLIC URLs the browser will hit (see release.yml).
ARG VITE_KEEBMEET_API_SERVER_URL
ARG VITE_KEEBMEET_AUTH_SERVER_URL
ARG VITE_KEEBMEET_SOCKET_SERVER_URL
ARG VITE_KEEBMEET_APP_URL
ARG VITE_DISCORD_CLIENT_ID
ARG VITE_DISCORD_REDIRECT_URI
ENV VITE_KEEBMEET_API_SERVER_URL=$VITE_KEEBMEET_API_SERVER_URL \
    VITE_KEEBMEET_AUTH_SERVER_URL=$VITE_KEEBMEET_AUTH_SERVER_URL \
    VITE_KEEBMEET_SOCKET_SERVER_URL=$VITE_KEEBMEET_SOCKET_SERVER_URL \
    VITE_KEEBMEET_APP_URL=$VITE_KEEBMEET_APP_URL \
    VITE_DISCORD_CLIENT_ID=$VITE_DISCORD_CLIENT_ID \
    VITE_DISCORD_REDIRECT_URI=$VITE_DISCORD_REDIRECT_URI
# Full build now includes tsc — the shared package resolves cross-package types.
RUN npm run build --workspace=@keebmeet/frontend

# ---- runtime stage: Caddy serves the SPA + reverse-proxies the backends ----
FROM caddy:2-alpine AS runtime
COPY frontend/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/frontend/dist /srv
