import asyncio
from app.services.ssh_client import SSHClient
from sqlalchemy import text
from app.services.credential_vault import get_server_credentials
from app.database import AsyncSessionLocal
import sys

async def main():
    async with AsyncSessionLocal() as db:
        servers = (await db.execute(text("SELECT id, ip_address, ssh_port FROM servers"))).all()
        if not servers:
            print("No servers")
            return
            
        server_id = servers[0][0]
        ip = servers[0][1]
        port = servers[0][2]
        
        creds = await get_server_credentials(str(server_id), db)
        client = SSHClient(
            host=ip, port=port,
            username=creds["username"],
            password=creds.get("password"),
            private_key=creds.get("private_key")
        )
        
        await client.connect()
        
        cmd_du = "du -xb --exclude='*/overlay2/*' --exclude='*/containers/*' --max-depth=1 '/webdisk' | sort -nr | head -n 101"
        try:
            out, err, code = await client._run_command_full(cmd_du, timeout=60, use_sudo=True)
            print(f"CODE: {code}")
            print(f"OUT: {out[:200]}")
            print(f"ERR: {err[:200]}")
        except Exception as e:
            print(f"EXCEPTION: {e}")
            
        await client.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
