"""
Medicine Reminder System - Main Flask Application
A comprehensive smart healthcare assistant with medicine reminders,
prescription management, AI chatbot, voice notifications, and pharmacy locator.
"""

import os
import sqlite3
import json
from datetime import datetime, timedelta
from functools import wraps

from flask import (
    Flask, render_template, request, redirect, url_for,
    session, flash, jsonify, send_from_directory
)
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-prod')
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 MB max upload

# Allowed file extensions for prescriptions
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'pdf'}

# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# ──────────────────────────────────────────────
# Database Initialization
# ──────────────────────────────────────────────

DATABASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'database.db')


def get_db():
    """Get a database connection with row factory enabled."""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize the database with required tables."""
    conn = get_db()
    cursor = conn.cursor()

    # Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            full_name TEXT,
            phone TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Medicines table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS medicines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            dosage TEXT NOT NULL,
            frequency TEXT NOT NULL,
            reminder_time TEXT NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT,
            notes TEXT,
            is_active INTEGER DEFAULT 1,
            completed_count INTEGER DEFAULT 0,
            total_count INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')

    # Prescriptions table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS prescriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            filename TEXT NOT NULL,
            original_name TEXT NOT NULL,
            description TEXT,
            doctor_name TEXT,
            upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')

    # Reminder logs table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS reminder_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            medicine_id INTEGER NOT NULL,
            reminded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'pending',
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (medicine_id) REFERENCES medicines (id)
        )
    ''')

    conn.commit()
    conn.close()


# Initialize database on startup
init_db()


# ──────────────────────────────────────────────
# Authentication Decorator
# ──────────────────────────────────────────────

def login_required(f):
    """Decorator to protect routes that require authentication."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash('Please log in to access this page.', 'warning')
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function


