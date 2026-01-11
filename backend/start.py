"""
Startup script for Laneway Backend API
Initializes database and starts the server
"""

import os
import sys

# Add backend directory to path
sys.path.insert(0, os.path.dirname(__file__))

from database import init_database

def main():
    print("=" * 60)
    print("🚀 Laneway Backend API - Starting Up")
    print("=" * 60)
    
    # Initialize database
    print("\n📦 Initializing database...")
    try:
        init_database()
        print("✅ Database initialized successfully")
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
        return
    
    # Start the server
    print("\n🌐 Starting API server...")
    print("📍 Server URL: http://localhost:5000")
    print("📚 API Docs: http://localhost:5000/docs")
    print("\n💡 Demo credentials:")
    print("   Email: demo@laneway.com")
    print("   Password: demo123")
    print("\n" + "=" * 60)
    print("Press Ctrl+C to stop the server")
    print("=" * 60 + "\n")
    
    # Import and run
    import uvicorn
    from main import app
    
    uvicorn.run(app, host="0.0.0.0", port=5000, log_level="info")

if __name__ == "__main__":
    main()
