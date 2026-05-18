# CodeMaster Arena

A browser-based quiz game with a Flask backend for leaderboard storage. Users log in with an approved email domain, select a programming topic, answer timed quiz questions, and compare scores on a leaderboard.

## Project Structure

- `Login.html` - Login page with university email validation and session-based login.
- `Main.html` - Dashboard for selecting a language quiz and viewing user info.
- `Quiz.html` - Quiz game page that loads questions and tracks score/time.
- `Leaderboard.html` - Shows leaderboard entries fetched from the backend.
- `About.html` - Application information and navigation.
- `script.js` - Frontend logic for page navigation, quiz management, backend communication, sounds, and score tracking.
- `style.css` - Shared styling for the entire app.
- `questions.json` - Quiz questions dataset for HTML, CSS, JavaScript, Python, and C.
- `backend/backend.py` - Flask server that serves questions, saves scores, and returns leaderboard data.

## Features

- Quiz categories: HTML5, CSS3, JavaScript, Python, C Programming
- Per-category question counts: HTML 13, CSS 13, JS 14, Python 12, C 10
- Login validation for `@chitkara.edu.in` email addresses
- Score saving and highest-score tracking via SQLite database (`quiz_scores.db`)
- Leaderboard sorted by percentage score
- Timed quiz support with easy/hard modes
- Sound feedback for interactions and answers

## Setup

1. Ensure Python 3 is installed.
2. Install Flask and Flask-CORS if not already installed:

```bash
python3 -m pip install Flask Flask-Cors
```

3. Run the backend server from the project root:

```bash
cd '/Users/heemanshusingh/Desktop/\\\\\\w '
python3 backend/backend.py
```

The backend listens on `http://127.0.0.1:5000`.

## Usage

1. Open `Login.html` in your browser.
2. Log in using a valid `@chitkara.edu.in` email address.
3. On the dashboard, choose a programming language quiz.
4. Complete the quiz, and your score will be saved to the backend.
5. Visit `Leaderboard.html` to view saved scores.

## Backend Endpoints

- `GET /get-questions/<lang>` - Returns questions for the requested language.
- `POST /save-score` - Saves the current user score to SQLite.
- `GET /leaderboard` - Returns the leaderboard data.

## Notes

- `backend/backend.py` expects `questions.json` to be available at `../questions.json` relative to the backend folder.
- Frontend pages can be opened directly from the file system, but the backend should be running to save and retrieve scores.
- The login page stores user info in `sessionStorage` under `codemaster_user`.

