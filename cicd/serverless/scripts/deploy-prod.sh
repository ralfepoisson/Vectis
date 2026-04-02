#!/usr/bin/env sh
set -eu

. "$(dirname "$0")/lib.sh"

IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD)}"

"$SERVERLESS_ROOT/scripts/deploy-foundation.sh"

if [ "${SKIP_IMAGE_BUILD:-0}" = "1" ]; then
  BACKEND_IMAGE_URI="${BACKEND_IMAGE_URI:-$(stack_output "$FOUNDATION_STACK" BackendRepositoryUri):${IMAGE_TAG}}"
  WEBSITE_IMAGE_URI="${WEBSITE_IMAGE_URI:-$(stack_output "$FOUNDATION_STACK" WebsiteRepositoryUri):${IMAGE_TAG}}"
  WEBAPP_IMAGE_URI="${WEBAPP_IMAGE_URI:-$(stack_output "$FOUNDATION_STACK" WebappRepositoryUri):${IMAGE_TAG}}"
else
  IMAGE_OUTPUT="$("$SERVERLESS_ROOT/scripts/build-and-push-images.sh")"
  BACKEND_IMAGE_URI="$(printf '%s\n' "$IMAGE_OUTPUT" | awk -F= '/^BACKEND_IMAGE_URI=/{print $2}')"
  WEBSITE_IMAGE_URI="$(printf '%s\n' "$IMAGE_OUTPUT" | awk -F= '/^WEBSITE_IMAGE_URI=/{print $2}')"
  WEBAPP_IMAGE_URI="$(printf '%s\n' "$IMAGE_OUTPUT" | awk -F= '/^WEBAPP_IMAGE_URI=/{print $2}')"
fi

BACKEND_IMAGE_URI="$BACKEND_IMAGE_URI" IMAGE_TAG="$IMAGE_TAG" "$SERVERLESS_ROOT/scripts/migrate-prod.sh"

serverless_deploy "$SERVERLESS_ROOT/website/serverless.yml" \
  --param="stackPrefix=$STACK_PREFIX" \
  --param="rootDomain=$ROOT_DOMAIN" \
  --param="hostedZoneId=$HOSTED_ZONE_ID" \
  --param="imageUri=$WEBSITE_IMAGE_URI"

serverless_deploy "$SERVERLESS_ROOT/webapp/serverless.yml" \
  --param="stackPrefix=$STACK_PREFIX" \
  --param="rootDomain=$ROOT_DOMAIN" \
  --param="hostedZoneId=$HOSTED_ZONE_ID" \
  --param="imageUri=$WEBAPP_IMAGE_URI"

serverless_deploy "$SERVERLESS_ROOT/backend/serverless.yml" \
  --param="stackPrefix=$STACK_PREFIX" \
  --param="rootDomain=$ROOT_DOMAIN" \
  --param="hostedZoneId=$HOSTED_ZONE_ID" \
  --param="imageUri=$BACKEND_IMAGE_URI" \
  --param="databaseName=$DATABASE_NAME"

serverless_deploy "$SERVERLESS_ROOT/image-worker/serverless.yml" \
  --param="stackPrefix=$STACK_PREFIX" \
  --param="imageBucketName=$(stack_output "$FOUNDATION_STACK" ImageBucketName)"

"$SERVERLESS_ROOT/scripts/smoke-check-prod.sh"
