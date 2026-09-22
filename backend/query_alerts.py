import asyncio
from sqlalchemy import select, func
from app.database import AsyncSessionLocal
from app.models.alert import Alert
from app.models.server import Server

async def main():
    async with AsyncSessionLocal() as db:
        # total active
        res = await db.execute(select(func.count(Alert.id)).where(Alert.status == 'active'))
        total = res.scalar()
        print(f'Global active alerts: {total}')
        
        # per server
        res = await db.execute(select(Server.name, Alert.server_id, func.count(Alert.id)).join(Alert, Alert.server_id == Server.id).where(Alert.status == 'active').group_by(Server.name, Alert.server_id))
        rows = res.all()
        for name, sid, count in rows:
            print(f'  {name}: {count} alerts')

        # check for duplicates
        print()
        res = await db.execute(select(Alert.rule_id, Alert.server_id, Alert.container_db_id, func.count(Alert.id)).where(Alert.status == 'active').group_by(Alert.rule_id, Alert.server_id, Alert.container_db_id).having(func.count(Alert.id) > 1))
        dups = res.all()
        print(f'Duplicate active alert groups: {len(dups)}')
        for rule_id, sid, cid, cnt in dups:
            print(f'  rule={rule_id} server={sid} container={cid} count={cnt}')

asyncio.run(main())
