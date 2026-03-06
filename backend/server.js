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

// Route to serve docs.html
app.get('/docs', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'docs.html'));
});

// Route to fetch leaderboard data
app.get('/leaderboard', async (req, res) => {
    try {
        const result = await pool.query('SELECT nickname, streak_count FROM users ORDER BY streak_count DESC LIMIT 50');
        res.json(result.rows);
    } catch (err) {
        console.error('DATABASE ERROR in /leaderboard:', err.message);
        res.status(500).json({ error: 'Database error' });
    }
});

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

// Route to handle quiz start/play count tracking
app.post('/start-quiz', async (req, res) => {
    const { nickname } = req.body;

    if (!nickname) {
        console.log("Error: Nickname is missing in request body");
        return res.status(400).json({ error: 'Nickname is required' });
    }

    const normalizedNickname = nickname.trim().toLowerCase();
    console.log(`\n--- Play Count Request for: "${normalizedNickname}" ---`);

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
            console.log(`Successfully created user. Initial play count: 1`);
            return res.json({ streak_count: 1 });
        }

        const user = userResult.rows[0];
        const newPlayCount = user.streak_count + 1;

        console.log(`User found. Current total plays: ${user.streak_count}. Incrementing to: ${newPlayCount}`);

        // Update user record
        console.log(`Updating database for ${normalizedNickname}: streak_count=${newPlayCount}, last_played=${now.toISOString()}`);
        const updateResult = await pool.query(
            'UPDATE users SET streak_count = $1, last_played = $2 WHERE LOWER(nickname) = $3 RETURNING streak_count',
            [newPlayCount, now, normalizedNickname]
        );

        if (updateResult.rowCount === 0) {
            console.error(`Failed to update play count for ${normalizedNickname}`);
            throw new Error("Update failed - user not found or database error");
        }

        console.log(`Successfully updated. Returning total plays: ${newPlayCount}`);
        res.json({ streak_count: newPlayCount });
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
