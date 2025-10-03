# Iris Backend Main Application - Ultra Fast FastAPI Setup
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="Iris API",
    description="Ultra-fast agentic AI system",
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

class ChatResponse(BaseModel):
    message: str
    tool_calls: Optional[List[ToolCall]] = None
    thread_id: str

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "iris-backend"}

# Chat endpoint - Main API
@app.post("/chat", response_model=ChatResponse)
async def chat(message: Message):
    """
    Main chat endpoint for instant AI responses with tool execution
    """
    try:
        # TODO: Implement instant LLM call with tool execution
        # This will be the core of Iris - ultra-fast responses
        
        return ChatResponse(
            message="Hello! I'm Iris, your ultra-fast AI assistant. Ready to help!",
            thread_id=message.thread_id or "default"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Tool execution endpoint
@app.post("/tools/execute")
async def execute_tool(tool_call: ToolCall):
    """
    Execute tools instantly with sub-100ms response times
    """
    try:
        # TODO: Implement instant tool execution
        # Shell, File, Web Search, Browser, Code, Computer tools
        
        return {"result": f"Tool {tool_call.tool_name} executed successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Thread management
@app.get("/threads/{thread_id}/messages")
async def get_messages(thread_id: str):
    """Get conversation history for a thread"""
    # TODO: Implement with Supabase
    return {"messages": [], "thread_id": thread_id}

@app.post("/threads")
async def create_thread():
    """Create a new conversation thread"""
    # TODO: Implement with Supabase
    return {"thread_id": "new_thread_123"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
