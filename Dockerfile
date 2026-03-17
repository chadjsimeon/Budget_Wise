# Stage 1: Build
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm install drizzle-kit

COPY --from=build /app/dist ./dist
COPY --from=build /app/shared ./shared
COPY --from=build /app/drizzle.config.ts ./
COPY docker-entrypoint.sh ./

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

ENTRYPOINT ["./docker-entrypoint.sh"]
