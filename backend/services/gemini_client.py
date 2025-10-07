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
from dotenv import load_dotenv

# Load environment variables
# Load environment variables from root directory
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))


class GeminiClient:
    """Ultra-fast Gemini 2.5 Flash client with streaming and function calling"""
    
    def __init__(self):
        # Configure Gemini API
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key or api_key == "your-google-api-key-here":
            self.api_key_configured = False
            print("⚠️  GOOGLE_API_KEY not configured - Gemini client will return error messages")
            return
        
        try:
            genai.configure(api_key=api_key)
            self.api_key_configured = True
        except Exception as e:
            print(f"❌ Failed to configure Gemini API: {e}")
            self.api_key_configured = False
            return
        
        # Model configuration for maximum speed
        self.model_name = os.getenv("GEMINI_MODEL", "gemini-2.0-flash-exp")
        self.thinking_budget = os.getenv("GEMINI_THINKING_BUDGET", "medium")
        
        # BLAZING FAST streaming settings - MAXIMUM SPEED
        self.ultra_fast_streaming = os.getenv("ULTRA_FAST_STREAMING", "true").lower() == "true"
        self.streaming_mode = os.getenv("STREAMING_MODE", "character")  # character, word, chunk
        self.streaming_chunk_size = int(os.getenv("STREAMING_CHUNK_SIZE", "10"))  # LARGE batches for speed
        self.streaming_delay = float(os.getenv("STREAMING_DELAY", "0"))  # ZERO delay - MAXIMUM SPEED
        
        # Initialize model with optimized settings for faster streaming
        self.model = genai.GenerativeModel(
            model_name=self.model_name,
            generation_config={
                "temperature": 0.7,
                "top_p": 0.8,
                "top_k": 40,
                "max_output_tokens": 8192,
                "candidate_count": 1,
                "stop_sequences": [],
                # MAXIMUM SPEED optimizations
                "response_mime_type": "text/plain",  # Faster than JSON
                "response_schema": None,  # No schema validation for speed
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
        
        # System instructions for agentic AI behavior
        self.system_instructions = self._get_system_instructions()
    
    def _get_system_instructions(self) -> str:
        """Comprehensive system instructions for agentic AI behavior"""
        return """You are Iris, an advanced autonomous AI agent with access to powerful tools and capabilities. Your mission is to be helpful, accurate, and proactive in solving complex problems.

## Core Identity
- You are a sophisticated AI assistant capable of autonomous reasoning, planning, and execution
- You can use multiple tools simultaneously and coordinate complex multi-step workflows
- You think step-by-step, plan ahead, and adapt your approach based on results
- You provide clear, actionable responses and explain your reasoning process

## Tool Usage Philosophy
- **Be Proactive**: Use tools whenever they would provide better, more accurate, or more current information
- **Think Systematically**: Break down complex tasks into smaller, manageable steps
- **Execute in Parallel**: When possible, run multiple tools simultaneously for efficiency
- **Validate Results**: Cross-reference information from multiple sources when accuracy is critical
- **Learn and Adapt**: Use tool results to refine your understanding and approach

## Tool Capabilities
- **web_search**: Search the web for current information, news, facts, and data
- **web_scrape**: Extract detailed content from specific web pages
- **shell**: Execute shell commands in a secure sandbox environment
- **file**: Read, write, and manage files in the sandbox
- **code**: Execute code in various programming languages
- **computer**: Get system information and perform local operations

## Execution Guidelines
1. **Always use tools when they would improve your response**
2. **Search for current information** when discussing recent events, news, or developments
3. **Verify facts** by checking multiple sources when accuracy is important
4. **Execute code** when users ask for calculations, data analysis, or programming help
5. **Read/write files** when working with documents, data, or code
6. **Use shell commands** for system operations, file management, or tool installation

## Response Format
- Start with a brief acknowledgment of the user's request
- Explain your plan and reasoning
- Execute tools as needed, showing progress
- Synthesize results into a comprehensive response
- Provide actionable next steps or recommendations

## Error Handling
- If a tool fails, try alternative approaches or explain limitations
- Always provide helpful information even when tools are unavailable
- Be transparent about what you can and cannot do

Remember: You are an autonomous agent. Use your tools proactively to provide the best possible assistance. Don't just answer questions - solve problems comprehensively."""
    
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
        thinking_budget: Optional[str] = None,
        ultra_fast_streaming: Optional[bool] = None
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
        
        # Use instance setting if not overridden
        if ultra_fast_streaming is None:
            ultra_fast_streaming = self.ultra_fast_streaming
        
        try:
            # Build conversation context for Gemini with system instructions
            messages = []
            
            # Add system instructions as the first message
            messages.append({"role": "user", "parts": [{"text": self.system_instructions}]})
            messages.append({"role": "model", "parts": [{"text": "I understand. I am Iris, an autonomous AI agent with access to powerful tools. I will use them proactively to provide comprehensive assistance and solve problems systematically."}]})
            
            # Add thread history
            if thread_history:
                for msg in thread_history:
                    content = msg.get("content", "").strip()
                    if content:  # Only add non-empty messages
                        if msg["role"] == "user":
                            messages.append({"role": "user", "parts": [{"text": content}]})
                        elif msg["role"] == "assistant":
                            messages.append({"role": "model", "parts": [{"text": content}]})
            
            # Add current user message (ensure it's not empty)
            if message and message.strip():
                messages.append({"role": "user", "parts": [{"text": message.strip()}]})
            
            # Configure tools if provided
            tools_config = None
            if tools:
                function_declarations = self._build_function_declarations(tools)
                if function_declarations:
                    tools_config = [{"function_declarations": function_declarations}]
            
            # Generate content with streaming (thinking disabled)
            generation_config = {
                "temperature": 0.7,
                "top_p": 0.8,
                "top_k": 40,
                "max_output_tokens": 8192,
                "candidate_count": 1,
            }
            
            # Use synchronous streaming in a thread to avoid blocking
            def sync_stream():
                # For Gemini 2.0 Flash, we need to use generate_content with tools parameter
                if tools_config:
                    return self.model.generate_content(
                        messages,
                        tools=tools_config,
                        generation_config=generation_config,
                        stream=True
                    )
                else:
                    return self.model.generate_content(
                        messages,
                        generation_config=generation_config,
                        stream=True
                    )
            
            # Run synchronous streaming in executor
            loop = asyncio.get_event_loop()
            response_stream = await loop.run_in_executor(None, sync_stream)
            
            # Stream the response with immediate token yielding
            for chunk in response_stream:
                chunk_time = time.time()
                
                # Handle text content - check for valid parts first
                try:
                    if hasattr(chunk, 'text') and chunk.text:
                        # Split text into individual tokens/words for faster streaming
                        text_content = chunk.text
                        if ultra_fast_streaming and len(text_content) > 3:
                            # BLAZING FAST mode: stream in LARGE batches for MAXIMUM SPEED
                            chunk_size = self.streaming_chunk_size  # LARGE chunks for speed
                            for i in range(0, len(text_content), chunk_size):
                                char_batch = text_content[i:i + chunk_size]
                                yield {
                                    "type": "text",
                                    "content": char_batch,
                                    "timestamp": chunk_time  # SAME timestamp - NO delays!
                                }
                                # ABSOLUTELY NO delays - MAXIMUM SPEED!
                        elif len(text_content) > 10:  # Only split longer chunks
                            # Word-level streaming for balance of speed and readability
                            words = text_content.split(' ')
                            for i, word in enumerate(words):
                                if word.strip():  # Skip empty words
                                    yield {
                                        "type": "text",
                                        "content": word + (' ' if i < len(words) - 1 else ''),
                                        "timestamp": chunk_time + (i * 0.001)  # Slight delay for ordering
                                    }
                                    # NO delays - MAXIMUM SPEED!
                        else:
                            # For short chunks, yield immediately - NO processing delays
                            yield {
                                "type": "text",
                                "content": text_content,
                                "timestamp": chunk_time
                            }
                except Exception as text_error:
                    # If text access fails, try to get text from parts
                    try:
                        if hasattr(chunk, 'parts') and chunk.parts:
                            text_content = ""
                            for part in chunk.parts:
                                if hasattr(part, 'text') and part.text:
                                    text_content += part.text
                            if text_content:
                                # Apply same BLAZING FAST streaming to parts
                                if ultra_fast_streaming and len(text_content) > 3:
                                    # BLAZING FAST mode: stream in LARGE batches
                                    chunk_size = self.streaming_chunk_size
                                    for i in range(0, len(text_content), chunk_size):
                                        char_batch = text_content[i:i + chunk_size]
                                        yield {
                                            "type": "text",
                                            "content": char_batch,
                                            "timestamp": chunk_time  # SAME timestamp - NO delays!
                                        }
                                        # ABSOLUTELY NO delays - MAXIMUM SPEED!
                                elif len(text_content) > 10:
                                    words = text_content.split(' ')
                                    for i, word in enumerate(words):
                                        if word.strip():
                                            yield {
                                                "type": "text",
                                                "content": word + (' ' if i < len(words) - 1 else ''),
                                                "timestamp": chunk_time + (i * 0.001)
                                            }
                                else:
                                    yield {
                                        "type": "text",
                                        "content": text_content,
                                        "timestamp": chunk_time
                                    }
                    except Exception as parts_error:
                        # Skip text if both methods fail
                        pass
                
                # Handle function calls - check multiple possible attributes
                function_calls = None
                if hasattr(chunk, 'function_calls') and chunk.function_calls:
                    function_calls = chunk.function_calls
                elif hasattr(chunk, 'candidates') and chunk.candidates:
                    # Check candidates for function calls
                    for candidate in chunk.candidates:
                        if hasattr(candidate, 'content') and candidate.content:
                            if hasattr(candidate.content, 'parts'):
                                for part in candidate.content.parts:
                                    if hasattr(part, 'function_call') and part.function_call:
                                        if not function_calls:
                                            function_calls = []
                                        function_calls.append(part.function_call)
                
                if function_calls:
                    for call in function_calls:
                        # Convert MapComposite to dict if needed
                        args = call.args if hasattr(call, 'args') else {}
                        if hasattr(args, 'items'):
                            # Convert MapComposite to regular dict
                            args = dict(args)
                        
                        yield {
                            "type": "tool_call",
                            "name": call.name,
                            "args": args,
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
    
    async def chat_simple_streaming(
        self, 
        message: str, 
        thread_history: Optional[List[Dict[str, str]]] = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Simple streaming chat for real-time token responses"""
        try:
            # Build conversation context for Gemini with system instructions
            messages = []
            
            # Add system instructions as the first message
            messages.append({"role": "user", "parts": [{"text": self.system_instructions}]})
            messages.append({"role": "model", "parts": [{"text": "I understand. I am Iris, an autonomous AI agent with access to powerful tools. I will use them proactively to provide comprehensive assistance and solve problems systematically."}]})
            
            # Add thread history
            if thread_history:
                for msg in thread_history:
                    content = msg.get("content", "").strip()
                    if content:  # Only add non-empty messages
                        if msg["role"] == "user":
                            messages.append({"role": "user", "parts": [{"text": content}]})
                        elif msg["role"] == "assistant":
                            messages.append({"role": "model", "parts": [{"text": content}]})
            
            # Add current message
            messages.append({"role": "user", "parts": [{"text": message}]})
            
            # Generate streaming response
            generation_config = {
                "temperature": 0.7,
                "top_p": 0.8,
                "top_k": 40,
                "max_output_tokens": 8192,
                "candidate_count": 1,
                "stop_sequences": []
            }
            
            safety_settings = {
                HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            }
            
            response = self.model.generate_content(
                messages,
                stream=True,
                generation_config=generation_config,
                safety_settings=safety_settings
            )
            
            # Stream the response tokens
            for chunk in response:
                if chunk.text:
                    yield {
                        "type": "text",
                        "content": chunk.text,
                        "timestamp": time.time()
                    }
                    
        except Exception as e:
            yield {
                "type": "error",
                "content": f"Error in streaming chat: {str(e)}",
                "timestamp": time.time()
            }

    async def chat_simple(
        self, 
        message: str, 
        thread_history: Optional[List[Dict[str, str]]] = None
    ) -> str:
        """Simple non-streaming chat for instant responses"""
        try:
            # Build conversation context for Gemini with system instructions
            messages = []
            
            # Add system instructions as the first message
            messages.append({"role": "user", "parts": [{"text": self.system_instructions}]})
            messages.append({"role": "model", "parts": [{"text": "I understand. I am Iris, an autonomous AI agent with access to powerful tools. I will use them proactively to provide comprehensive assistance and solve problems systematically."}]})
            
            # Add thread history
            if thread_history:
                for msg in thread_history:
                    content = msg.get("content", "").strip()
                    if content:  # Only add non-empty messages
                        if msg["role"] == "user":
                            messages.append({"role": "user", "parts": [{"text": content}]})
                        elif msg["role"] == "assistant":
                            messages.append({"role": "model", "parts": [{"text": content}]})
            
            # Add current user message (ensure it's not empty)
            if message and message.strip():
                messages.append({"role": "user", "parts": [{"text": message.strip()}]})
            
            response = await self.model.generate_content_async(messages)
            try:
                return response.text if response.text else "I'm ready to help!"
            except Exception:
                # If text access fails, try to get text from parts
                if hasattr(response, 'parts') and response.parts:
                    text_content = ""
                    for part in response.parts:
                        if hasattr(part, 'text') and part.text:
                            text_content += part.text
                    return text_content if text_content else "I'm ready to help!"
                return "I'm ready to help!"
            
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
            # Build conversation context for Gemini with system instructions
            messages = []
            
            # Add system instructions as the first message
            messages.append({"role": "user", "parts": [{"text": self.system_instructions}]})
            messages.append({"role": "model", "parts": [{"text": "I understand. I am Iris, an autonomous AI agent with access to powerful tools. I will use them proactively to provide comprehensive assistance and solve problems systematically."}]})
            
            # Add thread history
            if thread_history:
                for msg in thread_history:
                    content = msg.get("content", "").strip()
                    if content:  # Only add non-empty messages
                        if msg["role"] == "user":
                            messages.append({"role": "user", "parts": [{"text": content}]})
                        elif msg["role"] == "assistant":
                            messages.append({"role": "model", "parts": [{"text": content}]})
            
            # Add current user message (ensure it's not empty)
            if message and message.strip():
                messages.append({"role": "user", "parts": [{"text": message.strip()}]})
            
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
            
            # Extract text content safely
            text_content = ""
            try:
                text_content = response.text if response.text else ""
            except Exception:
                # If text access fails, try to get text from parts
                if hasattr(response, 'parts') and response.parts:
                    for part in response.parts:
                        if hasattr(part, 'text') and part.text:
                            text_content += part.text
            
            result = {
                "text": text_content,
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
    
    async def chat_next_turn(
        self, 
        message: str, 
        conversation_history: List[Dict[str, Any]], 
        tool_results: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """Get next turn in conversation with optional tool results"""
        try:
            # Build conversation context
            messages = []
            
            # Add system instructions
            messages.append({"role": "user", "parts": [{"text": self.system_instructions}]})
            messages.append({"role": "model", "parts": [{"text": "I understand. I am Iris, an autonomous AI agent with access to powerful tools. I will use them proactively to provide comprehensive assistance and solve problems systematically."}]})
            
            # Add conversation history
            for msg in conversation_history:
                content = msg.get("content", "").strip()
                if content:
                    if msg["role"] == "user":
                        messages.append({"role": "user", "parts": [{"text": content}]})
                    elif msg["role"] == "assistant":
                        messages.append({"role": "model", "parts": [{"text": content}]})
            
            # Add current message
            if message and message.strip():
                messages.append({"role": "user", "parts": [{"text": message.strip()}]})
            
            # Add tool results if provided
            if tool_results:
                tool_context = "\n\nTool Results:\n"
                for result in tool_results:
                    tool_context += f"- {result.get('name', 'unknown')}: {result.get('result', {})}\n"
                messages.append({"role": "user", "parts": [{"text": tool_context}]})
            
            response = await self.model.generate_content_async(messages)
            
            # Extract text content safely
            text_content = ""
            try:
                text_content = response.text if response.text else ""
            except Exception:
                if hasattr(response, 'parts') and response.parts:
                    for part in response.parts:
                        if hasattr(part, 'text') and part.text:
                            text_content += part.text
            
            result = {
                "text": text_content,
                "tool_calls": [],
                "timestamp": time.time()
            }
            
            # Extract function calls if any
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
    
    async def generate_chat_title(self, first_message: str) -> str:
        """Generate a chat title using Gemini Flash Lite"""
        try:
            # Use Flash Lite for title generation (faster and cheaper)
            lite_model = genai.GenerativeModel("gemini-2.0-flash-lite")
            
            title_prompt = f"""Generate a short, descriptive title (max 4 words) for this conversation starter:

"{first_message}"

Examples:
- "Market Research" for "Do market research on AI startups"
- "Code Help" for "Help me debug this Python function"
- "Quick Question" for "What's the weather like?"

Title:"""

            response = await lite_model.generate_content_async(title_prompt)
            
            try:
                title = response.text.strip() if response.text else "New Chat"
            except Exception:
                title = "New Chat"
            
            # Clean up title
            title = title.replace('"', '').replace("'", '').strip()
            if len(title) > 30:
                title = title[:27] + "..."
            
            return title or "New Chat"
            
        except Exception as e:
            return "New Chat"


# Global instance for singleton pattern
_gemini_client: Optional[GeminiClient] = None

def get_gemini_client() -> GeminiClient:
    """Get singleton Gemini client instance"""
    global _gemini_client
    if _gemini_client is None:
        _gemini_client = GeminiClient()
    return _gemini_client
