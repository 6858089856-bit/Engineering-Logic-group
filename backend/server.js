const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the root directory
app.use(express.static(path.join(__dirname, '..')));

// Route to serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Database Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Helper to check if two dates are consecutive days
function isConsecutiveDay(lastDate, currentDate) {
    const d1 = new Date(lastDate);
    const d2 = new Date(currentDate);

    // Set time to midnight for comparison
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);

    const diffTime = Math.abs(d2 - d1);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays === 1;
}

// Helper to check if it's the same day
function isSameDay(lastDate, currentDate) {
    const d1 = new Date(lastDate);
    const d2 = new Date(currentDate);
    return d1.getUTCFullYear() === d2.getUTCFullYear() &&
        d1.getUTCMonth() === d2.getUTCMonth() &&
        d1.getUTCDate() === d2.getUTCDate();
}

// Route to handle quiz start/streak tracking
app.post('/start-quiz', async (req, res) => {
    const { nickname } = req.body;

    if (!nickname) {
        return res.status(400).json({ error: 'Nickname is required' });
    }

    try {
        const now = new Date();

        // Check if user exists
        const userResult = await pool.query('SELECT * FROM users WHERE nickname = $1', [nickname]);

        if (userResult.rows.length === 0) {
            // New user
            const insertResult = await pool.query(
                'INSERT INTO users (nickname, streak_count, last_played) VALUES ($1, $2, $3) RETURNING streak_count',
                [nickname, 1, now]
            );
            return res.json({ streak_count: insertResult.rows[0].streak_count });
        }

        const user = userResult.rows[0];
        let newStreak = user.streak_count;

        if (isSameDay(user.last_played, now)) {
            // Already played today, streak remains same
        } else if (isConsecutiveDay(user.last_played, now)) {
            // Played yesterday, increment streak
            newStreak += 1;
        } else {
            // Missed a day or more, reset streak
            newStreak = 1;
        }

        // Update user record
        await pool.query(
            'UPDATE users SET streak_count = $1, last_played = $2 WHERE nickname = $3',
            [newStreak, now, nickname]
        );

        res.json({ streak_count: newStreak });
    } catch (err) {
        console.error('Error processing streak:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Initialize Database Table
async function initDB() {
    try {
        await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        nickname VARCHAR(50) UNIQUE NOT NULL,
        streak_count INTEGER DEFAULT 0,
        last_played TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
        console.log('Database initialized');
    } catch (err) {
        console.error('Error initializing database:', err);
    }
}

app.listen(port, async () => {
    console.log(`Server running on port ${port}`);
    await initDB();
});
