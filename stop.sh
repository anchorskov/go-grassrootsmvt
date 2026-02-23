#!/usr/bin/env bash
set -euo pipefail

# Find Wrangler processes and stop them.
mapfile -t WRANGLER_PIDS < <(ps -eo pid=,args= | awk '
  /wrangler([[:space:]]|$)|wrangler-dist\/cli\.js/ && $0 !~ /awk/ {
    print $1
  }
')

if [ "${#WRANGLER_PIDS[@]}" -eq 0 ]; then
  echo "No Wrangler processes found."
  exit 0
fi

echo "Stopping Wrangler process(es): ${WRANGLER_PIDS[*]}"
kill "${WRANGLER_PIDS[@]}" || true

# Give processes a moment to exit gracefully.
sleep 1

# Force kill any remaining Wrangler processes.
mapfile -t STILL_RUNNING < <(ps -eo pid=,args= | awk -v pids=" ${WRANGLER_PIDS[*]} " '
  /wrangler([[:space:]]|$)|wrangler-dist\/cli\.js/ && $0 !~ /awk/ {
    if (index(pids, " " $1 " ") > 0) print $1
  }
')

if [ "${#STILL_RUNNING[@]}" -gt 0 ]; then
  echo "Force stopping Wrangler process(es): ${STILL_RUNNING[*]}"
  kill -9 "${STILL_RUNNING[@]}" || true
fi

echo "Wrangler processes stopped."
