# Iris Core Tools - Ultra Fast Tool Execution

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
import asyncio
import time

class BaseTool(ABC):
    """Base class for all Iris tools - optimized for instant execution"""
    
    def __init__(self):
        self.name = self.__class__.__name__.lower().replace('tool', '')
    
    @abstractmethod
    async def execute(self, **kwargs) -> Dict[str, Any]:
        """Execute the tool with instant response"""
        pass
    
    def get_schema(self) -> Dict[str, Any]:
        """Get OpenAPI schema for the tool"""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.get_description(),
                "parameters": self.get_parameters()
            }
        }
    
    @abstractmethod
    def get_description(self) -> str:
        """Get tool description"""
        pass
    
    @abstractmethod
    def get_parameters(self) -> Dict[str, Any]:
        """Get tool parameters schema"""
        pass

class ShellTool(BaseTool):
    """Instant shell command execution in Daytona sandbox"""
    
    def get_description(self) -> str:
        return "Execute shell commands instantly in Daytona sandbox with sub-100ms response"
    
    def get_parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "Shell command to execute"},
                "timeout": {"type": "integer", "description": "Timeout in seconds", "default": 30}
            },
            "required": ["command"]
        }
    
    async def execute(self, command: str, timeout: int = 30) -> Dict[str, Any]:
        """Execute shell command with instant response"""
        start_time = time.time()
        
        try:
            # TODO: Implement Daytona sandbox execution
            # This will be the core of instant shell execution
            
            # Simulate instant execution for now
            await asyncio.sleep(0.05)  # Simulate 50ms execution
            
            execution_time = time.time() - start_time
            
            return {
                "success": True,
                "output": f"Command '{command}' executed successfully",
                "execution_time_ms": round(execution_time * 1000, 2),
                "command": command
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "execution_time_ms": round((time.time() - start_time) * 1000, 2),
                "command": command
            }

class FileTool(BaseTool):
    """Instant file operations in Daytona sandbox"""
    
    def get_description(self) -> str:
        return "Read and write files instantly in Daytona sandbox with sub-50ms response"
    
    def get_parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "operation": {"type": "string", "enum": ["read", "write", "list"], "description": "File operation"},
                "path": {"type": "string", "description": "File path"},
                "content": {"type": "string", "description": "Content to write (for write operation)"}
            },
            "required": ["operation", "path"]
        }
    
    async def execute(self, operation: str, path: str, content: Optional[str] = None) -> Dict[str, Any]:
        """Execute file operation with instant response"""
        start_time = time.time()
        
        try:
            # TODO: Implement Daytona file operations
            # This will be the core of instant file handling
            
            await asyncio.sleep(0.03)  # Simulate 30ms execution
            
            execution_time = time.time() - start_time
            
            if operation == "read":
                return {
                    "success": True,
                    "content": f"File content for {path}",
                    "operation": operation,
                    "path": path,
                    "execution_time_ms": round(execution_time * 1000, 2)
                }
            elif operation == "write":
                return {
                    "success": True,
                    "message": f"File {path} written successfully",
                    "operation": operation,
                    "path": path,
                    "execution_time_ms": round(execution_time * 1000, 2)
                }
            elif operation == "list":
                return {
                    "success": True,
                    "files": [f"file1.txt", f"file2.py", f"file3.json"],
                    "operation": operation,
                    "path": path,
                    "execution_time_ms": round(execution_time * 1000, 2)
                }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "execution_time_ms": round((time.time() - start_time) * 1000, 2)
            }

class WebSearchTool(BaseTool):
    """Instant web search with real-time results"""
    
    def get_description(self) -> str:
        return "Search the web instantly with sub-300ms response and real-time results"
    
    def get_parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query"},
                "num_results": {"type": "integer", "description": "Number of results", "default": 5}
            },
            "required": ["query"]
        }
    
    async def execute(self, query: str, num_results: int = 5) -> Dict[str, Any]:
        """Execute web search with instant response"""
        start_time = time.time()
        
        try:
            # TODO: Implement instant web search (Tavily, Google, etc.)
            # This will be the core of instant web search
            
            await asyncio.sleep(0.2)  # Simulate 200ms search
            
            execution_time = time.time() - start_time
            
            return {
                "success": True,
                "query": query,
                "results": [
                    {"title": f"Result {i} for {query}", "url": f"https://example.com/{i}", "snippet": f"Snippet {i}"}
                    for i in range(1, num_results + 1)
                ],
                "execution_time_ms": round(execution_time * 1000, 2)
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "execution_time_ms": round((time.time() - start_time) * 1000, 2)
            }

