import uuid
from datetime import datetime
from sqlalchemy import String, Integer, BigInteger, Float, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from app.database import Base


class ServerMetric(Base):
    """Time-series server metrics — one row per sample."""
    __tablename__ = "server_metrics"

    # TimescaleDB requires every unique constraint to include the time
    # partitioning column. The composite key keeps UUID identifiers while
    # making this table valid as a hypertable.
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    time: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True, nullable=False, index=True, server_default=func.now())
    server_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("servers.id", ondelete="CASCADE"), nullable=False, index=True)
    cpu_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    load_1: Mapped[float | None] = mapped_column(Float, nullable=True)
    load_5: Mapped[float | None] = mapped_column(Float, nullable=True)
    load_15: Mapped[float | None] = mapped_column(Float, nullable=True)
    cpu_cores: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ram_total: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    ram_used: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    ram_cached: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    ram_available: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    swap_total: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    swap_used: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    net_rx_rate: Mapped[float | None] = mapped_column(Float, nullable=True)   # bytes/sec
    net_tx_rate: Mapped[float | None] = mapped_column(Float, nullable=True)


class ContainerMetric(Base):
    """Time-series container metrics — one row per sample."""
    __tablename__ = "container_metrics"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True, server_default=func.now())
    server_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("servers.id", ondelete="CASCADE"), nullable=False)
    container_db_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("containers.id", ondelete="CASCADE"), nullable=False, index=True)
    cpu_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    cpu_normalized: Mapped[float | None] = mapped_column(Float, nullable=True)  # cpu_percent / cores
    mem_usage: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    mem_limit: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    mem_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    net_rx_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    net_tx_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    block_read_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    block_write_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    pids: Mapped[int | None] = mapped_column(Integer, nullable=True)


class DiskMetric(Base):
    __tablename__ = "disk_metrics"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True, server_default=func.now())
    server_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("servers.id", ondelete="CASCADE"), nullable=False, index=True)
    mount_point: Mapped[str] = mapped_column(String(255))
    filesystem: Mapped[str | None] = mapped_column(String(100), nullable=True)
    total_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    used_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    free_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    use_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    inode_total: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    inode_used: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    inode_percent: Mapped[float | None] = mapped_column(Float, nullable=True)


class CpuSpike(Base):
    __tablename__ = "cpu_spikes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    server_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("servers.id", ondelete="CASCADE"), nullable=False, index=True)
    container_db_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("containers.id", ondelete="SET NULL"), nullable=True)
    container_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    spike_from: Mapped[float | None] = mapped_column(Float, nullable=True)
    spike_to: Mapped[float | None] = mapped_column(Float, nullable=True)
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    top_process_pid: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    top_process_cmd: Mapped[str | None] = mapped_column(Text, nullable=True)
    top_process_cpu: Mapped[float | None] = mapped_column(Float, nullable=True)
    recent_logs: Mapped[str | None] = mapped_column(Text, nullable=True)
    active_crons: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    investigation: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
