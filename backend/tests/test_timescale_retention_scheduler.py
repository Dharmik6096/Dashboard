from app.tasks import scheduler as scheduler_module


def test_scheduler_does_not_duplicate_timescale_retention(monkeypatch):
    scheduled_job_ids: list[str] = []

    def capture_job(*args, **kwargs):
        scheduled_job_ids.append(kwargs["id"])

    monkeypatch.setattr(scheduler_module.scheduler, "add_job", capture_job)
    monkeypatch.setattr(scheduler_module.scheduler, "start", lambda: None)

    scheduler_module.start_scheduler()

    assert scheduled_job_ids == ["ingest_all", "alert_eval", "stale_check"]
    assert "cleanup" not in scheduled_job_ids
    assert not hasattr(scheduler_module, "_cleanup_old_metrics")
