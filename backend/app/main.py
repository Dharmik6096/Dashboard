"""
DevOps Dashboard — FastAPI Application Entry Point
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, Query, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import structlog

from app.config import settings
from app.database import engine, Base
from app.redis_client import close_redis
from app.tasks.scheduler import start_scheduler, stop_scheduler
from app.core.rate_limit import limiter
from app.api.v1 import auth, servers, containers, alerts, search, events, overview, processes, network, ports, ai
from app.api.websocket import websocket_endpoint
from app.core.security import decode_token

log = structlog.get_logger()

# Import all models so Alembic/SQLAlchemy knows about them
from app.models import *  # noqa


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    log.info("startup_begin")
    try:
        # Create tables if they don't exist
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            # Safely add new cached-metric columns that may not exist in older deployments
            for col_sql in [
                "ALTER TABLE servers ADD COLUMN IF NOT EXISTS last_uptime_seconds INTEGER",
                "ALTER TABLE servers ADD COLUMN IF NOT EXISTS os VARCHAR(100)",
                "ALTER TABLE servers ADD COLUMN IF NOT EXISTS architecture VARCHAR(50)",
                "ALTER TABLE servers ADD COLUMN IF NOT EXISTS cpu_cores INTEGER",
                "ALTER TABLE servers ADD COLUMN IF NOT EXISTS ram_total BIGINT",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE",
            ]:
                await conn.execute(__import__("sqlalchemy").text(col_sql))
        log.info("db_tables_ready")

        # Seed default alert rules if none exist
        await _seed_default_rules()
    except Exception as e:
        log.error(f"Failed to connect to database on startup: {e}")

    try:
        # Start background scheduler
        start_scheduler()
        log.info("scheduler_started")
    except Exception as e:
        log.error(f"Failed to start scheduler: {e}")

    yield

    # Shutdown
    stop_scheduler()
    await close_redis()
    await engine.dispose()
    log.info("shutdown_complete")


app = FastAPI(
    title="DevOps Monitor API",
    version="2.1.0",
    description="Centralized read-only DevOps observability platform",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_and_authentication(request: Request, call_next):
    """Enforce authentication centrally and attach production security headers."""
    path = request.url.path
    public_prefixes = ("/api/v1/auth/", "/api/v1/public/", "/api/v1/billing/webhook")
    public_exact = {"/health", "/api/v1/billing/plans", "/api/docs", "/api/redoc", "/openapi.json"}
    protected = path.startswith("/api/v1/") and path not in public_exact and not path.startswith(public_prefixes)
    if protected and request.method != "OPTIONS":
        authorization = request.headers.get("authorization", "")
        token = authorization[7:].strip() if authorization.lower().startswith("bearer ") else request.cookies.get("dm_access")
        if not token:
            return JSONResponse(status_code=401, content={"detail": "Authentication required"})
        try:
            payload = decode_token(token)
            if payload.get("type") != "access":
                raise ValueError("wrong token type")
            request.state.identity = payload
        except Exception:
            return JSONResponse(status_code=401, content={"detail": "Invalid or expired session"})
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    if settings.ENVIRONMENT == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# Routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(servers.router, prefix="/api/v1")
app.include_router(containers.router, prefix="/api/v1")
app.include_router(alerts.router, prefix="/api/v1")
app.include_router(search.router, prefix="/api/v1")
app.include_router(events.router, prefix="/api/v1")
app.include_router(overview.router, prefix="/api/v1")
app.include_router(processes.router, prefix="/api/v1")
app.include_router(network.router, prefix="/api/v1")
app.include_router(ai.router, prefix="/api/v1")

from app.api.v1 import nginx, settings as app_settings
app.include_router(nginx.router, prefix="/api/v1")
app.include_router(app_settings.router, prefix="/api/v1")

from app.api.v1 import storage, docker, database, rabbitmq, redis, cron
app.include_router(storage.router, prefix="/api/v1")
app.include_router(ports.router, prefix="/api/v1")
app.include_router(docker.router, prefix="/api/v1")
app.include_router(database.router, prefix="/api/v1")
app.include_router(rabbitmq.router, prefix="/api/v1")
app.include_router(redis.router, prefix="/api/v1")
app.include_router(cron.router, prefix="/api/v1")

from app.api.v1 import billing, organizations, public
app.include_router(billing.router, prefix="/api/v1")
app.include_router(organizations.router, prefix="/api/v1")
app.include_router(public.router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "devops-monitor-api", "version": "2.1.0"}


@app.websocket("/ws")
async def ws(websocket: WebSocket, token: str = Query("")):
    await websocket_endpoint(websocket, token)


async def _seed_default_rules():
    """Create default alert rules on first startup."""
    from app.database import AsyncSessionLocal
    from app.models.alert import AlertRule
    from sqlalchemy import select

    async with AsyncSessionLocal() as db:
        existing = await db.execute(select(AlertRule).limit(1))
        if existing.scalar_one_or_none():
            return  # Already seeded

        defaults = [
            AlertRule(name="Server CPU > 80%", target_type="server", metric="cpu_percent", operator="gt", threshold=80, severity="warning"),
            AlertRule(name="Server CPU > 90%", target_type="server", metric="cpu_percent", operator="gt", threshold=90, severity="critical"),
            AlertRule(name="Server RAM > 85%", target_type="server", metric="ram_percent", operator="gt", threshold=85, severity="warning"),
            AlertRule(name="Server RAM > 95%", target_type="server", metric="ram_percent", operator="gt", threshold=95, severity="critical"),
            AlertRule(name="Server Disk > 80%", target_type="server", metric="disk_percent", operator="gt", threshold=80, severity="warning"),
            AlertRule(name="Server Disk > 90%", target_type="server", metric="disk_percent", operator="gt", threshold=90, severity="critical"),
            AlertRule(name="Container CPU > 80%", target_type="container", metric="cpu_percent", operator="gt", threshold=80, severity="warning"),
            AlertRule(name="Container RAM > 85%", target_type="container", metric="ram_percent", operator="gt", threshold=85, severity="warning"),
        ]
        for rule in defaults:
            db.add(rule)
        await db.commit()
        log.info("default_alert_rules_seeded", count=len(defaults))
