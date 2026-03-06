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

// Helper to check if two dates are consecutive days (UTC)
function isConsecutiveDay(lastDate, currentDate) {
    const d1 = new Date(lastDate);
    const d2 = new Date(currentDate);

    // Normalize both to UTC midnight
    const utc1 = Date.UTC(d1.getUTCFullYear(), d1.getUTCMonth(), d1.getUTCDate());
    const utc2 = Date.UTC(d2.getUTCFullYear(), d2.getUTCMonth(), d2.getUTCDate());

    const diffDays = Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24));
    return diffDays === 1;
}

// Helper to check if it's the same day (UTC)
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
        console.log("Error: Nickname is missing in request body");
        return res.status(400).json({ error: 'Nickname is required' });
    }

    const normalizedNickname = nickname.trim().toLowerCase();
    console.log(`\n--- Streak Request for: "${normalizedNickname}" ---`);

    try {
        const now = new Date();

        // Check if user exists
        console.log(`Checking database for user: ${normalizedNickname}`);
        const userResult = await pool.query('SELECT * FROM users WHERE LOWER(nickname) = $1', [normalizedNickname]);

        if (userResult.rows.length === 0) {
            // New user
            console.log(`User not found. Creating new user: ${normalizedNickname}`);
            const insertResult = await pool.query(
                'INSERT INTO users (nickname, streak_count, last_played) VALUES ($1, $2, $3) RETURNING streak_count',
                [normalizedNickname, 1, now]
            );
            console.log(`Successfully created user. Initial streak: 1`);
            return res.json({ streak_count: 1 });
        }

        const user = userResult.rows[0];
        let newStreak = user.streak_count;
        const lastPlayed = new Date(user.last_played);

        console.log(`User found. Last played: ${lastPlayed.toISOString()}, Current streak: ${newStreak}`);

        if (isSameDay(lastPlayed, now)) {
            console.log("User already played today. Streak remains same.");
        } else if (isConsecutiveDay(lastPlayed, now)) {
            newStreak += 1;
            console.log(`Consecutive day! Streak incremented to: ${newStreak}`);
        } else {
            newStreak = 1;
            console.log(`Day(s) missed. Streak reset to 1.`);
        }

        // Update user record
        console.log(`Updating database for ${normalizedNickname}: streak_count=${newStreak}, last_played=${now.toISOString()}`);
        const updateResult = await pool.query(
            'UPDATE users SET streak_count = $1, last_played = $2 WHERE LOWER(nickname) = $3 RETURNING streak_count',
            [newStreak, now, normalizedNickname]
        );

        if (updateResult.rowCount === 0) {
            console.error(`Failed to update streak for ${normalizedNickname}`);
            throw new Error("Update failed - user not found or database error");
        }

        console.log(`Successfully updated. Returning streak: ${newStreak}`);
        res.json({ streak_count: newStreak });
    } catch (err) {
        console.error('DATABASE ERROR in /start-quiz:', err.message);
        res.status(500).json({ error: 'Database error', detail: err.message });
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
