#!/usr/bin/env sh
set -eu

. "$(dirname "$0")/lib.sh"

IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD)}"
BACKEND_REPOSITORY_URI="$(stack_output "$FOUNDATION_STACK" BackendRepositoryUri)"
WEBSITE_REPOSITORY_URI="$(stack_output "$FOUNDATION_STACK" WebsiteRepositoryUri)"
WEBAPP_REPOSITORY_URI="$(stack_output "$FOUNDATION_STACK" WebappRepositoryUri)"
API_BASE_URL="${API_BASE_URL:-https://api.${ROOT_DOMAIN}}"

aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$(printf '%s\n' "$BACKEND_REPOSITORY_URI" | cut -d/ -f1)"

docker build -f src/backend/Dockerfile -t "${BACKEND_REPOSITORY_URI}:${IMAGE_TAG}" .
docker push "${BACKEND_REPOSITORY_URI}:${IMAGE_TAG}"

docker build -f src/website/Dockerfile -t "${WEBSITE_REPOSITORY_URI}:${IMAGE_TAG}" .
docker push "${WEBSITE_REPOSITORY_URI}:${IMAGE_TAG}"

docker build \
  --build-arg "VITE_API_BASE_URL=${API_BASE_URL}" \
  -f src/webapp/Dockerfile \
  -t "${WEBAPP_REPOSITORY_URI}:${IMAGE_TAG}" \
  .
docker push "${WEBAPP_REPOSITORY_URI}:${IMAGE_TAG}"

printf 'BACKEND_IMAGE_URI=%s\n' "${BACKEND_REPOSITORY_URI}:${IMAGE_TAG}"
printf 'WEBSITE_IMAGE_URI=%s\n' "${WEBSITE_REPOSITORY_URI}:${IMAGE_TAG}"
printf 'WEBAPP_IMAGE_URI=%s\n' "${WEBAPP_REPOSITORY_URI}:${IMAGE_TAG}"
