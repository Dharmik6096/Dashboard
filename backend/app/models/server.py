import uuid
from datetime import datetime
from typing import List
from sqlalchemy import String, Integer, BigInteger, Boolean, DateTime, Text, func, ARRAY
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Server(Base):
    __tablename__ = "servers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    environment: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # production, qa, uat, dev, db, proxy
    hostname: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ip_address: Mapped[str] = mapped_column(String(45), nullable=False)
    ssh_port: Mapped[int] = mapped_column(Integer, default=22)
    ssh_username: Mapped[str | None] = mapped_column(String(100), nullable=True)
    auth_type: Mapped[str | None] = mapped_column(String(20), nullable=True)  # key, password
    tags: Mapped[List[str] | None] = mapped_column(ARRAY(String), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    agent_url: Mapped[str | None] = mapped_column(String(255), nullable=True)  # http://ip:9100
    agent_token_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    monitoring_mode: Mapped[str] = mapped_column(String(20), default="auto")  # agent, ssh, auto
    ssh_host_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Status cached from last agent poll
    status: Mapped[str] = mapped_column(String(20), default="unknown", index=True)  # online, offline, warning, critical
    docker_status: Mapped[str] = mapped_column(String(50), default="UNKNOWN")  # AVAILABLE, NOT INSTALLED, PERMISSION DENIED, UNAVAILABLE, UNKNOWN
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True) # Deprecated
    last_check_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_success_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    monitoring_source: Mapped[str | None] = mapped_column(String(20), nullable=True) # agent, ssh
    # Cached live metrics (updated by ingester)
    last_cpu_percent: Mapped[float | None] = mapped_column(nullable=True)
    last_ram_percent: Mapped[float | None] = mapped_column(nullable=True)
    last_disk_percent: Mapped[float | None] = mapped_column(nullable=True)
    last_load_1: Mapped[float | None] = mapped_column(nullable=True)
    last_uptime_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    os: Mapped[str | None] = mapped_column(String(100), nullable=True)
    architecture: Mapped[str | None] = mapped_column(String(50), nullable=True)
    cpu_cores: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ram_total: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