def allowed_file(filename):
    """Check if the uploaded file has an allowed extension."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


# ──────────────────────────────────────────────
# Public Routes
# ──────────────────────────────────────────────

@app.route('/')
def index():
    """Landing page."""
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return render_template('index.html')


@app.route('/register', methods=['GET', 'POST'])
def register():
    """User registration."""
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        email = request.form.get('email', '').strip()
        password = request.form.get('password', '')
        confirm_password = request.form.get('confirm_password', '')
        full_name = request.form.get('full_name', '').strip()
        phone = request.form.get('phone', '').strip()

        # Validation
        if not username or not email or not password:
            flash('All fields are required.', 'error')
            return render_template('register.html')

        if password != confirm_password:
            flash('Passwords do not match.', 'error')
            return render_template('register.html')

        if len(password) < 6:
            flash('Password must be at least 6 characters long.', 'error')
            return render_template('register.html')

        # Check if user already exists
        conn = get_db()
        existing = conn.execute(
            'SELECT id FROM users WHERE username = ? OR email = ?',
            (username, email)
        ).fetchone()

        if existing:
            conn.close()
            flash('Username or email already exists.', 'error')
            return render_template('register.html')

        # Create new user
        hashed_password = generate_password_hash(password)
        conn.execute(
            'INSERT INTO users (username, email, password, full_name, phone) VALUES (?, ?, ?, ?, ?)',
            (username, email, hashed_password, full_name, phone)
        )
        conn.commit()
        conn.close()

        flash('Registration successful! Please log in.', 'success')
        return redirect(url_for('login'))

    return render_template('register.html')


@app.route('/login', methods=['GET', 'POST'])
def login():
    """User login."""
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')

        conn = get_db()
        user = conn.execute(
            'SELECT * FROM users WHERE username = ? OR email = ?',
            (username, username)
        ).fetchone()
        conn.close()

        if user and check_password_hash(user['password'], password):
            session['user_id'] = user['id']
            session['username'] = user['username']
            session['full_name'] = user['full_name'] or user['username']
            flash(f'Welcome back, {session["full_name"]}!', 'success')
            return redirect(url_for('dashboard'))
        else:
            flash('Invalid username or password.', 'error')

    return render_template('login.html')


@app.route('/logout')
def logout():
    """User logout."""
    session.clear()
    flash('You have been logged out.', 'info')
    return redirect(url_for('index'))


# ──────────────────────────────────────────────
# Dashboard
# ──────────────────────────────────────────────

@app.route('/dashboard')
@login_required
def dashboard():
    """Main dashboard view."""
    conn = get_db()
    user_id = session['user_id']

    # Get active medicines
    medicines = conn.execute(
        'SELECT * FROM medicines WHERE user_id = ? AND is_active = 1 ORDER BY reminder_time',
        (user_id,)
    ).fetchall()

    # Get today's reminders
    today = datetime.now().strftime('%Y-%m-%d')
    today_medicines = conn.execute(
        '''SELECT * FROM medicines WHERE user_id = ? AND is_active = 1 
           AND start_date <= ? AND (end_date IS NULL OR end_date >= ?)
           ORDER BY reminder_time''',
        (user_id, today, today)
    ).fetchall()

    # Get stats
    total_medicines = conn.execute(
        'SELECT COUNT(*) as count FROM medicines WHERE user_id = ?',
        (user_id,)
    ).fetchone()['count']

    active_medicines = conn.execute(
        'SELECT COUNT(*) as count FROM medicines WHERE user_id = ? AND is_active = 1',
        (user_id,)
    ).fetchone()['count']

    total_prescriptions = conn.execute(
        'SELECT COUNT(*) as count FROM prescriptions WHERE user_id = ?',
        (user_id,)
    ).fetchone()['count']

    completed_reminders = conn.execute(
        'SELECT COUNT(*) as count FROM reminder_logs WHERE user_id = ? AND status = "taken"',
        (user_id,)
    ).fetchone()['count']

    # Recent prescriptions
    prescriptions = conn.execute(
        'SELECT * FROM prescriptions WHERE user_id = ? ORDER BY upload_date DESC LIMIT 5',
        (user_id,)
    ).fetchall()

    conn.close()

    stats = {
        'total_medicines': total_medicines,
        'active_medicines': active_medicines,
        'total_prescriptions': total_prescriptions,
        'completed_reminders': completed_reminders
    }

    return render_template('dashboard.html',
                           medicines=medicines,
                           today_medicines=today_medicines,
                           prescriptions=prescriptions,
                           stats=stats)


# ──────────────────────────────────────────────
# Medicine Management API
# ──────────────────────────────────────────────

@app.route('/api/medicines', methods=['GET'])
@login_required
def get_medicines():
    """Get all medicines for the logged-in user."""
    conn = get_db()
    medicines = conn.execute(
        'SELECT * FROM medicines WHERE user_id = ? ORDER BY created_at DESC',
        (session['user_id'],)
    ).fetchall()
    conn.close()
    return jsonify([dict(m) for m in medicines])


@app.route('/api/medicines', methods=['POST'])
@login_required
def add_medicine():
    """Add a new medicine."""
    data = request.get_json()

    name = data.get('name', '').strip()
    dosage = data.get('dosage', '').strip()
    frequency = data.get('frequency', '').strip()
    reminder_time = data.get('reminder_time', '').strip()
    start_date = data.get('start_date', '').strip()
    end_date = data.get('end_date', '').strip() or None
    notes = data.get('notes', '').strip() or None

    if not all([name, dosage, frequency, reminder_time, start_date]):
        return jsonify({'error': 'All required fields must be filled.'}), 400

    conn = get_db()
    cursor = conn.execute(
        '''INSERT INTO medicines (user_id, name, dosage, frequency, reminder_time, start_date, end_date, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
        (session['user_id'], name, dosage, frequency, reminder_time, start_date, end_date, notes)
    )
    medicine_id = cursor.lastrowid
    conn.commit()

    medicine = conn.execute('SELECT * FROM medicines WHERE id = ?', (medicine_id,)).fetchone()
    conn.close()

    return jsonify(dict(medicine)), 201


@app.route('/api/medicines/<int:med_id>', methods=['PUT'])
@login_required
def update_medicine(med_id):
    """Update an existing medicine."""
    data = request.get_json()
    conn = get_db()

    # Verify ownership
    medicine = conn.execute(
        'SELECT * FROM medicines WHERE id = ? AND user_id = ?',
        (med_id, session['user_id'])
    ).fetchone()

    if not medicine:
        conn.close()
        return jsonify({'error': 'Medicine not found.'}), 404

    conn.execute(
        '''UPDATE medicines SET name = ?, dosage = ?, frequency = ?, reminder_time = ?,
           start_date = ?, end_date = ?, notes = ?, is_active = ?
           WHERE id = ? AND user_id = ?''',
        (
            data.get('name', medicine['name']),
            data.get('dosage', medicine['dosage']),
            data.get('frequency', medicine['frequency']),
            data.get('reminder_time', medicine['reminder_time']),
            data.get('start_date', medicine['start_date']),
            data.get('end_date', medicine['end_date']),
            data.get('notes', medicine['notes']),
            data.get('is_active', medicine['is_active']),
            med_id,
            session['user_id']
        )
    )
    conn.commit()

    updated = conn.execute('SELECT * FROM medicines WHERE id = ?', (med_id,)).fetchone()
    conn.close()

    return jsonify(dict(updated))


@app.route('/api/medicines/<int:med_id>', methods=['DELETE'])
@login_required
def delete_medicine(med_id):
    """Delete a medicine."""
    conn = get_db()

    medicine = conn.execute(
        'SELECT * FROM medicines WHERE id = ? AND user_id = ?',
        (med_id, session['user_id'])
    ).fetchone()

    if not medicine:
        conn.close()
        return jsonify({'error': 'Medicine not found.'}), 404

    conn.execute('DELETE FROM reminder_logs WHERE medicine_id = ?', (med_id,))
    conn.execute('DELETE FROM medicines WHERE id = ? AND user_id = ?', (med_id, session['user_id']))
    conn.commit()
    conn.close()

    return jsonify({'message': 'Medicine deleted successfully.'})


@app.route('/api/medicines/<int:med_id>/take', methods=['POST'])
@login_required
def take_medicine(med_id):
    """Log that a medicine has been taken."""
    conn = get_db()

    medicine = conn.execute(
        'SELECT * FROM medicines WHERE id = ? AND user_id = ?',
        (med_id, session['user_id'])
    ).fetchone()

    if not medicine:
        conn.close()
        return jsonify({'error': 'Medicine not found.'}), 404

    # Log the reminder
    conn.execute(
        'INSERT INTO reminder_logs (user_id, medicine_id, status) VALUES (?, ?, "taken")',
        (session['user_id'], med_id)
    )

    # Increment completed count
    conn.execute(
        'UPDATE medicines SET completed_count = completed_count + 1 WHERE id = ?',
        (med_id,)
    )
    conn.commit()
    conn.close()

    return jsonify({'message': 'Medicine marked as taken.'})


@app.route('/api/medicines/<int:med_id>/skip', methods=['POST'])
@login_required
def skip_medicine(med_id):
    """Log that a medicine was skipped."""
    conn = get_db()

    medicine = conn.execute(
        'SELECT * FROM medicines WHERE id = ? AND user_id = ?',
        (med_id, session['user_id'])
    ).fetchone()

    if not medicine:
        conn.close()
        return jsonify({'error': 'Medicine not found.'}), 404

    conn.execute(
        'INSERT INTO reminder_logs (user_id, medicine_id, status) VALUES (?, ?, "skipped")',
        (session['user_id'], med_id)
    )
    conn.commit()
    conn.close()

    return jsonify({'message': 'Medicine marked as skipped.'})


# ──────────────────────────────────────────────
# Prescription Management
# ──────────────────────────────────────────────

@app.route('/api/prescriptions', methods=['GET'])
@login_required
def get_prescriptions():
    """Get all prescriptions for the logged-in user."""
    conn = get_db()
    prescriptions = conn.execute(
        'SELECT * FROM prescriptions WHERE user_id = ? ORDER BY upload_date DESC',
        (session['user_id'],)
    ).fetchall()
    conn.close()
    return jsonify([dict(p) for p in prescriptions])


@app.route('/api/prescriptions', methods=['POST'])
@login_required
def upload_prescription():
    """Upload a new prescription."""
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded.'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected.'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': 'File type not allowed. Use PNG, JPG, JPEG, GIF, or PDF.'}), 400

    # Generate unique filename
    original_name = secure_filename(file.filename)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"{session['user_id']}_{timestamp}_{original_name}"
    file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))

    description = request.form.get('description', '').strip()
    doctor_name = request.form.get('doctor_name', '').strip()

    conn = get_db()
    cursor = conn.execute(
        '''INSERT INTO prescriptions (user_id, filename, original_name, description, doctor_name)
           VALUES (?, ?, ?, ?, ?)''',
        (session['user_id'], filename, original_name, description, doctor_name)
    )
    prescription_id = cursor.lastrowid
    conn.commit()

    prescription = conn.execute('SELECT * FROM prescriptions WHERE id = ?', (prescription_id,)).fetchone()
    conn.close()

    return jsonify(dict(prescription)), 201


@app.route('/api/prescriptions/<int:presc_id>', methods=['DELETE'])
@login_required
def delete_prescription(presc_id):
    """Delete a prescription."""
    conn = get_db()

    prescription = conn.execute(
        'SELECT * FROM prescriptions WHERE id = ? AND user_id = ?',
        (presc_id, session['user_id'])
    ).fetchone()

    if not prescription:
        conn.close()
        return jsonify({'error': 'Prescription not found.'}), 404

    # Delete file from disk
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], prescription['filename'])
    if os.path.exists(filepath):
        os.remove(filepath)

    conn.execute('DELETE FROM prescriptions WHERE id = ? AND user_id = ?', (presc_id, session['user_id']))
    conn.commit()
    conn.close()

    return jsonify({'message': 'Prescription deleted successfully.'})


@app.route('/uploads/<filename>')
@login_required
def serve_upload(filename):
    """Serve uploaded files."""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


# ──────────────────────────────────────────────
# Reminder Logs
# ──────────────────────────────────────────────

@app.route('/api/reminder-logs', methods=['GET'])
@login_required
def get_reminder_logs():
    """Get reminder logs for the logged-in user."""
    conn = get_db()
    logs = conn.execute(
        '''SELECT rl.*, m.name as medicine_name FROM reminder_logs rl
           JOIN medicines m ON rl.medicine_id = m.id
           WHERE rl.user_id = ? ORDER BY rl.reminded_at DESC LIMIT 50''',
        (session['user_id'],)
    ).fetchall()
    conn.close()
    return jsonify([dict(log) for log in logs])


# ──────────────────────────────────────────────
# AI Healthcare Chatbot (Groq API)
# ──────────────────────────────────────────────

@app.route('/chatbot')
@login_required
def chatbot():
    """Chatbot page."""
    return render_template('chatbot.html')


@app.route('/api/chat', methods=['POST'])
@login_required
def chat():
    """Handle chatbot messages using Groq API."""
    data = request.get_json()
    user_message = data.get('message', '').strip()

    if not user_message:
        return jsonify({'error': 'Message cannot be empty.'}), 400

    groq_api_key = os.getenv('GROQ_API_KEY')
    if not groq_api_key or groq_api_key == 'your-groq-api-key-here':
        return jsonify({
            'response': "I'm sorry, the AI chatbot is not configured yet. Please add your Groq API key to the .env file.",
            'disclaimer': True
        })

    try:
        from groq import Groq
        client = Groq(api_key=groq_api_key)

        system_prompt = """You are a helpful healthcare assistant chatbot. You provide general health information 
        and guidance about medicines, symptoms, and wellness. You are NOT a replacement for professional medical advice.
        Always remind users to consult a healthcare professional for serious concerns.
        Keep your responses concise, helpful, and easy to understand.
        If asked about specific dosages or treatments, always recommend consulting a doctor."""

        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.7,
            max_tokens=1024
        )

        response = chat_completion.choices[0].message.content
        return jsonify({
            'response': response,
            'disclaimer': True
        })

    except Exception as e:
        return jsonify({
            'response': f"I'm sorry, I encountered an error. Please try again later.",
            'disclaimer': True
        }), 500


# ──────────────────────────────────────────────
# Pharmacy Finder Page
# ──────────────────────────────────────────────

@app.route('/pharmacy')
@login_required
def pharmacy():
    """Nearby pharmacy finder page."""
    return render_template('pharmacy.html')


# ──────────────────────────────────────────────
# User Profile
# ──────────────────────────────────────────────

@app.route('/profile', methods=['GET', 'POST'])
@login_required
def profile():
    """User profile management."""
    conn = get_db()
    user = conn.execute('SELECT * FROM users WHERE id = ?', (session['user_id'],)).fetchone()

    if request.method == 'POST':
        full_name = request.form.get('full_name', '').strip()
        email = request.form.get('email', '').strip()
        phone = request.form.get('phone', '').strip()
        current_password = request.form.get('current_password', '')
        new_password = request.form.get('new_password', '')

        # Update profile
        if full_name and email:
            conn.execute(
                'UPDATE users SET full_name = ?, email = ?, phone = ? WHERE id = ?',
                (full_name, email, phone, session['user_id'])
            )
            session['full_name'] = full_name

        # Update password if provided
        if current_password and new_password:
            if check_password_hash(user['password'], current_password):
                if len(new_password) >= 6:
                    hashed = generate_password_hash(new_password)
                    conn.execute(
                        'UPDATE users SET password = ? WHERE id = ?',
                        (hashed, session['user_id'])
                    )
                    flash('Password updated successfully.', 'success')
                else:
                    flash('New password must be at least 6 characters.', 'error')
            else:
                flash('Current password is incorrect.', 'error')

        conn.commit()
        flash('Profile updated successfully.', 'success')
        user = conn.execute('SELECT * FROM users WHERE id = ?', (session['user_id'],)).fetchone()

    conn.close()
    return render_template('profile.html', user=user)


# ──────────────────────────────────────────────
# Run Application
# ──────────────────────────────────────────────

if __name__ == '__main__':
    app.run(debug=True, port=5000)
