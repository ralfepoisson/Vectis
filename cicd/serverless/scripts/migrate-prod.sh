#!/usr/bin/env sh
set -eu

. "$(dirname "$0")/lib.sh"

IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD)}"
BACKEND_IMAGE_URI="${BACKEND_IMAGE_URI:-$(stack_output "$FOUNDATION_STACK" BackendRepositoryUri):${IMAGE_TAG}}"
DATABASE_HOST="$(stack_output "$FOUNDATION_STACK" DatabaseEndpointAddress)"
DATABASE_PORT="$(stack_output "$FOUNDATION_STACK" DatabaseEndpointPort)"
DATABASE_NAME_VALUE="$(stack_output "$FOUNDATION_STACK" DatabaseName)"
DATABASE_USERNAME_SECRET_ARN="$(stack_output "$FOUNDATION_STACK" DatabaseUsernameSecretArn)"
DATABASE_PASSWORD_SECRET_ARN="$(stack_output "$FOUNDATION_STACK" DatabasePasswordSecretArn)"
DATABASE_USERNAME_VALUE="$(aws secretsmanager get-secret-value --region "$AWS_REGION" --secret-id "$DATABASE_USERNAME_SECRET_ARN" --query SecretString --output text)"
DATABASE_PASSWORD_VALUE="$(aws secretsmanager get-secret-value --region "$AWS_REGION" --secret-id "$DATABASE_PASSWORD_SECRET_ARN" --query SecretString --output text)"
DATABASE_URL="postgresql://${DATABASE_USERNAME_VALUE}:${DATABASE_PASSWORD_VALUE}@${DATABASE_HOST}:${DATABASE_PORT}/${DATABASE_NAME_VALUE}?schema=public"

docker pull "$BACKEND_IMAGE_URI"

docker run --rm \
  -e "DATABASE_URL=$DATABASE_URL" \
  "$BACKEND_IMAGE_URI" \
  npm run prisma:migrate:deploy -w @vectis/backend
