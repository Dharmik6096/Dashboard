import asyncio
from sqlalchemy import select, func
from app.database import AsyncSessionLocal
from app.models.alert import Alert
from app.models.server import Server

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(func.count(Alert.id)).where(Alert.status == 'active'))
        total = res.scalar()
        print(f'Global active alerts after dedup: {total}')
        
        res = await db.execute(select(Server.name, func.count(Alert.id)).join(Alert, Alert.server_id == Server.id).where(Alert.status == 'active').group_by(Server.name))
        rows = res.all()
        for name, count in rows:
            print(f'  {name}: {count} alerts')

asyncio.run(main())
