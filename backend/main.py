"""
Laneway Backend API - Main Application
This API serves the Chrome extension and connects to your existing AI processing pipeline
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Import routers
from api.auth import router as auth_router
from api.recordings import router as recordings_router
from api.absences import router as absences_router
from api.analytics import router as analytics_router

# Initialize FastAPI app
app = FastAPI(
    title="Laneway Backend API",
    description="Backend API for Laneway Chrome Extension",
    version="1.0.0"
)

# Configure CORS to allow Chrome extension
# For development: Allow all origins
# For production: Restrict to specific extension ID
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins (development only)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Include API routers
app.include_router(auth_router, tags=["Authentication"])
app.include_router(recordings_router, tags=["Recordings"])
app.include_router(absences_router, tags=["Absences"])
app.include_router(analytics_router, tags=["Analytics"])

# Health check endpoint
@app.get("/")
async def root():
    return {
        "status": "online",
        "service": "Laneway Backend API",
        "version": "1.0.0"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    print("🚀 Starting Laneway Backend API on http://localhost:5000")
    print("📝 API Documentation: http://localhost:5000/docs")
    uvicorn.run(app, host="0.0.0.0", port=5000, log_level="info")
