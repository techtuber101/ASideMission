# Iris Backend Main Application - Ultra Fast Agentic AI
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import time
import json
import asyncio
import uuid
from datetime import datetime, timezone
from dotenv import load_dotenv

# Load environment variables from root directory
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

# Import our services
from services.gemini_client import get_gemini_client
from services.tool_executor import get_tool_executor
from services.orchestrator import get_orchestrator
from utils.redis_client import get_redis_client, JobStatus
from tools import get_tool_schemas
from auth import get_current_user
from threads import router as threads_router

# Initialize FastAPI app
app = FastAPI(
    title="Iris Agentic AI API",
    description="Ultra-fast agentic AI system with real-time streaming and multi-tool execution",
    version="1.0.0"
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:3003", "http://localhost:3004", "http://localhost:8081"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(threads_router, prefix="/api", tags=["threads"])

# Pydantic models
class Message(BaseModel):
    content: str
    thread_id: Optional[str] = None

class ToolCall(BaseModel):
    tool_name: str
    parameters: dict
    mode: Optional[str] = "sync"  # sync or async
    priority: Optional[str] = "normal"  # low, normal, high

class ChatResponse(BaseModel):
    message: str
    tool_calls: Optional[List[Dict[str, Any]]] = None
    thread_id: str
    job_id: Optional[str] = None
    status: str = "complete"

class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    created_at: float
    updated_at: float

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, thread_id: str):
        await websocket.accept()
        self.active_connections[thread_id] = websocket

    def disconnect(self, thread_id: str):
        if thread_id in self.active_connections:
            del self.active_connections[thread_id]

    async def send_message(self, thread_id: str, message: dict):
        if thread_id in self.active_connections:
            websocket = self.active_connections[thread_id]
            try:
                await websocket.send_json(message)
            except Exception:
                self.disconnect(thread_id)

manager = ConnectionManager()

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    redis_client = get_redis_client()
    redis_health = await redis_client.health_check()
    
    return {
        "status": "healthy", 
        "service": "iris-backend",
        "timestamp": time.time(),
        "redis": redis_health,
        "version": "1.0.0"
    }

# Tool schemas endpoint
@app.get("/tools/schemas")
async def get_tools_schemas():
    """Get all available tool schemas for function calling"""
    return {"schemas": get_tool_schemas()}

# Tool execution endpoint
@app.post("/tools/execute")
async def execute_tool_endpoint(tool_call: ToolCall):
    """Execute a tool synchronously or asynchronously"""
    try:
        if tool_call.mode == "async":
            # Create async job
            redis_client = get_redis_client()
            job_id = await redis_client.create_job(
                job_type="tool_execution",
                parameters={
                    "tool_name": tool_call.tool_name,
                    "parameters": tool_call.parameters
                },
                priority=tool_call.priority
            )
            
            return {"job_id": job_id, "status": "queued"}
        
        else:
            # Execute synchronously
            tool_executor = get_tool_executor()
            result = await tool_executor.execute_tool_sync(
                tool_call.tool_name, 
                tool_call.parameters
            )
            
            return {
                "success": result.get("success", True),
                "result": result,
                "execution_time_ms": result.get("execution_time_ms", 0)
            }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Job status endpoint
