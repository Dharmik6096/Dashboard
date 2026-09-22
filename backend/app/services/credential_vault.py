from cryptography.fernet import Fernet
from app.config import settings
import base64
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid


def _get_fernet() -> Fernet:
    key = settings.VAULT_ENCRYPTION_KEY
    # Ensure proper Fernet key format
    if not key.endswith("="):
        key = key + "=" * (4 - len(key) % 4)
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_credential(plaintext: str) -> str:
    """Encrypt a credential (SSH key or password) for storage."""
    f = _get_fernet()
    return f.encrypt(plaintext.encode()).decode()


def decrypt_credential(ciphertext: str) -> str:
    """Decrypt a credential. Never return to frontend."""
    f = _get_fernet()
    return f.decrypt(ciphertext.encode()).decode()


async def get_server_credentials(server_id: str, db: AsyncSession) -> dict:
    from app.models.server import Server
    from app.models.audit import CredentialVault
    
    server = (await db.execute(select(Server).where(Server.id == uuid.UUID(server_id)))).scalars().first()
    if not server:
        raise ValueError("Server not found")
        
    cred = (await db.execute(select(CredentialVault).where(CredentialVault.server_id == server.id))).scalars().first()
    
    password = None
    private_key = None
    
    if cred:
        decrypted = decrypt_credential(cred.encrypted_value)
        if cred.auth_type == "password":
            password = decrypted
        else:
            private_key = decrypted
            
    return {
        "username": server.ssh_username or "root",
        "password": password,
        "private_key": private_key
    }
