"""
Agentic Orchestrator - P1.5 Instant-or-Agentic Loop with Phase Management
Drives plan → analyze → execute → deliver workflow with Gemini 2.5 Flash
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
    AgentEvent, PhaseEvent, ToolCallEvent, ToolResultEvent, TextEvent, 
    DeliverEvent, ErrorEvent, PhaseType, PhaseStatus, EventType,
    OrchestratorConfig, ToolCall, ToolResult, ConversationTurn
)


class AgenticOrchestrator:
    """P1.5 orchestrator for instant-or-agentic responses"""
    
    def __init__(self):
        self.gemini_client = get_gemini_client()
        self.tool_executor = get_tool_executor()
        self.config = OrchestratorConfig(
            agent_mode=os.getenv("AGENT_MODE", "P1_5")
        )
        
        # Performance tracking
        self.instant_responses = 0
        self.agentic_responses = 0
        self.total_tool_hops = 0
        
        # Tool schemas for function calling
        self.tools = get_tool_schemas()
    
    def _is_trivial_message(self, message: str) -> bool:
        """Determine if message should get instant response"""
        message_lower = message.lower().strip()
        
        # Trivial patterns
        trivial_patterns = [
            "hi", "hello", "hey", "good morning", "good afternoon", "good evening",
            "thanks", "thank you", "bye", "goodbye", "see you",
            "yes", "no", "ok", "okay", "sure", "alright",
            "what's your name", "who are you", "what can you do",
            "help", "how are you", "how do you work"
        ]
        
        # Check for exact matches or very short responses
        if message_lower in trivial_patterns or len(message.split()) <= 3:
            return True
            
        # Check for simple questions without complex reasoning
        if message_lower.startswith(("what is", "what's", "how to", "when", "where", "why")) and len(message.split()) <= 8:
            return True
            
        return False
    
    async def _emit_event(self, event: AgentEvent) -> Dict[str, Any]:
        """Convert event to dict for WebSocket emission"""
        return event.model_dump()
    
    async def _execute_phase(self, phase: PhaseType, message: str, conversation_history: List[ConversationTurn]) -> AsyncGenerator[Dict[str, Any], None]:
        """Execute a single phase of the agentic loop"""
        phase_start_time = time.time()
        
        # Emit phase start
        yield await self._emit_event(PhaseEvent(
            phase=phase,
            status=PhaseStatus.START,
            ts=phase_start_time
        ))
        
        try:
            if phase == PhaseType.PLAN:
                # Planning phase - analyze the request and create execution plan
                plan_prompt = f"""Analyze this request and create a step-by-step plan:

Request: {message}

Create a concise plan with specific steps. Focus on what tools to use and in what order.
Keep it practical and actionable."""

                response = await self.gemini_client.chat_simple(plan_prompt)
                
                yield await self._emit_event(TextEvent(
                    content=f"📋 **Planning Phase**\n\n{response}",
                    ts=time.time()
                ))
                
            elif phase == PhaseType.ANALYZE:
                # Analysis phase - gather information using tools
                analyze_prompt = f"""Based on this request, what information do we need to gather?

Request: {message}

Identify what web searches or file operations would be most helpful.
Be specific about search terms and file operations needed."""

                response = await self.gemini_client.chat_simple(analyze_prompt)
                
                yield await self._emit_event(TextEvent(
                    content=f"🔍 **Analysis Phase**\n\n{response}",
                    ts=time.time()
                ))
                
            elif phase == PhaseType.EXECUTE:
                # Execution phase - run tool calls
                async for event in self._execute_tools(message, conversation_history):
                    yield event
                
            elif phase == PhaseType.DELIVER:
                # Delivery phase - synthesize results and create artifacts
                deliver_prompt = f"""Based on the conversation and tool results, provide a comprehensive response to:

Request: {message}

IMPORTANT: Use beautiful markdown formatting to present your response:

# Formatting Guidelines:
- Use **# Main Title** for major sections (big, bold, visible)
- Use **## Subsection** for important topics
- Use **### Details** for specific points
- Use **bold text** for emphasis
- Use `inline code` for technical terms
- Use ```language blocks``` for code examples
- Use bullet points (-) for lists
- Use numbered lists (1.) for steps
- Use > blockquotes for important notes
- Use tables for structured data
- Use --- for section separators

# Response Structure:
1. **Main Title** - Clear, bold heading for the main topic
2. **Summary** - Brief overview of what was accomplished
3. **Detailed Analysis** - Use subsections and formatting
4. **Key Findings** - Use lists and emphasis
5. **Next Steps** - Actionable recommendations
6. **Technical Details** - Use code blocks if applicable

