# Zoho Catalyst AppSail: one container serving the api and the website on one origin.
# Build context = repo root. AppSail only accepts linux/amd64 images:
#   docker build --platform linux/amd64 -f deploy/catalyst/Dockerfile -t tatakae:<tag> .
# Secrets are never baked in: set them as AppSail environment variables (docs/CATALYST.md).
FROM node:22-bookworm-slim AS build
RUN corepack enable && apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api
COPY apps/web ./apps/web
COPY db ./db
RUN pnpm install --frozen-lockfile --filter api... --filter web... \
 && pnpm --filter web build \
 && pnpm --filter api build \
 && pnpm --filter api deploy --prod /out

FROM node:22-bookworm-slim
# The disk is scratch on AppSail: the database is a Turso replica and files live in Stratus, so
# everything written locally goes under /tmp/tatakae.
ENV NODE_ENV=production \
    TZ=Asia/Kolkata \
    MIGRATIONS_DIR=/app/db/migrations \
    WEB_DIST=/app/web \
    DATABASE_PATH=/tmp/tatakae/replica.db \
    FILES_DIR=/tmp/tatakae/files \
    BACKUP_DIR=/tmp/tatakae/backups
WORKDIR /app
COPY --from=build /out ./
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/web/dist ./web
COPY db/migrations ./db/migrations
USER node
# AppSail sets X_ZOHO_CATALYST_LISTEN_PORT (deploy with --port 9000); the api reads it.
EXPOSE 9000
CMD ["node", "dist/server.js"]
