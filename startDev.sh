#!/usr/bin/env bash
set -euo pipefail

PORT=8787

# Find existing Wrangler dev processes and stop them before starting a fresh one.
mapfile -t WRANGLER_PIDS < <(ps -eo pid=,args= | awk '
  /wrangler[[:space:]]+dev|wrangler-dist\/cli\.js[[:space:]]+dev/ && $0 !~ /awk/ {
    print $1
  }
')

if [ "${#WRANGLER_PIDS[@]}" -gt 0 ]; then
  echo "Found existing Wrangler dev process(es): ${WRANGLER_PIDS[*]}"
  kill "${WRANGLER_PIDS[@]}" || true

  # Give processes a moment to exit gracefully.
  sleep 1

  # Force kill any survivors.
  mapfile -t STILL_RUNNING < <(ps -eo pid=,args= | awk -v pids=" ${WRANGLER_PIDS[*]} " '
    /wrangler[[:space:]]+dev|wrangler-dist\/cli\.js[[:space:]]+dev/ && $0 !~ /awk/ {
      if (index(pids, " " $1 " ") > 0) print $1
    }
  ')
  if [ "${#STILL_RUNNING[@]}" -gt 0 ]; then
    echo "Force stopping Wrangler dev process(es): ${STILL_RUNNING[*]}"
    kill -9 "${STILL_RUNNING[@]}" || true
  fi
else
  echo "No existing Wrangler dev processes found."
fi

echo "Starting Wrangler dev on port ${PORT}..."
exec npx wrangler dev --port "${PORT}"
