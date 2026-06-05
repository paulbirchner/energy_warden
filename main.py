from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from dotenv import load_dotenv
from fastapi import FastAPI

from database import init_db, get_prices, get_current_price

load_dotenv()

scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    scheduler.start()
    yield
    scheduler.shutdown()


app = FastAPI(title="Energy Warden", lifespan=lifespan)


@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/prices")
async def prices():
    res = get_prices()
    return [dict(row) for row in res]

@app.get("/prices/current")
async def prices_current():
    return get_current_price()