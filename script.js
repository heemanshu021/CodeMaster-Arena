// 1. BACKEND URL
const BACKEND_URL = 'http://127.0.0.1:5000';

// 2. DATA DEFINITIONS
const languages = [
    { id: "html", name: "HTML5", icon: "🌐", qCount: 13, color: "#e34c26" },
    { id: "css", name: "CSS3", icon: "🎨", qCount: 13, color: "#264de4" },
    { id: "js", name: "JavaScript", icon: "🟨", qCount: 14, color: "#f7df1e" },
    { id: "py", name: "Python", icon: "🐍", qCount: 12, color: "#3776ab" },
    { id: "c", name: "C Programming", icon: "🔵", qCount: 10, color: "#a8b9cc" }
];

// 3. CONFIGURATION & STATE
let user = null;
try {
    user = JSON.parse(sessionStorage.getItem("codemaster_user")?? "null");
} catch (e) {
    console.error("Session parse error:", e);
}

if (!user) {
    alert("Do Login first!");
    window.location.href = "Login.html";
}

const langId = localStorage.getItem("selectedLang") || "html";
const lang = languages.find(l => l.id === langId) || languages[0];

let phase = "difficulty";
let mode = "easy";
let questions = [];
let currentQ = 0;
let score = 0;
let answered = false;
let selectedIdx = -1;
let answerResults = [];

// TIMER VARIABLES
let totalTimeLeft = 600; // 10 MIN total for hard mode
let questionTimeLeft = 20; // 20 SEC per question for hard mode
let totalTimerInterval = null;
let questionTimerInterval = null;
let quizStartTime = null;

let questionsData = {};

function getBestScoreKey() {
    const email = user?.email?? "guest";
    return `codemaster_best_${email}_${lang.id}`;
}
function getBestScore() {
    return parseInt(localStorage.getItem(getBestScoreKey())?? "0", 10);
}
function saveBestScore(s) {
    if (s > getBestScore()) localStorage.setItem(getBestScoreKey(), s);
}

const quizAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playCorrectSound() {
    if (quizAudioCtx.state === 'suspended') quizAudioCtx.resume();
    const osc = quizAudioCtx.createOscillator();
    const gain = quizAudioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523, quizAudioCtx.currentTime);
    osc.frequency.setValueAtTime(659, quizAudioCtx.currentTime + 0.1);
    osc.frequency.setValueAtTime(784, quizAudioCtx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.15, quizAudioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, quizAudioCtx.currentTime + 0.4);
    osc.connect(gain); gain.connect(quizAudioCtx.destination);
    osc.start(); osc.stop(quizAudioCtx.currentTime + 0.4);
}
function playWrongSound() {
    if (quizAudioCtx.state === 'suspended') quizAudioCtx.resume();
    const osc = quizAudioCtx.createOscillator();
    const gain = quizAudioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, quizAudioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, quizAudioCtx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.12, quizAudioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, quizAudioCtx.currentTime + 0.3);
    osc.connect(gain); gain.connect(quizAudioCtx.destination);
    osc.start(); osc.stop(quizAudioCtx.currentTime + 0.3);
}

const app = document.getElementById("app");

// 4. BACKEND FUNCTIONS
function getQuestionsFromBackend() {
    console.log("Asking Questions from Python for:", lang.id);

    fetch(BACKEND_URL + '/get-questions/' + lang.id)
    .then(function(response) {
            if (!response.ok) {
                throw new Error('Backend error: ' + response.status);
            }
            return response.json();
        })
    .then(function(data) {
            console.log("Got the Questions from Backend:", data);
            questionsData[lang.id] = data;
            phase = "difficulty";
            render();
        })
    .catch(function(error) {
            console.log("Was not able to connect with Backend:", error);
            app.innerHTML = `
                <div class="glass-card" style="padding:2rem; text-align:center;">
                    <h2 style="color:var(--danger);">⚠️ Backend is close</h2>
                    <p>Start Sython server in the Terminal:</p>
                    <code style="background:#000; padding:0.5rem; display:block; margin:1rem 0;">python backend.py</code>
                    <button onclick="location.reload()" style="background:var(--primary); color:white; padding:0.5rem 1rem; border-radius:4px;">Retry</button>
                </div>
            `;
        });
}

