# DAO AI Agent Backend

AI-powered governance agent for the DAO Factory.

## Current On-Chain Target (Mainnet)

- Deployer: `SP1MTYHV6K2FNH3QNF4P5QXS9VJ3XZ0GBB5T1SJPK`
- Contract set: `-v2`
- Backend contract resolver (`buildDaoContracts`) now defaults to:
  - `${DAO_DEPLOYER_ADDRESS}.dao-core-v2`
  - `${DAO_DEPLOYER_ADDRESS}.proposal-submission-v2`
  - `${DAO_DEPLOYER_ADDRESS}.proposal-voting-v2`
  - `${DAO_DEPLOYER_ADDRESS}.governance-token-v2`
  - `${DAO_DEPLOYER_ADDRESS}.membership-v2`
  - `${DAO_DEPLOYER_ADDRESS}.extensions-registry-v2`
  - `${DAO_DEPLOYER_ADDRESS}.treasury-v2`
  - `${DAO_DEPLOYER_ADDRESS}.treasury-actions-v2`
  - `${DAO_DEPLOYER_ADDRESS}.template-registry-v2`
  - `${DAO_DEPLOYER_ADDRESS}.dao-factory-v2`

## Quick Start

```bash
# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env

# Start development server
npm run dev
```

## Testing

```bash
npm test
```

## Stacks Environment

Set these in `.env` for mainnet:

```bash
STACKS_NETWORK=mainnet
STACKS_API_URL=https://api.hiro.so
DAO_DEPLOYER_ADDRESS=SP1MTYHV6K2FNH3QNF4P5QXS9VJ3XZ0GBB5T1SJPK
DAO_FACTORY_CONTRACT_ID=SP1MTYHV6K2FNH3QNF4P5QXS9VJ3XZ0GBB5T1SJPK.dao-factory-v2
```

If `DAO_FACTORY_CONTRACT_ID` is omitted, backend defaults to `${DAO_DEPLOYER_ADDRESS}.dao-factory-v2`.

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
