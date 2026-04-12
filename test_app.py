import pytest
from app import app

def test_add_book_increases_count():
    client = app.test_client()

    # 1) Count books before adding
    response = client.get("/api/books")
    assert response.status_code == 200
    before_count = len(response.get_json()["books"])

    # 2) Add a new book (use the correct endpoint and required fields)
    response = client.post("/api/add", json={
        "title": "Clean Architecture",
        "publication_year": "2025",
        "author_name": "Robert C. Martin",
        "image_url": "https://covers.openlibrary.org/b/isbn/0134494164-L.jpg"
    })
    assert response.status_code == 200
    assert response.get_json()["message"] == "Book added successfully"

    # 3) Count books after adding
    response = client.get("/api/books")
    assert response.status_code == 200
    after_count = len(response.get_json()["books"])

    # 4) Assert count increased by 1
    assert after_count == before_count + 1