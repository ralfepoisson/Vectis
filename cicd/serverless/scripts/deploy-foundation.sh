#!/usr/bin/env sh
set -eu

. "$(dirname "$0")/lib.sh"

require_env HOSTED_ZONE_ID
require_env ACM_CERTIFICATE_ARN

serverless_deploy "$SERVERLESS_ROOT/foundation/serverless.yml" \
  --param="stackPrefix=$STACK_PREFIX" \
  --param="rootDomain=$ROOT_DOMAIN" \
  --param="hostedZoneId=$HOSTED_ZONE_ID" \
  --param="acmCertificateArn=$ACM_CERTIFICATE_ARN" \
  --param="databaseName=$DATABASE_NAME" \
  --param="databaseUsername=$DATABASE_USERNAME" \
  --param="imageBucketName=$IMAGE_BUCKET_NAME"
