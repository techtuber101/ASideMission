"""
Agent Models - Pydantic types for agentic orchestration events and phases
"""

from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Literal
from enum import Enum


class PhaseType(str, Enum):
    PLAN = "plan"
    ANALYZE = "analyze"
    EXECUTE = "execute"
    DELIVER = "deliver"


class PhaseStatus(str, Enum):
    START = "start"
    END = "end"


class EventType(str, Enum):
    PHASE = "phase"
    TOOL_CALL = "tool_call"
    TOOL_RESULT = "tool_result"
    TEXT = "text"
    DELIVER = "deliver"
    ERROR = "error"


class PhaseEvent(BaseModel):
    type: Literal[EventType.PHASE] = EventType.PHASE
    phase: PhaseType
    status: PhaseStatus
    ts: float


class ToolCallEvent(BaseModel):
    type: Literal[EventType.TOOL_CALL] = EventType.TOOL_CALL
    name: str
    args: Dict[str, Any]
    id: str
    ts: float


class ToolResultEvent(BaseModel):
    type: Literal[EventType.TOOL_RESULT] = EventType.TOOL_RESULT
    id: str
    name: str
    success: bool
    result: Dict[str, Any]
    cached: bool = False
    ts: float


class TextEvent(BaseModel):
    type: Literal[EventType.TEXT] = EventType.TEXT
    content: str
    ts: float


class Artifact(BaseModel):
    path: str
    size: int
    type: str = "file"


class DeliverEvent(BaseModel):
    type: Literal[EventType.DELIVER] = EventType.DELIVER
    artifacts: List[Artifact]
    summary: str
    ts: float


class ErrorEvent(BaseModel):
    type: Literal[EventType.ERROR] = EventType.ERROR
    content: str
    ts: float


# Union type for all events
AgentEvent = PhaseEvent | ToolCallEvent | ToolResultEvent | TextEvent | DeliverEvent | ErrorEvent


class OrchestratorConfig(BaseModel):
    max_tool_hops: int = 3
    max_execution_time: float = 12.0  # seconds
    enable_verification: bool = False
    agent_mode: str = "P1_5"


class ToolCall(BaseModel):
    name: str
    args: Dict[str, Any]


class ToolResult(BaseModel):
    name: str
    success: bool
    result: Dict[str, Any]
    cached: bool = False
    execution_time_ms: float = 0.0


class ConversationTurn(BaseModel):
    role: str  # "user" or "assistant"
    content: str
    tool_calls: Optional[List[ToolCall]] = None
    tool_results: Optional[List[ToolResult]] = None
    timestamp: float
