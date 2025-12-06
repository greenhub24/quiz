const API_BASE = '/api';
let currentUser = null;

// Utility functions
async function apiCall(endpoint, method = 'GET', data = null) {
    const options = { method, headers: { 'Content-Type': 'application/json' } };
    if (data) options.body = JSON.stringify(data);
    const res = await fetch(`${API_BASE}${endpoint}`, options);
    return res.json();
}

// Create Account
async function register() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const result = await apiCall('/register', 'POST', { username, password });
    if (result.success) {
        alert('Account created! Redirecting to dashboard...');
        window.location.href = 'dashboard.html';
    } else {
        alert(result.error);
    }
}

// Login (simple - uses same form)
async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const result = await apiCall('/login', 'POST', { username, password });
    if (result.success) {
        currentUser = result.user;
        localStorage.setItem('quizwe_user', JSON.stringify(currentUser));
        window.location.href = 'dashboard.html';
    } else {
        alert(result.error);
    }
}

// Load dashboard
async function loadDashboard() {
    currentUser = JSON.parse(localStorage.getItem('quizwe_user'));
    if (!currentUser) return window.location.href = 'create_account.html';
    
    document.getElementById('user-welcome').textContent = `Welcome, ${currentUser.username}!`;
    document.getElementById('user-stats').innerHTML = `
        <div class="stat-card"><h3>${currentUser.stats.quizzesPlayed}</h3><p>Quizzes Played</p></div>
        <div class="stat-card"><h3>${currentUser.stats.totalPoints}</h3><p>Total Points</p></div>
        <div class="stat-card"><h3>${currentUser.stats.wins}</h3><p>Wins</p></div>
    `;
    
    const quizzes = await apiCall(`/quizzes/${currentUser.username}`);
    displayQuizzes(quizzes);
}

// Display quizzes with search/filter
function displayQuizzes(quizzes) {
    const container = document.getElementById('quizzes-container');
    container.innerHTML = quizzes.map(q => `
        <div class="quiz-card" onclick="playQuiz('${q.quizCode}')">
            <h3>${q.title}</h3>
            <p>Grade: ${q.grade} | Level: ${q.level}</p>
            <p>Code: ${q.quizCode}</p>
            <p>${q.questions.length} questions</p>
        </div>
    `).join('');
}

// Create quiz
async function createQuiz() {
    const formData = {
        owner: currentUser.username,
        title: document.getElementById('quiz-title').value,
        grade: document.getElementById('quiz-grade').value,
        level: document.getElementById('quiz-level').value,
        questions: JSON.parse(document.getElementById('quiz-questions').value)
    };
    const result = await apiCall('/create-quiz', 'POST', formData);
    if (result.success) {
        alert(`Quiz created! Share code: ${result.quizCode}`);
        window.location.href = 'dashboard.html';
    }
}

// Join quiz by code
async function joinQuiz() {
    const quizCode = document.getElementById('quiz-code').value;
    const quiz = await apiCall(`/quiz/${quizCode}`);
    if (quiz.error) return alert('Quiz not found');
    localStorage.setItem('current_quiz', JSON.stringify(quiz));
    window.location.href = 'quiz_play.html';
}

// Play quiz
function playQuiz(quizCode) {
    localStorage.setItem('current_quiz', JSON.stringify({ quizCode }));
    window.location.href = 'quiz_play.html';
}

// Quiz player logic
let currentQuestion = 0;
let score = 0;
let timeLeft = 0;
let timer;

async function loadQuiz() {
    const quizData = localStorage.getItem('current_quiz');
    if (!quizData) return window.location.href = 'dashboard.html';
    
    const quiz = JSON.parse(quizData).quizCode ? 
        (await apiCall(`/quiz/${JSON.parse(quizData).quizCode}`)) : 
        JSON.parse(quizData);
    
    document.getElementById('quiz-title').textContent = quiz.title;
    showQuestion(quiz);
}

