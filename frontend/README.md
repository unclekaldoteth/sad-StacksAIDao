# DAO Factory Frontend

React + TypeScript frontend for the DAO AI Agent dashboard.

## Current On-Chain Contract Set

The frontend reads live contract IDs from backend (`GET /api/dao/config`) and now surfaces them in the UI:

- Header badge: `Contracts v2` (or `Contracts legacy` fallback)
- Dashboard card: `On-Chain Contract Set` with key IDs (Factory, Core, Voting, Treasury)

If the UI does not show `Contracts v2`, verify backend environment and contract mapping first.

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

## Configuration

Set the API base URL in `.env`:

```
VITE_API_URL=http://localhost:3001
```

For Vercel production, set `VITE_API_URL` to your backend domain only (do not append `/api`), e.g.:

```
VITE_API_URL=https://your-backend.up.railway.app
```

Select Stacks network:

```
VITE_STACKS_NETWORK=testnet
```

Optional: enable WalletConnect (for mobile wallets):

```
VITE_WALLETCONNECT_PROJECT_ID=your_project_id
```

## Build

```bash
npm run build
```

## Testing

No frontend tests are configured yet.
