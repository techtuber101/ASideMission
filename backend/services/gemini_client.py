"""
Gemini 2.5 Flash Client - Ultra Fast Streaming with Function Calling
Optimized for instant responses and real-time tool execution
"""

import os
import time
import asyncio
import json
from typing import AsyncGenerator, Dict, Any, List, Optional
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold


class GeminiClient:
    """Ultra-fast Gemini 2.5 Flash client with streaming and function calling"""
    
    def __init__(self):
        # Configure Gemini API
        genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
        
        # Model configuration for maximum speed
        self.model_name = os.getenv("GEMINI_MODEL", "gemini-2.0-flash-exp")
        self.thinking_budget = os.getenv("GEMINI_THINKING_BUDGET", "medium")
        
        # Initialize model with optimized settings
        self.model = genai.GenerativeModel(
            model_name=self.model_name,
            generation_config={
                "temperature": 0.7,
                "top_p": 0.8,
                "top_k": 40,
                "max_output_tokens": 8192,
                "candidate_count": 1,
                "stop_sequences": [],
            },
            safety_settings={
                HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            }
        )
        
        # Performance tracking
        self.request_count = 0
        self.total_tokens = 0
        self.avg_response_time = 0.0
    
    def _build_function_declarations(self, tools: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Convert tool schemas to Gemini function declarations"""
        function_declarations = []
        
        for tool in tools:
            if "function" in tool:
                func = tool["function"]
                function_declarations.append({
                    "name": func["name"],
                    "description": func["description"],
                    "parameters": func["parameters"]
                })
        
        return function_declarations
    
    async def chat_with_tools_streaming(
        self, 
        message: str, 
        tools: List[Dict[str, Any]], 
        thread_history: Optional[List[Dict[str, str]]] = None,
        thinking_budget: Optional[str] = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Stream chat response with function calling support
        
        Yields:
        - {"type": "text", "content": str, "timestamp": float}
        - {"type": "tool_call", "name": str, "args": dict, "timestamp": float}
        - {"type": "thinking", "content": str, "timestamp": float}
        - {"type": "error", "content": str, "timestamp": float}
        """
        start_time = time.time()
        self.request_count += 1
        
        try:
            # Build conversation context for Gemini
            messages = []
            if thread_history:
                for msg in thread_history:
                    if msg["role"] == "user":
                        messages.append({"role": "user", "parts": [{"text": msg["content"]}]})
                    elif msg["role"] == "assistant":
                        messages.append({"role": "model", "parts": [{"text": msg["content"]}]})
            
            # Add current user message
            messages.append({"role": "user", "parts": [{"text": message}]})
            
            # Configure tools if provided
            tools_config = None
            if tools:
                function_declarations = self._build_function_declarations(tools)
                if function_declarations:
                    tools_config = [{"function_declarations": function_declarations}]
            
            # Set thinking budget
            current_thinking = thinking_budget or self.thinking_budget
            
            # Generate content with streaming
            generation_config = {
                "temperature": 0.7,
                "top_p": 0.8,
                "top_k": 40,
                "max_output_tokens": 8192,
                "candidate_count": 1,
            }
            
            # Add thinking budget if supported
            if hasattr(self.model, 'generation_config'):
                generation_config["thinking_budget"] = current_thinking
            
            # Use synchronous streaming in a thread to avoid blocking
            def sync_stream():
                return self.model.generate_content(
                    messages,
                    tools=tools_config,
                    generation_config=generation_config,
                    stream=True
                )
            
            # Run synchronous streaming in executor
            loop = asyncio.get_event_loop()
            response_stream = await loop.run_in_executor(None, sync_stream)
            
            # Stream the response
            for chunk in response_stream:
                chunk_time = time.time()
                
                # Handle text content
                if hasattr(chunk, 'text') and chunk.text:
                    yield {
                        "type": "text",
                        "content": chunk.text,
                        "timestamp": chunk_time
                    }
                
                # Handle function calls
                if hasattr(chunk, 'function_calls') and chunk.function_calls:
                    for call in chunk.function_calls:
                        yield {
                            "type": "tool_call",
                            "name": call.name,
                            "args": call.args if hasattr(call, 'args') else {},
                            "timestamp": chunk_time
                        }
                
                # Handle thinking content (if available)
                if hasattr(chunk, 'thinking') and chunk.thinking:
                    yield {
                        "type": "thinking",
                        "content": chunk.thinking,
                        "timestamp": chunk_time
                    }
                
                # Yield control to allow other tasks
                await asyncio.sleep(0)
            
            # Update performance metrics
            total_time = time.time() - start_time
            self.avg_response_time = (self.avg_response_time * (self.request_count - 1) + total_time) / self.request_count
            
        except Exception as e:
            yield {
                "type": "error",
                "content": f"Gemini API error: {str(e)}",
                "timestamp": time.time()
            }
    
    async def chat_simple(
        self, 
        message: str, 
        thread_history: Optional[List[Dict[str, str]]] = None
    ) -> str:
        """Simple non-streaming chat for instant responses"""
        try:
            # Build conversation context for Gemini
            messages = []
            if thread_history:
                for msg in thread_history:
                    if msg["role"] == "user":
                        messages.append({"role": "user", "parts": [{"text": msg["content"]}]})
                    elif msg["role"] == "assistant":
                        messages.append({"role": "model", "parts": [{"text": msg["content"]}]})
            
            # Add current user message
            messages.append({"role": "user", "parts": [{"text": message}]})
            
            response = await self.model.generate_content_async(messages)
            return response.text if response.text else "I'm ready to help!"
            
        except Exception as e:
            return f"Error: {str(e)}"
    
    async def chat_with_tools_sync(
        self, 
        message: str, 
        tools: List[Dict[str, Any]], 
        thread_history: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """Synchronous chat with tools for instant responses"""
        try:
            # Build conversation context for Gemini
            messages = []
            if thread_history:
                for msg in thread_history:
                    if msg["role"] == "user":
                        messages.append({"role": "user", "parts": [{"text": msg["content"]}]})
                    elif msg["role"] == "assistant":
                        messages.append({"role": "model", "parts": [{"text": msg["content"]}]})
            
            # Add current user message
            messages.append({"role": "user", "parts": [{"text": message}]})
            
            # Configure tools
            tools_config = None
            if tools:
                function_declarations = self._build_function_declarations(tools)
                if function_declarations:
                    tools_config = [{"function_declarations": function_declarations}]
            
            response = await self.model.generate_content_async(
                messages,
                tools=tools_config
            )
            
            result = {
                "text": response.text if response.text else "",
                "tool_calls": [],
                "timestamp": time.time()
            }
            
            # Extract function calls
            if hasattr(response, 'function_calls') and response.function_calls:
                for call in response.function_calls:
                    result["tool_calls"].append({
                        "name": call.name,
                        "args": call.args if hasattr(call, 'args') else {}
                    })
            
            return result
            
        except Exception as e:
            return {
                "text": f"Error: {str(e)}",
                "tool_calls": [],
                "timestamp": time.time()
            }
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """Get performance statistics"""
        return {
            "request_count": self.request_count,
            "total_tokens": self.total_tokens,
            "avg_response_time": round(self.avg_response_time, 3),
            "model_name": self.model_name,
            "thinking_budget": self.thinking_budget
        }
    
    def update_thinking_budget(self, budget: str):
        """Update thinking budget for cost/performance optimization"""
        valid_budgets = ["low", "medium", "high"]
        if budget in valid_budgets:
            self.thinking_budget = budget


# Global instance for singleton pattern
_gemini_client: Optional[GeminiClient] = None

def get_gemini_client() -> GeminiClient:
    """Get singleton Gemini client instance"""
    global _gemini_client
    if _gemini_client is None:
        _gemini_client = GeminiClient()
    return _gemini_client
