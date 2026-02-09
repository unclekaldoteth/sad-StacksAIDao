# Stacks AI DAO Monorepo

This repository contains three coordinated packages:

- `dao-factory`: Clarity smart contracts and contract tests for DAO governance primitives on Stacks.
- `backend`: Node.js/TypeScript API that wraps LLM providers and exposes DAO governance assistant endpoints.
- `frontend`: React + Vite dashboard that calls the backend API for health checks, proposal analysis, and chat.

## Repository Layout

| Package | Path | Purpose |
|---|---|---|
| Smart Contracts | `dao-factory` | DAO core, proposal, voting, treasury, and extension contracts with Clarinet/Vitest tests |
| API Service | `backend` | DAO AI Agent API, provider abstraction (`ollama`, `openai`, `anthropic`, `together`, `groq`) |
| Web App | `frontend` | Governance dashboard UI that consumes backend endpoints |

## How the Packages Fit Together

1. `dao-factory` defines on-chain governance behavior and treasury logic in Clarity.
2. `backend` exposes:
   - read-only on-chain DAO state (`GET /api/dao/*`)
   - heuristic risk scanning and alerts (`GET /api/dao/alerts`)
   - AI endpoints (`POST /api/analyze-proposal`, `POST /api/voting-recommendation`, `POST /api/analyze-treasury`, `POST /api/chat`) that pull live on-chain context before prompting the LLM.
3. `frontend` presents proposals and assistant interactions, consumes `/api/dao/*` and `/api/dao/alerts` for real on-chain state, and uses wallet transactions for proposal creation and voting.

## Architecture Diagram

```mermaid
flowchart TB
  U["DAO Member"] --> F["frontend (React + Vite)"]
  F -->|"REST: /api/*"| B["backend (Express + DAO Agent)"]
  B -->|"LLM completion/stream"| P["LLM Provider (Ollama/OpenAI/Anthropic/Together/Groq/Gemini)"]

  subgraph Chain["Stacks Blockchain (Deployed DAO Instance)"]
    DAO["dao-factory (Clarity: DAO Core + Extensions)"]
  end

  B -->|"read-only calls (STACKS_API_URL)"| DAO
  F -->|"wallet tx (propose/vote)"| DAO
```

## Local Development

### Prerequisites

- Node.js 20+ (recommended)
- npm

### 1) Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Backend runs on `http://localhost:3001` by default.

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

If needed, set API URL in `frontend/.env`:

```bash
VITE_API_URL=http://localhost:3001
```

### 3) DAO Contracts

```bash
cd dao-factory
npm install
npm test
```

Note: `dao-factory/settings/Mainnet.toml` and `dao-factory/settings/Testnet.toml` are gitignored because they may contain mnemonics. Use `dao-factory/settings/Mainnet.toml.example` and `dao-factory/settings/Testnet.toml.example` as templates.

## Test Commands

- Backend: `cd backend && npm test`
- DAO contracts: `cd dao-factory && npm test`
- Frontend: no test suite configured yet

## Useful Docs

- Backend package docs: `backend/README.md`
- Frontend package docs: `frontend/README.md`
