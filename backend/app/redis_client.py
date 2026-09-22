import redis.asyncio as aioredis
from app.config import settings

_redis_client: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            max_connections=50,
        )
    return _redis_client


async def close_redis():
    global _redis_client
    if _redis_client:
        await _redis_client.aclose()
        _redis_client = None


async def publish_metric(channel: str, message: str):
    """Publish metric update to Redis pub/sub channel."""
    client = await get_redis()
    await client.publish(channel, message)


async def cache_set(key: str, value: str, ttl: int = 30):
    client = await get_redis()
    await client.setex(key, ttl, value)


async def cache_get(key: str) -> str | None:
    client = await get_redis()
    return await client.get(key)
