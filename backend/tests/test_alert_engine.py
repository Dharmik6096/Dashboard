import json
import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.alert import Alert
from app.tasks.alert_engine import AlertEngine


def query_result(*, one=None, many=None):
    return SimpleNamespace(
        scalar_one_or_none=lambda: one,
        scalars=lambda: SimpleNamespace(all=lambda: list(many or [])),
    )


def make_rule(**overrides):
    values = {
        "id": uuid.uuid4(), "name": "CPU high", "target_type": "container",
        "metric": "cpu_percent", "operator": "lt", "threshold": 1.0,
        "duration_seconds": 0, "severity": "warning",
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def make_server(name="server-1"):
    return SimpleNamespace(id=uuid.uuid4(), name=name)


def make_container(server, name="api", **overrides):
    values = {
        "id": uuid.uuid4(), "server_id": server.id, "name": name,
        "is_active": True, "oom_killed": False,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def make_alert(status="active"):
    return SimpleNamespace(status=status, current_value=99.0, resolved_at=None)


def make_db(*results):
    return SimpleNamespace(
        execute=AsyncMock(side_effect=list(results)),
        add=MagicMock(),
        commit=AsyncMock(),
    )


class FakeRedis:
    """Minimal in-memory Redis behavior needed by AlertEngine tests."""

    def __init__(self):
        self.values = {}

    async def get(self, key):
        return self.values.get(key)

    async def set(self, key, value, nx=False, px=None):
        if nx and key in self.values:
            return False
        self.values[key] = value
        return True

    async def delete(self, key):
        return int(self.values.pop(key, None) is not None)

    async def eval(self, script, _keys, key, worker_id, *args):
        if self.values.get(key) != worker_id:
            return 0
        if "pexpire" in script:
            return 1
        return await self.delete(key)


@pytest.fixture
def engine():
    eng = AlertEngine(worker_id="test_worker_1")
    eng.redis = AsyncMock()
    eng.redis.get.return_value = None
    return eng


@pytest.mark.asyncio
async def test_redis_lock_single_evaluator(engine):
    engine.redis.set.return_value = True
    assert await engine.acquire_lock() is True
    engine.redis.set.assert_called_with("alert_engine_lock", "test_worker_1", nx=True, px=30000)


@pytest.mark.asyncio
async def test_expired_lock_takeover(engine):
    engine.redis.set.return_value = True
    assert await engine.acquire_lock() is True


@pytest.mark.asyncio
async def test_lock_deletion_safety(engine):
    engine.redis.eval.return_value = 1
    await engine.release_lock()
    engine.redis.eval.assert_called_once()


@pytest.mark.asyncio
async def test_duration_logic(engine):
    rule = make_rule(duration_seconds=60)
    server = make_server()
    container = make_container(server)
    state_key = f"alert_state:{rule.id}:{server.id}:{container.id}"
    started = datetime.now(timezone.utc) - timedelta(seconds=61)
    db = make_db(query_result(one=None))

    await engine._check_condition(rule, server, container, db)

    engine.redis.set.assert_awaited_once()
    db.add.assert_not_called()
    db.commit.assert_not_awaited()

    engine.redis.get.return_value = json.dumps({"condition_started_at": started.isoformat()})
    await engine._check_condition(rule, server, container, db)

    db.add.assert_called_once()
    assert isinstance(db.add.call_args.args[0], Alert)
    db.commit.assert_awaited_once()
    assert engine.redis.get.await_args_list[-1].args == (state_key,)


@pytest.mark.asyncio
async def test_condition_break(engine):
    rule = make_rule(operator="gt", threshold=1.0)
    server = make_server()
    container = make_container(server)
    state_key = f"alert_state:{rule.id}:{server.id}:{container.id}"
    db = make_db(query_result(one=None))

    await engine._check_condition(rule, server, container, db)

    engine.redis.delete.assert_awaited_once_with(state_key)
    engine.redis.set.assert_not_awaited()
    db.add.assert_not_called()
    db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_deduplication(engine):
    existing = make_alert("active")
    db = make_db(query_result(one=existing))
    server = make_server()

    await engine._check_condition(make_rule(), server, make_container(server), db)

    db.add.assert_not_called()
    assert existing.current_value == 0.0
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_auto_resolve(engine):
    existing = make_alert("active")
    db = make_db(query_result(one=existing))

    await engine._check_condition(
        make_rule(operator="gt", threshold=1.0), make_server(), None, db
    )

    assert existing.status == "resolved"
    assert existing.resolved_at is not None
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_acknowledge_retention(engine):
    acknowledged = make_alert("acknowledged")
    db = make_db(query_result(one=acknowledged))
    server = make_server()

    await engine._check_condition(make_rule(), server, make_container(server), db)

    assert acknowledged.status == "acknowledged"
    assert acknowledged.current_value == 0.0
    db.add.assert_not_called()


@pytest.mark.asyncio
async def test_worker_isolation():
    redis = FakeRedis()
    owner = AlertEngine("worker-a")
    contender = AlertEngine("worker-b")
    owner.redis = contender.redis = redis

    assert await owner.acquire_lock() is True
    assert await contender.acquire_lock() is False
    assert await contender.renew_lock() is False
    await contender.release_lock()
    assert redis.values[owner.lock_key] == "worker-a"
    assert await owner.renew_lock() is True


@pytest.mark.asyncio
async def test_acknowledged_to_resolved(engine):
    acknowledged = make_alert("acknowledged")
    db = make_db(query_result(one=acknowledged))

    await engine._check_condition(
        make_rule(operator="gt", threshold=1.0), make_server(), None, db
    )

    assert acknowledged.status == "resolved"
    assert acknowledged.resolved_at is not None
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_multi_container_isolation():
    redis = FakeRedis()
    engine = AlertEngine("worker-a")
    engine.redis = redis
    rule = make_rule()
    server = make_server()
    first = make_container(server, "api")
    second = make_container(server, "worker")
    db = make_db(query_result(one=None), query_result(one=None))

    await engine._check_condition(rule, server, first, db)
    await engine._check_condition(rule, server, second, db)

    assert f"alert_state:{rule.id}:{server.id}:{first.id}" in redis.values
    assert f"alert_state:{rule.id}:{server.id}:{second.id}" in redis.values
    assert db.add.call_count == 2
    assert {call.args[0].container_db_id for call in db.add.call_args_list} == {first.id, second.id}


@pytest.mark.xfail(
    strict=True,
    reason="Known product bug: one server exception aborts the remaining servers for that rule",
)
@pytest.mark.asyncio
async def test_server_failure_isolation(engine):
    rule = make_rule(target_type="server")
    first, second = make_server("broken"), make_server("healthy")
    db = make_db(query_result(many=[first, second]))
    checked = []

    async def check(_rule, server, _container, _db):
        checked.append(server.id)
        if server.id == first.id:
            raise RuntimeError("simulated server failure")

    engine._check_condition = AsyncMock(side_effect=check)
    await engine._evaluate_rule(rule, db)

    assert checked == [first.id, second.id]


@pytest.mark.xfail(
    strict=True,
    reason="Known product gap: AlertEngine never reads Container.oom_killed or container events",
)
@pytest.mark.asyncio
async def test_oom_killed_alert(engine):
    rule = make_rule(metric="oom_killed", operator="gt", threshold=0.0)
    server = make_server()
    container = make_container(server, oom_killed=True)
    db = make_db(query_result(one=None))

    await engine._check_condition(rule, server, container, db)

    db.add.assert_called_once()
    assert db.add.call_args.args[0].metric_name == "oom_killed"


@pytest.mark.asyncio
async def test_server_alert_deduplication(engine):
    existing = make_alert("active")
    db = make_db(query_result(one=existing))

    await engine._check_condition(make_rule(target_type="server"), make_server(), None, db)

    db.add.assert_not_called()
    assert existing.status == "active"
    assert existing.current_value == 0.0
    db.commit.assert_awaited_once()
