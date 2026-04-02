#!/usr/bin/env sh
set -eu

. "$(dirname "$0")/lib.sh"

curl --fail --silent --show-error "https://${ROOT_DOMAIN}/" >/dev/null
curl --fail --silent --show-error "https://app.${ROOT_DOMAIN}/" >/dev/null
curl --fail --silent --show-error "https://api.${ROOT_DOMAIN}/health" >/dev/null
