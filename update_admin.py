import asyncio
from dotenv import load_dotenv
import os

load_dotenv()
os.environ["POSTGRES_HOST"] = "localhost" # Override postgres host for local execution
os.environ["POSTGRES_PORT"] = "5433"
os.environ["POSTGRES_USER"] = "postgres"
os.environ["POSTGRES_PASSWORD"] = "postgres_pass"
os.environ["POSTGRES_DB"] = "devops_dashboard"
os.environ["SECRET_KEY"] = "test"
os.environ["VAULT_ENCRYPTION_KEY"] = "tChsN0KbLqfpgQPkdRRgf6feUr_cKmE639KLiBaN534="

import sys
sys.path.append(os.path.join(os.path.dirname(__file__), "backend"))

from app.database import AsyncSessionLocal
from app.models.user import User
from app.core.security import hash_password
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.username == 'admin'))
        admin = result.scalar_one_or_none()
        
        if admin:
            print("Admin user found, updating password...")
            admin.password_hash = hash_password('Admin@123')
        else:
            print("Admin user not found, creating...")
            admin = User(
                username='admin',
                email='admin@example.com',
                password_hash=hash_password('Admin@123'),
                role='admin'
            )
            session.add(admin)
            
        await session.commit()
        print("Done!")

if __name__ == "__main__":
    asyncio.run(main())
