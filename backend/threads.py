"""
Thread and message management for Iris backend.
"""

import json
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Form, Query, Request
from pydantic import BaseModel

from utils.auth_utils import verify_and_get_user_id_from_jwt, verify_and_authorize_thread_access
from services.supabase_client import get_db_connection

router = APIRouter()

# Pydantic models
class CreateThreadResponse(BaseModel):
    thread_id: str
    project_id: Optional[str] = None

class MessageCreateRequest(BaseModel):
    type: str = "user"
    content: str
    is_llm_message: bool = True

class SyncChatRequest(BaseModel):
    messages: List[Dict[str, Any]]
    title: Optional[str] = None

@router.get("/threads")
async def get_user_threads(
    request: Request,
    user_id: str = Depends(verify_and_get_user_id_from_jwt),
    page: Optional[int] = Query(1, ge=1, description="Page number (1-based)"),
    limit: Optional[int] = Query(1000, ge=1, le=1000, description="Number of items per page (max 1000)")
):
    """Get all threads for the current user with associated project data."""
    print(f"Fetching threads for user: {user_id} (page={page}, limit={limit})")
    db = get_db_connection()
    client = await db.client
    # Use user's JWT for RLS-authenticated queries if available
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        try:
            client.postgrest.auth(auth_header.split(" ", 1)[1])
        except Exception:
            pass
    
    try:
        offset = (page - 1) * limit
        
        # Get threads for the user
        threads_result = await client.table('threads').select('*').eq('user_id', user_id).order('created_at', desc=True).execute()
        
        if not threads_result.data:
            print(f"No threads found for user: {user_id}")
            return {
                "threads": [],
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total": 0,
                    "pages": 0
                }
            }
        
        total_count = len(threads_result.data)
        
        # Apply pagination to threads
        paginated_threads = threads_result.data[offset:offset + limit]
        
        # Extract unique project IDs from threads that have them
        project_ids = [
            thread['project_id'] for thread in paginated_threads 
            if thread.get('project_id')
        ]
        unique_project_ids = list(set(project_ids)) if project_ids else []
        
        # Fetch projects if we have project IDs
        projects_by_id = {}
        if unique_project_ids:
            projects_data = await client.table('projects').select('*').in_('project_id', unique_project_ids).execute()
            
            print(f"Retrieved {len(projects_data.data)} projects")
            # Create a lookup map of projects by ID
            projects_by_id = {
                project['project_id']: project 
                for project in projects_data.data
            }
        
        # Map threads with their associated projects
        mapped_threads = []
        for thread in paginated_threads:
            project_data = None
            if thread.get('project_id') and thread['project_id'] in projects_by_id:
                project = projects_by_id[thread['project_id']]
                project_data = {
                    "project_id": project['project_id'],
                    "name": project.get('name', ''),
                    "description": project.get('description', ''),
                    "sandbox": project.get('sandbox', {}),
                    "is_public": project.get('is_public', False),
                    "created_at": project['created_at'],
                    "updated_at": project['updated_at']
                }
            
            mapped_thread = {
                "thread_id": thread['thread_id'],
                "project_id": thread.get('project_id'),
                "metadata": thread.get('metadata', {}),
                "is_public": thread.get('is_public', False),
                "created_at": thread['created_at'],
                "updated_at": thread['updated_at'],
                "project": project_data
            }
            mapped_threads.append(mapped_thread)
        
        total_pages = (total_count + limit - 1) // limit if total_count else 0
        
        print(f"Mapped threads for frontend: {len(mapped_threads)} threads, {len(projects_by_id)} unique projects")
        
        return {
            "threads": mapped_threads,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_count,
                "pages": total_pages
            }
        }
        
    except Exception as e:
        print(f"Error fetching threads for user {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch threads: {str(e)}")

