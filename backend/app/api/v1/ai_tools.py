from typing import Dict, Any
from app.database import AsyncSessionLocal
from app.models.server import Server
from sqlalchemy import select
from app.services.ssh_client import SSHClient

async def get_docker_image_summary(server_id: str) -> Dict[str, Any]:
    """Retrieves docker image count and inventory for a given server."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Server).filter(Server.id == server_id))
        server = result.scalar_one_or_none()
        
        if not server:
            return {"error": "Server not found"}

    try:
        # Connect and fetch docker images safely
        from app.models.audit import CredentialVault
        from app.services.credential_vault import decrypt_credential

        v_res = await db.execute(select(CredentialVault).where(CredentialVault.server_id == server.id))
        vault = v_res.scalar_one_or_none()

        if not vault or not server.ssh_username:
            return {"error": "SSH credentials not found in vault"}

        client = SSHClient(
            host=server.ip_address,
            port=server.ssh_port,
            username=server.ssh_username,
            password=decrypt_credential(vault.encrypted_value) if vault.auth_type == "password" else None,
            private_key=decrypt_credential(vault.encrypted_value) if vault.auth_type == "ssh_key" else None
        )
        
        await client.connect()
        out = (await client._run_with_sudo_fallback("docker images --format '{{.Repository}}:{{.Tag}}|{{.ID}}|{{.Size}}'", "Docker Images"))[0]
        await client.disconnect()

        if not out or "permission denied" in out.lower() or "cannot connect" in out.lower():
            return {"error": "Docker is not available or permission denied"}

        lines = [line for line in out.split("\n") if line.strip()]
        images = []
        for line in lines:
            parts = line.split("|")
            if len(parts) >= 3:
                images.append({
                    "repository": parts[0],
                    "image_id": parts[1],
                    "size": parts[2]
                })

        return {
            "server_id": server_id,
            "image_count": len(images),
            "images": images,
            "collected_at": "just now"
        }
    except Exception as e:
        return {"error": f"Failed to get docker images: {str(e)}"}

# Define OpenAI function definitions
AI_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_docker_image_summary",
            "description": "Get docker image inventory and count for a server.",
            "parameters": {
                "type": "object",
                "properties": {
                    "server_id": {"type": "string"}
                },
                "required": ["server_id"]
            }
        }
    }
]
