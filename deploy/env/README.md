# Deployment Environment Templates

Use these files as the canonical source for production environment variables:

- `deploy/env/railway.backend.env.example`
- `deploy/env/vercel.frontend.env.example`

## Usage

1. Copy values from the matching template into your deployment platform:
   - Railway: backend service variables
   - Vercel: frontend project variables
2. Keep template changes in git whenever deployment env requirements change.
3. For local development, continue using:
   - `backend/.env.example`
   - `frontend/.env.example`
