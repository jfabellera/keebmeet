# syntax=docker/dockerfile:1
# Self-hosted Iframely, pinned by commit. Build context is the repo ROOT
# (see release.yml), so config.local.js is copied from ./iframely/.

FROM node:22-bookworm-slim AS build
WORKDIR /app
# itteco/iframely main @ 2026-07-03. Bump the SHA to update plugins.
ARG IFRAMELY_REF=00cb18467c740e4856efb3961254cec08284e711
ADD https://github.com/itteco/iframely/archive/${IFRAMELY_REF}.tar.gz /tmp/iframely.tar.gz
RUN tar -xzf /tmp/iframely.tar.gz -C /app --strip-components=1 \
  && rm /tmp/iframely.tar.gz \
  && npm install --omit=dev --no-audit --no-fund
COPY iframely/config.local.js ./config.local.js

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
EXPOSE 8061
CMD ["node", "server.js"]
