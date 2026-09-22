"""Identity endpoints with lockout, strong passwords, rotating refresh sessions and secure cookies."""
import hashlib
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.rate_limit import limiter
from app.core.security import create_access_token, create_refresh_token, decode_token, hash_password, verify_password
from app.database import get_db
from app.models.audit import AuditLog
from app.models.platform import Organization, OrganizationMember, PasswordResetToken, RefreshSession, Subscription
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    role: str = "viewer"


class SignupRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: str = Field(min_length=5, max_length=255)
    company: str = Field(min_length=2, max_length=160)
    password: str = Field(min_length=12, max_length=128)

    @field_validator("email")
    @classmethod
    def valid_email(cls, value: str) -> str:
        value = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Enter a valid email address")
        return value

    @field_validator("password")
    @classmethod
    def strong_password(cls, value: str) -> str:
        if not re.search(r"[A-Z]", value) or not re.search(r"[a-z]", value) or not re.search(r"\d", value):
            raise ValueError("Password must include uppercase, lowercase and a number")
        return value


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict


class RefreshRequest(BaseModel):
    refresh_token: str | None = None


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    password: str = Field(min_length=12, max_length=128)


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    return (forwarded.split(",")[0].strip() if forwarded else request.client.host if request.client else None)


def _set_auth_cookies(response: Response, access: str, refresh: str) -> None:
    common = {"httponly": True, "secure": settings.COOKIE_SECURE, "samesite": "lax"}
    response.set_cookie("dm_access", access, max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60, path="/", **common)
    response.set_cookie("dm_refresh", refresh, max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400, path="/api/v1/auth", **common)


async def _create_refresh_session(db: AsyncSession, user_id: uuid.UUID, token: str, request: Request) -> None:
    payload = decode_token(token)
    expires_at = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
    db.add(RefreshSession(
        user_id=user_id,
        jti_hash=hashlib.sha256(payload["jti"].encode()).hexdigest(),
        expires_at=expires_at,
        ip_address=_client_ip(request),
        user_agent=request.headers.get("user-agent", "")[:1000],
    ))


