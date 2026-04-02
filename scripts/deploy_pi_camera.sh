#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)"
PI_HOST="${PI_HOST:-192.168.1.22}"
PI_PORT="${PI_PORT:-22}"
PI_USER="${PI_USER:-ralfe}"
PI_PASSWORD="${PI_PASSWORD:-}"
PI_SUDO_PASSWORD="${PI_SUDO_PASSWORD:-$PI_PASSWORD}"
PI_INSTALL_DIR="${PI_INSTALL_DIR:-/opt/vectis/pi-camera}"
PI_SERVICE_NAME="${PI_SERVICE_NAME:-vectis-pi-camera}"
PI_SERVICE_USER="${PI_SERVICE_USER:-$PI_USER}"
PI_SERVICE_GROUP="${PI_SERVICE_GROUP:-$PI_SERVICE_USER}"
PI_NODE_MAJOR="${PI_NODE_MAJOR:-22}"
PI_APP_HOST="${PI_APP_HOST:-0.0.0.0}"
PI_APP_PORT="${PI_APP_PORT:-8080}"
PI_STREAM_PATH="${PI_STREAM_PATH:-/stream}"
PI_HEALTH_PATH="${PI_HEALTH_PATH:-/health}"
PI_RPICAM_BIN="${PI_RPICAM_BIN:-rpicam-vid}"
PI_CAMERA_WIDTH="${PI_CAMERA_WIDTH:-1920}"
PI_CAMERA_HEIGHT="${PI_CAMERA_HEIGHT:-1080}"
PI_CAMERA_FRAMERATE="${PI_CAMERA_FRAMERATE:-30}"
PI_CAMERA_BITRATE="${PI_CAMERA_BITRATE:-4000000}"
PI_CAMERA_LOW_LATENCY="${PI_CAMERA_LOW_LATENCY:-true}"

REMOTE_ADDRESS="${PI_USER}@${PI_HOST}"
SSH_OPTIONS="-p ${PI_PORT} -o StrictHostKeyChecking=accept-new"
SCP_OPTIONS="-P ${PI_PORT} -o StrictHostKeyChecking=accept-new"
TEMP_DIR="$(mktemp -d)"
EXPECT_BIN="$(command -v expect || true)"
PAYLOAD_DIR="${TEMP_DIR}/payload"
ENV_OUTPUT_PATH="${TEMP_DIR}/${PI_SERVICE_NAME}.env"
SERVICE_OUTPUT_PATH="${TEMP_DIR}/${PI_SERVICE_NAME}.service"

cleanup() {
  rm -rf "${TEMP_DIR}"
}

trap cleanup EXIT INT TERM

run_with_optional_expect() {
  if [ -n "${PI_PASSWORD}" ]; then
    if [ -z "${EXPECT_BIN}" ]; then
      echo "expect is required for password-based non-interactive SSH deployments." >&2
      exit 1
    fi

    EXPECT_PASSWORD="${PI_PASSWORD}" expect -f - -- "$@" <<'EOF'
set timeout -1
set password $env(EXPECT_PASSWORD)
set cmd [lindex $argv 0]
set args [lrange $argv 1 end]
spawn {*}$cmd {*}$args
expect {
  -re "(?i)yes/no" {
    send "yes\r"
    exp_continue
  }
  -re "(?i)password:" {
    send "$password\r"
    exp_continue
  }
  eof {
    catch wait result
    exit [lindex $result 3]
  }
}
EOF
  else
    "$@"
  fi
}

run_ssh() {
  run_with_optional_expect ssh ${SSH_OPTIONS} "${REMOTE_ADDRESS}" "$@"
}

run_rsync() {
  run_with_optional_expect rsync -az --delete -e "ssh ${SSH_OPTIONS}" "$@"
}

build_local_artifacts() {
  echo "Building Pi camera package locally..."
  (cd "${ROOT_DIR}" && npm run build -w @vectis/pi-camera)

  mkdir -p "${PAYLOAD_DIR}/dist"
  cp -R "${ROOT_DIR}/src/pi-camera/dist/." "${PAYLOAD_DIR}/dist/"
  cp "${ROOT_DIR}/src/pi-camera/package.json" "${PAYLOAD_DIR}/package.json"

  (
    cd "${ROOT_DIR}"
    HOST="${PI_APP_HOST}" \
    PORT="${PI_APP_PORT}" \
    STREAM_PATH="${PI_STREAM_PATH}" \
    HEALTH_PATH="${PI_HEALTH_PATH}" \
    RPICAM_BIN="${PI_RPICAM_BIN}" \
    CAMERA_WIDTH="${PI_CAMERA_WIDTH}" \
    CAMERA_HEIGHT="${PI_CAMERA_HEIGHT}" \
    CAMERA_FRAMERATE="${PI_CAMERA_FRAMERATE}" \
    CAMERA_BITRATE="${PI_CAMERA_BITRATE}" \
    CAMERA_LOW_LATENCY="${PI_CAMERA_LOW_LATENCY}" \
    DEPLOY_INSTALL_DIR="${PI_INSTALL_DIR}" \
    DEPLOY_SERVICE_NAME="${PI_SERVICE_NAME}" \
    DEPLOY_USER="${PI_SERVICE_USER}" \
    DEPLOY_GROUP="${PI_SERVICE_GROUP}" \
    node src/pi-camera/dist/render-deploy-files.js "${ENV_OUTPUT_PATH}" "${SERVICE_OUTPUT_PATH}"
  )
}

