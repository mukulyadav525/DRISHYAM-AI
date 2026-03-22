#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_PORT="${DRISHYAM_E2E_BACKEND_PORT:-4100}"
SIM_PORT="${DRISHYAM_E2E_SIM_PORT:-4101}"
API_BASE="${DRISHYAM_E2E_API_BASE:-http://127.0.0.1:${BACKEND_PORT}/api/v1}"
SIM_BASE="${DRISHYAM_E2E_SIM_BASE:-http://127.0.0.1:${SIM_PORT}}"

BACKEND_LOG="$(mktemp -t drishyam-backend-e2e.XXXXXX.log)"
SIM_LOG="$(mktemp -t drishyam-simulation-e2e.XXXXXX.log)"
BACKEND_PID=""
SIM_PID=""

cleanup() {
  if [[ -n "${SIM_PID}" ]] && kill -0 "${SIM_PID}" >/dev/null 2>&1; then
    kill "${SIM_PID}" >/dev/null 2>&1 || true
    wait "${SIM_PID}" >/dev/null 2>&1 || true
  fi
  if [[ -n "${BACKEND_PID}" ]] && kill -0 "${BACKEND_PID}" >/dev/null 2>&1; then
    kill "${BACKEND_PID}" >/dev/null 2>&1 || true
    wait "${BACKEND_PID}" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

echo "Building simulation app for E2E..."
(
  cd "${ROOT_DIR}/simulation-app"
  NEXT_PUBLIC_API_BASE="${API_BASE}" npm run build
)

(
  cd "${ROOT_DIR}/backend"
  ./venv/bin/python3 -m uvicorn main:app --host 127.0.0.1 --port "${BACKEND_PORT}"
) >"${BACKEND_LOG}" 2>&1 &
BACKEND_PID=$!

(
  cd "${ROOT_DIR}/simulation-app"
  NEXT_PUBLIC_API_BASE="${API_BASE}" npm run start -- --hostname 127.0.0.1 -p "${SIM_PORT}"
) >"${SIM_LOG}" 2>&1 &
SIM_PID=$!

for _ in $(seq 1 120); do
  if curl -fsS "http://127.0.0.1:${BACKEND_PORT}/health" >/dev/null 2>&1 && curl -fsSI "${SIM_BASE}" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -fsS "http://127.0.0.1:${BACKEND_PORT}/health" >/dev/null 2>&1; then
  echo "Backend did not become healthy on port ${BACKEND_PORT}." >&2
  echo "--- backend log ---" >&2
  cat "${BACKEND_LOG}" >&2
  exit 1
fi

if ! curl -fsSI "${SIM_BASE}" >/dev/null 2>&1; then
  echo "Simulation app did not become ready on port ${SIM_PORT}." >&2
  echo "--- simulation log ---" >&2
  cat "${SIM_LOG}" >&2
  exit 1
fi

DRISHYAM_E2E_API_BASE="${API_BASE}" \
DRISHYAM_E2E_SIM_BASE="${SIM_BASE}" \
PLAYWRIGHT_BROWSER_CHANNEL="${PLAYWRIGHT_BROWSER_CHANNEL:-chrome}" \
npx playwright test --config "${ROOT_DIR}/playwright.config.js"
