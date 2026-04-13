from flask import Flask, jsonify, render_template, request
import sqlite3
import os
import datetime
from pymongo import MongoClient

app = Flask(__name__)

# -----------------------------
# SQLite (Books)
# -----------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_DIR = os.path.join(BASE_DIR, "db")
os.makedirs(DB_DIR, exist_ok=True)
DATABASE = os.path.join(DB_DIR, "books.db")


def init_sqlite():
    conn = sqlite3.connect(DATABASE)
    cur = conn.cursor()

    # Books table (with image_url)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS Books (
        book_id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        publication_year TEXT NOT NULL,
        image_url TEXT
    );
    """)

    # Authors + link table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS Authors (
        author_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
    );
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS book_author (
        book_id INTEGER NOT NULL,
        author_id INTEGER NOT NULL,
        UNIQUE(book_id, author_id),
        FOREIGN KEY(book_id) REFERENCES Books(book_id),
        FOREIGN KEY(author_id) REFERENCES Authors(author_id)
    );
    """)

    conn.commit()
    conn.close()


init_sqlite()


@app.route("/api/books", methods=["GET"])
def get_all_books():
    try:
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                b.book_id,
                b.title,
                b.publication_year,
                b.image_url,
                COALESCE(GROUP_CONCAT(a.name, ', '), '') AS author_name
            FROM Books b
            LEFT JOIN book_author ba ON b.book_id = ba.book_id
            LEFT JOIN Authors a ON ba.author_id = a.author_id
            GROUP BY b.book_id, b.title, b.publication_year, b.image_url
            ORDER BY b.book_id DESC
        """)

        books = cursor.fetchall()
        conn.close()

        book_list = []
        for book in books:
            book_list.append({
                "book_id": book[0],
                "title": book[1],
                "publication_year": book[2],
                "image_url": book[3],
                "author_name": book[4],
            })

        return jsonify({"books": book_list})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/add", methods=["POST"])
def add_book():
    try:
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()

        data = request.get_json(force=True) or {}
        title = (data.get("title") or "").strip()
        publication_year = (data.get("publication_year") or "").strip()
        author_name = (data.get("author_name") or "").strip()
        image_url = (data.get("image_url") or "").strip()

        if not title or not publication_year or not author_name:
            conn.close()
            return jsonify({"error": "title, publication_year, and author_name are required"}), 400

        # Insert book
        cursor.execute(
            "INSERT INTO Books (title, publication_year, image_url) VALUES (?, ?, ?)",
            (title, publication_year, image_url)
        )
        book_id = cursor.lastrowid

        # Get or create author
        cursor.execute("SELECT author_id FROM Authors WHERE name = ?", (author_name,))
        row = cursor.fetchone()

        if row:
            author_id = row[0]
        else:
            cursor.execute("INSERT INTO Authors (name) VALUES (?)", (author_name,))
            author_id = cursor.lastrowid

        # Link book-author
        cursor.execute(
            "INSERT OR IGNORE INTO book_author (book_id, author_id) VALUES (?, ?)",
            (book_id, author_id)
        )

        conn.commit()
        conn.close()

        return jsonify({"message": "Book added successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/search", methods=["GET"])
def search_books():
    try:
        q = (request.args.get("q", "") or "").strip()
        like = f"%{q}%"

        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                b.book_id,
                b.title,
                b.publication_year,
                b.image_url,
                COALESCE(GROUP_CONCAT(a.name, ', '), '') AS author_name
            FROM Books b
            LEFT JOIN book_author ba ON b.book_id = ba.book_id
            LEFT JOIN Authors a ON ba.author_id = a.author_id
            WHERE b.title LIKE ? OR a.name LIKE ?
            GROUP BY b.book_id, b.title, b.publication_year, b.image_url
            ORDER BY b.book_id DESC
        """, (like, like))

        rows = cursor.fetchall()
        conn.close()

        books = [{
            "book_id": r[0],
            "title": r[1],
            "publication_year": r[2],
            "image_url": r[3],
            "author_name": r[4],
        } for r in rows]

        return jsonify({"books": books})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -----------------------------
# MongoDB (Reviews)
# -----------------------------
MONGO_URI = os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017")
mongo_client = MongoClient(MONGO_URI)
mongo_db = mongo_client["book_shelf_app"]
reviews_col = mongo_db["reviews"]


@app.route("/api/reviews", methods=["GET"])
def get_all_reviews():
    try:
        docs = list(reviews_col.find({}).sort("created_at", -1))
        out = []
        for d in docs:
            out.append({
                "_id": str(d.get("_id")),
                "book_title": d.get("book_title", ""),
                "reviewer": d.get("reviewer", ""),
                "rating": d.get("rating", ""),
                "review_text": d.get("review_text", ""),
                "created_at": d.get("created_at", ""),
            })
        return jsonify({"reviews": out})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/reviews/add", methods=["POST"])
def add_review():
    try:
        data = request.get_json(force=True) or {}

        book_title = (data.get("book_title") or "").strip()
        reviewer = (data.get("reviewer") or "").strip()
        rating = data.get("rating")
        review_text = (data.get("review_text") or "").strip()

        if not book_title or not reviewer or not review_text:
            return jsonify({"error": "book_title, reviewer, and review_text are required"}), 400

        try:
            rating_int = int(rating)
        except Exception:
            return jsonify({"error": "rating must be a number 1-5"}), 400

        if rating_int < 1 or rating_int > 5:
            return jsonify({"error": "rating must be between 1 and 5"}), 400

        doc = {
            "book_title": book_title,
            "reviewer": reviewer,
            "rating": rating_int,
            "review_text": review_text,
            "created_at": datetime.datetime.utcnow().isoformat() + "Z",
        }

        reviews_col.insert_one(doc)
        return jsonify({"message": "Review added successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -----------------------------
# UI
# -----------------------------
@app.route("/")
def index():
    return render_template("index.html")


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0")