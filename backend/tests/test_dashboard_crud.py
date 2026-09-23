import uuid
from datetime import datetime, timezone

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import UniqueConstraint
from sqlalchemy.dialects import postgresql

from app.api.v1 import dashboards as dashboard_api
from app.api.v1.auth import get_current_user
from app.database import get_db
from app.models.dashboard import Dashboard, Panel
from app.models.platform import OrganizationMember
from app.models.user import User


class FakeResult:
    def __init__(self, scalar=None, rows=None):
        self.scalar = scalar
        self.rows = rows or []

    def scalar_one_or_none(self):
        return self.scalar

    def all(self):
        return self.rows


class FakeSession:
    def __init__(self, results):
        self.results = list(results)
        self.added = []
        self.deleted = []
        self.commits = 0
        self.statements = []

    async def execute(self, statement):
        self.last_statement = statement
        self.statements.append(statement)
        return self.results.pop(0)

    def add(self, value):
        self.added.append(value)

    async def flush(self):
        for value in self.added:
            if getattr(value, "id", None) is None:
                value.id = uuid.uuid4()

    async def commit(self):
        self.commits += 1

    async def refresh(self, value):
        return None

    async def delete(self, value):
        self.deleted.append(value)


def membership(role="owner"):
    return OrganizationMember(
        id=uuid.uuid4(),
        organization_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        role=role,
        status="active",
    )


def user():
    return User(
        id=uuid.uuid4(),
        username="owner@example.com",
        email="owner@example.com",
        password_hash="unused",
        role="admin",
    )


def test_models_have_organization_and_cascade_contracts():
    assert Dashboard.__table__.c.organization_id.nullable is False
    assert Dashboard.__table__.c.created_by.nullable is True
    assert Panel.__table__.c.dashboard_id.nullable is False
    assert any(
        isinstance(constraint, UniqueConstraint) and constraint.name == "uq_dashboard_org_slug"
        for constraint in Dashboard.__table__.constraints
    )
    assert Panel.__table__.c.query_config.type.__class__.__name__ == "JSONB"


def test_panel_schema_rejects_unknown_metrics_raw_queries_and_invalid_grid():
    with pytest.raises(ValidationError, match="Metric is not available"):
        dashboard_api.PanelCreate(
            title="Unsafe",
            visualization="time_series",
            metric_source="server_metrics",
            metric_name="password_hash",
            grid_position={"x": 0, "y": 0, "width": 12, "height": 6},
        )
    with pytest.raises(ValidationError, match="raw_sql"):
        dashboard_api.PanelCreate(
            title="Unsafe",
            visualization="time_series",
            metric_source="server_metrics",
            metric_name="cpu_percent",
            query_config={"raw_sql": "DROP TABLE servers"},
            grid_position={"x": 0, "y": 0, "width": 12, "height": 6},
        )
    with pytest.raises(ValidationError, match="24-column"):
        dashboard_api.PanelCreate(
            title="Outside grid",
            visualization="stat",
            metric_source="server_metrics",
            metric_name="cpu_percent",
            grid_position={"x": 20, "y": 0, "width": 8, "height": 4},
        )
    with pytest.raises(ValidationError, match="group_by=container"):
        dashboard_api.PanelCreate(
            title="Invalid grouping",
            visualization="time_series",
            metric_source="server_metrics",
            metric_name="cpu_percent",
            query_config={"group_by": "container"},
            grid_position={"x": 0, "y": 0, "width": 12, "height": 6},
        )


def test_viewer_cannot_mutate_dashboards():
    with pytest.raises(HTTPException) as exc:
        dashboard_api.require_editor(membership("viewer"))
    assert exc.value.status_code == 403
    dashboard_api.require_editor(membership("analyst"))


@pytest.mark.asyncio
async def test_dashboard_lookup_is_scoped_to_current_organization():
    member = membership()
    db = FakeSession([FakeResult()])
    with pytest.raises(HTTPException) as exc:
        await dashboard_api._organization_dashboard(uuid.uuid4(), member, db)
    assert exc.value.status_code == 404
    sql = str(db.last_statement.compile(dialect=postgresql.dialect()))
    assert "dashboards.id" in sql
    assert "dashboards.organization_id" in sql


