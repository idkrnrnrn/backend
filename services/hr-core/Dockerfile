FROM node:22-slim AS deps

WORKDIR /app
COPY services/hr-core/package*.json ./
RUN npm ci

FROM node:22-slim AS build

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY services/hr-core/package.json services/hr-core/tsconfig.json ./
COPY services/hr-core/src ./src
RUN npm run build

FROM node:22-slim

WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY services/hr-core/package.json ./package.json

CMD ["node", "dist/server.js"]
