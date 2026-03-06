from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
import os

app = Flask(__name__)
CORS(app)

# Database connection configuration
DATABASE_URL = os.environ.get('DATABASE_URL')
DB_HOST = os.environ.get('DB_HOST', 'localhost')
DB_NAME = os.environ.get('DB_NAME', 'consonant_drill')
DB_USER = os.environ.get('DB_USER', 'postgres')
DB_PASS = os.environ.get('DB_PASS', 'password')

def get_db_connection():
    if DATABASE_URL:
        # Direct URL connection (best for Render)
        return psycopg2.connect(DATABASE_URL, sslmode='require')
    
    # Standard connection
    return psycopg2.connect(
        host=DB_HOST,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASS
    )

@app.route('/start-quiz', methods=['POST'])
def start_quiz():
    data = request.json
    nickname = data.get('nickname')
    
    if not nickname:
        return jsonify({'error': 'Nickname is required'}), 400
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        # Upsert user and increment streak
        cur.execute(
            """
            INSERT INTO users (nickname, streak_count)
            VALUES (%s, 1)
            ON CONFLICT (nickname)
            DO UPDATE SET streak_count = users.streak_count + 1
            RETURNING streak_count;
            """,
            (nickname,)
        )
        streak_count = cur.fetchone()[0]
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        cur.close()
        conn.close()
    
    return jsonify({
        'nickname': nickname,
        'streak_count': streak_count
    })

if __name__ == '__main__':
    app.run(debug=True, port=5001)
