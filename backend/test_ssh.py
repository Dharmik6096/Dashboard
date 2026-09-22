import asyncio
from app.database import async_session
from sqlalchemy import select
from app.models.container import Container
from app.api.v1.servers import _get_ssh_client

async def main():
    async with async_session() as db:
        c = (await db.execute(select(Container).where(Container.id == '049d2bda-b5cc-446e-af89-494f15a59215'))).scalar_one_or_none()
        if not c:
            print('Container not found')
            return
            
        print('Container Full ID:', c.container_full_id)
        print('Container Short ID:', c.container_id)
        
        server = await c.awaitable_attrs.server
        ssh_client = await _get_ssh_client(server, db)
        
        # Test original docker top
        out = await ssh_client._run_safe_command(f'docker top {c.container_id} -eo pid,ppid,user,%cpu,%mem,rss,etime,args', use_sudo=False)
        print('With fields:', out)
        
        out2 = await ssh_client._run_safe_command(f'docker top {c.container_id}', use_sudo=False)
        print('Standard:', out2)

asyncio.run(main())
