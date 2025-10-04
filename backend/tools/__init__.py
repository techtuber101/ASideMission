# Iris Core Tools - Ultra Fast Tool Execution

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
import asyncio
import time
import os

class BaseTool(ABC):
    """Base class for all Iris tools - optimized for instant execution"""
    
    def __init__(self):
        self.name = self.__class__.__name__.lower().replace('tool', '').replace('websearch', 'web_search').replace('webscrape', 'web_scrape')
    
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
        return "Execute shell commands in a secure sandbox environment. Use for file operations, system commands, package installation, process management, and automation tasks. Always use this tool when you need to run system commands, check system status, or perform file operations."
    
    def get_parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "Shell command to execute"},
                "timeout": {"type": "integer", "description": "Timeout in seconds"}
            },
            "required": ["command"]
        }
    
    async def execute(self, command: str, timeout: int = 30) -> Dict[str, Any]:
        """Execute shell command with instant response"""
        start_time = time.time()
        
        try:
            from services.daytona_client import get_daytona_client
            
            daytona = get_daytona_client()
            result = await daytona.execute_command(command, timeout_seconds=timeout)
            
            execution_time = time.time() - start_time
            
            return {
                "success": result.get("success", False),
                "stdout": result.get("stdout", ""),
                "stderr": result.get("stderr", ""),
                "exit_code": result.get("exit_code", 0),
                "execution_time_ms": round(execution_time * 1000, 2),
                "command": command,
                "provider": "daytona"
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
        return "Read, write, and manage files in a secure sandbox environment. Use this tool when you need to work with files, read documents, write data, create scripts, or manage file systems. Always use this tool when working with documents, data files, or code files."
    
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
            from services.daytona_client import get_daytona_client
            
            daytona = get_daytona_client()
            
            if operation == "read":
                result = await daytona.read_file(path)
            elif operation == "write":
                if content is None:
                    return {
                        "success": False,
                        "error": "Content is required for write operation",
                        "execution_time_ms": round((time.time() - start_time) * 1000, 2)
                    }
                result = await daytona.write_file(path, content)
            elif operation == "list":
                result = await daytona.list_files(path)
            else:
                return {
                    "success": False,
                    "error": f"Unknown operation: {operation}",
                    "execution_time_ms": round((time.time() - start_time) * 1000, 2)
                }
            
            execution_time = time.time() - start_time
            
            return {
                "success": result.get("success", False),
                "operation": operation,
                "path": path,
                "content": result.get("content", ""),
                "files": result.get("files", []),
                "size_bytes": result.get("size_bytes", 0),
                "execution_time_ms": round(execution_time * 1000, 2),
                "provider": "daytona"
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
        return "Search the web for current information, news, facts, and data. Use this tool whenever you need up-to-date information, want to verify facts, research topics, find recent news, or get current data. Always use this tool when discussing recent events, news, or developments."
    
    def get_parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query"},
                "max_results": {"type": "integer", "description": "Maximum number of results"},
                "freshness": {"type": "string", "enum": ["hour", "day", "week", "month", "all"], "description": "Result freshness"},
                "site_filters": {"type": "array", "items": {"type": "string"}, "description": "Specific sites to search"},
                "extract_top_n": {"type": "integer", "description": "Number of top results to extract content from"}
            },
            "required": ["query"]
        }
    
    async def execute(self, query: str, max_results: int = 5, freshness: str = "week", site_filters: Optional[list] = None, extract_top_n: int = 0) -> Dict[str, Any]:
        """Execute web search with instant response"""
        start_time = time.time()
        
        try:
            from services.tavily_client import get_tavily_client
            
            tavily = get_tavily_client()
            
            # Convert freshness to Tavily format
            freshness_map = {
                "hour": "basic",
                "day": "basic", 
                "week": "basic",
                "month": "basic",
                "all": "basic"
            }
            search_depth = freshness_map.get(freshness, "basic")
            
            result = await tavily.search(
                query=query,
                search_depth=search_depth,
                max_results=max_results,
                include_answer=False,
                include_images=False,
                search_domain=site_filters
            )
            
            # Extract content from top results if requested
            if extract_top_n > 0 and result.get("success"):
                urls = [r["url"] for r in result["results"][:extract_top_n]]
                extract_result = await tavily.extract_content(urls)
                
                if extract_result.get("success"):
                    # Merge extracted content with results
                    for i, extraction in enumerate(extract_result["extractions"]):
                        if i < len(result["results"]):
                            result["results"][i]["extracted_content"] = extraction.get("content", "")
            
            execution_time = time.time() - start_time
            
            return {
                "success": result.get("success", False),
                "query": query,
                "results": result.get("results", []),
                "answer": result.get("answer"),
                "execution_time_ms": round(execution_time * 1000, 2),
                "provider": "tavily"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "execution_time_ms": round((time.time() - start_time) * 1000, 2)
            }