class BrowserTool(BaseTool):
    """Instant browser automation and navigation"""
    
    def get_description(self) -> str:
        return "Navigate websites instantly with sub-500ms response and content extraction"
    
    def get_parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "action": {"type": "string", "enum": ["navigate", "click", "type", "extract"], "description": "Browser action"},
                "url": {"type": "string", "description": "URL to navigate to"},
                "selector": {"type": "string", "description": "CSS selector for click/type actions"},
                "text": {"type": "string", "description": "Text to type"}
            },
            "required": ["action"]
        }
    
    async def execute(self, action: str, url: Optional[str] = None, selector: Optional[str] = None, text: Optional[str] = None) -> Dict[str, Any]:
        """Execute browser action with instant response"""
        start_time = time.time()
        
        try:
            # TODO: Implement instant browser automation (Playwright, Selenium, etc.)
            # This will be the core of instant browser operations
            
            await asyncio.sleep(0.3)  # Simulate 300ms browser operation
            
            execution_time = time.time() - start_time
            
            if action == "navigate":
                return {
                    "success": True,
                    "action": action,
                    "url": url,
                    "title": f"Page Title for {url}",
                    "content": f"Page content for {url}",
                    "execution_time_ms": round(execution_time * 1000, 2)
                }
            elif action == "extract":
                return {
                    "success": True,
                    "action": action,
                    "selector": selector,
                    "content": f"Extracted content from {selector}",
                    "execution_time_ms": round(execution_time * 1000, 2)
                }
            else:
                return {
                    "success": True,
                    "action": action,
                    "message": f"Browser action {action} completed",
                    "execution_time_ms": round(execution_time * 1000, 2)
                }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "execution_time_ms": round((time.time() - start_time) * 1000, 2)
            }

class CodeTool(BaseTool):
    """Instant code execution and result streaming"""
    
    def get_description(self) -> str:
        return "Execute code snippets instantly in Daytona sandbox with live streaming results"
    
    def get_parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "code": {"type": "string", "description": "Code to execute"},
                "language": {"type": "string", "description": "Programming language", "default": "python"}
            },
            "required": ["code"]
        }
    
    async def execute(self, code: str, language: str = "python") -> Dict[str, Any]:
        """Execute code with instant response"""
        start_time = time.time()
        
        try:
            # TODO: Implement instant code execution in Daytona
            # This will be the core of instant code execution
            
            await asyncio.sleep(0.1)  # Simulate 100ms execution
            
            execution_time = time.time() - start_time
            
            return {
                "success": True,
                "code": code,
                "language": language,
                "output": f"Code executed successfully: {code[:50]}...",
                "execution_time_ms": round(execution_time * 1000, 2)
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "execution_time_ms": round((time.time() - start_time) * 1000, 2)
            }

class ComputerTool(BaseTool):
    """Direct system access for instant operations"""
    
    def get_description(self) -> str:
        return "Direct system access for instant operations with sub-100ms response"
    
    def get_parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "operation": {"type": "string", "enum": ["info", "processes", "network", "disk"], "description": "System operation"},
                "details": {"type": "string", "description": "Additional details for the operation"}
            },
            "required": ["operation"]
        }
    
    async def execute(self, operation: str, details: Optional[str] = None) -> Dict[str, Any]:
        """Execute system operation with instant response"""
        start_time = time.time()
        
        try:
            # TODO: Implement instant system operations
            # This will be the core of instant system access
            
            await asyncio.sleep(0.05)  # Simulate 50ms execution
            
            execution_time = time.time() - start_time
            
            return {
                "success": True,
                "operation": operation,
                "result": f"System {operation} completed successfully",
                "details": details,
                "execution_time_ms": round(execution_time * 1000, 2)
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "execution_time_ms": round((time.time() - start_time) * 1000, 2)
            }

# Tool Registry - All 6 essential tools
TOOLS = {
    "shell": ShellTool(),
    "file": FileTool(),
    "web_search": WebSearchTool(),
    "browser": BrowserTool(),
    "code": CodeTool(),
    "computer": ComputerTool()
}

def get_tool_schemas() -> list:
    """Get all tool schemas for LLM function calling"""
    return [tool.get_schema() for tool in TOOLS.values()]

async def execute_tool(tool_name: str, **kwargs) -> Dict[str, Any]:
    """Execute a tool by name with instant response"""
    if tool_name not in TOOLS:
        return {"success": False, "error": f"Tool {tool_name} not found"}
    
    return await TOOLS[tool_name].execute(**kwargs)
