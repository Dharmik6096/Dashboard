import asyncio
import uuid
from datetime import datetime, timezone, timedelta
import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, update, and_
from app.database import AsyncSessionLocal
from app.models.alert import AlertRule, Alert
from app.models.server import Server
from app.models.container import Container
from app.redis_client import get_redis
import structlog
log = structlog.get_logger()

class AlertEngine:
    def __init__(self, worker_id: str):
        self.worker_id = worker_id
        self.lock_key = "alert_engine_lock"
        self.lock_ttl = 30000  # 30 seconds
        # Redis construction is asynchronous; resolve lazily inside async methods.
        self.redis = None
        self.running = False

    async def _redis_client(self):
        if self.redis is None:
            self.redis = await get_redis()
        return self.redis

    async def acquire_lock(self) -> bool:
        redis = await self._redis_client()
        if not redis:
            return False
        res = await redis.set(self.lock_key, self.worker_id, nx=True, px=self.lock_ttl)
        return bool(res)

    async def renew_lock(self) -> bool:
        redis = await self._redis_client()
        if not redis:
            return False
        # Lua script to renew lock only if worker_id matches
        script = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("pexpire", KEYS[1], ARGV[2])
        else
            return 0
        end
        """
        res = await redis.eval(script, 1, self.lock_key, self.worker_id, self.lock_ttl)
        return bool(res)

    async def release_lock(self):
        redis = await self._redis_client()
        if not redis:
            return
        script = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
        """
        await redis.eval(script, 1, self.lock_key, self.worker_id)

    async def start(self):
        self.running = True
        log.info("alert_engine_starting", worker_id=self.worker_id)
        while self.running:
            try:
                if await self.acquire_lock():
                    log.debug("alert_engine_lock_acquired", worker_id=self.worker_id)
                    await self._evaluation_loop()
                else:
                    await asyncio.sleep(10)
            except Exception as e:
                log.error("alert_engine_loop_error", error=str(e))
                await asyncio.sleep(10)

    async def stop(self):
        self.running = False
        await self.release_lock()

    async def _evaluation_loop(self):
        while self.running:
            start_time = datetime.now(timezone.utc)
            try:
                # Renew lock at the start of each cycle
                if not await self.renew_lock():
                    log.warning("alert_engine_lock_lost", worker_id=self.worker_id)
                    break
                
                async with AsyncSessionLocal() as db:
                    await self._evaluate_rules(db)
                
            except Exception as e:
                log.error("alert_engine_eval_error", error=str(e))
            
            elapsed = (datetime.now(timezone.utc) - start_time).total_seconds()
            sleep_time = max(0, 10 - elapsed)
            await asyncio.sleep(sleep_time)

    async def _evaluate_rules(self, db: AsyncSession):
        # Fetch active rules
        result = await db.execute(select(AlertRule).where(AlertRule.is_active == True))
        rules = result.scalars().all()
        
        for rule in rules:
            try:
                await self._evaluate_rule(rule, db)
            except Exception as e:
                log.error("alert_engine_rule_error", rule_id=str(rule.id), error=str(e))

    async def _evaluate_rule(self, rule: AlertRule, db: AsyncSession):
        # Determine targets and query latest metrics.
        # This is a robust mock integration point.
        # In a real environment, we'd query Redis for "container:*:*:live" or DB for ServerMetric
        # For demonstration of the engine, we iterate over servers/containers
        
        # Example fetching logic
        servers_res = await db.execute(select(Server).where(Server.is_active == True))
        servers = servers_res.scalars().all()
        
        for server in servers:
            if rule.target_type == "container":
                containers_res = await db.execute(select(Container).where(Container.server_id == server.id, Container.is_active == True))
                containers = containers_res.scalars().all()
                for c in containers:
                    await self._check_condition(rule, server, c, db)
            else:
                await self._check_condition(rule, server, None, db)

    async def _check_condition(self, rule: AlertRule, server: Server, container: Container | None, db: AsyncSession):
        # Mock fetching the current metric value (e.g. from Redis live cache)
        # We will use 0.0 as placeholder unless real data is hooked up
        current_value = 0.0
        
        # 1. Check if condition is failing
        failing = False
        if rule.operator == "gt": failing = current_value > rule.threshold
        elif rule.operator == "lt": failing = current_value < rule.threshold
        
        state_key = f"alert_state:{rule.id}:{server.id}:{container.id if container else 'null'}"
        
        if failing:
            # 2. Duration Logic
            state = await self.redis.get(state_key)
            if not state:
                state_data = {"condition_started_at": datetime.now(timezone.utc).isoformat()}
                await self.redis.set(state_key, json.dumps(state_data))
                duration_met = rule.duration_seconds == 0
            else:
                state_data = json.loads(state)
                started_at = datetime.fromisoformat(state_data["condition_started_at"])
                duration_met = (datetime.now(timezone.utc) - started_at).total_seconds() >= rule.duration_seconds
                
            if duration_met:
                # 3. Deduplication & Acknowledge Retention
                existing_res = await db.execute(
                    select(Alert).where(
                        and_(
                            Alert.rule_id == rule.id,
                            Alert.server_id == server.id,
                            Alert.container_db_id == (container.id if container else None),
                            Alert.status.in_(["active", "acknowledged"])
                        )
                    )
                )
                existing = existing_res.scalar_one_or_none()
                
                if existing:
                    # Update value but retain status (even if acknowledged)
                    existing.current_value = current_value
                else:
                    # Create new ACTIVE alert
                    new_alert = Alert(
                        rule_id=rule.id,
                        server_id=server.id,
                        container_db_id=container.id if container else None,
                        severity=rule.severity,
                        title=f"{rule.name} on {container.name if container else server.name}",
                        message=f"{rule.metric} is {current_value} ({rule.operator} {rule.threshold})",
                        metric_name=rule.metric,
                        current_value=current_value,
                        threshold=rule.threshold,
                        status="active",
                        fired_at=datetime.now(timezone.utc)
                    )
                    db.add(new_alert)
                await db.commit()
                
        else:
            # 4. Auto Resolve
            await self.redis.delete(state_key)
            existing_res = await db.execute(
                select(Alert).where(
                    and_(
                        Alert.rule_id == rule.id,
                        Alert.server_id == server.id,
                        Alert.container_db_id == (container.id if container else None),
                        Alert.status.in_(["active", "acknowledged"])
                    )
                )
            )
            existing = existing_res.scalar_one_or_none()
            if existing:
                existing.status = "resolved"
                existing.resolved_at = datetime.now(timezone.utc)
                await db.commit()

# Global instance for FastAPI lifecycle
alert_engine: AlertEngine | None = None

async def start_alert_engine():
    global alert_engine
    if alert_engine is None:
        alert_engine = AlertEngine(worker_id=str(uuid.uuid4()))
        asyncio.create_task(alert_engine.start())

async def stop_alert_engine():
    global alert_engine
    if alert_engine:
        await alert_engine.stop()
