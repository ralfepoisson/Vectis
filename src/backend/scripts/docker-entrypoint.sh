#!/usr/bin/env sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  : "${DATABASE_HOST:?DATABASE_HOST is required when DATABASE_URL is not set}"
  : "${DATABASE_PORT:=5432}"
  : "${DATABASE_NAME:?DATABASE_NAME is required when DATABASE_URL is not set}"
  : "${DATABASE_USERNAME:?DATABASE_USERNAME is required when DATABASE_URL is not set}"
  : "${DATABASE_PASSWORD:?DATABASE_PASSWORD is required when DATABASE_URL is not set}"

  export DATABASE_URL="postgresql://${DATABASE_USERNAME}:${DATABASE_PASSWORD}@${DATABASE_HOST}:${DATABASE_PORT}/${DATABASE_NAME}?schema=public"
fi

exec node /app/src/backend/dist/server.js
