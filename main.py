from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import init_db, get_prices, get_current_price, get_suggestions
from suggestions import generate_suggestions

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Energy Warden", lifespan=lifespan)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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

@app.post("/suggestions/generate")
async def suggestions_generate():
    await generate_suggestions()
    return [dict(row) for row in get_suggestions()]

@app.get("/suggestions")
async def suggestions():
    return [dict(row) for row in get_suggestions()]