def test_create_dashboard_endpoint_persists_real_entity(monkeypatch):
    current_user = user()
    current_membership = membership("owner")
    current_membership.user_id = current_user.id
    db = FakeSession([FakeResult()])

    async def fake_membership(account, session):
        return current_membership

    app = FastAPI()
    app.include_router(dashboard_api.router)
    app.dependency_overrides[get_current_user] = lambda: current_user
    app.dependency_overrides[get_db] = lambda: db
    monkeypatch.setattr(dashboard_api, "current_membership", fake_membership)

    response = TestClient(app).post(
        "/dashboards",
        json={
            "title": "Production Overview",
            "description": "Live production signals",
            "default_time_range": "6h",
            "refresh_interval_seconds": 30,
        },
    )

    assert response.status_code == 201
    assert response.json()["slug"] == "production-overview"
    assert response.json()["panel_count"] == 0
    assert db.commits == 1
    saved = next(value for value in db.added if isinstance(value, Dashboard))
    assert saved.organization_id == current_membership.organization_id
    assert saved.created_by == current_user.id


def test_router_exposes_complete_dashboard_and_panel_crud():
    all_routes = {(route.path, method) for route in dashboard_api.router.routes for method in route.methods}
    expected = {
        ("/dashboards", "GET"),
        ("/dashboards", "POST"),
        ("/dashboards/{dashboard_id}", "GET"),
        ("/dashboards/{dashboard_id}", "PATCH"),
        ("/dashboards/{dashboard_id}", "DELETE"),
        ("/dashboards/{dashboard_id}/panels", "POST"),
        ("/dashboards/{dashboard_id}/panels/{panel_id}", "PATCH"),
        ("/dashboards/{dashboard_id}/panels/{panel_id}", "DELETE"),
        ("/dashboards/{dashboard_id}/panels/{panel_id}/data", "GET"),
    }
    assert expected <= all_routes


@pytest.mark.asyncio
async def test_panel_data_is_allowlisted_downsampled_and_read_only(monkeypatch):
    current_user = user()
    member = membership("viewer")
    member.user_id = current_user.id
    dashboard = Dashboard(
        id=uuid.uuid4(),
        organization_id=member.organization_id,
        created_by=current_user.id,
        title="Production",
        slug="production",
        default_time_range="1h",
        refresh_interval_seconds=30,
    )
    panel = Panel(
        id=uuid.uuid4(),
        dashboard_id=dashboard.id,
        title="CPU",
        visualization="time_series",
        metric_source="server_metrics",
        metric_name="cpu_percent",
        aggregation="avg",
        query_config={"group_by": "server"},
        grid_position={"x": 0, "y": 0, "width": 12, "height": 6},
        display_options={},
        sort_order=0,
    )
    server_id = uuid.uuid4()
    sampled_at = datetime(2026, 9, 23, 10, 0, tzinfo=timezone.utc)
    db = FakeSession([
        FakeResult(scalar=dashboard),
        FakeResult(scalar=panel),
        FakeResult(rows=[(sampled_at, 42.125, server_id)]),
    ])

    async def fake_membership(account, session):
        return member

    monkeypatch.setattr(dashboard_api, "current_membership", fake_membership)
    response = await dashboard_api.get_panel_data(
        dashboard.id, panel.id, "1h", current_user, db,
    )

    assert response["bucket_seconds"] == 15
    assert response["series"][0]["key"] == str(server_id)
    assert response["series"][0]["points"] == [
        {"time": sampled_at.isoformat(), "value": 42.125},
    ]
    sql = str(db.last_statement.compile(dialect=postgresql.dialect()))
    assert "time_bucket" in sql
    assert "avg(server_metrics.cpu_percent)" in sql
    assert "GROUP BY" in sql
    assert db.commits == 0
