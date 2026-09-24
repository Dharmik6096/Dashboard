from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

from app.api.v1.alerts import _cpu_alert_to_spike
from app.api.v1.events import _container_event_dict, _infrastructure_event_dict


def test_container_event_contract_uses_real_model_fields():
    occurred_at = datetime(2026, 9, 23, 8, 30, tzinfo=timezone.utc)
    event = SimpleNamespace(
        id=uuid4(),
        server_id=uuid4(),
        container_name="checkout-api",
        event_type="oom_killed",
        oom_killed=True,
        reason="Memory limit exceeded",
        occurred_at=occurred_at,
    )

    result = _container_event_dict(event, "prod-node-01")

    assert result["timestamp"] == occurred_at.isoformat()
    assert result["server_name"] == "prod-node-01"
    assert result["source"] == "checkout-api"
    assert result["severity"] == "critical"
    assert result["details"] == "Memory limit exceeded"


def test_infrastructure_event_contract_includes_server_name():
    detected_at = datetime(2026, 9, 23, 9, 0, tzinfo=timezone.utc)
    event = SimpleNamespace(
        id=uuid4(),
        server_id=uuid4(),
        source="nginx",
        event_type="config_changed",
        severity="info",
        title="Nginx configuration changed",
        details={"path": "/etc/nginx/nginx.conf"},
        detected_at=detected_at,
    )

    result = _infrastructure_event_dict(event, "edge-node-01")

    assert result["server_name"] == "edge-node-01"
    assert result["timestamp"] == detected_at.isoformat()
    assert result["details"] == {"path": "/etc/nginx/nginx.conf"}


def test_cpu_alert_contract_uses_recorded_alert_values_and_duration():
    fired_at = datetime(2026, 9, 23, 9, 0, tzinfo=timezone.utc)
    resolved_at = fired_at + timedelta(seconds=75)
    alert = SimpleNamespace(
        id=uuid4(),
        fired_at=fired_at,
        resolved_at=resolved_at,
        current_value=94.5,
        severity="critical",
        status="resolved",
    )

    result = _cpu_alert_to_spike(alert, "prod-node-01", "checkout-api", resolved_at)

    assert result["server_name"] == "prod-node-01"
    assert result["process_name"] == "checkout-api"
    assert result["peak_usage"] == 94.5
    assert result["duration_seconds"] == 75
    assert result["severity"] == "Critical"
