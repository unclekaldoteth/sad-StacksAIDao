#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-3010}"
HOST="${HOST:-127.0.0.1}"
BASE_URL="http://${HOST}:${PORT}"
HEALTH_JSON="${HEALTH_JSON:-/tmp/dao-ai-agent.health.json}"
CONFIG_JSON="${CONFIG_JSON:-/tmp/dao-ai-agent.config.json}"
SERVER_LOG="${SERVER_LOG:-/tmp/dao-ai-agent.smoke.log}"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill "${SERVER_PID}" >/dev/null 2>&1 || true
    wait "${SERVER_PID}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo "[smoke] starting backend on ${BASE_URL}"
NODE_ENV="${NODE_ENV:-production}" \
PORT="${PORT}" \
LLM_PROVIDER="${LLM_PROVIDER:-ollama}" \
OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-http://127.0.0.1:11434}" \
STACKS_NETWORK="${STACKS_NETWORK:-mainnet}" \
STACKS_API_URL="${STACKS_API_URL:-http://127.0.0.1:3999}" \
DAO_DEPLOYER_ADDRESS="${DAO_DEPLOYER_ADDRESS:-SP1MTYHV6K2FNH3QNF4P5QXS9VJ3XZ0GBB5T1SJPK}" \
npm run start >"${SERVER_LOG}" 2>&1 &
SERVER_PID=$!

ready=0
for _ in $(seq 1 30); do
  if curl -sSf "${BASE_URL}/api/health" >"${HEALTH_JSON}"; then
    ready=1
    break
  fi
  sleep 1
done

if [[ "${ready}" -ne 1 ]]; then
  echo "[smoke] backend did not become ready"
  echo "[smoke] server log:"
  sed -n '1,240p' "${SERVER_LOG}" || true
  exit 1
fi

curl -sSf "${BASE_URL}/api/dao/config" >"${CONFIG_JSON}"

node - "${HEALTH_JSON}" "${CONFIG_JSON}" <<'NODE'
const fs = require('node:fs');

const healthPath = process.argv[2];
const configPath = process.argv[3];

const health = JSON.parse(fs.readFileSync(healthPath, 'utf8'));
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

if (health.status !== 'ok') {
  throw new Error(`Unexpected health status: ${health.status}`);
}

if (!health.llm || typeof health.llm.provider !== 'string') {
  throw new Error('Health payload missing llm.provider');
}

if (!config.contracts || typeof config.contracts.core !== 'string' || config.contracts.core.length === 0) {
  throw new Error('DAO config payload missing contracts.core');
}

if (!config.deployerAddress || typeof config.deployerAddress !== 'string') {
  throw new Error('DAO config payload missing deployerAddress');
}

console.log('[smoke] health status:', health.status);
console.log('[smoke] llm provider:', health.llm.provider);
console.log('[smoke] core contract:', config.contracts.core);
NODE

echo "[smoke] backend endpoint checks passed"
