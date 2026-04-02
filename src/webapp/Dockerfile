FROM node:22-slim AS build

WORKDIR /app

ARG VITE_API_BASE_URL=https://api.vectis-sense.ai
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

COPY package.json package-lock.json tsconfig.base.json ./
COPY src/shared/package.json src/shared/package.json
COPY src/webapp/package.json src/webapp/package.json

RUN npm ci

COPY src/shared src/shared
COPY src/webapp src/webapp

RUN npm run build -w @vectis/shared
RUN npm run build -w @vectis/webapp

FROM nginx:1.27-alpine

COPY src/webapp/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/src/webapp/dist /usr/share/nginx/html

EXPOSE 80
