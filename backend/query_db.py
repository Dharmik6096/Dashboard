import asyncio
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.metric import ServerMetric
from app.models.server import Server
import datetime

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Server.name, Server.id))
        servers = dict(res.all())
        print('Servers:', servers)
        for name, sid in servers.items():
            res = await db.execute(select(ServerMetric).where(ServerMetric.server_id == sid))
            rows = res.scalars().all()
            print(f'{name} metric rows total: {len(rows)}')
            now = datetime.datetime.now(datetime.timezone.utc)
            r5m = len([r for r in rows if r.time > now - datetime.timedelta(minutes=5)])
            r15m = len([r for r in rows if r.time > now - datetime.timedelta(minutes=15)])
            r1h = len([r for r in rows if r.time > now - datetime.timedelta(hours=1)])
            print(f'{name} in last 5m: {r5m}, 15m: {r15m}, 1h: {r1h}')

asyncio.run(main())
