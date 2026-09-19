# On-premise deployment image for the SCADA Gateway (Asama 7).
# Built from the monorepo root context: docker build -f apps/scada-gateway/Dockerfile .

FROM node:24-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/simulator/package.json apps/simulator/package.json
COPY apps/scada-gateway/package.json apps/scada-gateway/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build --workspace=apps/scada-gateway

FROM node:24-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/apps/scada-gateway ./apps/scada-gateway

# Modbus TCP (demo port; map to 502 at the host/network layer in production
# where appropriate - see docs/modbus-register-map.md).
EXPOSE 1502
WORKDIR /repo/apps/scada-gateway
CMD ["node", "dist/index.js"]
