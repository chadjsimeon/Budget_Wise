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
COPY vite.config.ts tsconfig.json vite-plugin-meta-images.ts ./
COPY attached_assets/ attached_assets/
RUN npm run build && cp node_modules/connect-pg-simple/table.sql dist/table.sql

FROM node:20-alpine AS runtime
WORKDIR /app

COPY --from=build /app/dist ./dist
COPY shared/ shared/
COPY drizzle.config.ts tsconfig.json package.json ./

# Install only what drizzle-kit push needs (schema parsing + DB connection)
RUN npm install --no-save drizzle-kit@0.31.4 drizzle-orm@0.39.3 drizzle-zod@0.7.0 pg@8.16.3 tsx@4.20.5 zod@3.25.76

ENV NODE_ENV=production
EXPOSE 5050

CMD ["sh", "-c", "npx drizzle-kit push && node dist/index.cjs"]
