# DAO AI Agent Backend

AI-powered governance agent for the DAO Factory.

## Current On-Chain Target (Mainnet)

- Deployer: `SP1MTYHV6K2FNH3QNF4P5QXS9VJ3XZ0GBB5T1SJPK`
- Contract set: `-v2-c4`
- Backend contract resolver (`buildDaoContracts`) now defaults to:
  - `${DAO_DEPLOYER_ADDRESS}.dao-core-v2-c4`
  - `${DAO_DEPLOYER_ADDRESS}.proposal-submission-v2-c4`
  - `${DAO_DEPLOYER_ADDRESS}.proposal-voting-v2-c4`
  - `${DAO_DEPLOYER_ADDRESS}.governance-token-v2-c4`
  - `${DAO_DEPLOYER_ADDRESS}.membership-v2-c4`
  - `${DAO_DEPLOYER_ADDRESS}.extensions-registry-v2-c4`
  - `${DAO_DEPLOYER_ADDRESS}.treasury-v2-c4`
  - `${DAO_DEPLOYER_ADDRESS}.treasury-actions-v2-c4`
  - `${DAO_DEPLOYER_ADDRESS}.template-registry-v2-c4`
  - `${DAO_DEPLOYER_ADDRESS}.dao-factory-v2-c4`

## Quick Start

```bash
# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env

# Start development server
npm run dev
```

The backend now validates critical environment variables at startup and exits with a clear error if configuration is invalid.
At minimum, set one of:

- `DAO_DEPLOYER_ADDRESS`
- `DAO_FACTORY_CONTRACT_ID`

## Testing

```bash
npm test
```

Endpoint smoke test (boots the app and verifies `/api/health` and `/api/dao/config`):

```bash
npm run build
npm run smoke
```

## Stacks Environment

Set these in `.env` for mainnet:

```bash
STACKS_NETWORK=mainnet
STACKS_API_URL=https://api.hiro.so
DAO_DEPLOYER_ADDRESS=SP1MTYHV6K2FNH3QNF4P5QXS9VJ3XZ0GBB5T1SJPK
DAO_FACTORY_CONTRACT_ID=SP1MTYHV6K2FNH3QNF4P5QXS9VJ3XZ0GBB5T1SJPK.dao-factory-v2-c4
```

If `DAO_FACTORY_CONTRACT_ID` is omitted, backend defaults to `${DAO_DEPLOYER_ADDRESS}.dao-factory-v2-c4`.

For Railway production deployment, use `../deploy/env/railway.backend.env.example` as the source-of-truth template.

## LLM Providers

Configure `LLM_PROVIDER` in `.env`:

| Provider | Local | API Key Required |
|----------|-------|-----------------|
| `ollama` | ✅ | No |
| `openai` | ❌ | Yes |
| `anthropic` | ❌ | Yes |
| `together` | ❌ | Yes |
| `groq` | ❌ | Yes |
| `gemini` | ❌ | Yes |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/provider` | GET | Current LLM info |
| `/api/analyze-proposal` | POST | Analyze a proposal |
| `/api/voting-recommendation` | POST | Get voting recommendation |
| `/api/analyze-treasury` | POST | Treasury insights |
| `/api/chat` | POST | Chat with agent |

## Example Usage

```bash
# Analyze a proposal
curl -X POST http://localhost:3001/api/analyze-proposal \
  -H "Content-Type: application/json" \
  -d '{
    "daoAddress": "ST1ZGGS886YCZHMFXJR1EK61ZP34FNWNSX28M1PMM",
    "proposal": {
      "id": 1,
      "title": "Fund Community Event",
      "description": "Allocate 100 STX for community meetup",
      "proposer": "ST1..."
    }
  }'
```