function saveResultsToLeaderboard() {
    const scoreData = {
        email: user.email,
        name: user.name,
        lang: lang.name,
        score: score,
        total: questions.length
    };
    console.log("Sending Scores to Python:", scoreData);
    fetch(BACKEND_URL + '/save-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scoreData)
    })
.then(res => res.json())
.then(data => console.log("Python said:", data))
.catch(err => console.log("Score could not be saved:", err));

    saveBestScore(Math.round((score / questions.length) * 100));
}

// 5. UTILITIES
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}
function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// 6. LOGIC HANDLERS
function initQuiz(m) {
    mode = m;
    phase = "quiz";
    const sourceData = questionsData[lang.id]?? [];
    if (sourceData.length === 0) {
        alert("Questions did not load. Check!");
        return;
    }
    questions = shuffleArray([...sourceData]);
    currentQ = 0;
    score = 0;
    answerResults = [];
    quizStartTime = Date.now();

    // Hard mode = 2 timers
    if (mode === 'hard') {
        totalTimeLeft = 600; // 10 min total
        questionTimeLeft = 20; // 20 sec per question
        startTotalTimer();
        startQuestionTimer();
    }
    render();
}

function startTotalTimer() {
    if (mode!== 'hard') return;
    clearInterval(totalTimerInterval);
    totalTimerInterval = setInterval(() => {
        totalTimeLeft--;
        updateTimerDisplay();
        if (totalTimeLeft <= 0) {
            clearInterval(totalTimerInterval);
            clearInterval(questionTimerInterval);
            alert("Total time's up! Auto-submitting quiz.");
            phase = "results";
            saveResultsToLeaderboard();
            render();
        }
    }, 1000);
}

function startQuestionTimer() {
    if (mode!== 'hard') return;
    clearInterval(questionTimerInterval);
    questionTimeLeft = 20; // Reset to 20 for each question
    questionTimerInterval = setInterval(() => {
        questionTimeLeft--;
        updateTimerDisplay();
        if (questionTimeLeft <= 0) {
            clearInterval(questionTimerInterval);
            handleAnswer(-1); // Auto-submit as wrong
        }
    }, 1000);
}

function updateTimerDisplay() {
    const totalTimerEl = document.getElementById("totalTimerDisplay");
    const qTimerEl = document.getElementById("questionTimerDisplay");
    if (totalTimerEl) {
        totalTimerEl.textContent = `Total: ${formatTime(totalTimeLeft)}`;
        if (totalTimeLeft <= 60) totalTimerEl.style.color = 'var(--danger)';
    }
    if (qTimerEl) {
        qTimerEl.textContent = `${questionTimeLeft}s`;
        if (questionTimeLeft <= 5) qTimerEl.style.color = 'var(--danger)';
        else qTimerEl.style.color = 'var(--primary)';
    }
}

function handleAnswer(idx) {
    if (answered) return;
    clearInterval(questionTimerInterval); // Stop question timer
    answered = true;
    selectedIdx = idx;
    const isCorrect = idx === (questions[currentQ]?.a?? null);
    if (isCorrect) { score++; playCorrectSound(); } else { playWrongSound(); }
    answerResults.push({ q: questions[currentQ]?.q, correct: isCorrect });
    render();
}

function nextQuestion() {
    answered = false;
    selectedIdx = -1;
    currentQ++;
    if (currentQ < questions.length) {
        if (mode === 'hard') startQuestionTimer(); // Start 20s timer for next Q
        render();
    } else {
        clearInterval(totalTimerInterval);
        clearInterval(questionTimerInterval);
        phase = "results";
        saveResultsToLeaderboard();
        render();
    }
}

// 7. VIEW ENGINE
function render() {
    if (phase === "difficulty") renderDifficulty();
    else if (phase === "quiz") renderQuiz();
    else if (phase === "results") renderResults();
}

