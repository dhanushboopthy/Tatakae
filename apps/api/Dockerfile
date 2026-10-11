# Multi-arch (built for linux/arm64 for Oracle Ampere A1). Build context = repo root.
FROM node:22-bookworm-slim AS build
RUN corepack enable && apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api
COPY db ./db
RUN pnpm install --frozen-lockfile --filter api... && pnpm --filter api build \
 && pnpm --filter api deploy --prod /out

FROM node:22-bookworm-slim
ENV NODE_ENV=production TZ=Asia/Kolkata MIGRATIONS_DIR=/app/db/migrations
WORKDIR /app
COPY --from=build /out ./
COPY --from=build /repo/apps/api/dist ./dist
COPY db/migrations ./db/migrations
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:8787/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
