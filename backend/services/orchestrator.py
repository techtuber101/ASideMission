"""
Transparent Agentic Orchestrator - Continuous streaming without phases
Drives transparent tool execution with Gemini 2.5 Flash
"""

import os
import time
import asyncio
import json
from typing import AsyncGenerator, Dict, Any, List, Optional, Union
from services.gemini_client import get_gemini_client
from services.tool_executor import get_tool_executor
from tools import get_tool_schemas
from models.agent import (
    AgentEvent, ToolCallEvent, ToolResultEvent, TextEvent, 
    ErrorEvent, EventType,
    OrchestratorConfig, ToolCall, ToolResult, ConversationTurn
)


class TransparentOrchestrator:
    """Transparent orchestrator for continuous streaming responses"""
    
    def __init__(self):
        self.gemini_client = get_gemini_client()
        self.tool_executor = get_tool_executor()
        self.config = OrchestratorConfig(
            agent_mode=os.getenv("AGENT_MODE", "transparent")
        )
        
        # Performance tracking
        self.total_responses = 0
        self.total_tool_hops = 0
        
        # Tool schemas for function calling
        self.tools = get_tool_schemas()
    
    async def _emit_event(self, event: AgentEvent) -> Dict[str, Any]:
        """Convert event to dict for WebSocket emission"""
        data = event.model_dump()
        # Convert enum values to strings for JSON serialization
        if 'type' in data and hasattr(data['type'], 'value'):
            data['type'] = data['type'].value
        return data
    
    async def _execute_tools_streaming(self, message: str, conversation_history: List[Union[ConversationTurn, Dict[str, Any]]]) -> AsyncGenerator[Dict[str, Any], None]:
        """Execute tool calls with streaming execution - tools run as they appear"""
        tool_hops = 0
        start_time = time.time()
        pending_tasks = []
        
        # Build context for tool calling
        context = f"User request: {message}\n\n"
        if conversation_history:
            context += "Previous conversation:\n"
            for turn in conversation_history[-3:]:  # Last 3 turns
                # Handle both ConversationTurn objects and dict objects
                if isinstance(turn, dict):
                    role = turn.get("role", "unknown")
                    content = turn.get("content", "")
                else:
                    role = turn.role
                    content = turn.content
                context += f"{role}: {content}\n"
        
        # Get tool calls from Gemini using streaming
        tool_calls_prompt = f"""{context}

Based on this request, what tools should be called? Use web_search for research, task_list for planning, and shell for file operations.
Respond with specific tool calls needed to fulfill this request."""

        # Stream Gemini response and execute tools as they appear
        async for chunk in self.gemini_client.chat_with_tools_streaming(
            tool_calls_prompt,
            self.tools
        ):
            if chunk["type"] == "tool_call":
                if tool_hops >= self.config.max_tool_hops:
                    break
                    
                if time.time() - start_time > self.config.max_execution_time:
                    break
                
                tool_hops += 1
                self.total_tool_hops += 1
                
                # Emit tool call event immediately
                tool_call_id = f"tool_{int(time.time() * 1000)}"
                yield await self._emit_event(ToolCallEvent(
                    name=chunk["name"],
                    args=chunk["args"],
                    id=tool_call_id,
                    ts=time.time()
                ))
                
                # Execute tool in parallel task
                execution_task = asyncio.create_task(
                    self._execute_single_tool_streaming(
                        tool_call_id,
                        chunk["name"],
                        chunk["args"]
                    )
                )
                pending_tasks.append(execution_task)
            
            elif chunk["type"] == "error":
                yield await self._emit_event(ErrorEvent(
                    content=chunk["content"],
                    ts=chunk["timestamp"]
                ))
        
        # Wait for all pending tool executions to complete
        if pending_tasks:
            for task in pending_tasks:
                try:
                    async for event in task:
                        yield event
                except Exception as e:
                    yield await self._emit_event(ErrorEvent(
                        content=f"Tool execution error: {str(e)}",
                        ts=time.time()
                    ))

    async def _execute_single_tool_streaming(self, tool_call_id: str, tool_name: str, args: Dict[str, Any]) -> AsyncGenerator[Dict[str, Any], None]:
        """Execute a single tool and stream the result"""
        try:
            result = await self.tool_executor.execute_tool_sync(tool_name, args)
            
            # Emit tool result event
            yield await self._emit_event(ToolResultEvent(
                id=tool_call_id,
                name=tool_name,
                success=result.get("success", True),
                result=result,
                cached=result.get("cached", False),
                ts=time.time()
            ))
            
        except Exception as e:
            yield await self._emit_event(ToolResultEvent(
                id=tool_call_id,
                name=tool_name,
                success=False,
                result={"error": str(e)},
                cached=False,
                ts=time.time()
            ))
    
    async def process_message(
        self, 
        message: str, 
        conversation_history: Optional[List[Union[ConversationTurn, Dict[str, Any]]]] = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Process a message with transparent streaming"""
        
        if conversation_history is None:
            conversation_history = []
        
        start_time = time.time()
        self.total_responses += 1
        
        # Build context for response
        context = f"User request: {message}\n\n"
        if conversation_history:
            context += "Previous conversation:\n"
            for turn in conversation_history[-3:]:  # Last 3 turns
                if isinstance(turn, dict):
                    role = turn.get("role", "unknown")
                    content = turn.get("content", "")
                else:
                    role = turn.role
                    content = turn.content
                context += f"{role}: {content}\n"
        
        # Stream Gemini response with tool calling
        response_prompt = f"""{context}

Respond to this request naturally. If you need to use tools (web_search, task_list, shell), call them as needed.
Provide a helpful response with proper markdown formatting."""

        # Stream the response tokens in real-time
        async for chunk in self.gemini_client.chat_with_tools_streaming(
            response_prompt,
            self.tools
        ):
            if chunk["type"] == "text":
                # Emit each token immediately for instant streaming
                yield await self._emit_event(TextEvent(
                    content=chunk["content"],
                    ts=chunk["timestamp"]
                ))
            elif chunk["type"] == "tool_call":
                # Execute tool immediately and stream results
                tool_call_id = f"tool_{int(time.time() * 1000)}"
                yield await self._emit_event(ToolCallEvent(
                    name=chunk["name"],
                    args=chunk["args"],
                    id=tool_call_id,
                    ts=time.time()
                ))
                
                # Execute tool and stream result
                try:
                    result = await self.tool_executor.execute_tool_sync(
                        chunk["name"],
                        chunk["args"]
                    )
                    
                    yield await self._emit_event(ToolResultEvent(
                        id=tool_call_id,
                        name=chunk["name"],
                        success=result.get("success", True),
                        result=result,
                        cached=result.get("cached", False),
                        ts=time.time()
                    ))
                    
                except Exception as e:
                    yield await self._emit_event(ToolResultEvent(
                        id=tool_call_id,
                        name=chunk["name"],
                        success=False,
                        result={"error": str(e)},
                        cached=False,
                        ts=time.time()
                    ))
                    
            elif chunk["type"] == "error":
                yield await self._emit_event(ErrorEvent(
                    content=chunk["content"],
                    ts=chunk["timestamp"]
                ))
    
    def get_stats(self) -> Dict[str, Any]:
        """Get orchestrator performance statistics"""
        avg_tool_hops = self.total_tool_hops / max(self.total_responses, 1)
        
        return {
            "total_responses": self.total_responses,
            "total_tool_hops": self.total_tool_hops,
            "avg_tool_hops_per_response": round(avg_tool_hops, 2),
            "config": self.config.model_dump()
        }


# Global instance for singleton pattern
_orchestrator: Optional[TransparentOrchestrator] = None

def get_orchestrator() -> TransparentOrchestrator:
    """Get singleton orchestrator instance"""
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = TransparentOrchestrator()
    return _orchestrator
