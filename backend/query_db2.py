import asyncio
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.metric import ServerMetric
from app.models.server import Server
import datetime

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(ServerMetric).limit(1))
        row = res.scalars().first()
        if row:
            print('CPU:', row.cpu_percent)
            print('RAM:', row.ram_used, row.ram_total)
            print('Load:', row.load_1, row.load_5, row.load_15)
            print('Net:', row.net_rx_rate, row.net_tx_rate)

asyncio.run(main())