@app.get("/jobs/{job_id}/status", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    """Get job status and result"""
    redis_client = get_redis_client()
    job_data = await redis_client.get_job(job_id)
    
    if not job_data:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return JobStatusResponse(
        job_id=job_id,
        status=job_data["status"],
        result=job_data.get("result"),
        error=job_data.get("error"),
        created_at=job_data["created_at"],
        updated_at=job_data["updated_at"]
    )

# Job events streaming endpoint
@app.get("/jobs/{job_id}/events")
async def stream_job_events(job_id: str):
    """Stream job events in real-time"""
    redis_client = get_redis_client()
    
    async def generate_events():
        try:
            async for event in redis_client.stream_job_events(job_id):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
    
    return StreamingResponse(
        generate_events(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*"
        }
    )

# Simple chat endpoint (instant response)
@app.post("/chat", response_model=ChatResponse)
async def chat_simple(message: Message):
    """Simple chat endpoint with instant response"""
    try:
        gemini_client = get_gemini_client()
        
        # Get instant response
        response = await gemini_client.chat_simple(
            message.content,
            thread_history=None  # TODO: Add thread history from Redis
        )
        
        return ChatResponse(
            message=response,
            thread_id=message.thread_id or "default",
            status="complete"
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Streaming chat endpoint (SSE)
@app.post("/chat/stream")
async def chat_stream(message: Message):
    """Streaming chat endpoint with Server-Sent Events"""
    
    async def generate_stream():
        try:
            gemini_client = get_gemini_client()
            tool_executor = get_tool_executor()
            
            # Get tool schemas
            tools = get_tool_schemas()
            
            # Stream Gemini response
            async for chunk in gemini_client.chat_with_tools_streaming(
                message.content, 
                tools
            ):
                if chunk["type"] == "text":
                    yield f"data: {json.dumps({'type': 'text', 'content': chunk['content']})}\n\n"
                
                elif chunk["type"] == "tool_call":
                    # Execute tool immediately
                    tool_results = await tool_executor.execute_tools_parallel([chunk])
                    
                    yield f"data: {json.dumps({'type': 'tool_result', 'name': chunk['name'], 'result': tool_results[0]['result']})}\n\n"
                
                elif chunk["type"] == "thinking":
                    yield f"data: {json.dumps({'type': 'thinking', 'content': chunk['content']})}\n\n"
                
                elif chunk["type"] == "error":
                    yield f"data: {json.dumps({'type': 'error', 'content': chunk['content']})}\n\n"
        
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
    
    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*"
        }
    )

