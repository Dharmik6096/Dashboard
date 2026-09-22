"""
Agent Client — communicates with the Go monitoring agent running on each server.
All requests are GET-only. No control commands.
"""
import httpx
import json
from typing import Any
from tenacity import retry, stop_after_attempt, wait_fixed
import structlog

log = structlog.get_logger()

AGENT_TIMEOUT = 10.0  # seconds


class AgentClient:
    def __init__(self, base_url: str, token: str, server_name: str = ""):
        self.base_url = base_url.rstrip("/")
        self.headers = {"Authorization": f"Bearer {token}"}
        self.server_name = server_name

    async def _get(self, path: str) -> dict[str, Any] | None:
        try:
            async with httpx.AsyncClient(timeout=AGENT_TIMEOUT) as client:
                resp = await client.get(
                    f"{self.base_url}{path}",
                    headers=self.headers,
                )
                resp.raise_for_status()
                return resp.json()
        except httpx.ConnectError:
            log.warning("agent_unreachable", server=self.server_name, path=path)
            return None
        except httpx.TimeoutException:
            log.warning("agent_timeout", server=self.server_name, path=path)
            return None
        except Exception as e:
            log.error("agent_error", server=self.server_name, path=path, error=str(e))
            return None

    async def health(self) -> bool:
        result = await self._get("/health")
        return result is not None

    async def snapshot(self) -> dict[str, Any] | None:
        """Full snapshot — all metrics in one call."""
        return await self._get("/snapshot")

    async def host_metrics(self) -> dict[str, Any] | None:
        return await self._get("/metrics/host")

    async def disk_metrics(self) -> dict[str, Any] | None:
        return await self._get("/metrics/disk")

    async def network_metrics(self) -> dict[str, Any] | None:
        return await self._get("/metrics/network")

    async def processes(self) -> dict[str, Any] | None:
        return await self._get("/metrics/processes")

    async def containers(self) -> dict[str, Any] | None:
        return await self._get("/docker/containers")

    async def container_stats(self) -> dict[str, Any] | None:
        return await self._get("/docker/stats")

    async def container_inspect(self, container_id: str) -> dict[str, Any] | None:
        return await self._get(f"/docker/{container_id}/inspect")

    async def container_top(self, container_id: str) -> dict[str, Any] | None:
        return await self._get(f"/docker/{container_id}/top")

    async def container_logs(self, container_id: str, tail: int = 100, since: str = "") -> dict[str, Any] | None:
        path = f"/docker/{container_id}/logs?tail={tail}"
        if since:
            path += f"&since={since}"
        return await self._get(path)

    async def nginx_status(self) -> dict[str, Any] | None:
        return await self._get("/nginx/status")

    async def listening_ports(self) -> dict[str, Any] | None:
        return await self._get("/ports/listening")

    async def cron_jobs(self) -> dict[str, Any] | None:
        return await self._get("/cron/jobs")

    async def service_status(self, name: str) -> dict[str, Any] | None:
        return await self._get(f"/services/{name}/status")
