import os
import sqlite3
import tempfile
import pytest

from app import app as flask_app


@pytest.fixture()
def client():
    # Create a temporary database for tests (so we don't touch db/books.db)
    fd, db_path = tempfile.mkstemp(suffix=".db")
    os.close(fd)

    # Build schema to match your app expectations
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE Books (
            book_id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            publication_year TEXT NOT NULL,
            image_url TEXT
        );
    """)

    cur.execute("""
        CREATE TABLE Authors (
            author_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL
        );
    """)

    cur.execute("""
        CREATE TABLE book_author (
            book_id INTEGER,
            author_id INTEGER,
            UNIQUE(book_id, author_id)
        );
    """)

    conn.commit()
    conn.close()

    # Put Flask in testing mode
    flask_app.config["TESTING"] = True

    # Point the app's DATABASE to the temporary DB
    import app as app_module
    app_module.DATABASE = db_path

    with flask_app.test_client() as c:
        yield c

    # Cleanup temp DB file
    os.remove(db_path)


def test_add_book_stores_title_author_image(client):
    payload = {
        "title": "The Phoenix Project",
        "publication_year": "2013",
        "author_name": "Gene Kim",
        "image_url": "https://covers.openlibrary.org/b/isbn/0988262509-L.jpg"
    }

    r = client.post("/api/add", json=payload)
    assert r.status_code == 200

    r2 = client.get("/api/books")
    assert r2.status_code == 200
    data = r2.get_json()

    assert "books" in data
    assert len(data["books"]) == 1

    b = data["books"][0]
    assert b["title"] == payload["title"]
    assert b["publication_year"] == payload["publication_year"]
    assert payload["author_name"] in b["author_name"]
    assert b["image_url"] == payload["image_url"]


def test_search_by_title_returns_correct_results(client):
    # Add two books
    client.post("/api/add", json={
        "title": "The Phoenix Project",
        "publication_year": "2013",
        "author_name": "Gene Kim",
        "image_url": "https://covers.openlibrary.org/b/isbn/0988262509-L.jpg"
    })
    client.post("/api/add", json={
        "title": "The Clean Coder",
        "publication_year": "2011",
        "author_name": "Robert C. Martin",
        "image_url": "https://covers.openlibrary.org/b/isbn/0137081073-L.jpg"
    })

    r = client.get("/api/search?q=Phoenix")
    assert r.status_code == 200
    data = r.get_json()

    assert len(data["books"]) == 1
    assert data["books"][0]["title"] == "The Phoenix Project"


def test_search_by_author_returns_correct_results(client):
    client.post("/api/add", json={
        "title": "The Art of Computer Programming, Volume 1",
        "publication_year": "1997",
        "author_name": "Donald E. Knuth",
        "image_url": "https://covers.openlibrary.org/b/isbn/0201896834-L.jpg"
    })
    client.post("/api/add", json={
        "title": "Operating System Concepts",
        "publication_year": "2018",
        "author_name": "Abraham Silberschatz",
        "image_url": "https://covers.openlibrary.org/b/isbn/1119456339-L.jpg"
    })

    r = client.get("/api/search?q=Knuth")
    assert r.status_code == 200
    data = r.get_json()

    assert len(data["books"]) == 1
    assert "Donald E. Knuth" in data["books"][0]["author_name"]


def test_search_nonexistent_returns_empty(client):
    r = client.get("/api/search?q=thisdoesnotexist")
    assert r.status_code == 200
    data = r.get_json()
    assert data["books"] == []