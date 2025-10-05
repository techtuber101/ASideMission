"""
Centralized database connection management for Iris using Supabase.
"""

from typing import Optional
from supabase import create_async_client, AsyncClient
import os
import threading
from dotenv import load_dotenv

# Load environment variables
# Load environment variables from root directory
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

class DBConnection:
    """Thread-safe singleton database connection manager using Supabase."""
    
    _instance: Optional['DBConnection'] = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                # Double-check locking pattern
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
                    cls._instance._client = None
        return cls._instance

    def __init__(self):
        """No initialization needed in __init__ as it's handled in __new__"""
        pass

    async def initialize(self):
        """Initialize the database connection."""
        if self._initialized:
            return
                
        try:
            supabase_url = os.getenv("SUPABASE_URL")
            # Use service role key preferentially for backend operations, but fall back to anon key if service role is placeholder
            supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            supabase_anon_key = os.getenv("SUPABASE_ANON_KEY")
            
            # Use service role key only if it's not a placeholder
            if supabase_service_key and not supabase_service_key.startswith("your-service-role"):
                supabase_key = supabase_service_key
            else:
                supabase_key = supabase_anon_key
            
            if not supabase_url or not supabase_key:
                raise RuntimeError("SUPABASE_URL and a key (SERVICE_ROLE_KEY or ANON_KEY) environment variables must be set.")

            print("Initializing Supabase connection")
            
            # Create Supabase client with timeout configuration
            self._client = await create_async_client(
                supabase_url, 
                supabase_key,
            )
            
            self._initialized = True
            key_type = "SERVICE_ROLE_KEY" if (supabase_service_key and not supabase_service_key.startswith("your-service-role")) else "ANON_KEY"
            print(f"Database connection initialized with Supabase using {key_type}")
            
        except Exception as e:
            print(f"Database initialization error: {e}")
            raise RuntimeError(f"Failed to initialize database connection: {str(e)}")

    @classmethod
    async def disconnect(cls):
        """Disconnect from the database."""
        if cls._instance and cls._instance._client:
            print("Disconnecting from Supabase database")
            try:
                # Close Supabase client
                if hasattr(cls._instance._client, 'close'):
                    await cls._instance._client.close()
                    
            except Exception as e:
                print(f"Warning: Error during disconnect: {e}")
            finally:
                cls._instance._initialized = False
                cls._instance._client = None
                print("Database disconnected successfully")

    @property
    async def client(self) -> AsyncClient:
        """Get the Supabase client instance."""
        if not self._initialized:
            print("Supabase client not initialized, initializing now")
            await self.initialize()
        if not self._client:
            raise RuntimeError("Database client is None after initialization")
        return self._client

# Global instance for singleton pattern
_db_connection: Optional[DBConnection] = None

def get_db_connection() -> DBConnection:
    """Get singleton database connection instance"""
    global _db_connection
    if _db_connection is None:
        _db_connection = DBConnection()
    return _db_connection
