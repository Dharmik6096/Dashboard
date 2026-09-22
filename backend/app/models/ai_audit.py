from sqlalchemy import Column, String, Text, DateTime, JSON, ForeignKey, Boolean
from sqlalchemy.sql import func
from app.database import Base

class AIConversation(Base):
    __tablename__ = "ai_conversations"

    id = Column(String(50), primary_key=True, index=True)
    user_id = Column(String(50), index=True, nullable=True)
    environment_id = Column(String(50), index=True, nullable=True)
    server_id = Column(String(50), index=True, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class AIAuditLog(Base):
    __tablename__ = "ai_audit_logs"

    id = Column(String(50), primary_key=True, index=True)
    conversation_id = Column(String(50), ForeignKey("ai_conversations.id", ondelete="CASCADE"), index=True)
    question = Column(Text, nullable=False)
    tools_called = Column(JSON, nullable=True)
    is_success = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