def _token_payload(user: User, access: str, refresh: str) -> TokenResponse:
    return TokenResponse(access_token=access, refresh_token=refresh, user={"id": str(user.id), "username": user.username, "email": user.email, "role": user.role})


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(request: Request, response: Response, form: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    identifier = form.username.strip().lower()
    result = await db.execute(select(User).where(or_(User.username == identifier, User.email == identifier)))
    user = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if user and user.locked_until and user.locked_until > now:
        raise HTTPException(status_code=423, detail="Account is temporarily locked. Try again later.")
    if not user or not verify_password(form.password, user.password_hash):
        if user:
            user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
            if user.failed_login_attempts >= 5:
                user.locked_until = now + timedelta(minutes=15)
            db.add(AuditLog(user_id=user.id, action="auth.login_failed", ip_address=_client_ip(request), user_agent=request.headers.get("user-agent")))
            await db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username/email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")
    user.last_login = now
    user.failed_login_attempts = 0
    user.locked_until = None
    access = create_access_token(str(user.id), user.role)
    refresh = create_refresh_token(str(user.id))
    await _create_refresh_session(db, user.id, refresh, request)
    db.add(AuditLog(user_id=user.id, action="auth.login_succeeded", ip_address=_client_ip(request), user_agent=request.headers.get("user-agent")))
    await db.commit()
    _set_auth_cookies(response, access, refresh)
    return _token_payload(user, access, refresh)


@router.post("/signup", status_code=201)
@limiter.limit("5/hour")
async def signup(request: Request, body: SignupRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(or_(User.email == body.email, User.username == body.email)))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="An account already exists for this email")
    base_slug = re.sub(r"[^a-z0-9]+", "-", body.company.lower()).strip("-") or "workspace"
    slug = f"{base_slug}-{secrets.token_hex(3)}"
    user = User(username=body.email, email=body.email, password_hash=hash_password(body.password), role="admin")
    org = Organization(name=body.company.strip(), slug=slug)
    db.add_all([user, org])
    await db.flush()
    db.add_all([
        OrganizationMember(organization_id=org.id, user_id=user.id, role="owner", status="active", joined_at=datetime.now(timezone.utc)),
        Subscription(organization_id=org.id, plan="starter", status="active"),
        AuditLog(user_id=user.id, action="workspace.created", resource_type="organization", resource_id=str(org.id), ip_address=_client_ip(request)),
    ])
    await db.commit()
    return {"message": "Workspace created", "workspace": {"id": str(org.id), "name": org.name, "slug": org.slug}}


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("30/hour")
async def refresh(request: Request, response: Response, body: RefreshRequest | None = None, dm_refresh: str | None = Cookie(default=None), db: AsyncSession = Depends(get_db)):
    token = (body.refresh_token if body else None) or dm_refresh
    if not token:
        raise HTTPException(status_code=401, detail="Refresh token required")
    payload = decode_token(token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    jti_hash = hashlib.sha256(payload["jti"].encode()).hexdigest()
    session_result = await db.execute(select(RefreshSession).where(RefreshSession.jti_hash == jti_hash))
    session = session_result.scalar_one_or_none()
    if not session or session.revoked_at or session.expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Refresh session expired or revoked")
    user = (await db.execute(select(User).where(User.id == payload["sub"], User.is_active.is_(True)))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    session.revoked_at = datetime.now(timezone.utc)
    access = create_access_token(str(user.id), user.role)
    new_refresh = create_refresh_token(str(user.id))
    await _create_refresh_session(db, user.id, new_refresh, request)
    await db.commit()
    _set_auth_cookies(response, access, new_refresh)
    return _token_payload(user, access, new_refresh)


@router.post("/logout", status_code=204)
async def logout(response: Response, body: RefreshRequest | None = None, dm_refresh: str | None = Cookie(default=None), db: AsyncSession = Depends(get_db)):
    token = (body.refresh_token if body else None) or dm_refresh
    if token:
        try:
            payload = decode_token(token)
            jti_hash = hashlib.sha256(payload["jti"].encode()).hexdigest()
            session = (await db.execute(select(RefreshSession).where(RefreshSession.jti_hash == jti_hash))).scalar_one_or_none()
            if session:
                session.revoked_at = datetime.now(timezone.utc)
                await db.commit()
        except HTTPException:
            pass
    response.delete_cookie("dm_access", path="/")
    response.delete_cookie("dm_refresh", path="/api/v1/auth")


@router.post("/forgot-password", status_code=202)
@limiter.limit("5/hour")
async def forgot_password(request: Request, body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    user = (await db.execute(select(User).where(User.email == body.email.strip().lower()))).scalar_one_or_none()
    if user and user.is_active:
        raw = secrets.token_urlsafe(32)
        db.add(PasswordResetToken(user_id=user.id, token_hash=hashlib.sha256(raw.encode()).hexdigest(), expires_at=datetime.now(timezone.utc) + timedelta(minutes=30)))
        db.add(AuditLog(user_id=user.id, action="auth.password_reset_requested", ip_address=_client_ip(request)))
        await db.commit()
        # Integrate the configured mail provider here. Never return the raw token from the API.
    return {"message": "If the account exists, recovery instructions have been sent"}


@router.post("/reset-password")
@limiter.limit("5/hour")
async def reset_password(request: Request, body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    if not re.search(r"[A-Z]", body.password) or not re.search(r"[a-z]", body.password) or not re.search(r"\d", body.password):
        raise HTTPException(status_code=422, detail="Password must include uppercase, lowercase and a number")
    token_hash = hashlib.sha256(body.token.encode()).hexdigest()
    token = (await db.execute(select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash))).scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if not token or token.used_at or token.expires_at <= now:
        raise HTTPException(status_code=400, detail="Reset link is invalid or expired")
    user = (await db.execute(select(User).where(User.id == token.user_id))).scalar_one()
    user.password_hash = hash_password(body.password)
    token.used_at = now
    sessions = (await db.execute(select(RefreshSession).where(RefreshSession.user_id == user.id, RefreshSession.revoked_at.is_(None)))).scalars().all()
    for session in sessions:
        session.revoked_at = now
    db.add(AuditLog(user_id=user.id, action="auth.password_reset_completed", ip_address=_client_ip(request)))
    await db.commit()
    return {"message": "Password updated"}


@router.post("/register", status_code=201)
async def register_first_admin(body: UserCreate, db: AsyncSession = Depends(get_db)):
    """Bootstrap-only endpoint retained for self-hosted deployments."""
    if (await db.execute(select(User).where(User.role == "admin"))).scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Admin already exists. Contact your admin.")
    user = User(username=body.username.strip().lower(), email=body.email.strip().lower(), password_hash=hash_password(body.password), role="admin")
    db.add(user)
    await db.commit()
    return {"message": "Admin created", "username": user.username}


async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)) -> User:
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = (await db.execute(select(User).where(User.id == payload.get("sub"), User.is_active.is_(True)))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@router.get("/me")
async def get_current_user_info(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    membership = (await db.execute(select(OrganizationMember, Organization).join(Organization, Organization.id == OrganizationMember.organization_id).where(OrganizationMember.user_id == user.id, OrganizationMember.status == "active"))).first()
    if membership:
        member, organization = membership
        workspace = {"id": str(organization.id), "name": organization.name, "slug": organization.slug, "role": member.role}
    else:
        workspace = None
    return {"id": str(user.id), "username": user.username, "email": user.email, "role": user.role, "last_login": user.last_login.isoformat() if user.last_login else None, "workspace": workspace}
