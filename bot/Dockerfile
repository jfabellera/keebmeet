# syntax=docker/dockerfile:1
# Build context is the repo ROOT (workspace build) — see .github/workflows/release.yml.

# ---- build stage ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY bot/package.json ./bot/
# The bot doesn't depend on shared, so install just the bot workspace.
RUN npm ci --workspace=bot --include-workspace-root
COPY bot ./bot
RUN npm run build --workspace=bot
RUN npm prune --omit=dev --workspace=bot --include-workspace-root

# ---- runtime stage ----
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app/bot
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/bot/build ./build
COPY --from=build /app/bot/package.json ./package.json
CMD ["node", "build/index.js"]