function showQuestion(quiz) {
    const q = quiz.questions[currentQuestion];
    document.getElementById('question-text').textContent = q.question;
    document.getElementById('options').innerHTML = q.options.map((opt, i) => 
        `<button class="btn" onclick="selectAnswer('${opt}', '${q.correct}')">${opt}</button>`
    ).join('');
    document.getElementById('question-count').textContent = `${currentQuestion + 1}/${quiz.questions.length}`;
    startTimer(30); // 30s per question
}

function selectAnswer(selected, correct) {
    clearInterval(timer);
    if (selected === correct) score += 10;
    nextQuestion();
}

function nextQuestion() {
    currentQuestion++;
    const quizData = JSON.parse(localStorage.getItem('current_quiz'));
    if (currentQuestion >= quizData.questions?.length || !quizData.questions) {
        finishQuiz();
    } else {
        showQuestion(quizData);
    }
}

function startTimer(seconds) {
    timeLeft = seconds;
    document.getElementById('timer').textContent = timeLeft;
    timer = setInterval(() => {
        timeLeft--;
        document.getElementById('timer').textContent = timeLeft;
        if (timeLeft <= 0) nextQuestion();
    }, 1000);
}

async function finishQuiz() {
    await apiCall('/submit-quiz', 'POST', { 
        username: currentUser.username, 
        score: Math.round(score / 10 * 100) 
    });
    alert(`Quiz Complete! Score: ${Math.round(score / 10 * 100)}%`);
    window.location.href = 'dashboard.html';
}

// Search and filter quizzes
function searchQuizzes() {
    const search = document.getElementById('search').value.toLowerCase();
    const grade = document.getElementById('filter-grade').value;
    const level = document.getElementById('filter-level').value;
    
    loadDashboard().then(() => {
        const quizzes = JSON.parse(localStorage.getItem('user_quizzes') || '[]');
        const filtered = quizzes.filter(q => 
            q.title.toLowerCase().includes(search) &&
            (!grade || q.grade === grade) &&
            (!level || q.level === level)
        );
        displayQuizzes(filtered);
    });
}

// Initialize pages
if (window.location.pathname.includes('dashboard')) loadDashboard();
if (window.location.pathname.includes('quiz_play')) loadQuiz();
if (window.location.pathname.includes('create_account')) {
    document.getElementById('account-form').onsubmit = (e) => {
        e.preventDefault();
        document.getElementById('login-btn').style.display = 'none';
        register(); // Default to register
    };
}
// Fix for create_quiz form submission
if (window.location.pathname.includes('create_quiz')) {
    document.getElementById('quiz-form').onsubmit = async (e) => {
        e.preventDefault();
        try {
            const questions = JSON.parse(document.getElementById('quiz-questions').value);
            const formData = {
                title: document.getElementById('quiz-title').value,
                grade: document.getElementById('quiz-grade').value,
                level: document.getElementById('quiz-level').value,
                questions
            };
            const result = await apiCall('/create-quiz', 'POST', formData);
            if (result.success) {
                alert(`✅ Quiz created successfully!\nShare this code: ${result.quizCode}`);
                window.location.href = 'dashboard.html';
            }
        } catch (e) {
            alert('❌ Invalid JSON format for questions');
        }
    };
}

// Update score display during quiz
function updateScoreDisplay() {
    document.getElementById('current-score').textContent = Math.round(score / 10 * 100);
}

// Update showQuestion to call updateScoreDisplay
function showQuestion(quiz) {
    const q = quiz.questions[currentQuestion];
    document.getElementById('question-text').textContent = q.question;
    document.getElementById('options').innerHTML = q.options.map((opt, i) => 
        `<button class="btn" style="width: 100%; padding: 1rem; margin: 0.5rem 0;" onclick="selectAnswer('${opt}', '${q.correct}')">${opt}</button>`
    ).join('');
    document.getElementById('question-count').textContent = `${currentQuestion + 1}/${quiz.questions.length}`;
    updateScoreDisplay();
    startTimer(30);
}

// Update selectAnswer
function selectAnswer(selected, correct) {
    clearInterval(timer);
    if (selected === correct) {
        score += 10;
        updateScoreDisplay();
    }
    setTimeout(nextQuestion, 1000); // Show answer for 1 second
}
