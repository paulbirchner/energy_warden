from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from database import init_db, get_prices, get_current_price, get_suggestions, get_appliances
from suggestions import generate_suggestions
from appliances import estimate_and_store_appliance

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

@app.get("/appliances")
async def appliances():
    return [dict(row) for row in get_appliances()]

@app.post("/appliances/estimate-from-photo")
async def appliances_estimate_from_photo(image: UploadFile = File(...)):
    allowed = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if image.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Use JPG, PNG, WEBP or GIF.")

    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty file.")

    return await estimate_and_store_appliance(image_bytes, image.content_type)