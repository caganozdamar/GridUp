# On-premise deployment image for the GRID UP backend (Asama 7).
# Built from the monorepo root context: docker build -f apps/api/Dockerfile .
# (see docker-compose.onprem.yml, which does exactly this).

FROM node:24-alpine AS deps
WORKDIR /repo
# npm workspaces + `npm ci` needs every workspace's package.json present,
# even though this image only runs apps/api.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/simulator/package.json apps/simulator/package.json
COPY apps/scada-gateway/package.json apps/scada-gateway/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

FROM deps AS build
# Prisma engines need OpenSSL on Alpine/musl.
RUN apk add --no-cache openssl
COPY . .
RUN npm run build:shared \
  && npm run prisma:generate --workspace=apps/api \
  && npm run build --workspace=apps/api

FROM node:24-alpine AS runtime
RUN apk add --no-cache openssl
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/packages/shared ./packages/shared
COPY --from=build /repo/apps/api ./apps/api

EXPOSE 3000
WORKDIR /repo/apps/api
# Applies any pending migrations (idempotent, safe against an already
# up-to-date schema) before starting the API - does NOT reset the database.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