class WebScrapeTool(BaseTool):
    """Instant web scraping with content extraction"""
    
    def get_description(self) -> str:
        return "Scrape and extract content from specific web pages. Use this tool when you need detailed content from a specific URL, want to extract structured data, get full article text, or analyze webpage content. Always use this tool when you have a specific URL and need its content."
    
    def get_parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "URL to scrape"},
                "extract_text": {"type": "boolean", "description": "Extract clean text content"},
                "max_length": {"type": "integer", "description": "Maximum content length"}
            },
            "required": ["url"]
        }
    
    async def execute(self, url: str, extract_text: bool = True, max_length: int = 4000) -> Dict[str, Any]:
        """Execute web scraping with instant response"""
        start_time = time.time()
        
        try:
            from services.firecrawl_client import get_firecrawl_client
            
            firecrawl = get_firecrawl_client()
            
            formats = ["markdown"]
            if not extract_text:
                formats.append("html")
            
            result = await firecrawl.scrape_url(
                url=url,
                formats=formats,
                onlyMainContent=True,
                maxLength=max_length
            )
            
            execution_time = time.time() - start_time
            
            return {
                "success": result.get("success", False),
                "url": url,
                "title": result.get("title", ""),
                "content": result.get("content", ""),
                "markdown": result.get("markdown", ""),
                "html": result.get("html", ""),
                "metadata": result.get("metadata", {}),
                "execution_time_ms": round(execution_time * 1000, 2),
                "provider": "firecrawl"
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
        return "Execute code in various programming languages in a secure sandbox. Use this tool when you need to run calculations, analyze data, test code, perform computations, or execute scripts. Always use this tool when users ask for calculations, data analysis, or programming help."
    
    def get_parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "code": {"type": "string", "description": "Code to execute"},
                "language": {"type": "string", "description": "Programming language"}
            },
            "required": ["code"]
        }
    
    async def execute(self, code: str, language: str = "python") -> Dict[str, Any]:
        """Execute code with instant response"""
        start_time = time.time()
        
        try:
            from services.daytona_client import get_daytona_client
            
            daytona = get_daytona_client()
            
            # Create appropriate command based on language
            if language.lower() == "python":
                command = f"python3 -c '{code}'"
            elif language.lower() == "bash":
                command = f"bash -c '{code}'"
            elif language.lower() == "javascript":
                command = f"node -e '{code}'"
            else:
                command = code  # Assume it's already a shell command
            
            result = await daytona.execute_command(command, timeout_seconds=30)
            
            execution_time = time.time() - start_time
            
            # Check if execution was successful - prioritize exit_code over success flag
            exit_code = result.get("exit_code", 0)
            stdout = result.get("stdout", "")
            stderr = result.get("stderr", "")
            
            # Consider it successful if exit_code is 0, regardless of success flag
            is_success = exit_code == 0
            
            # If Daytona fails but we have a simple calculation, try local execution as fallback
            if not is_success and language.lower() == "python" and not stderr:
                try:
                    # Simple fallback for basic calculations
                    if all(c in "0123456789+-*/(). " for c in code.strip()):
                        local_result = eval(code.strip())
                        return {
                            "success": True,
                            "code": code,
                            "language": language,
                            "stdout": str(local_result),
                            "stderr": "",
                            "exit_code": 0,
                            "execution_time_ms": round(execution_time * 1000, 2),
                            "provider": "local_fallback",
                            "cached": False
                        }
                except:
                    pass  # Fallback failed, continue with original result
            
            return {
                "success": is_success,
                "code": code,
                "language": language,
                "stdout": stdout,
                "stderr": stderr,
                "exit_code": exit_code,
                "execution_time_ms": round(execution_time * 1000, 2),
                "provider": "daytona",
                "cached": False
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

# Tool Registry - P1.5 Limited to web_search and file only
TOOLS = {
    "web_search": WebSearchTool(),
    "file": FileTool()
}

def get_tool_schemas() -> list:
    """Get P1.5 tool schemas for LLM function calling (web_search + file only)"""
    return [tool.get_schema() for tool in TOOLS.values()]

async def execute_tool(tool_name: str, **kwargs) -> Dict[str, Any]:
    """Execute a tool by name with instant response"""
    if tool_name not in TOOLS:
        return {"success": False, "error": f"Tool {tool_name} not found"}
    
    return await TOOLS[tool_name].execute(**kwargs)
