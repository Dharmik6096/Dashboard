import asyncio
from sqlalchemy import select, func, delete
from app.database import AsyncSessionLocal
from app.models.alert import Alert
from app.models.server import Server

async def main():
    async with AsyncSessionLocal() as db:
        # Show the duplicate alerts - same rule+server+container
        res = await db.execute(select(Alert).where(Alert.status == 'active').order_by(Alert.rule_id, Alert.server_id, Alert.container_db_id, Alert.fired_at))
        alerts = res.scalars().all()
        
        seen = {}
        to_keep = []
        to_delete = []
        
        for a in alerts:
            key = (a.rule_id, a.server_id, a.container_db_id)
            if key in seen:
                # newer one replaces, mark old for deletion
                to_delete.append(seen[key].id)
                seen[key] = a  # keep newer
            else:
                seen[key] = a
        
        to_keep_ids = [a.id for a in seen.values()]
        print(f'Total active: {len(alerts)}')
        print(f'Unique groups: {len(seen)}')
        print(f'Duplicates to delete: {len(to_delete)}')
        
        # Remove duplicates - keep only the latest per rule+server+container
        for dup_id in to_delete:
            await db.execute(delete(Alert).where(Alert.id == dup_id))
        await db.commit()
        
        res = await db.execute(select(func.count(Alert.id)).where(Alert.status == 'active'))
        total = res.scalar()
        print(f'Active alerts after dedup: {total}')

asyncio.run(main())
