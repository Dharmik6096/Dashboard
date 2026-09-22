import asyncio
from sqlalchemy import select, text
from app.database import AsyncSessionLocal
from app.models.server import Server
import datetime

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Server).where(Server.is_active == True))
        servers = res.scalars().all()
        for s in servers:
            print(f'{s.name}: CPU={s.last_cpu_percent}, RAM={s.last_ram_percent}, Disk={s.last_disk_percent}, status={s.status}')

asyncio.run(main())
