#!/usr/bin/env sh
set -eu

SERVERLESS_ROOT="$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)"
STAGE="${STAGE:-prod}"
STACK_PREFIX="${STACK_PREFIX:-vectis}"
AWS_REGION="${AWS_REGION:-eu-west-3}"
ROOT_DOMAIN="${ROOT_DOMAIN:-vectis-sense.ai}"
HOSTED_ZONE_ID="${HOSTED_ZONE_ID:-}"
ACM_CERTIFICATE_ARN="${ACM_CERTIFICATE_ARN:-}"
DATABASE_NAME="${DATABASE_NAME:-vectis_prod}"
DATABASE_USERNAME="${DATABASE_USERNAME:-vectis}"
IMAGE_BUCKET_NAME="${IMAGE_BUCKET_NAME:-${STACK_PREFIX}-${STAGE}-$(aws sts get-caller-identity --query Account --output text)-${AWS_REGION}-images}"
FOUNDATION_STACK="${FOUNDATION_STACK:-${STACK_PREFIX}-${STAGE}-foundation}"

require_env() {
  name="$1"
  value="$(eval "printf '%s' \"\${$name:-}\"")"

  if [ -z "$value" ]; then
    echo "Environment variable $name is required." >&2
    exit 1
  fi
}

stack_output() {
  stack_name="$1"
  output_key="$2"

  aws cloudformation describe-stacks \
    --region "$AWS_REGION" \
    --stack-name "$stack_name" \
    --query "Stacks[0].Outputs[?OutputKey=='${output_key}'].OutputValue | [0]" \
    --output text
}

serverless_deploy() {
  config_path="$1"
  shift

  npx serverless@4 deploy \
    --config "$config_path" \
    --stage "$STAGE" \
    --region "$AWS_REGION" \
    "$@"
}
