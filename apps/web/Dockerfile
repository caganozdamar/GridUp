# On-premise deployment image for the GRID UP dashboard (Asama 7).
# Built from the monorepo root context: docker build -f apps/web/Dockerfile .

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
# Build-time API URL: on an on-prem private network this normally points at
# the API service's private DNS name/port (see docker-compose.onprem.yml).
ARG VITE_API_BASE_URL=http://localhost:3000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ARG VITE_SCADA_GATEWAY_URL=http://localhost:1580
ENV VITE_SCADA_GATEWAY_URL=$VITE_SCADA_GATEWAY_URL
RUN npm run build:shared && npm run build --workspace=apps/web

FROM nginx:alpine AS runtime
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
