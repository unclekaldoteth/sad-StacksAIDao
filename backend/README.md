# DAO AI Agent Backend

AI-powered governance agent for the DAO Factory.

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

## LLM Providers

Configure `LLM_PROVIDER` in `.env`:

| Provider | Local | API Key Required |
|----------|-------|-----------------|
| `ollama` | ✅ | No |
| `openai` | ❌ | Yes |
| `anthropic` | ❌ | Yes |
| `together` | ❌ | Yes |
| `groq` | ❌ | Yes |

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