# WebSocket chat endpoint (primary) - P1.5 Instant-or-Agentic
@app.websocket("/ws/chat/{thread_id}")
async def websocket_chat(websocket: WebSocket, thread_id: str):
    """WebSocket chat endpoint with P1.5 instant-or-agentic orchestration"""
    await manager.connect(websocket, thread_id)
    
    try:
        # Get auth token from query params (optional)
        token = websocket.query_params.get("token")
        user_id = None
        
        # Only verify authentication if token is provided
        if token:
            try:
                from utils.auth_utils import verify_and_get_user_id_from_jwt
                from fastapi import Request
                import jwt
                
                # Create a mock request for auth verification
                class MockRequest:
                    def __init__(self, token):
                        self.headers = {"Authorization": f"Bearer {token}"}
                
                mock_request = MockRequest(token)
                user_id = await verify_and_get_user_id_from_jwt(mock_request)
                
                # Verify user has access to thread
                from services.supabase_client import get_db_connection
                from utils.auth_utils import verify_and_authorize_thread_access
                db = get_db_connection()
                client = await db.client
                # Attach user's JWT to PostgREST for RLS evaluation
                try:
                    client.postgrest.auth(token)
                except Exception:
                    pass
                await verify_and_authorize_thread_access(client, thread_id, user_id)
                
            except Exception as e:
                await websocket.close(code=1008, reason=f"Authentication failed: {str(e)}")
                return
        else:
            # No authentication - allow anonymous access
            print(f"🔓 Anonymous WebSocket connection for thread: {thread_id}")
            user_id = None
        
        orchestrator = get_orchestrator()
        gemini_client = get_gemini_client()
        
        # Get conversation history from database (only if authenticated)
        conversation_history = []
        if user_id:
            try:
                messages_result = await client.table('messages').select('*').eq('thread_id', thread_id).order('created_at', desc=False).execute()
                for msg in messages_result.data or []:
                    content = msg.get('content', {})
                    if isinstance(content, dict):
                        conversation_history.append({
                            "role": content.get("role", "user"),
                            "content": content.get("content", ""),
                            "timestamp": msg.get("created_at", "")
                        })
            except Exception as e:
                print(f"Error loading conversation history: {e}")
        else:
            print(f"🔓 Anonymous user - no conversation history loaded")
        
        while True:
            # Receive user message
            data = await websocket.receive_json()
            message_content = data.get("content", "")
            
            print(f"🔍 Received WebSocket message: {data}")
            
            # Handle file operations (background, no tool calls)
            if data.get("type") == "file_upload":
                await handle_file_upload(websocket, data, thread_id)
                continue
            elif data.get("type") == "file_download":
                await handle_file_download(websocket, data, thread_id)
                continue
            elif data.get("type") == "list_files":
                await handle_list_files(websocket, data, thread_id)
                continue
            
            if not message_content:
                print("❌ Empty message content, skipping")
                continue
            
            # Send acknowledgment
            await manager.send_message(thread_id, {
                "type": "ack",
                "timestamp": time.time()
            })
            print(f"✅ Sent acknowledgment for: {message_content}")
            
            # Save user message to database (only if authenticated)
            if user_id:
                try:
                    await client.table('messages').insert({
                        "message_id": str(uuid.uuid4()),
                        "thread_id": thread_id,
                        "type": "user",
                        "is_llm_message": True,
                        "content": {"role": "user", "content": message_content},
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }).execute()
                except Exception as e:
                    print(f"Error saving user message: {e}")
            else:
                print(f"🔓 Anonymous user - message not saved to database")
            
            # Process message through orchestrator (instant-or-agentic routing)
            try:
                print(f"🔄 Starting orchestrator processing for: {message_content}")
                event_count = 0
                async for event in orchestrator.process_message(message_content, conversation_history):
                    event_count += 1
                    print(f"📤 Sending event #{event_count}: {event}")
                    await manager.send_message(thread_id, event)
                    
                    # Update conversation history for next turn
                    if event["type"] == "text":
                        conversation_history.append({
                            "role": "assistant",
                            "content": event["content"],
                            "timestamp": event["ts"]
                        })
                        
                        # Save assistant message to database (only if authenticated)
                        if user_id:
                            try:
                                await client.table('messages').insert({
                                    "message_id": str(uuid.uuid4()),
                                    "thread_id": thread_id,
                                    "type": "assistant",
                                    "is_llm_message": True,
                                    "content": {"role": "assistant", "content": event["content"]},
                                    "created_at": datetime.now(timezone.utc).isoformat()
                                }).execute()
                            except Exception as e:
                                print(f"Error saving assistant message: {e}")
                
                print(f"✅ Processed {event_count} events for message: {message_content}")
                
            except Exception as e:
                print(f"❌ Error in orchestrator: {e}")
                import traceback
                traceback.print_exc()
                await manager.send_message(thread_id, {
                    "type": "error",
                    "content": f"Error processing message: {str(e)}",
                    "timestamp": time.time()
                })
            
            # Add user message to history
            conversation_history.append({
                "role": "user", 
                "content": message_content,
                "timestamp": time.time()
            })
    
    except WebSocketDisconnect:
        manager.disconnect(thread_id)
    except Exception as e:
        await manager.send_message(thread_id, {
            "type": "error",
            "content": f"WebSocket error: {str(e)}",
            "timestamp": time.time()
        })
        manager.disconnect(thread_id)

# Performance stats endpoint
@app.get("/stats")
async def get_performance_stats():
    """Get system performance statistics"""
    gemini_client = get_gemini_client()
    tool_executor = get_tool_executor()
    orchestrator = get_orchestrator()
    redis_client = get_redis_client()
    
    return {
        "gemini": gemini_client.get_performance_stats(),
        "tools": tool_executor.get_performance_stats(),
        "orchestrator": orchestrator.get_stats(),
        "redis": redis_client.get_stats(),
        "websocket_connections": len(manager.active_connections),
        "timestamp": time.time()
    }

