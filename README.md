# 💊 MedRemind - Smart Medicine Reminder System

A full-stack healthcare assistant web application built with Flask, SQLite, and modern web technologies.

## Features
- 🔐 User Authentication (Register, Login, Logout)
- 📊 Interactive Dashboard with statistics
- 💊 Medicine Management (CRUD with reminders)
- ⏰ Voice-enabled reminders (SpeechSynthesis API)
- 📋 Prescription upload and tracking
- 🤖 AI Healthcare Chatbot (Groq API + Llama 3.3 70B)
- 🗺️ Nearby Pharmacy Finder (OpenStreetMap + Leaflet.js)
- 🌙 Dark/Light mode toggle
- 📱 Fully responsive design

## Setup

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure environment variables:**
   Edit `.env` and add your Groq API key:
   ```
   SECRET_KEY=your-secret-key
   GROQ_API_KEY=your-groq-api-key
   GEOAPIFY_API_KEY=your-geoapify-api-key
   ```

3. **Run the application:**
   ```bash
   python app.py
   ```

4. **Open in browser:**
   Navigate to `http://localhost:5002`

## Tech Stack
- **Backend:** Flask (Python)
- **Database:** SQLite
- **Frontend:** HTML, CSS, JavaScript
- **AI:** Groq API (Llama 3.3 70B Versatile)
- **Maps & Location:** OpenStreetMap + Leaflet.js, Geoapify API
- **Voice:** Web SpeechSynthesis API
