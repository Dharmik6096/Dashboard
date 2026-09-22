import asyncio
from app.redis_client import get_redis, cache_get

async def main():
    r = await get_redis()
    keys = await r.keys('storage:du:*')
    print("KEYS:", keys)
    for k in keys:
        if type(k) == bytes: k = k.decode()
        print("KEY:", k)
        val = await cache_get(k)
        print("VAL:", val[:100] if val else None)

if __name__ == '__main__':
    asyncio.run(main())
