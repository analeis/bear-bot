# syntax=docker/dockerfile:1

# --- build stage -------------------------------------------------------------
FROM oven/bun:1.4-alpine AS build

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY tsconfig.json biome.json ./
COPY src ./src
COPY tests ./tests

RUN bun run typecheck

# --- runtime stage -----------------------------------------------------------
FROM oven/bun:1.4-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

# Only the runtime dependencies are needed in the final image.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production && rm -rf /root/.bun/install/cache

COPY --from=build /app/src ./src
COPY --from=build /app/tsconfig.json ./tsconfig.json

# The SQLite database lives here. Mount a volume to keep it across restarts.
RUN mkdir -p /app/data
VOLUME ["/app/data"]

ENV DATABASE_PATH=/app/data/bear-bot.db

# Run as a non-root user.
RUN addgroup -S bearbot && adduser -S bearbot -G bearbot && chown -R bearbot:bearbot /app
USER bearbot

ENTRYPOINT ["bun", "run", "src/index.ts"]
