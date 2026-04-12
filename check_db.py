import sqlite3

conn = sqlite3.connect("db/books.db")
cur = conn.cursor()
try:
    cur.execute("ALTER TABLE Books ADD COLUMN image_url TEXT;")
    conn.commit()
    print("image_url added")
except Exception as e:
    print("maybe already exists:", e)
conn.close()