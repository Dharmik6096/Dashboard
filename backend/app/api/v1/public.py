from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rate_limit import limiter
from app.database import get_db
from app.models.platform import ContactRequest

router = APIRouter(prefix="/public", tags=["public"])


class ContactRequestBody(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=5, max_length=255)
    company: str = Field(min_length=1, max_length=180)
    topic: str = Field(min_length=2, max_length=40)
    message: str = Field(min_length=10, max_length=5000)


@router.post("/contact", status_code=201)
@limiter.limit("5/hour")
async def create_contact_request(request: Request, body: ContactRequestBody, db: AsyncSession = Depends(get_db)):
    lead = ContactRequest(first_name=body.first_name.strip(), last_name=body.last_name.strip(), email=body.email.strip().lower(), company=body.company.strip(), topic=body.topic, message=body.message.strip(), metadata_json={"ip": request.client.host if request.client else None, "user_agent": request.headers.get("user-agent", "")[:500]})
    db.add(lead)
    await db.commit()
    return {"id": str(lead.id), "message": "Request received"}

