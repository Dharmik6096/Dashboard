import asyncio
import bcrypt
import uuid
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import text

DATABASE_URL = "postgresql+asyncpg://postgres:postgres_pass@localhost:5433/devops_dashboard"
engine = create_async_engine(DATABASE_URL)
Session = async_sessionmaker(engine)

pw = bcrypt.hashpw(b"Admin@123", bcrypt.gensalt()).decode()
uid = str(uuid.uuid4())

async def run():
    async with Session() as db:
        r = await db.execute(text("SELECT id FROM users WHERE username='admin'"))
        if r.fetchone():
            print("Admin already exists!")
            return
        await db.execute(text(
            "INSERT INTO users (id, username, email, password_hash, role, is_active, created_at) "
            "VALUES (:id, :u, :e, :p, :r, true, NOW())"
        ), {"id": uid, "u": "admin", "e": "admin@devops.local", "p": pw, "r": "admin"})
        await db.commit()
        print("SUCCESS: Admin user created!")
        print("Username: admin")
        print("Password: Admin@123")

asyncio.run(run())
