"""
Database connection and utilities
"""

import sqlite3
import os
from contextlib import contextmanager

# Database file path
DB_PATH = os.path.join(os.path.dirname(__file__), 'database', 'laneway.db')

def init_database():
    """Initialize the database with schema"""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    
    # Read schema file
    schema_path = os.path.join(os.path.dirname(__file__), 'database', 'schema.sql')
    
    if os.path.exists(schema_path):
        with open(schema_path, 'r') as f:
            schema = f.read()
        
        # Execute schema
        conn = sqlite3.connect(DB_PATH)
        conn.executescript(schema)
        conn.commit()
        conn.close()
        print(f"✅ Database initialized at {DB_PATH}")
    else:
        print(f"⚠️  Schema file not found at {schema_path}")

@contextmanager
def get_db():
    """Get database connection context manager"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # Enable column access by name
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def execute_query(query, params=None):
    """Execute a query and return results"""
    with get_db() as conn:
        cursor = conn.cursor()
        if params:
            cursor.execute(query, params)
        else:
            cursor.execute(query)
        return cursor.fetchall()

def execute_insert(query, params):
    """Execute an insert query and return last row id"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        return cursor.lastrowid
