# Iris Dramatiq Worker - Ultra Fast Background Processing
import dramatiq
from dramatiq.brokers.redis import RedisBroker
import os
import asyncio
import time
import json
from urllib.parse import urlparse
from tools import execute_tool
from utils.redis_client import get_redis_client, JobStatus

# Configure Redis broker with URL parsing
redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
parsed_url = urlparse(redis_url)

redis_broker = RedisBroker(
    host=parsed_url.hostname or "localhost",
    port=parsed_url.port or 6379,
    password=parsed_url.password,
    db=int(parsed_url.path.lstrip('/')) if parsed_url.path else 0
)

dramatiq.set_broker(redis_broker)

@dramatiq.actor(max_retries=3, time_limit=30000)  # 30 second timeout
def execute_tool_task(tool_name: str, parameters: dict, job_id: str = None):
    """
    Execute tool in background with instant processing
    Ultra-fast worker for tool execution
    """
    try:
        # Update job status to running
        if job_id:
            redis_client = get_redis_client()
            asyncio.run(redis_client.update_job_status(job_id, JobStatus.RUNNING))
            asyncio.run(redis_client.add_job_event(job_id, "tool_started", {
                "tool_name": tool_name,
                "parameters": parameters
            }))
        
        # Run async tool execution
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        start_time = time.time()
        result = loop.run_until_complete(execute_tool(tool_name, **parameters))
        execution_time = (time.time() - start_time) * 1000
        
        # Add execution time to result
        result["execution_time_ms"] = round(execution_time, 2)
        
        loop.close()
        
        # Update job status to completed
        if job_id:
            asyncio.run(redis_client.update_job_status(job_id, JobStatus.COMPLETED, result=result))
            asyncio.run(redis_client.add_job_event(job_id, "tool_completed", {
                "tool_name": tool_name,
                "result": result,
                "execution_time_ms": execution_time
            }))
        
        return result
        
    except Exception as e:
        error_result = {"success": False, "error": str(e), "execution_time_ms": 0}
        
        # Update job status to failed
        if job_id:
            redis_client = get_redis_client()
            asyncio.run(redis_client.update_job_status(job_id, JobStatus.FAILED, error=str(e)))
            asyncio.run(redis_client.add_job_event(job_id, "tool_failed", {
                "tool_name": tool_name,
                "error": str(e)
            }))
        
        return error_result

@dramatiq.actor(max_retries=2, time_limit=10000)  # 10 second timeout
def process_chat_message(message: str, thread_id: str, job_id: str = None):
    """
    Process chat message with instant LLM response
    Ultra-fast message processing
    """
    try:
        # Update job status to running
        if job_id:
            redis_client = get_redis_client()
            asyncio.run(redis_client.update_job_status(job_id, JobStatus.RUNNING))
            asyncio.run(redis_client.add_job_event(job_id, "processing_started", {
                "message": message[:100] + "..." if len(message) > 100 else message,
                "thread_id": thread_id
            }))
        
        # TODO: Implement advanced chat processing with Gemini
        # This will be the core of instant chat processing
        
        result = {
            "success": True,
            "message": f"Processed: {message}",
            "thread_id": thread_id,
            "processing_time_ms": 50  # Simulate processing time
        }
        
        # Update job status to completed
        if job_id:
            redis_client = get_redis_client()
            asyncio.run(redis_client.update_job_status(job_id, JobStatus.COMPLETED, result=result))
            asyncio.run(redis_client.add_job_event(job_id, "processing_completed", {
                "result": result
            }))
        
        return result
        
    except Exception as e:
        error_result = {"success": False, "error": str(e)}
        
        # Update job status to failed
        if job_id:
            redis_client = get_redis_client()
            asyncio.run(redis_client.update_job_status(job_id, JobStatus.FAILED, error=str(e)))
            asyncio.run(redis_client.add_job_event(job_id, "processing_failed", {
                "error": str(e)
            }))
        
        return error_result

@dramatiq.actor(max_retries=1, time_limit=5000)  # 5 second timeout
def process_heavy_tool_task(tool_name: str, parameters: dict, job_id: str):
    """
    Process heavy/long-running tools in background
    For tools that take longer than 5 seconds
    """
    try:
        # Update job status to running
        redis_client = get_redis_client()
        asyncio.run(redis_client.update_job_status(job_id, JobStatus.RUNNING))
        asyncio.run(redis_client.add_job_event(job_id, "heavy_tool_started", {
            "tool_name": tool_name,
            "parameters": parameters
        }))
        
        # Run async tool execution
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        start_time = time.time()
        result = loop.run_until_complete(execute_tool(tool_name, **parameters))
        execution_time = (time.time() - start_time) * 1000
        
        # Add execution time to result
        result["execution_time_ms"] = round(execution_time, 2)
        result["tool_type"] = "heavy"
        
        loop.close()
        
        # Update job status to completed
        asyncio.run(redis_client.update_job_status(job_id, JobStatus.COMPLETED, result=result))
        asyncio.run(redis_client.add_job_event(job_id, "heavy_tool_completed", {
            "tool_name": tool_name,
            "result": result,
            "execution_time_ms": execution_time
        }))
        
        return result
        
    except Exception as e:
        error_result = {"success": False, "error": str(e), "execution_time_ms": 0}
        
        # Update job status to failed
        redis_client = get_redis_client()
        asyncio.run(redis_client.update_job_status(job_id, JobStatus.FAILED, error=str(e)))
        asyncio.run(redis_client.add_job_event(job_id, "heavy_tool_failed", {
            "tool_name": tool_name,
            "error": str(e)
        }))
        
        return error_result

# Worker health check
@dramatiq.actor
def health_check():
    """Worker health check"""
    return {
        "status": "healthy", 
        "worker": "iris-worker",
        "timestamp": time.time(),
        "redis_url": redis_url
    }

# Job processing worker
@dramatiq.actor(max_retries=1, time_limit=60000)  # 60 second timeout
def process_job_queue():
    """
    Process jobs from the queue
    This worker continuously processes jobs
    """
    try:
        redis_client = get_redis_client()
        
        # Get next job from queue
        job_id = asyncio.run(redis_client.get_next_job("normal"))
        
        if job_id:
            job_data = asyncio.run(redis_client.get_job(job_id))
            
            if job_data and job_data["status"] == JobStatus.PENDING.value:
                job_type = job_data["type"]
                parameters = job_data["parameters"]
                
                if job_type == "tool_execution":
                    # Execute tool
                    execute_tool_task.send(
                        parameters["tool_name"],
                        parameters["parameters"],
                        job_id
                    )
                elif job_type == "chat_processing":
                    # Process chat message
                    process_chat_message.send(
                        parameters["message"],
                        parameters["thread_id"],
                        job_id
                    )
                elif job_type == "heavy_tool":
                    # Process heavy tool
                    process_heavy_tool_task.send(
                        parameters["tool_name"],
                        parameters["parameters"],
                        job_id
                    )
        
        return {"processed": True, "timestamp": time.time()}
        
    except Exception as e:
        return {"processed": False, "error": str(e), "timestamp": time.time()}
