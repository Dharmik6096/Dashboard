import uuid
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel

from app.database import get_db
from app.models.dashboard import Dashboard
from app.core.security import get_current_user

router = APIRouter(tags=["dashboards"])

class DashboardCreate(BaseModel):
    name: str
    description: Optional[str] = None
    is_default: bool = False
    is_favorite: bool = False
    layout: List[Dict[str, Any]] = []
    widgets: List[Dict[str, Any]] = []

class DashboardUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_default: Optional[bool] = None
    is_favorite: Optional[bool] = None
    layout: Optional[List[Dict[str, Any]]] = None
    widgets: Optional[List[Dict[str, Any]]] = None
    version: int

@router.get("/dashboards", response_model=List[Dict[str, Any]])
async def list_dashboards(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    query = select(Dashboard).where(Dashboard.owner_id == uuid.UUID(current_user["sub"])).order_by(desc(Dashboard.updated_at))
    result = await db.execute(query)
    dashboards = result.scalars().all()
    return [
        {
            "id": str(d.id),
            "name": d.name,
            "description": d.description,
            "is_default": d.is_default,
            "is_favorite": d.is_favorite,
            "owner_id": str(d.owner_id),
            "version": d.version,
            "created_at": d.created_at,
            "updated_at": d.updated_at,
            # we omit layout and widgets here for lighter payload
        }
        for d in dashboards
    ]

@router.post("/dashboards", response_model=Dict[str, Any])
async def create_dashboard(
    data: DashboardCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    if data.is_default:
        await db.execute(
            __import__("sqlalchemy").update(Dashboard)
            .where(Dashboard.owner_id == uuid.UUID(current_user["sub"]))
            .values(is_default=False)
        )
    
    new_dash = Dashboard(
        name=data.name,
        description=data.description,
        is_default=data.is_default,
        is_favorite=data.is_favorite,
        layout=data.layout,
        widgets=data.widgets,
        owner_id=uuid.UUID(current_user["sub"])
    )
    db.add(new_dash)
    await db.commit()
    await db.refresh(new_dash)
    return {
        "id": str(new_dash.id),
        "name": new_dash.name,
        "description": new_dash.description,
        "is_default": new_dash.is_default,
        "is_favorite": new_dash.is_favorite,
        "layout": new_dash.layout,
        "widgets": new_dash.widgets,
        "version": new_dash.version
    }

@router.get("/dashboards/{dashboard_id}", response_model=Dict[str, Any])
async def get_dashboard(
    dashboard_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    query = select(Dashboard).where(Dashboard.id == dashboard_id, Dashboard.owner_id == uuid.UUID(current_user["sub"]))
    result = await db.execute(query)
    dash = result.scalar_one_or_none()
    if not dash:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    return {
        "id": str(dash.id),
        "name": dash.name,
        "description": dash.description,
        "is_default": dash.is_default,
        "is_favorite": dash.is_favorite,
        "layout": dash.layout,
        "widgets": dash.widgets,
        "version": dash.version,
        "created_at": dash.created_at,
        "updated_at": dash.updated_at
    }

@router.put("/dashboards/{dashboard_id}", response_model=Dict[str, Any])
async def update_dashboard(
    dashboard_id: uuid.UUID,
    data: DashboardUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    query = select(Dashboard).where(Dashboard.id == dashboard_id, Dashboard.owner_id == uuid.UUID(current_user["sub"]))
    result = await db.execute(query)
    dash = result.scalar_one_or_none()
    if not dash:
        raise HTTPException(status_code=404, detail="Dashboard not found")
        
    if dash.version != data.version:
        raise HTTPException(status_code=409, detail="Dashboard was modified by another request. Please refresh.")
        
    if data.is_default is True and not dash.is_default:
        await db.execute(
            __import__("sqlalchemy").update(Dashboard)
            .where(Dashboard.owner_id == uuid.UUID(current_user["sub"]))
            .where(Dashboard.id != dash.id)
            .values(is_default=False)
        )
        
    if data.name is not None: dash.name = data.name
    if data.description is not None: dash.description = data.description
    if data.is_default is not None: dash.is_default = data.is_default
    if data.is_favorite is not None: dash.is_favorite = data.is_favorite
    if data.layout is not None: dash.layout = data.layout
    if data.widgets is not None: dash.widgets = data.widgets
    
    dash.version += 1
    await db.commit()
    await db.refresh(dash)
    
    return {
        "id": str(dash.id),
        "name": dash.name,
        "description": dash.description,
        "is_default": dash.is_default,
        "is_favorite": dash.is_favorite,
        "layout": dash.layout,
        "widgets": dash.widgets,
        "version": dash.version,
        "updated_at": dash.updated_at
    }

@router.delete("/dashboards/{dashboard_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dashboard(
    dashboard_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    query = select(Dashboard).where(Dashboard.id == dashboard_id, Dashboard.owner_id == uuid.UUID(current_user["sub"]))
    result = await db.execute(query)
    dash = result.scalar_one_or_none()
    if not dash:
        raise HTTPException(status_code=404, detail="Dashboard not found")
        
    await db.delete(dash)
    await db.commit()
    return None
