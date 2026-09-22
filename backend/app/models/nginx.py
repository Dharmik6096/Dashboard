from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import datetime
from app.database import Base

class NginxConfig(Base):
    __tablename__ = "nginx_configs"
    id = Column(Integer, primary_key=True, index=True)
    server_id = Column(UUID(as_uuid=True), ForeignKey("servers.id", ondelete="CASCADE"))
    enabled_path = Column(String, nullable=True)
    source_path = Column(String, nullable=True)
    config_hash = Column(String, nullable=True)
    collected_at = Column(DateTime, default=datetime.datetime.utcnow)

    server = relationship("Server", backref="nginx_configs")
    server_blocks = relationship("NginxServerBlock", backref="config", cascade="all, delete-orphan")
    upstreams = relationship("NginxUpstream", backref="config", cascade="all, delete-orphan")

class NginxServerBlock(Base):
    __tablename__ = "nginx_server_blocks"
    id = Column(Integer, primary_key=True, index=True)
    config_id = Column(Integer, ForeignKey("nginx_configs.id", ondelete="CASCADE"))
    server_name = Column(String, nullable=True)
    listen = Column(String, nullable=True)
    ssl = Column(Boolean, default=False)
    
    locations = relationship("NginxLocation", backref="server_block", cascade="all, delete-orphan")

class NginxLocation(Base):
    __tablename__ = "nginx_locations"
    id = Column(Integer, primary_key=True, index=True)
    server_block_id = Column(Integer, ForeignKey("nginx_server_blocks.id", ondelete="CASCADE"))
    path = Column(String, nullable=False)
    proxy_pass = Column(String, nullable=True)

class NginxUpstream(Base):
    __tablename__ = "nginx_upstreams"
    id = Column(Integer, primary_key=True, index=True)
    config_id = Column(Integer, ForeignKey("nginx_configs.id", ondelete="CASCADE"))
    name = Column(String, nullable=False)
    
    targets = relationship("NginxUpstreamTarget", backref="upstream", cascade="all, delete-orphan")

class NginxUpstreamTarget(Base):
    __tablename__ = "nginx_upstream_targets"
    id = Column(Integer, primary_key=True, index=True)
    upstream_id = Column(Integer, ForeignKey("nginx_upstreams.id", ondelete="CASCADE"))
    host = Column(String, nullable=False)
    port = Column(Integer, nullable=True)
    weight = Column(Integer, nullable=True)
    backup = Column(Boolean, default=False)
    down = Column(Boolean, default=False)
    max_fails = Column(Integer, nullable=True)
    fail_timeout = Column(String, nullable=True)
