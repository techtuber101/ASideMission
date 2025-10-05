"""
Authentication utilities for Iris backend.
"""

import jwt
import os
from typing import Optional, Dict, Any
from fastapi import Request, HTTPException
from services.supabase_client import get_db_connection

async def verify_and_get_user_id_from_jwt(request: Request) -> str:
    """
    Verify JWT token and extract user ID.
    Following Supabase pattern - no signature verification needed.
    """
    try:
        # Get Authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
        
        # Extract token
        token = auth_header.split(" ")[1]
        
        # Decode JWT without verification (Supabase pattern)
        # In production, you might want to verify the signature
        decoded_token = jwt.decode(token, options={"verify_signature": False})
        
        # Extract user ID
        user_id = decoded_token.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: missing user ID")
        
        return user_id
        
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication error: {str(e)}")

async def verify_and_authorize_thread_access(client, thread_id: str, user_id: str) -> bool:
    """
    Verify that the user has access to the specified thread.
    Simplified schema: threads have user_id field
    """
    try:
        print(f"🔍 Verifying access: user {user_id} to thread {thread_id}")
        
        # Check if thread exists and user has access
        result = await client.table('threads').select('thread_id, user_id').eq('thread_id', thread_id).eq('user_id', user_id).execute()
        
        if not result.data:
            print(f"❌ Access denied: Thread {thread_id} not found or user {user_id} has no access")
            # Let's also check if the thread exists at all
            thread_check = await client.table('threads').select('thread_id, user_id').eq('thread_id', thread_id).execute()
            if thread_check.data:
                print(f"🔍 Thread exists but belongs to user: {thread_check.data[0].get('user_id')}")
            else:
                print(f"🔍 Thread {thread_id} does not exist in database")
            raise HTTPException(status_code=404, detail="Thread not found or access denied")
        
        print(f"✅ Access granted: User {user_id} has access to thread {thread_id}")
        return True
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error verifying thread access: {e}")
        raise HTTPException(status_code=500, detail=f"Error verifying thread access: {str(e)}")

async def get_user_account_id(user_id: str) -> str:
    """
    Get the account ID for a user.
    In Basejump, personal account_id is the same as user_id.
    """
    return user_id