@router.get("/threads/{thread_id}")
async def get_thread(
    thread_id: str,
    request: Request,
    user_id: str = Depends(verify_and_get_user_id_from_jwt)
):
    """Get a specific thread by ID with complete related data."""
    print(f"Fetching thread: {thread_id}")
    db = get_db_connection()
    client = await db.client
    # Use user's JWT for RLS-authenticated queries if available
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        try:
            client.postgrest.auth(auth_header.split(" ", 1)[1])
        except Exception:
            pass
    
    try:
        # Verify user has access to thread
        await verify_and_authorize_thread_access(client, thread_id, user_id)
        
        # Get the thread data
        thread_result = await client.table('threads').select('*').eq('thread_id', thread_id).execute()
        
        if not thread_result.data:
            raise HTTPException(status_code=404, detail="Thread not found")
        
        thread = thread_result.data[0]
        
        # Get associated project if thread has a project_id
        project_data = None
        if thread.get('project_id'):
            project_result = await client.table('projects').select('*').eq('project_id', thread['project_id']).execute()
            
            if project_result.data:
                project = project_result.data[0]
                print(f"Raw project from DB for thread {thread_id}")
                project_data = {
                    "project_id": project['project_id'],
                    "name": project.get('name', ''),
                    "description": project.get('description', ''),
                    "sandbox": project.get('sandbox', {}),
                    "is_public": project.get('is_public', False),
                    "created_at": project['created_at'],
                    "updated_at": project['updated_at']
                }
        
        # Get message count for the thread
        message_count_result = await client.table('messages').select('message_id', count='exact').eq('thread_id', thread_id).execute()
        message_count = message_count_result.count if message_count_result.count is not None else 0
        
        # Map thread data for frontend
        mapped_thread = {
            "thread_id": thread['thread_id'],
            "project_id": thread.get('project_id'),
            "metadata": thread.get('metadata', {}),
            "is_public": thread.get('is_public', False),
            "created_at": thread['created_at'],
            "updated_at": thread['updated_at'],
            "project": project_data,
            "message_count": message_count
        }
        
        print(f"Mapped thread for frontend: {thread_id} with {message_count} messages")
        return mapped_thread
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching thread {thread_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch thread: {str(e)}")

@router.post("/threads", response_model=CreateThreadResponse)
async def create_thread(
    request: Request,
    name: Optional[str] = Form(None)
):
    """Create a new thread."""
    if not name:
        name = "New Chat"
    print(f"🚀 Creating new thread with name: {name}")
    print(f"🔍 Request headers: {dict(request.headers)}")
    print(f"🔍 Request method: {request.method}")
    print(f"🔍 Request URL: {request.url}")
    
    # Check for authentication (optional)
    user_id = None
    try:
        if request.headers.get("Authorization"):
            print(f"🔐 Found Authorization header")
            user_id = await verify_and_get_user_id_from_jwt(request)
            print(f"🔐 Creating authenticated thread for user: {user_id}")
        else:
            print(f"🔓 No Authorization header, creating anonymous thread")
    except Exception as e:
        print(f"🔓 Authentication failed, creating anonymous thread: {e}")
        user_id = None
    
    db = get_db_connection()
    client = await db.client
    # Use user's JWT for RLS-authenticated queries if available
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        try:
            client.postgrest.auth(auth_header.split(" ", 1)[1])
        except Exception:
            pass
    
    try:
        if user_id:
            # Authenticated user - create project and thread in database
            project_name = name or "New Chat"
            print(f"📁 Creating project: {project_name} for user: {user_id}")
            
            project = await client.table('projects').insert({
                "project_id": str(uuid.uuid4()), 
                "user_id": user_id, 
                "name": project_name,
                "created_at": datetime.now(timezone.utc).isoformat()
            }).execute()
            project_id = project.data[0]['project_id']
            print(f"✅ Created project: {project_id}")

            # 2. Create Thread
            thread_data = {
                "thread_id": str(uuid.uuid4()), 
                "project_id": project_id, 
                "user_id": user_id,
                "title": project_name,
                "metadata": {"title": project_name},
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            print(f"🧵 Creating thread with data: {thread_data}")
            thread = await client.table('threads').insert(thread_data).execute()
            thread_id = thread.data[0]['thread_id']
            print(f"✅ Created thread: {thread_id}")

            print(f"🎉 Successfully created authenticated thread {thread_id} with project {project_id}")
            return {"thread_id": thread_id, "project_id": project_id}
        else:
            # Anonymous user - just return a thread ID without database storage
            thread_id = str(uuid.uuid4())
            print(f"🔓 Created anonymous thread: {thread_id}")
            return {"thread_id": thread_id, "project_id": None}

    except Exception as e:
        print(f"Error creating thread: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create thread: {str(e)}")

@router.get("/threads/{thread_id}/messages")
async def get_thread_messages(
    thread_id: str,
    request: Request,
    user_id: str = Depends(verify_and_get_user_id_from_jwt),
    order: str = Query("desc", description="Order by created_at: 'asc' or 'desc'")
):
    """Get all messages for a thread."""
    print(f"Fetching all messages for thread: {thread_id}, order={order}")
    db = get_db_connection()
    client = await db.client
    # Use user's JWT for RLS-authenticated queries if available
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        try:
            client.postgrest.auth(auth_header.split(" ", 1)[1])
        except Exception:
            pass
    await verify_and_authorize_thread_access(client, thread_id, user_id)
    
    try:
        batch_size = 1000
        offset = 0
        all_messages = []
        while True:
            query = client.table('messages').select('*').eq('thread_id', thread_id)
            query = query.order('created_at', desc=(order == "desc"))
            query = query.range(offset, offset + batch_size - 1)
            messages_result = await query.execute()
            batch = messages_result.data or []
            all_messages.extend(batch)
            print(f"Fetched batch of {len(batch)} messages (offset {offset})")
            if len(batch) < batch_size:
                break
            offset += batch_size
        return {"messages": all_messages}
    except Exception as e:
        print(f"Error fetching messages for thread {thread_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch messages: {str(e)}")

@router.post("/threads/{thread_id}/messages")
async def create_message(
    thread_id: str,
    message_data: MessageCreateRequest,
    request: Request,
    user_id: str = Depends(verify_and_get_user_id_from_jwt)
):
    """Create a new message in a thread."""
    print(f"Creating message in thread: {thread_id}")
    db = get_db_connection()
    client = await db.client
    # Use user's JWT for RLS-authenticated queries if available
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        try:
            client.postgrest.auth(auth_header.split(" ", 1)[1])
        except Exception:
            pass
    
    try:
        await verify_and_authorize_thread_access(client, thread_id, user_id)
        
        message_payload = {
            "role": "user" if message_data.type == "user" else "assistant",
            "content": message_data.content
        }
        
        insert_data = {
            "message_id": str(uuid.uuid4()),
            "thread_id": thread_id,
            "type": message_data.type,
            "is_llm_message": message_data.is_llm_message,
            "content": message_payload,  # Store as JSONB object
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        message_result = await client.table('messages').insert(insert_data).execute()
        
        if not message_result.data:
            raise HTTPException(status_code=500, detail="Failed to create message")
        
        print(f"Created message: {message_result.data[0]['message_id']}")
        return message_result.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating message in thread {thread_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create message: {str(e)}")

@router.post("/threads/sync")
async def sync_local_chats(
    sync_data: SyncChatRequest,
    request: Request,
    user_id: str = Depends(verify_and_get_user_id_from_jwt)
):
    """Sync local chats to cloud storage."""
    print(f"Syncing {len(sync_data.messages)} messages for user: {user_id}")
    db = get_db_connection()
    client = await db.client
    # Use user's JWT for RLS-authenticated queries if available
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        try:
            client.postgrest.auth(auth_header.split(" ", 1)[1])
        except Exception:
            pass
    account_id = user_id
    
    try:
        # 1. Create Project
        project_name = sync_data.title or "Synced Chat"
        project = await client.table('projects').insert({
            "project_id": str(uuid.uuid4()), 
            "user_id": account_id, 
            "name": project_name,
            "created_at": datetime.now(timezone.utc).isoformat()
        }).execute()
        project_id = project.data[0]['project_id']
        print(f"Created sync project: {project_id}")

        # 2. Create Thread
        thread_data = {
            "thread_id": str(uuid.uuid4()), 
            "project_id": project_id, 
            "user_id": account_id,
            "metadata": {"title": project_name, "synced_from_local": True},
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        thread = await client.table('threads').insert(thread_data).execute()
        thread_id = thread.data[0]['thread_id']
        print(f"Created sync thread: {thread_id}")

        # 3. Insert Messages
        messages_to_insert = []
        for i, msg in enumerate(sync_data.messages):
            message_payload = {
                "role": msg.get("role", "user"),
                "content": msg.get("content", "")
            }
            
            insert_data = {
                "message_id": str(uuid.uuid4()),
                "thread_id": thread_id,
                "type": msg.get("type", "user"),
                "is_llm_message": msg.get("is_llm_message", True),
                "content": message_payload,
                "created_at": msg.get("timestamp", datetime.now(timezone.utc).isoformat())
            }
            messages_to_insert.append(insert_data)
        
        if messages_to_insert:
            await client.table('messages').insert(messages_to_insert).execute()
            print(f"Inserted {len(messages_to_insert)} messages")

        print(f"Successfully synced thread {thread_id} with project {project_id}")
        return {"thread_id": thread_id, "project_id": project_id, "synced_messages": len(messages_to_insert)}

    except Exception as e:
        print(f"Error syncing chats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to sync chats: {str(e)}")
