const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(express.static('public'));
app.use('/data', express.static('data'));

const USERS_FILE = path.join(__dirname, 'data/users.json');
const QUIZZES_FILE = path.join(__dirname, 'data/quizzes.json');

// Initialize files
fs.ensureFileSync(USERS_FILE);
fs.ensureFileSync(QUIZZES_FILE);

// Generate unique quiz code
function generateQuizCode() {
    return 'Q' + Math.random().toString(36).substr(2, 6).toUpperCase();
}

// Validate username/password
function isValidCredentials(username, password) {
    return /^[a-zA-Z0-9]{4,20}$/.test(username) && /^[a-zA-Z0-9]{6,20}$/.test(password);
}

// API Routes
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!isValidCredentials(username, password)) {
        return res.json({ success: false, error: 'Username/password must be 4-20 chars, letters/numbers only' });
    }
    
    const users = await fs.readJson(USERS_FILE).catch(() => ([]));
    if (users.find(u => u.username === username)) {
        return res.json({ success: false, error: 'Username already exists' });
    }
    
    users.push({ username, password, stats: { quizzesPlayed: 0, totalPoints: 0, wins: 0 } });
    await fs.writeJson(USERS_FILE, users);
    res.json({ success: true });
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const users = await fs.readJson(USERS_FILE).catch(() => ([]));
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        res.json({ success: true, user });
    } else {
        res.json({ success: false, error: 'Invalid credentials' });
    }
});

app.get('/api/quizzes/:username', async (req, res) => {
    const quizzes = await fs.readJson(QUIZZES_FILE).catch(() => ([]));
    res.json(quizzes.filter(q => q.owner === req.params.username));
});

app.post('/api/create-quiz', async (req, res) => {
    const quiz = { ...req.body, quizCode: generateQuizCode(), id: Date.now() };
    const quizzes = await fs.readJson(QUIZZES_FILE).catch(() => ([]));
    quizzes.push(quiz);
    await fs.writeJson(QUIZZES_FILE, quizzes);
    res.json({ success: true, quizCode: quiz.quizCode });
});

app.get('/api/quiz/:quizCode', async (req, res) => {
    const quizzes = await fs.readJson(QUIZZES_FILE).catch(() => ([]));
    const quiz = quizzes.find(q => q.quizCode === req.params.quizCode);
    res.json(quiz || { error: 'Quiz not found' });
});

app.post('/api/submit-quiz', async (req, res) => {
    const { username, score } = req.body;
    const users = await fs.readJson(USERS_FILE).catch(() => ([]));
    const user = users.find(u => u.username === username);
    if (user) {
        user.stats.quizzesPlayed++;
        user.stats.totalPoints += score;
        if (score > 80) user.stats.wins++;
        await fs.writeJson(USERS_FILE, users);
        res.json({ success: true });
    }
});

app.listen(PORT, () => console.log(`Quizwe running on http://localhost:${PORT}`));
