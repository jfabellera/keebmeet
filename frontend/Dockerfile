# syntax=docker/dockerfile:1

# ---- build stage: produce the static SPA ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Vite INLINES these values into the JS bundle at build time — they are not
# read at runtime. So they must be passed as build args (see docker-compose.yml)
# and must be the PUBLIC URLs the browser will hit, not container names.
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
RUN npx vite build

# ---- runtime stage: Caddy serves the SPA + reverse-proxies the backends ----
FROM caddy:2-alpine AS runtime
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
