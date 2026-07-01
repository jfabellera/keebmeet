# syntax=docker/dockerfile:1
# Build context is the repo ROOT (workspace build) — see .github/workflows/release.yml.

# ---- build stage: install api + shared deps, compile both ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
# bcrypt has native bindings; these are the fallback if no prebuilt binary exists.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
# Workspace manifests first (for install-layer caching). All are needed so npm
# can resolve the workspace graph from the root lockfile.
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY bot/package.json ./bot/
# Install ONLY what the backend needs (api + shared) — not frontend/bot deps.
RUN npm ci --workspace=api --workspace=@keebmeet/shared --include-workspace-root
# Build shared first (backend imports its compiled output), then the backend.
COPY shared ./shared
RUN npm run build --workspace=@keebmeet/shared
COPY backend ./backend
RUN npm run build --workspace=api
RUN npm prune --omit=dev --workspace=api --workspace=@keebmeet/shared --include-workspace-root

# ---- runtime stage ----
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app/backend
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/shared /app/shared
COPY --from=build /app/backend/build ./build
COPY --from=build /app/backend/package.json ./package.json
# The entrypoint (Server.js / AuthServer.js / SocketServer.js) is set per-service
# via `command:` in docker-compose.yml — one image, three roles.
CMD ["node", "build/Server.js"]
