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
from dotenv import load_dotenv

# Import our services
from services.gemini_client import get_gemini_client
from services.tool_executor import get_tool_executor
from utils.redis_client import get_redis_client, JobStatus
from tools import get_tool_schemas

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="Iris Agentic AI API",
    description="Ultra-fast agentic AI system with real-time streaming and multi-tool execution",
    version="1.0.0"
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8081"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*"
        }
    )

# WebSocket chat endpoint (primary)
@app.websocket("/ws/chat/{thread_id}")
async def websocket_chat(websocket: WebSocket, thread_id: str):
    """WebSocket chat endpoint for real-time bidirectional communication"""
    await manager.connect(websocket, thread_id)
    
    try:
        gemini_client = get_gemini_client()
        tool_executor = get_tool_executor()
        redis_client = get_redis_client()
        
        # Get tool schemas
        tools = get_tool_schemas()
        
        while True:
            # Receive user message
            data = await websocket.receive_json()
            message_content = data.get("content", "")
            
            if not message_content:
                continue
            
            # Send acknowledgment
            await manager.send_message(thread_id, {
                "type": "ack",
                "timestamp": time.time()
            })
            
            # Stream Gemini response
            async for chunk in gemini_client.chat_with_tools_streaming(
                message_content, 
                tools
            ):
                if chunk["type"] == "text":
                    await manager.send_message(thread_id, {
                        "type": "text",
                        "content": chunk["content"],
                        "timestamp": chunk["timestamp"]
                    })
                
                elif chunk["type"] == "tool_call":
                    # Execute tool immediately
                    tool_results = await tool_executor.execute_tools_parallel([chunk])
                    
                    await manager.send_message(thread_id, {
                        "type": "tool_result",
                        "name": chunk["name"],
                        "result": tool_results[0]["result"],
                        "timestamp": chunk["timestamp"]
                    })
                
                elif chunk["type"] == "thinking":
                    await manager.send_message(thread_id, {
                        "type": "thinking",
                        "content": chunk["content"],
                        "timestamp": chunk["timestamp"]
                    })
                
                elif chunk["type"] == "error":
                    await manager.send_message(thread_id, {
                        "type": "error",
                        "content": chunk["content"],
                        "timestamp": chunk["timestamp"]
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
    redis_client = get_redis_client()
    
    return {
        "gemini": gemini_client.get_performance_stats(),
        "tools": tool_executor.get_performance_stats(),
        "redis": redis_client.get_stats(),
        "websocket_connections": len(manager.active_connections),
        "timestamp": time.time()
    }

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
