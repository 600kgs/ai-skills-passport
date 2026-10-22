# build from the repo root: docker build -f apps/worker/Dockerfile .
FROM node:24-slim
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NODE_ENV=production
RUN corepack enable
WORKDIR /app
# manifests first, so code changes don't redo the install layer
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/worker/package.json apps/worker/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
# runtime deps only. tsx runs the typescript source directly, same as in dev
RUN pnpm install --frozen-lockfile --prod --filter "@passport/worker..."
COPY tsconfig.base.json ./
COPY packages/core packages/core
COPY packages/db packages/db
COPY apps/worker apps/worker
# issued pdfs live on a volume mounted here; it inherits this owner on first use
RUN mkdir -p /data/storage && chown node:node /data/storage
USER node
WORKDIR /app/apps/worker
CMD ["node", "--import", "tsx", "src/index.ts"]
