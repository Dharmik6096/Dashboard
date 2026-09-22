import uuid
import secrets
import string
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import List, Optional

from app.database import get_db
from app.models.settings import APIKey, SecuritySettings, NotificationPreferences
from app.api.v1.auth import oauth2_scheme, decode_token

router = APIRouter(prefix="/settings", tags=["settings"])

async def get_current_user_id(token: str = Depends(oauth2_scheme)) -> uuid.UUID:
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token")
    return uuid.UUID(payload.get("sub"))

# Security Settings
class SecuritySettingsUpdate(BaseModel):
    two_factor_enabled: bool
    session_timeout_minutes: int
    enforce_password_policy: bool

@router.get("/security")
async def get_security_settings(user_id: uuid.UUID = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SecuritySettings).where(SecuritySettings.user_id == user_id))
    settings = result.scalar_one_or_none()
    if not settings:
        settings = SecuritySettings(user_id=user_id)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    return {
        "two_factor_enabled": settings.two_factor_enabled,
        "session_timeout_minutes": settings.session_timeout_minutes,
        "enforce_password_policy": settings.enforce_password_policy,
    }

@router.put("/security")
async def update_security_settings(body: SecuritySettingsUpdate, user_id: uuid.UUID = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SecuritySettings).where(SecuritySettings.user_id == user_id))
    settings = result.scalar_one_or_none()
    if not settings:
        settings = SecuritySettings(user_id=user_id)
        db.add(settings)
    
    settings.two_factor_enabled = body.two_factor_enabled
    settings.session_timeout_minutes = body.session_timeout_minutes
    settings.enforce_password_policy = body.enforce_password_policy
    await db.commit()
    return {"message": "Security settings updated successfully"}


# Notification Preferences
class NotificationPreferencesUpdate(BaseModel):
    preferences: dict

@router.get("/notifications")
async def get_notification_preferences(user_id: uuid.UUID = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(NotificationPreferences).where(NotificationPreferences.user_id == user_id))
    prefs = result.scalar_one_or_none()
    if not prefs:
        prefs = NotificationPreferences(user_id=user_id, preferences={
            "Critical System Failures": {"email": True, "slack": True, "sms": True},
            "CPU/Memory Spikes": {"email": True, "slack": False, "sms": False},
            "Database Connection Issues": {"email": True, "slack": True, "sms": False},
            "Weekly Analytics Reports": {"email": False, "slack": False, "sms": False},
        })
        db.add(prefs)
        await db.commit()
        await db.refresh(prefs)
    return {"preferences": prefs.preferences}

@router.put("/notifications")
async def update_notification_preferences(body: NotificationPreferencesUpdate, user_id: uuid.UUID = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(NotificationPreferences).where(NotificationPreferences.user_id == user_id))
    prefs = result.scalar_one_or_none()
    if not prefs:
        prefs = NotificationPreferences(user_id=user_id)
        db.add(prefs)
    
    prefs.preferences = body.preferences
    await db.commit()
    return {"message": "Notification preferences updated successfully"}


# API Keys
class APIKeyCreate(BaseModel):
    name: str

@router.get("/apikeys")
async def list_api_keys(user_id: uuid.UUID = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(APIKey).where(APIKey.user_id == user_id).order_by(APIKey.created_at.desc()))
    keys = result.scalars().all()
    return [
        {
            "id": str(key.id),
            "name": key.name,
            "prefix": key.prefix,
            "created_at": key.created_at.isoformat() if key.created_at else None,
            "last_used": key.last_used.isoformat() if key.last_used else None,
        }
        for key in keys
    ]

@router.post("/apikeys")
async def create_api_key(body: APIKeyCreate, user_id: uuid.UUID = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    # Generate a random 32 char string
    raw_key = "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(32))
    prefix = raw_key[:10] + "..."
    
    # In a real app we'd hash the raw_key, here we'll just store a dummy hash for brevity
    import hashlib
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()

    new_key = APIKey(
        user_id=user_id,
        name=body.name,
        prefix=prefix,
        key_hash=key_hash
    )
    db.add(new_key)
    await db.commit()
    await db.refresh(new_key)

    # We only return the raw_key once upon creation
    return {
        "id": str(new_key.id),
        "name": new_key.name,
        "prefix": new_key.prefix,
        "raw_key": raw_key,
        "created_at": new_key.created_at.isoformat() if new_key.created_at else None,
    }

@router.delete("/apikeys/{key_id}")
async def revoke_api_key(key_id: uuid.UUID, user_id: uuid.UUID = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(APIKey).where(APIKey.id == key_id, APIKey.user_id == user_id))
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    await db.delete(key)
    await db.commit()
    return {"message": "API key revoked successfully"}
