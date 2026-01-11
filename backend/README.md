# Laneway Backend API

This is the backend API server for the Laneway Chrome Extension.

## Quick Start

1. **Install dependencies** (already done):
   ```bash
   pip install -r requirements.txt
   ```

2. **Start the server**:
   ```bash
   python start.py
   ```

3. **Test the API**:
   - Open http://localhost:5000 in your browser
   - View API docs at http://localhost:5000/docs

## Demo Login Credentials

- **Email**: demo@laneway.com
- **Password**: demo123

## Project Structure

```
backend/
├── main.py              # FastAPI application
├── start.py             # Startup script
├── database.py          # Database utilities
├── requirements.txt     # Python dependencies
├── api/
│   ├── auth.py         # Authentication endpoints
│   ├── recordings.py   # Recording management
│   ├── absences.py     # Absence notifications
│   └── analytics.py    # Analytics endpoints
└── database/
    ├── schema.sql      # Database schema
    └── laneway.db      # SQLite database (auto-created)
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login

### Recordings
- `POST /api/recordings/upload-url` - Get upload URL
- `POST /api/recordings/complete` - Mark recording complete

### Absences
- `POST /api/absences/notify` - Submit absence notification
- `GET /api/absences/meeting/{meeting_id}` - Get meeting absences
- `POST /api/absences/mark-shown` - Mark absences as shown

### Analytics
- `POST /api/analytics/upload` - Upload analytics data
- `GET /api/analytics/user/{user_id}` - Get user statistics

## Connecting to Your AI Agent

To integrate with your existing AI processing pipeline, edit `api/recordings.py`:

```python
@router.post("/api/recordings/complete")
async def complete_recording(request, authorization):
    # ... existing code ...
    
    # Add your AI processing here:
    from your_ai_agent.transcription import transcribe_video
    from your_ai_agent.task_extraction import extract_tasks
    from your_ai_agent.notion_sync import write_to_notion
    
    recording_url = get_recording_url(request.recordingId)
    transcript = transcribe_video(recording_url)
    tasks = extract_tasks(transcript)
    write_to_notion(tasks, request.metadata)
```

## Database

The backend uses SQLite for simplicity. The database is automatically created at `backend/database/laneway.db`.

To reset the database, simply delete the `laneway.db` file and restart the server.

## Production Deployment

For production:
1. Change `SECRET_KEY` in `api/auth.py` to a secure random string
2. Use environment variables for configuration
3. Switch from SQLite to PostgreSQL for better performance
4. Enable HTTPS
5. Configure proper CORS origins