Synthesize all information gathered and provide actionable insights with beautiful formatting.
If files were created, summarize what was delivered."""

                response = await self.gemini_client.chat_simple(deliver_prompt)
                
                yield await self._emit_event(TextEvent(
                    content=f"📦 **Delivery Phase**\n\n{response}",
                    ts=time.time()
                ))
                
                # Check for created artifacts
                artifacts = await self._get_created_artifacts()
                if artifacts:
                    yield await self._emit_event(DeliverEvent(
                        artifacts=artifacts,
                        summary=f"Created {len(artifacts)} file(s) with research results",
                        ts=time.time()
                    ))
        
        except Exception as e:
            yield await self._emit_event(ErrorEvent(
                content=f"Error in {phase.value} phase: {str(e)}",
                ts=time.time()
            ))
        
        # Emit phase end
        yield await self._emit_event(PhaseEvent(
            phase=phase,
            status=PhaseStatus.END,
            ts=time.time()
        ))
    
    async def _execute_tools(self, message: str, conversation_history: List[Union[ConversationTurn, Dict[str, Any]]]) -> AsyncGenerator[Dict[str, Any], None]:
        """Execute tool calls based on the message and conversation context"""
        tool_hops = 0
        start_time = time.time()
        
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
        
        # Get tool calls from Gemini
        tool_calls_prompt = f"""{context}

Based on this request, what tools should be called? Use web_search for research and file for reading/writing files.
Respond with specific tool calls needed to fulfill this request."""

        # Use function calling to get tool calls
        response = await self.gemini_client.chat_with_tools_sync(
            tool_calls_prompt,
            self.tools
        )
        
        # Execute any tool calls returned
        if response.get("tool_calls"):
            for tool_call_data in response["tool_calls"]:
                if tool_hops >= self.config.max_tool_hops:
                    break
                    
                if time.time() - start_time > self.config.max_execution_time:
                    break
                
                tool_hops += 1
                self.total_tool_hops += 1
                
                # Emit tool call event
                tool_call_id = f"tool_{int(time.time() * 1000)}"
                yield await self._emit_event(ToolCallEvent(
                    name=tool_call_data["name"],
                    args=tool_call_data["args"],
                    id=tool_call_id,
                    ts=time.time()
                ))
                
                # Execute tool
                try:
                    result = await self.tool_executor.execute_tool_sync(
                        tool_call_data["name"],
                        tool_call_data["args"]
                    )
                    
                    # Emit tool result event
                    yield await self._emit_event(ToolResultEvent(
                        id=tool_call_id,
                        name=tool_call_data["name"],
                        success=result.get("success", True),
                        result=result,
                        cached=result.get("cached", False),
                        ts=time.time()
                    ))
                    
                except Exception as e:
                    yield await self._emit_event(ToolResultEvent(
                        id=tool_call_id,
                        name=tool_call_data["name"],
                        success=False,
                        result={"error": str(e)},
                        cached=False,
                        ts=time.time()
                    ))
    
    async def _get_created_artifacts(self) -> List[Dict[str, Any]]:
        """Get list of files created during this session"""
        # This is a placeholder - in a real implementation, we'd track created files
        # For now, return empty list
        return []
    
    async def process_message(
        self, 
        message: str, 
        conversation_history: Optional[List[Union[ConversationTurn, Dict[str, Any]]]] = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Process a message with instant-or-agentic routing"""
        
        if conversation_history is None:
            conversation_history = []
        
        start_time = time.time()
        
        # Route to instant or agentic path
        if self._is_trivial_message(message):
            # Instant path
            self.instant_responses += 1
            
            # Get instant response with markdown formatting
            instant_prompt = f"""Respond to this message with helpful information. Use markdown formatting for better readability:

Message: {message}

Formatting Guidelines:
- Use **bold** for emphasis
- Use `code` for technical terms
- Use bullet points (-) for lists
- Use numbered lists (1.) for steps
- Use > blockquotes for important notes
- Use ## headings for main topics
- Keep responses concise but well-formatted

Provide a helpful response with proper markdown formatting."""
            
            response = await self.gemini_client.chat_simple(instant_prompt, conversation_history)
            
            yield await self._emit_event(TextEvent(
                content=response,
                ts=time.time()
            ))
            
        else:
            # Agentic path
            self.agentic_responses += 1
            
            # Execute phases
            phases = [PhaseType.PLAN, PhaseType.ANALYZE, PhaseType.EXECUTE, PhaseType.DELIVER]
            
            for phase in phases:
                async for event in self._execute_phase(phase, message, conversation_history):
                    yield event
                    
                # Check timeout
                if time.time() - start_time > self.config.max_execution_time:
                    yield await self._emit_event(ErrorEvent(
                        content="Execution timeout reached",
                        ts=time.time()
                    ))
                    break
    
    def get_stats(self) -> Dict[str, Any]:
        """Get orchestrator performance statistics"""
        total_responses = self.instant_responses + self.agentic_responses
        avg_tool_hops = self.total_tool_hops / max(self.agentic_responses, 1)
        
        return {
            "instant_responses": self.instant_responses,
            "agentic_responses": self.agentic_responses,
            "total_responses": total_responses,
            "instant_ratio": self.instant_responses / max(total_responses, 1),
            "total_tool_hops": self.total_tool_hops,
            "avg_tool_hops_per_agentic": round(avg_tool_hops, 2),
            "config": self.config.model_dump()
        }


# Global instance for singleton pattern
_orchestrator: Optional[AgenticOrchestrator] = None

def get_orchestrator() -> AgenticOrchestrator:
    """Get singleton orchestrator instance"""
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = AgenticOrchestrator()
    return _orchestrator
