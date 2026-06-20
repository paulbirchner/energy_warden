import sqlite3
from datetime import datetime, date, timedelta
import time

def connect():
    con = sqlite3.connect('database.db')
    con.execute("PRAGMA foreign_keys = ON")
    return con

def init_db():
    with connect() as con:
        cur = con.cursor()

        cur.execute('''CREATE TABLE IF NOT EXISTS rooms (
                id integer PRIMARY KEY AUTOINCREMENT,
                name text NOT NULL,
                UNIQUE (name))''')

        cur.execute('''CREATE TABLE IF NOT EXISTS appliances (
                id integer PRIMARY KEY AUTOINCREMENT,
                name text NOT NULL,
                room_id integer REFERENCES rooms (id),
                watt integer NOT NULL,
                duration_min integer NOT NULL,
                UNIQUE (name, room_id))''')

        cur.execute('''CREATE TABLE IF NOT EXISTS price_data (
                id integer PRIMARY KEY AUTOINCREMENT,
                timestamp integer NOT NULL,
                price_eur_mwh real NOT NULL,
                source text DEFAULT 'awattar',
                UNIQUE (timestamp))''')

        cur.execute('''CREATE TABLE IF NOT EXISTS weather_data (
                id integer PRIMARY KEY AUTOINCREMENT,
                timestamp integer NOT NULL,
                irradiance_wm2 real,
                estimated_yield_kwh real,
                humidity real,
                UNIQUE (timestamp))''')

        cur.execute('''CREATE TABLE IF NOT EXISTS suggestions (
                id integer PRIMARY KEY AUTOINCREMENT,
                category text,
                appliance_id integer REFERENCES appliances (id),
                recommended_start integer,
                recommended_end integer,
                savings_eur real,
                reasoning text,
                created_at integer DEFAULT (strftime('%s','now')))''')

        cur.executemany(
            "INSERT OR IGNORE INTO rooms (name) VALUES (?)",
            [("Kitchen",), ("Living room",), ("Bathroom",), ("Garage",), ("Garden",)]
        )

        cur.executemany(
            '''INSERT OR IGNORE INTO appliances (name, room_id, watt, duration_min)
               VALUES (?, (SELECT id FROM rooms WHERE name = ?), ?, ?)''',
            [
                ("Washing machine", "Bathroom", 2000, 90),
                ("Dishwasher", "Kitchen", 1800, 60),
                ("EV Charger", "Garage", 11000, 240),
                ("Dryer", "Bathroom", 3000, 60),
                ("Heat pump", "Garage", 3500, 120),
            ]
        )

# --- prices ---

def get_current_price():
    with connect() as con:
        cur = con.cursor()

        cur.execute("SELECT price_eur_mwh FROM price_data WHERE timestamp <= ? AND ? < timestamp + 3600", (int(time.time()), int(time.time())))
        res = cur.fetchone()
    return res[0]

def get_prices(start = None, end = None):

    if start is None:
        start = int(datetime.combine(date.today(), datetime.min.time()).timestamp())
    if end is None:
        end = int(datetime.combine(date.today() + timedelta(days=1), datetime.min.time()).timestamp())

    with connect() as con:
        con.row_factory = sqlite3.Row
        cur = con.cursor()

        cur.execute('''SELECT * FROM price_data WHERE timestamp >= ? AND timestamp < ?''', (start, end))
        res = cur.fetchall()

    return res

def insert_prices(rows):
    with connect() as con:
        cur = con.cursor()

        cur.executemany(
            '''INSERT INTO price_data (timestamp, price_eur_mwh, source)
               VALUES (?, ?, 'awattar_de')
               ON CONFLICT(timestamp) DO UPDATE SET
                   price_eur_mwh = excluded.price_eur_mwh,
                   source = excluded.source''',
            rows,
        )

# --- weather data ---

def insert_weather_data(rows):
    with connect() as con:
        cur = con.cursor()

        cur.executemany('''INSERT OR IGNORE INTO weather_data (timestamp, irradiance_wm2, estimated_yield_kwh, humidity)
                        VALUES (?, ?, ?, ?)''', rows)

def get_weather_data(start = None, end = None):

    if start is None:
        start = int(datetime.combine(date.today(), datetime.min.time()).timestamp())
    if end is None:
        end = int(datetime.combine(date.today() + timedelta(days=1), datetime.min.time()).timestamp())

    with connect() as con:
        con.row_factory = sqlite3.Row
        cur = con.cursor()

        cur.execute("SELECT * FROM weather_data WHERE timestamp >= ? AND timestamp < ?", (start, end))
        res = cur.fetchall()

    return res

def insert_appliance(name, watt, duration_min, room_id = None):
    """Insert a single appliance and return its new id. room_id is optional."""
    with connect() as con:
        cur = con.cursor()

        cur.execute(
            '''INSERT INTO appliances (name, room_id, watt, duration_min)
               VALUES (?, ?, ?, ?)''',
            (name, room_id, watt, duration_min),
        )
        return cur.lastrowid

def get_appliances(room_id = None):
    with connect() as con:
        con.row_factory = sqlite3.Row
        cur = con.cursor()

        if room_id is None:
            cur.execute('''SELECT * FROM appliances''')
        else:
            cur.execute('''SELECT * FROM appliances WHERE room_id = ?''', (room_id,))
        res = cur.fetchall()

    return res

def clear_suggestions():
    with connect() as con:
        cur = con.cursor()

        cur.execute('''DELETE FROM suggestions''')

def insert_suggestions(rows):
    with connect() as con:
        cur = con.cursor()

        cur.executemany("""INSERT INTO suggestions (category, appliance_id, recommended_start, recommended_end, savings_eur, reasoning) 
                        VALUES (?, ?, ?, ?, ?, ?)""", rows)


def get_suggestions():
    with connect() as con:
        con.row_factory = sqlite3.Row
        cur = con.cursor()

        cur.execute('''SELECT s.*, a.name AS appliance_name 
                        FROM suggestions s JOIN appliances a ON a.id = s.appliance_id''')
        res = cur.fetchall()

    return res
