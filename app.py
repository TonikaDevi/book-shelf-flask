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
DATABASE = os.path.join(BASE_DIR, 'db', 'books.db')

# -----------------------------
# MongoDB (Reviews) - Local
# -----------------------------
MONGO_URI = os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017")
mongo_client = MongoClient(MONGO_URI)
mongo_db = mongo_client["book_shelf_app"]
reviews_col = mongo_db["reviews"]

# -----------------------------
# Books APIs (SQLite)
# -----------------------------
@app.route('/api/books', methods=['GET'])
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
                'book_id': book[0],
                'title': book[1],
                'publication_year': book[2],
                'image_url': book[3],
                'author_name': book[4]
            })

        return jsonify({'books': book_list})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/authors', methods=['GET'])
def get_all_authors():
    try:
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM Authors")
        authors = cursor.fetchall()
        conn.close()
        return jsonify(authors)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/add', methods=['POST'])
def add_book():
    try:
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()

        data = request.get_json()
        title = data.get('title')
        publication_year = data.get('publication_year')
        author_name = data.get('author_name')
        image_url = data.get('image_url')

        if not title or not publication_year or not author_name:
            conn.close()
            return jsonify({'error': 'title, publication_year, and author_name are required'}), 400

        cursor.execute(
            "INSERT INTO Books (title, publication_year, image_url) VALUES (?, ?, ?)",
            (title, publication_year, image_url)
        )
        book_id = cursor.lastrowid

        cursor.execute("SELECT author_id FROM Authors WHERE name = ?", (author_name,))
        row = cursor.fetchone()

        if row:
            author_id = row[0]
        else:
            cursor.execute("INSERT INTO Authors (name) VALUES (?)", (author_name,))
            author_id = cursor.lastrowid

        cursor.execute(
            "INSERT OR IGNORE INTO book_author (book_id, author_id) VALUES (?, ?)",
            (book_id, author_id)
        )

        conn.commit()
        conn.close()

        return jsonify({'message': 'Book added successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/search', methods=['GET'])
def search_books():
    try:
        q = request.args.get('q', '').strip()
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()

        like = f"%{q}%"

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
# Reviews APIs (MongoDB)
# -----------------------------
@app.route('/api/reviews', methods=['GET'])
def get_all_reviews():
    try:
        docs = list(reviews_col.find({}).sort("_id", -1))
        for d in docs:
            d["_id"] = str(d["_id"])
        return jsonify({"reviews": docs})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/reviews/add', methods=['POST'])
def add_review():
    try:
        data = request.get_json()

        book_title = data.get("book_title")
        reviewer = data.get("reviewer")
        rating = data.get("rating")
        review_text = data.get("review_text")

        if not book_title or not reviewer or not review_text:
            return jsonify({"error": "book_title, reviewer, review_text are required"}), 400

        doc = {
            "book_title": book_title,
            "reviewer": reviewer,
            "rating": rating,
            "review_text": review_text,
            "created_at": datetime.datetime.utcnow()
        }

        result = reviews_col.insert_one(doc)
        return jsonify({"message": "Review added", "id": str(result.inserted_id)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -----------------------------
# UI Route
# -----------------------------
@app.route('/')
def index():
    return render_template('index.html')


if __name__ == '__main__':
    app.run(debug=True, host="0.0.0.0")