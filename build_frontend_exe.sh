#!/usr/bin/env bash
set -euo pipefail

# SPDX-License-Identifier: MIT

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="${ROOT_DIR}/frontend-react"
PYTHON_BIN="${PYTHON_BIN:-}"

cd "${ROOT_DIR}"

find_python() {
  if [[ -n "${PYTHON_BIN}" ]]; then
    if command -v "${PYTHON_BIN}" >/dev/null 2>&1; then
      return 0
    fi
    echo "[ERROR] PYTHON_BIN is set but was not found: ${PYTHON_BIN}"
    exit 1
  fi

  if command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="python3"
  elif command -v python >/dev/null 2>&1; then
    PYTHON_BIN="python"
  else
    echo "[ERROR] python3 or python was not found in PATH."
    exit 1
  fi
}

build_frontend() {
  if [[ ! -d "${FRONTEND_DIR}/node_modules" ]]; then
    echo "[1/3] Installing frontend dependencies..."
    (cd "${FRONTEND_DIR}" && npm ci)
  fi

  echo "[1/3] Building React frontend..."
  (cd "${FRONTEND_DIR}" && npm run build)
}

find_python

if ! command -v npm >/dev/null 2>&1; then
  if [[ ! -f "${FRONTEND_DIR}/dist/index.html" ]]; then
    echo "[ERROR] npm was not found and frontend-react/dist does not exist."
    echo "[INFO] Install Node.js or provide an existing frontend-react/dist build."
    exit 1
  fi
  echo "[WARN] npm was not found. Reusing existing frontend-react/dist."
else
  build_frontend
fi

echo "[2/3] Installing desktop packaging dependencies..."
"${PYTHON_BIN}" -m pip install -r "${ROOT_DIR}/requirements-frontend.txt"

echo "[3/3] Packaging macOS frontend app..."
"${PYTHON_BIN}" -m PyInstaller \
  --clean \
  --noconfirm \
  --windowed \
  --onefile \
  --name HomeKakeiboFrontend \
  --hidden-import webview \
  --add-data "frontend-react/dist:frontend-react/dist" \
  run_frontend.py

echo
echo "[OK] macOS frontend app build finished: dist/HomeKakeiboFrontend"
echo "[OK] Put frontend-config.json next to the executable or keep it in this folder when running from source."
