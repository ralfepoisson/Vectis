FROM node:22-slim AS build

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY src/shared/package.json src/shared/package.json
COPY src/backend/package.json src/backend/package.json

RUN npm ci

COPY src/shared src/shared
COPY src/backend src/backend

RUN npm run build -w @vectis/shared
RUN npm run prisma:generate -w @vectis/backend
RUN npm run build -w @vectis/backend

FROM node:22-slim

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json tsconfig.base.json ./
COPY src/shared/package.json src/shared/package.json
COPY src/backend/package.json src/backend/package.json

RUN npm ci

COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/src/shared /app/src/shared
COPY --from=build /app/src/backend /app/src/backend
COPY src/backend/scripts/docker-entrypoint.sh /usr/local/bin/vectis-backend-entrypoint

RUN chmod +x /usr/local/bin/vectis-backend-entrypoint

EXPOSE 3000

CMD ["vectis-backend-entrypoint"]
