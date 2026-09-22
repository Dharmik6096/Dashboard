import uuid
from datetime import datetime
from sqlalchemy import String, Integer, BigInteger, Boolean, DateTime, Text, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base


class Container(Base):
    __tablename__ = "containers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    server_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("servers.id", ondelete="CASCADE"), nullable=False, index=True)
    container_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)  # Docker short ID
    container_full_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    image: Mapped[str | None] = mapped_column(String(512), nullable=True)
    status: Mapped[str | None] = mapped_column(String(50), nullable=True)  # running, exited, paused
    created_at_docker: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    restart_count: Mapped[int] = mapped_column(Integer, default=0)
    exit_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    oom_killed: Mapped[bool] = mapped_column(Boolean, default=False)
    health_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    network_mode: Mapped[str | None] = mapped_column(String(100), nullable=True)
    ports: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    volumes: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    labels: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    env_vars_masked: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # secrets masked
    # Cached live stats
    last_cpu_percent: Mapped[float | None] = mapped_column(nullable=True)
    last_mem_usage: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    last_mem_limit: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    server: Mapped["Server"] = relationship("Server")


class ContainerEvent(Base):
    __tablename__ = "container_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    server_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("servers.id", ondelete="CASCADE"))
    container_db_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("containers.id", ondelete="SET NULL"), nullable=True)
    container_name: Mapped[str] = mapped_column(String(255))
    event_type: Mapped[str] = mapped_column(String(50))  # started, stopped, restarted, oom_killed, unhealthy
    exit_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    oom_killed: Mapped[bool] = mapped_column(Boolean, default=False)
    restart_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    container: Mapped["Container"] = relationship("Container")
