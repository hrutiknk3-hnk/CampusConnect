
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
from pathlib import Path

app = FastAPI(title="CampusConnect API")

# Allow your frontend to communicate with the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:5501",
        "http://localhost:5501",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create the database file inside the backend folder
DB_PATH = Path(__file__).with_name("campusconnect.db")


def get_connection():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


# Create the database table automatically
def create_table():
    with get_connection() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                description TEXT NOT NULL,
                location TEXT NOT NULL,
                date TEXT NOT NULL,
                status TEXT NOT NULL,
                returned INTEGER NOT NULL DEFAULT 0
            )
        """)


create_table()


# Fields received when someone reports an item
class ItemReport(BaseModel):
    name: str
    category: str
    description: str
    location: str
    date: str
    status: str
    
class ClaimReport(BaseModel):
    item_id: int
    claimant_name: str
    claimant_contact: str
    claim_message: str



@app.get("/")
def home():
    return {
        "message": "Welcome to CampusConnect API",
        "status": "running"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


# Get all reports from the database
@app.get("/items")
def get_items():
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT * FROM items ORDER BY id DESC"
        ).fetchall()

    return [dict(row) for row in rows]


# Save a new report in the database
@app.post("/items", status_code=201)
def create_item(item: ItemReport):
    if not item.name.strip():
        raise HTTPException(
            status_code=400,
            detail="Item name cannot be empty"
        )

    if item.status.upper() not in ["LOST", "FOUND"]:
        raise HTTPException(
            status_code=400,
            detail="Status must be LOST or FOUND"
        )

    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO items
            (name, category, description, location, date, status)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                item.name.strip(),
                item.category.strip(),
                item.description.strip(),
                item.location.strip(),
                item.date,
                item.status.upper()
            )
        )

        item_id = cursor.lastrowid

        row = connection.execute(
            "SELECT * FROM items WHERE id = ?",
            (item_id,)
        ).fetchone()

    return dict(row)


# Mark an item as returned
@app.patch("/items/{item_id}/return")
def return_item(item_id: int):
    with get_connection() as connection:
        cursor = connection.execute(
            "UPDATE items SET returned = 1 WHERE id = ?",
            (item_id,)
        )

        if cursor.rowcount == 0:
            raise HTTPException(
                status_code=404,
                detail="Item not found"
            )

        row = connection.execute(
            "SELECT * FROM items WHERE id = ?",
            (item_id,)
        ).fetchone()

    return dict(row)


import re
from collections import Counter


def matching_words(text):
    """Convert text into useful lowercase words."""
    words = re.findall(r"[a-z0-9]+", text.lower())

    ignored_words = {
        "the", "a", "an", "is", "in", "on", "at",
        "and", "or", "with", "near", "my", "found",
        "lost", "item"
    }

    return set(words) - ignored_words


@app.get("/matches/{item_id}")
def find_matches(item_id: int):
    """Find possible matches for a lost or found report."""

    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row

    try:
        cursor = connection.cursor()

        cursor.execute(
            "SELECT * FROM items WHERE id = ?",
            (item_id,)
        )
        target = cursor.fetchone()

        if target is None:
            raise HTTPException(
                status_code=404,
                detail="Item not found."
            )

        target = dict(target)

        if target["returned"]:
            return {
                "item_id": item_id,
                "matches": []
            }

        opposite_status = (
            "FOUND" if target["status"].upper() == "LOST"
            else "LOST"
        )

        cursor.execute(
            """
            SELECT * FROM items
            WHERE UPPER(status) = ?
              AND returned = 0
              AND id != ?
            """,
            (opposite_status, item_id)
        )

        candidates = [dict(row) for row in cursor.fetchall()]

        target_words = matching_words(
            f"{target['name']} {target['description']}"
        )

        results = []

        for candidate in candidates:
            candidate_words = matching_words(
                f"{candidate['name']} {candidate['description']}"
            )

            common_words = target_words & candidate_words
            all_words = target_words | candidate_words

            word_score = (
                len(common_words) / len(all_words) * 60
                if all_words else 0
            )

            category_score = (
                20
                if target["category"].lower()
                == candidate["category"].lower()
                else 0
            )

            location_score = (
                20
                if target["location"].strip().lower()
                == candidate["location"].strip().lower()
                else 0
            )

            score = round(
                word_score + category_score + location_score
            )

            if score > 0:
                results.append({
                    "id": candidate["id"],
                    "name": candidate["name"],
                    "category": candidate["category"],
                    "location": candidate["location"],
                    "date": candidate["date"],
                    "description": candidate["description"],
                    "status": candidate["status"],
                    "match_score": score,
                    "matching_words": sorted(common_words)
                })

        results.sort(
            key=lambda item: item["match_score"],
            reverse=True
        )

        return {
            "item_id": item_id,
            "matches": results[:10]
        }

    finally:
        connection.close()


# Create the claims table without changing existing item reports.
def create_claims_table():
    connection = sqlite3.connect(DB_PATH)

    try:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS claims (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_id INTEGER NOT NULL,
                claimant_name TEXT NOT NULL,
                claimant_contact TEXT NOT NULL,
                claim_message TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'PENDING',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (item_id) REFERENCES items(id)
            )
        """)

        connection.commit()

    finally:
        connection.close()


create_claims_table()


@app.post("/claims")
def create_claim(claim: ClaimReport):
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row

    try:
        item = connection.execute(
            """
            SELECT id, status, returned
            FROM items
            WHERE id = ?
            """,
            (claim.item_id,)
        ).fetchone()

        if item is None:
            raise HTTPException(
                status_code=404,
                detail="Item not found"
            )

        if item["status"].upper() != "FOUND":
            raise HTTPException(
                status_code=400,
                detail="Only found items can be claimed"
            )

        if item["returned"]:
            raise HTTPException(
                status_code=400,
                detail="This item has already been returned"
            )

        cursor = connection.execute(
            """
            INSERT INTO claims (
                item_id,
                claimant_name,
                claimant_contact,
                claim_message
            )
            VALUES (?, ?, ?, ?)
            """,
            (
                claim.item_id,
                claim.claimant_name.strip(),
                claim.claimant_contact.strip(),
                claim.claim_message.strip()
            )
        )

        connection.commit()

        return {
            "message": "Claim submitted successfully",
            "claim_id": cursor.lastrowid,
            "status": "PENDING"
        }

    finally:
        connection.close()

@app.get("/items/{item_id}/claims")
def get_item_claims(item_id: int):
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row

    try:
        item = connection.execute(
            "SELECT id FROM items WHERE id = ?",
            (item_id,)
        ).fetchone()

        if item is None:
            raise HTTPException(
                status_code=404,
                detail="Item not found"
            )

        claims = connection.execute(
            """
            SELECT id, item_id, claimant_name,
                   claimant_contact, claim_message,
                   status, created_at
            FROM claims
            WHERE item_id = ?
            ORDER BY created_at DESC
            """,
            (item_id,)
        ).fetchall()

        return [dict(claim) for claim in claims]

    finally:
        connection.close()