# Title generation endpoint
@app.post("/chat/title")
async def generate_chat_title(message: Message):
    """Generate a chat title using Gemini Flash Lite"""
    try:
        gemini_client = get_gemini_client()
        title = await gemini_client.generate_chat_title(message.content)
        
        return {"title": title, "thread_id": message.thread_id or "default"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Thread management endpoints
@app.get("/threads/{thread_id}/messages")
async def get_messages(thread_id: str):
    """Get conversation history for a thread"""
    # TODO: Implement with Redis storage
    return {"messages": [], "thread_id": thread_id}

@app.post("/threads")
async def create_thread():
    """Create a new conversation thread"""
    thread_id = str(uuid.uuid4())
    # TODO: Store thread in Redis
    return {"thread_id": thread_id}

# File operation handlers (background operations, no tool calls)
async def handle_file_upload(websocket: WebSocket, data: dict, thread_id: str):
    """Handle file upload to sandbox - background operation"""
    try:
        file_name = data.get("file_name")
        file_content = data.get("file_content")  # Base64 encoded
        file_size = data.get("file_size")
        file_type = data.get("file_type")
        
        if not file_name or not file_content:
            await manager.send_message(thread_id, {
                "type": "file_upload_error",
                "error": "Missing file name or content"
            })
            return
        
        # Decode base64 content
        import base64
        try:
            decoded_content = base64.b64decode(file_content)
        except Exception as e:
            await manager.send_message(thread_id, {
                "type": "file_upload_error",
                "error": f"Failed to decode file content: {str(e)}"
            })
            return
        
        # Upload to sandbox using Daytona client
        from services.daytona_client import get_daytona_client
        daytona_client = get_daytona_client()
        
        sandbox_path = f"/workspace/{file_name}"
        result = await daytona_client.write_file(sandbox_path, decoded_content.decode('utf-8', errors='ignore'))
        
        if result.get("success"):
            await manager.send_message(thread_id, {
                "type": "file_upload_success",
                "file_name": file_name,
                "sandbox_path": sandbox_path,
                "size": len(decoded_content),
                "type": file_type
            })
        else:
            await manager.send_message(thread_id, {
                "type": "file_upload_error",
                "error": f"Failed to upload file: {result.get('error', 'Unknown error')}"
            })
            
    except Exception as e:
        await manager.send_message(thread_id, {
            "type": "file_upload_error",
            "error": f"File upload failed: {str(e)}"
        })

async def handle_file_download(websocket: WebSocket, data: dict, thread_id: str):
    """Handle file download from sandbox - background operation"""
    try:
        file_path = data.get("file_path")
        
        if not file_path:
            await manager.send_message(thread_id, {
                "type": "file_download_error",
                "error": "Missing file path"
            })
            return
        
        # Download from sandbox using Daytona client
        from services.daytona_client import get_daytona_client
        daytona_client = get_daytona_client()
        
        result = await daytona_client.read_file(file_path)
        
        if result.get("success"):
            content = result.get("content", "")
            
            # Encode content as base64 for transfer
            import base64
            encoded_content = base64.b64encode(content.encode('utf-8')).decode('utf-8')
            
            await manager.send_message(thread_id, {
                "type": "file_download_success",
                "file_path": file_path,
                "file_name": os.path.basename(file_path),
                "content": encoded_content,
                "size": len(content)
            })
        else:
            await manager.send_message(thread_id, {
                "type": "file_download_error",
                "error": f"Failed to download file: {result.get('error', 'Unknown error')}"
            })
            
    except Exception as e:
        await manager.send_message(thread_id, {
            "type": "file_download_error",
            "error": f"File download failed: {str(e)}"
        })

async def handle_list_files(websocket: WebSocket, data: dict, thread_id: str):
    """Handle listing files in sandbox - background operation"""
    try:
        folder_path = data.get("folder_path", "/workspace")
        
        # List files using Daytona client
        from services.daytona_client import get_daytona_client
        daytona_client = get_daytona_client()
        
        result = await daytona_client.list_files(folder_path)
        
        if result.get("success"):
            files = result.get("files", [])
            await manager.send_message(thread_id, {
                "type": "list_files_success",
                "folder_path": folder_path,
                "files": files,
                "count": len(files)
            })
        else:
            await manager.send_message(thread_id, {
                "type": "list_files_error",
                "error": f"Failed to list files: {result.get('error', 'Unknown error')}"
            })
            
    except Exception as e:
        await manager.send_message(thread_id, {
            "type": "list_files_error",
            "error": f"List files failed: {str(e)}"
        })

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