function renderDifficulty() {
    app.innerHTML = `
        <h1 style="font-size:1.875rem; font-weight:700; margin-bottom:0.5rem;" class="animate-slide-up">Select Difficulty</h1>
        <p style="color:var(--fg-muted); margin-bottom:2rem;" class="animate-slide-up">
            Choose your challenge mode for <strong style="color:var(--primary);">${lang.name}</strong>
        </p>
        <div class="diff-grid animate-slide-up" role="group" aria-label="Difficulty Levels">
            <div class="glass-card diff-card easy" role="button" tabindex="0" onclick="initQuiz('easy')" onkeypress="if(event.key==='Enter') initQuiz('easy')">
                <div style="font-size:2.5rem; margin-bottom:1rem;" aria-hidden="true">🛡️</div>
                <h2 style="font-size:1.25rem; font-weight:700; margin-bottom:0.5rem;">Easy Mode</h2>
                <ul style="list-style:none; font-size:0.875rem; color:var(--fg-muted); padding:0;">
                    <li>• No time constraints</li>
                    <li>• Beginner friendly</li>
                    <li>• Detailed explanations</li>
                </ul>
            </div>
            <div class="glass-card diff-card hard" role="button" tabindex="0" onclick="initQuiz('hard')" onkeypress="if(event.key==='Enter') initQuiz('hard')">
                <div style="font-size:2.5rem; margin-bottom:1rem;" aria-hidden="true">⚡</div>
                <h2 style="font-size:1.25rem; font-weight:700; margin-bottom:0.5rem;">Hard Mode</h2>
                <ul style="list-style:none; font-size:0.875rem; color:var(--fg-muted); padding:0;">
                    <li>• 20s per question</li>
                    <li>• 10 min total time</li>
                    <li>• Auto-submit on timeout</li>
                </ul>
            </div>
        </div>
    `;
}

function renderQuiz() {
    const q = questions[currentQ];
    if (!q) return;
    app.innerHTML = `
        <div class="quiz-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:1rem;">
            <div aria-label="Progress" style="font-weight:600;">Question ${currentQ + 1} of ${questions.length}</div>
            ${mode === 'hard'? `
                <div style="display:flex; gap:1rem; align-items:center;">
                    <div id="questionTimerDisplay" style="color:var(--primary); font-weight:bold; font-family:'JetBrains Mono'; font-size:1.1rem; padding:0.5rem 1rem; background:rgba(99,102,241,0.1); border-radius:8px;">
                        ${questionTimeLeft}s
                    </div>
                    <div id="totalTimerDisplay" style="color:var(--fg-muted); font-weight:bold; font-family:'JetBrains Mono'; font-size:1rem;">
                        Total: ${formatTime(totalTimeLeft)}
                    </div>
                </div>
            ` : ''}
        </div>
        <h2 style="font-size:1.5rem; margin-bottom:2rem;">${escapeHtml(q.q)}</h2>
        <div class="options-list" role="radiogroup" aria-label="Answers">
            ${q.o.map((opt, i) => `
                <button class="option-btn glass-card ${answered? (i === q.a? 'correct' : (i === selectedIdx? 'wrong' : '')) : ''}"
                        onclick="handleAnswer(${i})"
                        ${answered? 'disabled' : ''}
                        style="width:100%; text-align:left; padding:1rem; margin-bottom:1rem; cursor:pointer;">
                    ${escapeHtml(opt)}
                </button>
            `).join("")}
        </div>
        ${answered? `
            <div class="explanation glass-card animate-slide-up" style="padding:1rem; margin-top:1rem; border-left:4px solid var(--primary);">
                <p><strong>Explanation:</strong> ${q.explanation}</p>
                <button class="nav-link-btn" onclick="nextQuestion()" style="margin-top:1rem; background:var(--primary); color:white; padding:0.5rem 1rem; border-radius:4px;">Next Question →</button>
            </div>
        ` : ''}
    `;
}

