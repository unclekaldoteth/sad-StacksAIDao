#!/bin/bash
# =============================================================
# Stacks DAO Factory — Mainnet Deployment (v2 contracts)
# Fee tier : LOW — 5,000 microstacks (0.05 STX) per contract
# Total    : 31 contracts × 0.05 STX ≈ 1.55 STX
# Deployer : SP1MTYHV6K2FNH3QNF4P5QXS9VJ3XZ0GBB5T1SJPK
# =============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "=============================================="
echo "  DAO Factory v2 — Mainnet Deployment"
echo "  Fee: LOW (0.05 STX / 5000 µSTX per tx)"
echo "  Contracts: 31"
echo "  Estimated total cost: ~1.55 STX"
echo "=============================================="
echo ""

# Validate Clarinet is installed
if ! command -v clarinet &> /dev/null; then
  echo "❌ Error: clarinet is not installed. Install from https://github.com/hirosystems/clarinet"
  exit 1
fi

CLARINET_VERSION=$(clarinet --version 2>&1 | head -n1)
echo "ℹ️  Using $CLARINET_VERSION"
echo ""

# Validate deployment plan exists
PLAN="deployments/default.mainnet-plan.yaml"
MANIFEST="Clarinet.v2.toml"

if [ ! -f "$PLAN" ]; then
  echo "❌ Error: Deployment plan not found at $PLAN"
  exit 1
fi

if [ ! -f "$MANIFEST" ]; then
  echo "❌ Error: Manifest not found at $MANIFEST"
  exit 1
fi

echo "✅ Deployment plan : $PLAN"
echo "✅ Manifest        : $MANIFEST"
echo ""
echo "🚀 Starting deployment..."
echo ""

# Apply deployment using v2 manifest + mainnet plan
# --use-on-disk-deployment-plan prevents Clarinet from recomputing costs
# (which would overwrite our low-fee 5000 µSTX values)
clarinet deployments apply \
  --manifest-path "$MANIFEST" \
  --deployment-plan-path "$PLAN" \
  --use-on-disk-deployment-plan \
  --no-dashboard

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🔍 Verify your contracts at:"
echo "   https://explorer.hiro.so/address/SP1MTYHV6K2FNH3QNF4P5QXS9VJ3XZ0GBB5T1SJPK?chain=mainnet"
