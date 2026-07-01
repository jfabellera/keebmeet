# syntax=docker/dockerfile:1

# ---- build stage: compile TypeScript, install all deps ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
# bcrypt has native bindings; these are only needed if a prebuilt binary
# isn't available for the platform. Discarded with the build stage.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# ---- runtime stage: just node + production deps + compiled output ----
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY package.json ./
USER node
# The actual entrypoint (Server.js / AuthServer.js / SocketServer.js) is set
# per-service via `command:` in docker-compose.yml — one image, three roles.
CMD ["node", "build/Server.js"]
