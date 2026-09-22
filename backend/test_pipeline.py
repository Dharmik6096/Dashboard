import asyncio
import os
import json
import logging
from sqlalchemy import text
from app.database import AsyncSessionLocal
from app.services.ssh_client import SSHClient
from app.services.metrics_ingester import ingest_server
from app.models.server import Server

async def main():
    report = []
    
    # 1. VERIFY REGISTERED SERVERS
    async with AsyncSessionLocal() as session:
        result = await session.execute(text("SELECT id, name, status, ip_address, ssh_port, ssh_username, auth_type FROM servers WHERE status != 'offline'"))
        servers = result.fetchall()
        
        report.append(f"Active Servers:\n{len(servers)}")
        if servers:
            report.append("Server names:\n" + "\n".join([f"{s.name} ({s.id})" for s in servers]))
        
        # 5. VERIFY DATABASE
        result = await session.execute(text("SELECT count(*) FROM containers"))
        db_container_count = result.scalar()
        report.append(f"\nDATABASE:\nContainer Records: {db_container_count}")
        report.append(f"Active Server Count: {len(servers)}")

    if not servers:
        print("\n".join(report))
        return
        
    server = servers[0] # Pick the first active server for SSH tests
    server_id = str(server.id)
    ip_address = server.ip_address
    ssh_port = server.ssh_port
    ssh_username = server.ssh_username
    auth_type = server.auth_type
    
    # We need vault to decrypt the SSH credentials. We'll use SSHClient directly
    report.append(f"\nTesting SSH on server: {server.name}")
    
    try:
        # Get password from vault
        async with AsyncSessionLocal() as session:
            from sqlalchemy import select
            from app.models.audit import CredentialVault
            from app.services.credential_vault import decrypt_credential
            v_res = await session.execute(select(CredentialVault).where(CredentialVault.server_id == server.id))
            vault = v_res.scalar_one_or_none()
            password = decrypt_credential(vault.encrypted_value) if vault and vault.auth_type == "password" else None

        ssh_client = SSHClient(
            host=server.ip_address,
            port=server.ssh_port,
            username=server.ssh_username,
            password=password
        )
        # 2 & 3. VERIFY SSHCLIENT
        snapshot = await ssh_client.snapshot()
        containers = snapshot.get("containers", [])
        
        report.append("SSH command result:\nPASS")
        report.append("Parsing:\nPASS")
        report.append(f"Parsed Container Count:\n{len(containers)}")
        
    except Exception as e:
        report.append("SSH command result:\nFAIL")
        report.append(f"Parsing:\nFAIL - {str(e)}")
        report.append("Parsed Container Count:\n0")

    # 4. VERIFY METRICS INGESTER
    # Let's see if we can trigger ingest_server for the server
    try:
        # We need a proper Server model object, we have a Row, let's query it
        async with AsyncSessionLocal() as session:
            server_obj = await session.get(Server, server.id)
            if server_obj:
                await ssh_client.connect()
                raw_docker_ps = await ssh_client._run_safe_command("docker ps -a --no-trunc --format '{{json .}}'")
                report.append(f"RAW DOCKER PS OUT:\n{raw_docker_ps}")
                
                report.append(f"Snapshot containers returned from agent/ssh in ingester: {len(snapshot.get('containers', []))}")
                report.append(f"Snapshot keys: {list(snapshot.keys())}")
                await ingest_server(server_obj)
                report.append("\nIngester running:\nYES")
                report.append("Docker collection called:\nYES")
            else:
                report.append("\nIngester running:\nERROR - Server not found")
    except Exception as e:
        report.append(f"\nIngester running:\nERROR - {str(e)}")

    print("\n".join(report))

if __name__ == '__main__':
    asyncio.run(main())
