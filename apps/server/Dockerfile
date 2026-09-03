FROM node:26.8.1-alpine3.24 AS build
RUN npm install --global pnpm@11.17.0
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY patches patches
COPY apps/server/package.json apps/server/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN CI=true pnpm install --frozen-lockfile

COPY apps/server apps/server
COPY packages/db packages/db
COPY packages/shared packages/shared
WORKDIR /app/apps/server
RUN node node_modules/tsdown/dist/run.mjs

FROM build AS migration
WORKDIR /app
USER node

FROM build AS production-dependencies
WORKDIR /app
RUN pnpm --filter @splidly/server deploy --prod --legacy /prod/server

FROM node:26.8.1-alpine3.24 AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=production-dependencies --chown=node:node /prod/server ./apps/server
USER node
EXPOSE 4000
CMD ["node", "apps/server/dist/index.js"]
