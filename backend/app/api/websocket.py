"""
WebSocket endpoint — subscribes to Redis pub/sub channels and pushes live metrics to browsers.
"""
import asyncio
import json
from fastapi import WebSocket, WebSocketDisconnect
import redis.asyncio as aioredis
import structlog

from app.config import settings
from app.core.security import decode_token

log = structlog.get_logger()


class ConnectionManager:
    def __init__(self):
        # ws_id → set of channel subscriptions
        self._connections: dict[str, WebSocket] = {}
        self._subscriptions: dict[str, set[str]] = {}

    async def connect(self, ws_id: str, ws: WebSocket):
        await ws.accept()
        self._connections[ws_id] = ws
        self._subscriptions[ws_id] = {"servers", "alerts"}
        log.info("ws_connected", ws_id=ws_id)

    def disconnect(self, ws_id: str):
        self._connections.pop(ws_id, None)
        self._subscriptions.pop(ws_id, None)
        log.info("ws_disconnected", ws_id=ws_id)

    def subscribe(self, ws_id: str, channels: list[str]):
        if ws_id in self._subscriptions:
            self._subscriptions[ws_id].update(channels)

    async def send(self, ws_id: str, message: str):
        ws = self._connections.get(ws_id)
        if ws:
            try:
                await ws.send_text(message)
            except Exception:
                self.disconnect(ws_id)

    def get_channels(self, ws_id: str) -> set[str]:
        return self._subscriptions.get(ws_id, set())


manager = ConnectionManager()


async def websocket_endpoint(websocket: WebSocket, token: str = ""):
    """
    WS /ws?token=<jwt>
    Client sends: {"type": "subscribe", "channels": ["server:uuid", "container:uuid"]}
    Server sends: metric/alert payloads
    """
    # Authenticate
    try:
        payload = decode_token(token)
        ws_id = payload["sub"]
    except Exception:
        await websocket.close(code=4001)
        return

    await manager.connect(ws_id, websocket)

    # Subscribe to Redis and forward messages
    redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    pubsub = redis_client.pubsub()
    await pubsub.subscribe("servers", "alerts")

    async def _redis_listener():
        async for message in pubsub.listen():
            if message["type"] == "message":
                channel = message["channel"]
                data = message["data"]
                # Check if this client is subscribed to this channel
                if channel in manager.get_channels(ws_id):
                    await manager.send(ws_id, data)

    listener_task = asyncio.create_task(_redis_listener())

    try:
        while True:
            msg = await websocket.receive_text()
            try:
                cmd = json.loads(msg)
                if cmd.get("type") == "subscribe":
                    channels = cmd.get("channels", [])
                    manager.subscribe(ws_id, channels)
                    # Subscribe to new Redis channels
                    for ch in channels:
                        await pubsub.subscribe(ch)
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        pass
    finally:
        listener_task.cancel()
        await pubsub.unsubscribe()
        await redis_client.aclose()
        manager.disconnect(ws_id)
