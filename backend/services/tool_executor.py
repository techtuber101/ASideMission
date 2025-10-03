"""
Tool Executor - Ultra Fast Parallel Execution with Caching and Retries
Optimized for instant tool execution with intelligent caching and error handling
"""

import os
import time
import asyncio
import hashlib
import json
from typing import Dict, Any, List, Optional, Union
from functools import lru_cache
import redis.asyncio as redis
from tools import execute_tool, TOOLS


class ToolExecutor:
    """Ultra-fast tool executor with parallel execution, caching, and retries"""
    
    def __init__(self):
        self.tools = TOOLS
        self.execution_cache = {}
        self.redis_client = None
        self.cache_ttl = int(os.getenv("TOOL_CACHE_TTL", "300"))  # 5 minutes default
        
        # Tool-specific timeouts (in seconds)
        self.tool_timeouts = {
            "shell": 5,
            "file": 1,
            "web_search": 2,
            "browser": 10,
            "code": 5,
            "computer": 1
        }
        
        # Retry configuration
        self.max_retries = {
            "shell": 0,  # Non-idempotent
            "file": 2,   # Idempotent for read operations
            "web_search": 2,  # Idempotent
            "browser": 1,  # Semi-idempotent
            "code": 0,   # Non-idempotent
            "computer": 2  # Idempotent
        }
        
        # Performance tracking
        self.execution_stats = {}
        self.total_executions = 0
        self.cache_hits = 0
    
    async def _get_redis_client(self) -> Optional[redis.Redis]:
        """Get Redis client for caching"""
        if self.redis_client is None:
            try:
                redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
                self.redis_client = redis.from_url(redis_url)
                await self.redis_client.ping()
            except Exception:
                self.redis_client = None
        return self.redis_client
    
    def _generate_cache_key(self, tool_name: str, parameters: Dict[str, Any]) -> str:
        """Generate cache key for tool execution"""
        # Sort parameters for consistent keys
        sorted_params = json.dumps(parameters, sort_keys=True)
        key_string = f"{tool_name}:{sorted_params}"
        return hashlib.md5(key_string.encode()).hexdigest()
    
    async def _get_cached_result(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """Get cached result from Redis or memory"""
        # Try Redis first
        redis_client = await self._get_redis_client()
        if redis_client:
            try:
                cached = await redis_client.get(f"tool_cache:{cache_key}")
                if cached:
                    self.cache_hits += 1
                    return json.loads(cached)
            except Exception:
                pass
        
        # Fallback to memory cache
        if cache_key in self.execution_cache:
            cached_data = self.execution_cache[cache_key]
            if time.time() - cached_data["timestamp"] < self.cache_ttl:
                self.cache_hits += 1
                return cached_data["result"]
            else:
                del self.execution_cache[cache_key]
        
        return None
    
    async def _cache_result(self, cache_key: str, result: Dict[str, Any]):
        """Cache result in Redis and memory"""
        cache_data = {
            "result": result,
            "timestamp": time.time()
        }
        
        # Cache in memory
        self.execution_cache[cache_key] = cache_data
        
        # Cache in Redis
        redis_client = await self._get_redis_client()
        if redis_client:
            try:
                await redis_client.setex(
                    f"tool_cache:{cache_key}",
                    self.cache_ttl,
                    json.dumps(result)
                )
            except Exception:
                pass
    
    async def execute_tools_parallel(
        self, 
        tool_calls: List[Dict[str, Any]],
        priority: str = "normal"
    ) -> List[Dict[str, Any]]:
        """
        Execute multiple tools in parallel for maximum speed
        
        Args:
            tool_calls: List of tool calls with 'name' and 'args'
            priority: Execution priority ('low', 'normal', 'high')
        
        Returns:
            List of execution results
        """
        if not tool_calls:
            return []
        
        # Create execution tasks
        tasks = []
        for call in tool_calls:
            task = asyncio.create_task(
                self._execute_single_tool_with_retry(
                    call["name"], 
                    call["args"], 
                    priority
                )
            )
            tasks.append(task)
        
        # Execute all tools in parallel
        start_time = time.time()
        results = await asyncio.gather(*tasks, return_exceptions=True)
        total_time = time.time() - start_time
        
        # Process results
        processed_results = []
        for i, (call, result) in enumerate(zip(tool_calls, results)):
            if isinstance(result, Exception):
                processed_results.append({
                    "name": call["name"],
                    "success": False,
                    "error": str(result),
                    "execution_time_ms": 0,
                    "timestamp": time.time(),
                    "cached": False
                })
            else:
                processed_results.append({
                    "name": call["name"],
                    "success": result.get("success", True),
                    "result": result,
                    "execution_time_ms": result.get("execution_time_ms", 0),
                    "timestamp": time.time(),
                    "cached": result.get("cached", False)
                })
        
        # Update statistics
        self.total_executions += len(tool_calls)
        self._update_stats("parallel_execution", total_time, len(tool_calls))
        
        return processed_results
    
    async def _execute_single_tool_with_retry(
        self, 
        tool_name: str, 
        parameters: Dict[str, Any], 
        priority: str = "normal"
    ) -> Dict[str, Any]:
        """Execute a single tool with retry logic and caching"""
        
        # Check cache first (for idempotent operations)
        cache_key = self._generate_cache_key(tool_name, parameters)
        cached_result = await self._get_cached_result(cache_key)
        if cached_result:
            cached_result["cached"] = True
            return cached_result
        
        # Get retry configuration
        max_retries = self.max_retries.get(tool_name, 1)
        timeout = self.tool_timeouts.get(tool_name, 5)
        
        # Execute with retries
        last_exception = None
        for attempt in range(max_retries + 1):
            try:
                start_time = time.time()
                
                # Execute tool with timeout
                result = await asyncio.wait_for(
                    execute_tool(tool_name, **parameters),
                    timeout=timeout
                )
                
                execution_time = (time.time() - start_time) * 1000
                result["execution_time_ms"] = round(execution_time, 2)
                result["cached"] = False
                
                # Cache result if successful and idempotent
                if result.get("success", True) and max_retries > 0:
                    await self._cache_result(cache_key, result)
                
                # Update statistics
                self._update_stats(tool_name, execution_time / 1000, 1)
                
                return result
                
            except asyncio.TimeoutError:
                last_exception = Exception(f"Tool {tool_name} timed out after {timeout}s")
            except Exception as e:
                last_exception = e
            
            # Wait before retry (exponential backoff)
            if attempt < max_retries:
                wait_time = 0.1 * (2 ** attempt)
                await asyncio.sleep(wait_time)
        
        # All retries failed
        return {
            "success": False,
            "error": str(last_exception),
            "execution_time_ms": 0,
            "cached": False
        }
    
    def _update_stats(self, tool_name: str, execution_time: float, count: int):
        """Update execution statistics"""
        if tool_name not in self.execution_stats:
            self.execution_stats[tool_name] = {
                "count": 0,
                "total_time": 0.0,
                "avg_time": 0.0,
                "min_time": float('inf'),
                "max_time": 0.0
            }
        
        stats = self.execution_stats[tool_name]
        stats["count"] += count
        stats["total_time"] += execution_time
        stats["avg_time"] = stats["total_time"] / stats["count"]
        stats["min_time"] = min(stats["min_time"], execution_time)
        stats["max_time"] = max(stats["max_time"], execution_time)
    
    async def execute_tool_sync(
        self, 
        tool_name: str, 
        parameters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute a single tool synchronously (for simple cases)"""
        return await self._execute_single_tool_with_retry(tool_name, parameters)
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """Get performance statistics"""
        cache_hit_rate = (self.cache_hits / max(self.total_executions, 1)) * 100
        
        return {
            "total_executions": self.total_executions,
            "cache_hits": self.cache_hits,
            "cache_hit_rate": round(cache_hit_rate, 2),
            "tool_stats": self.execution_stats,
            "cache_ttl": self.cache_ttl,
            "tool_timeouts": self.tool_timeouts,
            "max_retries": self.max_retries
        }
    
    def update_tool_timeout(self, tool_name: str, timeout: int):
        """Update timeout for a specific tool"""
        self.tool_timeouts[tool_name] = timeout
    
    def update_max_retries(self, tool_name: str, max_retries: int):
        """Update max retries for a specific tool"""
        self.max_retries[tool_name] = max_retries
    
    async def clear_cache(self, tool_name: Optional[str] = None):
        """Clear cache for specific tool or all tools"""
        if tool_name:
            # Clear specific tool cache
            keys_to_remove = [
                key for key in self.execution_cache.keys() 
                if key.startswith(f"{tool_name}:")
            ]
            for key in keys_to_remove:
                del self.execution_cache[key]
        else:
            # Clear all cache
            self.execution_cache.clear()
        
        # Clear Redis cache
        redis_client = await self._get_redis_client()
        if redis_client:
            try:
                if tool_name:
                    pattern = f"tool_cache:{tool_name}:*"
                else:
                    pattern = "tool_cache:*"
                
                keys = await redis_client.keys(pattern)
                if keys:
                    await redis_client.delete(*keys)
            except Exception:
                pass


# Global instance for singleton pattern
_tool_executor: Optional[ToolExecutor] = None

def get_tool_executor() -> ToolExecutor:
    """Get singleton tool executor instance"""
    global _tool_executor
    if _tool_executor is None:
        _tool_executor = ToolExecutor()
    return _tool_executor