bootstrap_remote_host() {
  echo "Ensuring Node.js ${PI_NODE_MAJOR} and runtime prerequisites are present on the Pi..."

  if [ -n "${PI_SUDO_PASSWORD}" ]; then
    run_ssh "printf '%s\n' '${PI_SUDO_PASSWORD}' | sudo -S bash -lc '
      set -eu
      export DEBIAN_FRONTEND=noninteractive
      if ! command -v node >/dev/null 2>&1 || [ \"\$(node -p \"process.versions.node.split(\\\".\\\")[0]\")\" -lt ${PI_NODE_MAJOR} ]; then
        apt-get update
        apt-get install -y ca-certificates curl gnupg
        curl -fsSL https://deb.nodesource.com/setup_${PI_NODE_MAJOR}.x | bash -
        apt-get install -y nodejs
      fi
      apt-get install -y curl
      mkdir -p \"${PI_INSTALL_DIR}\"
      chown -R \"${PI_SERVICE_USER}:${PI_SERVICE_GROUP}\" \"${PI_INSTALL_DIR}\"
    '"
  else
    run_ssh "sudo bash -lc '
      set -eu
      export DEBIAN_FRONTEND=noninteractive
      if ! command -v node >/dev/null 2>&1 || [ \"\$(node -p \"process.versions.node.split(\\\".\\\")[0]\")\" -lt ${PI_NODE_MAJOR} ]; then
        apt-get update
        apt-get install -y ca-certificates curl gnupg
        curl -fsSL https://deb.nodesource.com/setup_${PI_NODE_MAJOR}.x | bash -
        apt-get install -y nodejs
      fi
      apt-get install -y curl
      mkdir -p \"${PI_INSTALL_DIR}\"
      chown -R \"${PI_SERVICE_USER}:${PI_SERVICE_GROUP}\" \"${PI_INSTALL_DIR}\"
    '"
  fi
}

sync_payload() {
  echo "Uploading Pi camera files to ${REMOTE_ADDRESS}:${PI_INSTALL_DIR}..."
  run_rsync "${PAYLOAD_DIR}/" "${REMOTE_ADDRESS}:${PI_INSTALL_DIR}/"
  run_with_optional_expect scp ${SCP_OPTIONS} "${ENV_OUTPUT_PATH}" "${REMOTE_ADDRESS}:${PI_INSTALL_DIR}/${PI_SERVICE_NAME}.env"
  run_with_optional_expect scp ${SCP_OPTIONS} "${SERVICE_OUTPUT_PATH}" "${REMOTE_ADDRESS}:/tmp/${PI_SERVICE_NAME}.service"
}

install_and_restart_service() {
  echo "Installing systemd unit and restarting the Pi camera service..."

  if [ -n "${PI_SUDO_PASSWORD}" ]; then
    run_ssh "printf '%s\n' '${PI_SUDO_PASSWORD}' | sudo -S bash -lc '
      set -eu
      cd \"${PI_INSTALL_DIR}\"
      npm install --omit=dev
      install -m 0644 \"/tmp/${PI_SERVICE_NAME}.service\" \"/etc/systemd/system/${PI_SERVICE_NAME}.service\"
      systemctl daemon-reload
      systemctl enable ${PI_SERVICE_NAME}
      systemctl restart ${PI_SERVICE_NAME}
      attempts=0
      until curl --fail --silent --show-error \"http://127.0.0.1:${PI_APP_PORT}${PI_HEALTH_PATH}\" >/dev/null; do
        attempts=\$((attempts + 1))
        if [ \"\$attempts\" -ge 10 ]; then
          echo \"Pi camera health check did not pass after restart.\" >&2
          exit 1
        fi
        sleep 1
      done
      systemctl --no-pager --full status ${PI_SERVICE_NAME}
    '"
  else
    run_ssh "sudo bash -lc '
      set -eu
      cd \"${PI_INSTALL_DIR}\"
      npm install --omit=dev
      install -m 0644 \"/tmp/${PI_SERVICE_NAME}.service\" \"/etc/systemd/system/${PI_SERVICE_NAME}.service\"
      systemctl daemon-reload
      systemctl enable ${PI_SERVICE_NAME}
      systemctl restart ${PI_SERVICE_NAME}
      attempts=0
      until curl --fail --silent --show-error \"http://127.0.0.1:${PI_APP_PORT}${PI_HEALTH_PATH}\" >/dev/null; do
        attempts=\$((attempts + 1))
        if [ \"\$attempts\" -ge 10 ]; then
          echo \"Pi camera health check did not pass after restart.\" >&2
          exit 1
        fi
        sleep 1
      done
      systemctl --no-pager --full status ${PI_SERVICE_NAME}
    '"
  fi
}

echo "Deploying Vectis Pi camera service to ${REMOTE_ADDRESS}..."
build_local_artifacts
bootstrap_remote_host
sync_payload
install_and_restart_service
echo "Pi camera deployment completed successfully."
