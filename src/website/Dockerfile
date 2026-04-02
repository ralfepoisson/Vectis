FROM node:22-slim AS build

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY src/shared/package.json src/shared/package.json
COPY src/website/package.json src/website/package.json

RUN npm ci

COPY src/shared src/shared
COPY src/website src/website

RUN npm run build -w @vectis/shared
RUN npm run build -w @vectis/website

FROM nginx:1.27-alpine

COPY src/website/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/src/website/dist /usr/share/nginx/html

EXPOSE 80
