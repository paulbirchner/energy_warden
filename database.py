import sqlite3
from datetime import datetime, date, timedelta
import time

def init_db():
    with sqlite3.connect('database.db') as con:
        cur = con.cursor()

        cur.execute('''CREATE TABLE IF NOT EXISTS rooms (
                id integer PRIMARY KEY AUTOINCREMENT,
                name text NOT NULL)''')

        cur.execute('''CREATE TABLE IF NOT EXISTS appliances (
                id integer PRIMARY KEY AUTOINCREMENT,
                name text NOT NULL,
                room_id integer REFERENCES rooms (id),
                watt integer NOT NULL,
                duration_min integer NOT NULL)''')

        cur.execute('''CREATE TABLE IF NOT EXISTS price_data (
                id integer PRIMARY KEY AUTOINCREMENT,
                timestamp integer NOT NULL,
                price_eur_mwh real NOT NULL,
                source TEXT DEFAULT 'awattar',
                UNIQUE (timestamp))''')

        cur.execute('''CREATE TABLE IF NOT EXISTS weather_data (
                id integer PRIMARY KEY AUTOINCREMENT,
                timestamp integer NOT NULL,
                irradiance_wm2 REAL,
                estimated_yield_kwh REAL,
                humidity REAL,
                UNIQUE (timestamp))''')

        cur.execute('''CREATE TABLE IF NOT EXISTS suggestions (
                id integer PRIMARY KEY AUTOINCREMENT,
                category text,
                appliance_id integer REFERENCES appliances (id),
                recommended_start integer,
                recommended_end integer,
                savings_eur REAL,
                reasoning TEXT,
                created_at INTEGER DEFAULT (strftime('%s','now')))''')


# --- prices ---

def get_current_price():
    with sqlite3.connect('database.db') as con:
        cur = con.cursor()

        cur.execute("SELECT price_eur_mwh FROM price_data WHERE timestamp >= ? AND ? < timestamp + 3600", (int(time.time()), int(time.time())))
        res = cur.fetchone()
    return res[0]

def get_prices(start = None, end = None):

    if start is None:
        start = int(datetime.combine(date.today(), datetime.min.time()).timestamp())
    if end is None:
        end = int(datetime.combine(date.today() + timedelta(days=1), datetime.min.time()).timestamp())

    with sqlite3.connect('database.db') as con:
        con.row_factory = sqlite3.Row
        cur = con.cursor()

        cur.execute('''SELECT * FROM price_data WHERE timestamp >= ? AND timestamp < ?''', (start, end))
        res = cur.fetchall()

    return res

def insert_prices(rows):
    with sqlite3.connect('database.db') as con:
        cur = con.cursor()

        cur.executemany('''INSERT OR IGNORE INTO price_data (timestamp, price_eur_mwh) VALUES (?, ?)''', rows)

# --- weather data ---

def insert_weather_data(rows):
    with sqlite3.connect('database.db') as con:
        cur = con.cursor()

        cur.executemany('''INSERT OR IGNORE INTO weather_data (timestamp, irradiance_wm2, estimated_yield_kwh, humidity) 
                        VALUES (?, ?, ?, ?)''', rows)

def get_weather_data(start = None, end = None):

    if start is None:
        start = int(datetime.combine(date.today(), datetime.min.time()).timestamp())
    if end is None:
        end = int(datetime.combine(date.today() + timedelta(days=1), datetime.min.time()).timestamp())

    with sqlite3.connect('database.db') as con:
        con.row_factory = sqlite3.Row
        cur = con.cursor()

        cur.execute("SELECT * FROM weather_data WHERE timestamp >= ? AND timestamp < ?", (start, end))
        res = cur.fetchall()

    return res