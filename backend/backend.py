# ==========================================
# CodeMaster Arena - Backend Server
# Purpose: Store quiz questions + SQLite DB for permanent leaderboard
# ==========================================

from flask import Flask, jsonify, request
from flask_cors import CORS
import json
import sqlite3 # ← DB ke liye
import os

app = Flask(__name__)
CORS(app)

# ====================  SQLite DATABASE SETUP  ====================
def init_db():
    conn = sqlite3.connect('quiz_scores.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS scores
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  name TEXT NOT NULL,
                  email TEXT NOT NULL,
                  language TEXT NOT NULL,
                  score INTEGER NOT NULL,
                  total INTEGER NOT NULL,
                  UNIQUE(email, language))''')
    conn.commit()
    conn.close()
    print("Database ready: quiz_scores.db")

init_db() # Server start hote hi chalega
# ========================================================

# Load questions from JSON file
with open('../questions.json', 'r', encoding='utf-8') as f: # '../' hata diya kyunki same folder me hai ../ ka matlab: backend folder se ek step bahar jaa, wahan questions.json milega.
    questions_data = json.load(f)

# ==========================================
# ROUTE 1: Home
# ==========================================
@app.route('/')
def home():
    return "Backend is working! Server is running on port 5000"

# ==========================================
# ROUTE 2: Get questions
# ==========================================
@app.route('/get-questions/<lang>')
def get_questions(lang):
    print(f"Frontend asked for questions of: {lang}")
    if lang in questions_data:
        return jsonify(questions_data[lang]) # ← Array bhejte hain
    else:
        return jsonify({"error": "Language not found"}), 404

# ==========================================
# ROUTE 3: Save score - DB VERSION
# ==========================================
@app.route('/save-score', methods=['POST']) # ← /save-score rakha kyunki script.js me yahi hai
def save_score():
    score_data = request.json
    print(f"Received score data: {score_data}")

    user_email = score_data['email']
    user_lang = score_data['lang'] # Frontend 'lang' bhejta hai, 'language' nahi
    user_name = score_data['name']
    score = score_data['score']
    total = score_data['total']
    new_percent = (score / total) * 100

    conn = sqlite3.connect('quiz_scores.db')
    c = conn.cursor()

    # Check existing score
    c.execute("SELECT score, total FROM scores WHERE email=? AND language=?", (user_email, user_lang))
    existing = c.fetchone()

    if existing:
        old_score, old_total = existing
        old_percent = (old_score / old_total) * 100
        if new_percent > old_percent:
            c.execute("UPDATE scores SET score=?, total=?, name=? WHERE email=? AND language=?",
                     (score, total, user_name, user_email, user_lang))
            print(f"BEST SCORE UPDATED: {user_name} - {user_lang} - {old_percent:.1f}% -> {new_percent:.1f}%")
        else:
            print(f"Score not improved. Keeping old: {old_percent:.1f}%, New: {new_percent:.1f}%")
    else:
        c.execute("INSERT INTO scores (name, email, language, score, total) VALUES (?,?,?,?,?)",
                 (user_name, user_email, user_lang, score, total))
        print(f"NEW ENTRY: {user_name} - {user_lang} - {new_percent:.1f}%")

    conn.commit()
    conn.close()
    return jsonify({"status": "success", "message": "Score saved to DB!"})

# ==========================================
# ROUTE 4: Leaderboard - DB VERSION
# ==========================================
@app.route('/leaderboard')
def get_leaderboard():
    conn = sqlite3.connect('quiz_scores.db')
    c = conn.cursor()
    # Percentage ke hisaab se sort karo - best score upar
    c.execute("SELECT name, email, language, score, total FROM scores ORDER BY (CAST(score AS FLOAT)/total) DESC")
    rows = c.fetchall()
    conn.close()

    leaderboard = []
    for row in rows:
        leaderboard.append({
            'name': row[0],
            'email': row[1],
            'lang': row[2], # Frontend 'lang' expect karta hai
            'score': row[3],
            'total': row[4]
        })

    print(f"Sending leaderboard. Total entries: {len(leaderboard)}")
    return jsonify(leaderboard)

# ==========================================
if __name__ == '__main__':
    print("Questions loaded successfully!")
    print("Server ready. DB: quiz_scores.db | Rule: 1 user + 1 language = 1 best score")
    print("Running on http://127.0.0.1:5000")
    app.run(debug=True, port=5000)
    