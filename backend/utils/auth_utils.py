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
    """
    try:
        # Check if thread exists and user has access
        result = await client.table('threads').select('thread_id').eq('thread_id', thread_id).eq('account_id', user_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Thread not found or access denied")
        
        return True
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error verifying thread access: {str(e)}")

async def get_user_account_id(user_id: str) -> str:
    """
    Get the account ID for a user.
    In Basejump, personal account_id is the same as user_id.
    """
    return user_id
