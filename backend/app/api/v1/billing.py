"""Stripe-ready subscription endpoints. Card data is handled only by Stripe Checkout."""
import hashlib
import hmac
import json
import time
from datetime import datetime, timezone
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth import get_current_user
from app.api.v1.organizations import current_membership, require_admin
from app.config import settings
from app.database import get_db
from app.models.audit import AuditLog
from app.models.platform import Organization, Subscription
from app.models.server import Server
from app.models.user import User

router = APIRouter(prefix="/billing", tags=["billing"])

PLANS = [
    {"id": "starter", "name": "Starter", "price_monthly": 0, "host_limit": 5, "retention_days": 7, "features": ["Core dashboards", "Email alerts", "Community support"]},
    {"id": "scale", "name": "Scale", "price_monthly": 49, "host_limit": 50, "retention_days": 30, "features": ["AI investigations", "Team roles", "Audit log", "Priority support"]},
    {"id": "enterprise", "name": "Enterprise", "price_monthly": 0, "host_limit": None, "retention_days": 365, "features": ["Custom retention", "SSO-ready", "Private deployment", "Enterprise SLA"]},
]


class CheckoutRequest(BaseModel):
    plan: str
    success_url: str
    cancel_url: str


class PortalRequest(BaseModel):
    return_url: str


def safe_return_url(url: str) -> str:
    parsed = urlparse(url)
    allowed = {urlparse(settings.APP_URL).netloc, "localhost:3000", "127.0.0.1:3000"}
    if parsed.scheme not in {"http", "https"} or parsed.netloc not in allowed:
        raise HTTPException(status_code=422, detail="Return URL is not allowed")
    return url


async def stripe_post(path: str, data: dict[str, str]) -> dict:
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Stripe billing is not configured for this deployment")
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(f"https://api.stripe.com/v1/{path}", data=data, auth=(settings.STRIPE_SECRET_KEY, ""))
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="Payment provider rejected the request")
    return response.json()


@router.get("/plans")
async def list_plans():
    return PLANS


@router.get("/summary")
async def billing_summary(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    membership = await current_membership(user, db)
    subscription = (await db.execute(select(Subscription).where(Subscription.organization_id == membership.organization_id))).scalar_one_or_none()
    if not subscription:
        subscription = Subscription(organization_id=membership.organization_id, plan="starter", status="active")
        db.add(subscription)
        await db.commit()
        await db.refresh(subscription)
    host_count = (await db.execute(select(func.count(Server.id)).where(Server.is_active.is_(True)))).scalar_one()
    plan = next((item for item in PLANS if item["id"] == subscription.plan), PLANS[0])
    return {"plan": plan["name"], "status": subscription.status, "host_count": host_count, "host_limit": plan["host_limit"], "retention_days": plan["retention_days"], "period_end": subscription.current_period_end.isoformat() if subscription.current_period_end else None, "cancel_at_period_end": subscription.cancel_at_period_end}


@router.post("/checkout-session")
async def create_checkout(body: CheckoutRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    membership = await current_membership(user, db)
    require_admin(membership)
    if body.plan == "enterprise":
        return {"url": f"{settings.APP_URL}/contact?topic=enterprise", "message": "Contact sales for enterprise pricing"}
    price_id = settings.STRIPE_SCALE_PRICE_ID if body.plan == "scale" else ""
    if not price_id:
        raise HTTPException(status_code=503, detail="The selected paid plan is not configured yet")
    result = await stripe_post("checkout/sessions", {"mode": "subscription", "line_items[0][price]": price_id, "line_items[0][quantity]": "1", "success_url": safe_return_url(body.success_url), "cancel_url": safe_return_url(body.cancel_url), "client_reference_id": str(membership.organization_id), "customer_email": user.email, "metadata[organization_id]": str(membership.organization_id), "allow_promotion_codes": "true"})
    return {"id": result["id"], "url": result["url"]}


@router.post("/portal-session")
async def create_portal(body: PortalRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    membership = await current_membership(user, db)
    require_admin(membership)
    subscription = (await db.execute(select(Subscription).where(Subscription.organization_id == membership.organization_id))).scalar_one_or_none()
    if not subscription or not subscription.stripe_customer_id:
        raise HTTPException(status_code=409, detail="No paid subscription is connected to this workspace")
    result = await stripe_post("billing_portal/sessions", {"customer": subscription.stripe_customer_id, "return_url": safe_return_url(body.return_url)})
    return {"url": result["url"]}


def verify_stripe_signature(payload: bytes, signature: str) -> None:
    if not settings.STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Stripe webhook is not configured")
    parts = dict(item.split("=", 1) for item in signature.split(",") if "=" in item)
    try:
        timestamp = int(parts["t"])
        supplied = parts["v1"]
    except (KeyError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")
    if abs(time.time() - timestamp) > 300:
        raise HTTPException(status_code=400, detail="Expired webhook signature")
    expected = hmac.new(settings.STRIPE_WEBHOOK_SECRET.encode(), f"{timestamp}.".encode() + payload, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, supplied):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")


@router.post("/webhook")
async def stripe_webhook(request: Request, stripe_signature: str = Header(alias="stripe-signature"), db: AsyncSession = Depends(get_db)):
    payload = await request.body()
    verify_stripe_signature(payload, stripe_signature)
    event = json.loads(payload)
    if (await db.execute(select(AuditLog).where(AuditLog.resource_type == "stripe_event", AuditLog.resource_id == event.get("id")))).scalar_one_or_none():
        return {"received": True, "duplicate": True}
    obj = event.get("data", {}).get("object", {})
    org_id = obj.get("metadata", {}).get("organization_id") or obj.get("client_reference_id")
    if org_id:
        subscription = (await db.execute(select(Subscription).where(Subscription.organization_id == org_id))).scalar_one_or_none()
        if subscription:
            if event.get("type") == "checkout.session.completed":
                subscription.plan = "scale"
                subscription.status = "active"
                subscription.stripe_customer_id = obj.get("customer")
                subscription.stripe_subscription_id = obj.get("subscription")
            elif event.get("type", "").startswith("customer.subscription."):
                subscription.status = obj.get("status", subscription.status)
                subscription.cancel_at_period_end = bool(obj.get("cancel_at_period_end", False))
                if obj.get("current_period_end"):
                    subscription.current_period_end = datetime.fromtimestamp(obj["current_period_end"], tz=timezone.utc)
    db.add(AuditLog(action=f"billing.{event.get('type', 'unknown')}", resource_type="stripe_event", resource_id=event.get("id"), details={"livemode": event.get("livemode", False)}))
    await db.commit()
    return {"received": True}

