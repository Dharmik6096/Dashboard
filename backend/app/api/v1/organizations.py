"""Workspace membership, invitations and governance endpoints."""
import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth import get_current_user
from app.database import get_db
from app.models.audit import AuditLog
from app.models.platform import Organization, OrganizationMember
from app.models.user import User

router = APIRouter(prefix="/organizations", tags=["organizations"])


class InvitationCreate(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    role: str = "viewer"


async def current_membership(user: User, db: AsyncSession) -> OrganizationMember:
    membership = (await db.execute(select(OrganizationMember).where(OrganizationMember.user_id == user.id, OrganizationMember.status == "active").order_by(OrganizationMember.created_at))).scalars().first()
    if not membership:
        # Preserve upgraded self-hosted installations by creating a personal workspace lazily.
        org = Organization(name=f"{user.username}'s workspace", slug=f"workspace-{str(user.id)[:8]}")
        db.add(org)
        await db.flush()
        membership = OrganizationMember(organization_id=org.id, user_id=user.id, role="owner", status="active", joined_at=datetime.now(timezone.utc))
        db.add(membership)
        await db.commit()
        await db.refresh(membership)
    return membership


def require_admin(membership: OrganizationMember) -> None:
    if membership.role not in {"owner", "admin"}:
        raise HTTPException(status_code=403, detail="Workspace administrator access required")


@router.get("/current")
async def get_current_organization(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    membership = await current_membership(user, db)
    org = (await db.execute(select(Organization).where(Organization.id == membership.organization_id))).scalar_one()
    return {"id": str(org.id), "name": org.name, "slug": org.slug, "role": membership.role}


@router.get("/members")
async def list_members(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    membership = await current_membership(user, db)
    rows = (await db.execute(select(OrganizationMember, User).outerjoin(User, User.id == OrganizationMember.user_id).where(OrganizationMember.organization_id == membership.organization_id).order_by(OrganizationMember.created_at))).all()
    return [{"id": str(member.id), "name": account.username if account else "Invited user", "email": account.email if account else member.invited_email, "role": member.role, "status": member.status, "last_active": account.last_login.isoformat() if account and account.last_login else None} for member, account in rows]


@router.post("/invitations", status_code=201)
async def invite_member(request: Request, body: InvitationCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    membership = await current_membership(user, db)
    require_admin(membership)
    email = body.email.strip().lower()
    if body.role not in {"viewer", "analyst", "admin"}:
        raise HTTPException(status_code=422, detail="Unsupported workspace role")
    duplicate = (await db.execute(select(OrganizationMember).outerjoin(User, User.id == OrganizationMember.user_id).where(OrganizationMember.organization_id == membership.organization_id, ((OrganizationMember.invited_email == email) | (User.email == email))))).scalars().first()
    if duplicate:
        raise HTTPException(status_code=409, detail="This person is already a member or has a pending invitation")
    raw_token = secrets.token_urlsafe(32)
    invitation = OrganizationMember(organization_id=membership.organization_id, invited_email=email, role=body.role, status="invited", invitation_token_hash=hashlib.sha256(raw_token.encode()).hexdigest(), invitation_expires_at=datetime.now(timezone.utc) + timedelta(days=7))
    db.add(invitation)
    db.add(AuditLog(user_id=user.id, action="workspace.member_invited", resource_type="organization_member", resource_id=str(invitation.id), ip_address=request.client.host if request.client else None, details={"email": email, "role": body.role}))
    await db.commit()
    return {"id": str(invitation.id), "email": email, "role": body.role, "status": "invited", "message": "Invitation created"}


@router.get("/audit-log")
async def audit_log(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    membership = await current_membership(user, db)
    require_admin(membership)
    rows = (await db.execute(select(AuditLog, User).outerjoin(User, User.id == AuditLog.user_id).order_by(AuditLog.created_at.desc()).limit(250))).all()
    return [{"id": str(entry.id), "action": entry.action, "actor": account.email if account else "System", "resource_type": entry.resource_type, "resource_id": entry.resource_id, "ip_address": entry.ip_address, "created_at": entry.created_at.isoformat()} for entry, account in rows]

