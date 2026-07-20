FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY client/ client/
COPY server/ server/
COPY shared/ shared/
COPY script/ script/
COPY vite.config.ts tsconfig.json ./
COPY attached_assets/ attached_assets/
RUN npm run build && cp node_modules/connect-pg-simple/table.sql dist/table.sql

FROM node:20-alpine AS runtime
WORKDIR /app

COPY --from=build /app/dist ./dist
# Migrations are applied programmatically at server startup (server/migrate.ts),
# so the runtime image needs no node_modules — only the SQL files.
COPY migrations/ migrations/

ENV NODE_ENV=production
EXPOSE 5050

COPY script/start.sh ./script/start.sh
CMD ["sh", "script/start.sh"]
