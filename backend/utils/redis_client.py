"""
Redis Client Helper - Jobs, Events, and Caching
Ultra-fast Redis operations for job management and real-time events
"""

import os
import json
import time
import uuid
from typing import Dict, Any, List, Optional, AsyncGenerator
from enum import Enum
import redis.asyncio as redis
from redis.asyncio import Redis


class JobStatus(Enum):
    """Job status enumeration"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class RedisClient:
    """Ultra-fast Redis client for jobs, events, and caching"""
    
    def __init__(self):
        self.redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        self.client: Optional[Redis] = None
        self.connected = False
        
        # Configuration
        self.job_ttl = int(os.getenv("JOB_TTL", "3600"))  # 1 hour default
        self.event_ttl = int(os.getenv("EVENT_TTL", "1800"))  # 30 minutes default
        self.max_events_per_job = int(os.getenv("MAX_EVENTS_PER_JOB", "1000"))
        
        # Performance tracking
        self.operations_count = 0
        self.cache_hits = 0
        self.cache_misses = 0
    
    async def connect(self) -> bool:
        """Connect to Redis server"""
        try:
            self.client = redis.from_url(self.redis_url)
            await self.client.ping()
            self.connected = True
            return True
        except Exception as e:
            print(f"Redis connection failed: {e}")
            self.connected = False
            return False
    
    async def disconnect(self):
        """Disconnect from Redis"""
        if self.client:
            await self.client.close()
            self.connected = False
    
    async def _ensure_connected(self):
        """Ensure Redis connection is active"""
        if not self.connected:
            await self.connect()
    
    # Job Management Methods
    
    async def create_job(
        self, 
        job_type: str, 
        parameters: Dict[str, Any], 
        priority: str = "normal",
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """Create a new job and return job ID"""
        await self._ensure_connected()
        
        job_id = str(uuid.uuid4())
        job_data = {
            "id": job_id,
            "type": job_type,
            "parameters": parameters,
            "priority": priority,
            "status": JobStatus.PENDING.value,
            "created_at": time.time(),
            "updated_at": time.time(),
            "metadata": metadata or {}
        }
        
        # Store job data
        await self.client.setex(
            f"job:{job_id}",
            self.job_ttl,
            json.dumps(job_data)
        )
        
        # Add to job queue
        await self.client.lpush(f"job_queue:{priority}", job_id)
        
        # Initialize events list
        await self.client.lpush(f"job:{job_id}:events", json.dumps({
            "type": "created",
            "message": f"Job {job_type} created",
            "timestamp": time.time(),
            "metadata": {"priority": priority}
        }))
        
        self.operations_count += 1
        return job_id
    
    async def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get job data by ID"""
        await self._ensure_connected()
        
        job_data = await self.client.get(f"job:{job_id}")
        if job_data:
            return json.loads(job_data)
        return None
    
    async def update_job_status(
        self, 
        job_id: str, 
        status: JobStatus, 
        result: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None
    ) -> bool:
        """Update job status and result"""
        await self._ensure_connected()
        
        job_data = await self.get_job(job_id)
        if not job_data:
            return False
        
        # Update job data
        job_data["status"] = status.value
        job_data["updated_at"] = time.time()
        
        if result:
            job_data["result"] = result
        if error:
            job_data["error"] = error
        
        # Store updated job
        await self.client.setex(
            f"job:{job_id}",
            self.job_ttl,
            json.dumps(job_data)
        )
        
        # Add status event
        await self.add_job_event(job_id, "status_update", {
            "status": status.value,
            "result": result,
            "error": error
        })
        
        self.operations_count += 1
        return True
    
    async def add_job_event(
        self, 
        job_id: str, 
        event_type: str, 
        data: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Add event to job timeline"""
        await self._ensure_connected()
        
        event = {
            "type": event_type,
            "timestamp": time.time(),
            "data": data or {}
        }
        
        # Add event to job timeline
        await self.client.lpush(f"job:{job_id}:events", json.dumps(event))
        
        # Trim events list to max size
        await self.client.ltrim(f"job:{job_id}:events", 0, self.max_events_per_job - 1)
        
        # Set TTL for events
        await self.client.expire(f"job:{job_id}:events", self.event_ttl)
        
        self.operations_count += 1
        return True
    
    async def get_job_events(
        self, 
        job_id: str, 
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get job events (most recent first)"""
        await self._ensure_connected()
        
        events_data = await self.client.lrange(f"job:{job_id}:events", 0, limit - 1)
        events = []
        
        for event_data in events_data:
            try:
                events.append(json.loads(event_data))
            except json.JSONDecodeError:
                continue
        
        return events
    
    async def stream_job_events(
        self, 
        job_id: str
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Stream job events in real-time"""
        await self._ensure_connected()
        
        # Get initial events
        events = await self.get_job_events(job_id)
        for event in reversed(events):  # Send oldest first
            yield event
        
        # Stream new events
        last_count = len(events)
        while True:
            await asyncio.sleep(0.1)  # Check every 100ms
            
            current_events = await self.get_job_events(job_id)
            if len(current_events) > last_count:
                # New events available
                new_events = current_events[:len(current_events) - last_count]
                for event in reversed(new_events):
                    yield event
                last_count = len(current_events)
    
    async def get_next_job(self, priority: str = "normal") -> Optional[str]:
        """Get next job from queue"""
        await self._ensure_connected()
        
        job_id = await self.client.rpop(f"job_queue:{priority}")
        if job_id:
            return job_id.decode() if isinstance(job_id, bytes) else job_id
        
        return None
    
    async def cancel_job(self, job_id: str) -> bool:
        """Cancel a job"""
        await self._ensure_connected()
        
        job_data = await self.get_job(job_id)
        if not job_data:
            return False
        
        if job_data["status"] in [JobStatus.COMPLETED.value, JobStatus.FAILED.value]:
            return False  # Cannot cancel completed/failed jobs
        
        # Update status
        await self.update_job_status(job_id, JobStatus.CANCELLED)
        
        # Remove from queue if still pending
        if job_data["status"] == JobStatus.PENDING.value:
            await self.client.lrem(f"job_queue:{job_data['priority']}", 1, job_id)
        
        return True
    
    # Caching Methods
    
    async def cache_set(
        self, 
        key: str, 
        value: Any, 
        ttl: int = 300
    ) -> bool:
        """Set cache value with TTL"""
        await self._ensure_connected()
        
        try:
            await self.client.setex(key, ttl, json.dumps(value))
            self.operations_count += 1
            return True
        except Exception:
            return False
    
    async def cache_get(self, key: str) -> Optional[Any]:
        """Get cache value"""
        await self._ensure_connected()
        
        try:
            value = await self.client.get(key)
            if value:
                self.cache_hits += 1
                return json.loads(value)
            else:
                self.cache_misses += 1
                return None
        except Exception:
            self.cache_misses += 1
            return None
    
    async def cache_delete(self, key: str) -> bool:
        """Delete cache value"""
        await self._ensure_connected()
        
        try:
            result = await self.client.delete(key)
            self.operations_count += 1
            return bool(result)
        except Exception:
            return False
    
    async def cache_clear_pattern(self, pattern: str) -> int:
        """Clear cache keys matching pattern"""
        await self._ensure_connected()
        
        try:
            keys = await self.client.keys(pattern)
            if keys:
                result = await self.client.delete(*keys)
                self.operations_count += 1
                return result
            return 0
        except Exception:
            return 0
    
    # Statistics and Monitoring
    
    def get_stats(self) -> Dict[str, Any]:
        """Get Redis client statistics"""
        total_requests = self.cache_hits + self.cache_misses
        hit_rate = (self.cache_hits / max(total_requests, 1)) * 100
        
        return {
            "connected": self.connected,
            "operations_count": self.operations_count,
            "cache_hits": self.cache_hits,
            "cache_misses": self.cache_misses,
            "cache_hit_rate": round(hit_rate, 2),
            "job_ttl": self.job_ttl,
            "event_ttl": self.event_ttl,
            "max_events_per_job": self.max_events_per_job
        }
    
    async def health_check(self) -> Dict[str, Any]:
        """Perform Redis health check"""
        try:
            await self._ensure_connected()
            
            # Test basic operations
            test_key = f"health_check:{time.time()}"
            await self.client.setex(test_key, 10, "test")
            await self.client.get(test_key)
            await self.client.delete(test_key)
            
            return {
                "status": "healthy",
                "connected": True,
                "latency_ms": 0,  # Could measure actual latency
                "timestamp": time.time()
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "connected": False,
                "error": str(e),
                "timestamp": time.time()
            }


# Global instance for singleton pattern
_redis_client: Optional[RedisClient] = None

def get_redis_client() -> RedisClient:
    """Get singleton Redis client instance"""
    global _redis_client
    if _redis_client is None:
        _redis_client = RedisClient()
    return _redis_client
