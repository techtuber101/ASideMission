# Iris Dramatiq Worker - Ultra Fast Background Processing

import dramatiq
from dramatiq.brokers.redis import RedisBroker
import os
from tools import execute_tool
import asyncio

# Configure Redis broker
redis_broker = RedisBroker(host=os.getenv("REDIS_HOST", "localhost"), port=int(os.getenv("REDIS_PORT", 6379)))
dramatiq.set_broker(redis_broker)

@dramatiq.actor(max_retries=3, time_limit=30000)  # 30 second timeout
def execute_tool_task(tool_name: str, parameters: dict):
    """
    Execute tool in background with instant processing
    Ultra-fast worker for tool execution
    """
    try:
        # Run async tool execution
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        result = loop.run_until_complete(execute_tool(tool_name, **parameters))
        loop.close()
        
        return result
    except Exception as e:
        return {"success": False, "error": str(e)}

@dramatiq.actor(max_retries=2, time_limit=10000)  # 10 second timeout
def process_chat_message(message: str, thread_id: str):
    """
    Process chat message with instant LLM response
    Ultra-fast message processing
    """
    try:
        # TODO: Implement instant LLM processing
        # This will be the core of instant chat processing
        
        return {
            "success": True,
            "message": f"Processed: {message}",
            "thread_id": thread_id
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

# Worker health check
@dramatiq.actor
def health_check():
    """Worker health check"""
    return {"status": "healthy", "worker": "iris-worker"}
