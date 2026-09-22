# DevOps Monitor V2

DevOps Monitor V2 is a read-only observability platform for infrastructure, containers, databases, network activity, incidents, cost visibility, and team operations. The V2 release adds a complete public website, premium authentication, a dense product shell, organization management, billing foundations, and a hardened API.

## Product surfaces

- Public: platform, solutions, pricing, integrations, security, docs, company, contact, status, privacy, and terms
- Identity: sign in, sign up, password recovery, rotating refresh sessions, lockout controls, and secure cookies
- Application: overview, servers, containers, databases, network, metrics, logs, incidents, cost, reports, topology, integrations, team, audit, settings, and billing
- Commerce: Stripe Checkout, customer portal, signed webhooks, subscriptions, and a plan catalog
- Safety: monitored infrastructure remains strictly read-only; the product does not expose remote shell or mutation controls

## Start locally

1. Copy `.env.example` to `.env` and replace every placeholder secret.
2. Start PostgreSQL and Redis with Docker Compose.
3. Install backend dependencies from `backend/requirements.txt`, run Alembic, and start FastAPI on port 8000.
4. Install frontend dependencies and run Next.js on port 3002.

```bash
docker compose up -d postgres redis
cd backend && alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000
cd frontend && npm ci && npm run dev -- -p 3002
```

For the full container stack, run `docker compose up --build` and open `http://localhost:8080`.

## Production configuration

Generate independent high-entropy values for `SECRET_KEY`, `VAULT_ENCRYPTION_KEY`, database credentials, and Redis credentials. Set `COOKIE_SECURE=true` behind HTTPS. Configure Stripe secret, webhook secret, and price IDs before enabling paid checkout. Restrict CORS to the production domains listed in `ALLOWED_ORIGINS`.

## Verification

```bash
cd frontend && npm run lint && npx tsc --noEmit && npm run build
POSTGRES_PASSWORD=test SECRET_KEY=test-secret-key-long-enough-for-ci-only \
  VAULT_ENCRYPTION_KEY=test-vault-key-long-enough-for-ci-only COOKIE_SECURE=false \
  PYTHONPATH=backend .venv-test/bin/pytest -q backend/tests backend/test_pipeline.py
```

The V2 package excludes local secrets, dependencies, build caches, database volumes, and logs.