function renderResults() {
    clearInterval(totalTimerInterval);
    clearInterval(questionTimerInterval);
    const total = questions.length || 1;
    const percent = Math.round((score / total) * 100);
    const bestScore = getBestScore();
    const wrongCount = total - score;
    const timeTaken = quizStartTime? Math.floor((Date.now() - quizStartTime) / 1000) : 0;

    app.innerHTML = `
        <div class="results-container animate-slide-up" style="text-align:center;">
            <h1 style="font-size:2.5rem; margin-bottom:1rem;">Quiz Complete!</h1>
            <div class="score-circle animate-bounce" style="font-size:3rem; font-weight:bold; color:var(--primary); margin-bottom:1rem;">
                ${score} / ${questions.length}
            </div>
            <p style="font-size:1.2rem; color:var(--fg-muted); margin-bottom:0.5rem;">You scored ${percent}%</p>
            <p style="font-size:0.95rem; color:var(--fg-muted); margin-bottom:1.5rem;">
                🏆 Best Score: <strong style="color:var(--primary);">${bestScore}%</strong>
                &nbsp;|&nbsp; Mode: <strong>${mode.toUpperCase()}</strong>
                &nbsp;|&nbsp; Time: <strong>${formatTime(timeTaken)}</strong>
                &nbsp;|&nbsp; Saved to Leaderboard ✅
            </p>
            <div class="glass-card animate-slide-up" style="padding:1.5rem; margin-bottom:1.5rem; display:inline-block; width:100%; max-width:500px; box-sizing:border-box;">
                <h3 style="margin-bottom:1rem; font-size:1rem;">📊 Performance Breakdown</h3>
                <canvas id="resultChart" width="400" height="260" style="max-width:100%;"></canvas>
            </div>
            <div style="display:flex; gap:1rem; justify-content:center; flex-wrap:wrap;">
                <button class="nav-link-btn" onclick="location.reload()" style="background:var(--primary); color:white; padding:1rem 2rem; border-radius:8px;">Try Again</button>
                <button class="nav-link-btn" onclick="window.location.href='Main.html'" style="padding:1rem 2rem;">Back to Home</button>
                <button class="nav-link-btn" onclick="window.location.href='Leaderboard.html'" style="padding:1rem 2rem;">🏆 Leaderboard</button>
            </div>
        </div>
    `;

    setTimeout(() => {
        const canvas = document.getElementById('resultChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        const W = rect.width || 400;
        const H = 260;

        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        ctx.scale(dpr, dpr);

        const bars = [
            { label: '✅ Correct', value: score, color: '#22c55e' },
            { label: '❌ Wrong', value: wrongCount, color: '#ef4444' },
            { label: '📈 Score %', value: percent, color: '#6366f1' },
            { label: '🏆 Best %', value: bestScore, color: '#f59e0b' }
        ];

        const maxVal = Math.max(...bars.map(b => b.value), 1, 100);
        const barW = (W - 60) / bars.length - 12;
        const bottomPad = 40, topPad = 16;
        const chartH = H - bottomPad - topPad;

        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        [0.25, 0.5, 0.75, 1].forEach(f => {
            const y = topPad + chartH * (1 - f);
            ctx.beginPath();
            ctx.moveTo(40, y);
            ctx.lineTo(W - 10, y);
            ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.font = '10px JetBrains Mono';
            ctx.textAlign = 'right';
            ctx.fillText(Math.round(maxVal * f), 36, y + 4);
        });

        bars.forEach((bar, i) => {
            const x = 44 + i * (barW + 12);
            const targetHeight = (bar.value / maxVal) * chartH;
            const y = topPad + chartH - targetHeight;

            const grad = ctx.createLinearGradient(0, y, 0, y + targetHeight);
            grad.addColorStop(0, bar.color);
            grad.addColorStop(1, bar.color + '88');
            ctx.fillStyle = grad;

            const r = 6;
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + barW - r, y);
            ctx.quadraticCurveTo(x + barW, y, x + barW, y + r);
            ctx.lineTo(x + barW, y + targetHeight);
            ctx.lineTo(x, y + targetHeight);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px JetBrains Mono';
            ctx.textAlign = 'center';
            ctx.fillText(bar.value + (i >= 2? '%' : ''), x + barW / 2, Math.max(y - 8, topPad + 10));

            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.font = '9px Space Grotesk';
            ctx.fillText(bar.label, x + barW / 2, H - 8);
        });
    }, 100);
}

// 8. START THE APP
getQuestionsFromBackend();

// Sci-fi audio
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playInteractionSound() {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.04);
  gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);
  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  oscillator.start();
  oscillator.stop(audioCtx.currentTime + 0.04);
}
document.addEventListener('DOMContentLoaded', () => {
    const interactiveElements = document.querySelectorAll('.lang-card,.diff-card,.btn-login,.option-btn,.nav-link-btn,.feature-card');
    interactiveElements.forEach(element => {
      element.addEventListener('mouseenter', () => playInteractionSound());
    });
});