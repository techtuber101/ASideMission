"""
Browser Automation Tool - Stagehand API Integration
Based on Reference implementation with comprehensive browser automation capabilities
"""

import asyncio
import json
import logging
import base64
import uuid
from datetime import datetime
from typing import Dict, Any, Optional
from services.daytona_client import get_daytona_client


class BrowserAutomationTool:
    """Tool for browser automation using Stagehand API"""
    
    def __init__(self):
        self.tool_name = "browser_automation"
        self.description = "Automate browser interactions using Stagehand API. Navigate, click, type, extract content, and take screenshots."
    
    def get_schema(self) -> Dict[str, Any]:
        """Get the tool schema for LLM function calling"""
        return {
            "name": self.tool_name,
            "description": self.description,
            "parameters": {
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": [
                            "navigate", "click", "type", "extract_content", 
                            "screenshot", "scroll", "wait", "get_page_info"
                        ],
                        "description": "The browser action to perform"
                    },
                    "url": {
                        "type": "string",
                        "description": "URL to navigate to (for navigate action)"
                    },
                    "selector": {
                        "type": "string",
                        "description": "CSS selector for click/type actions"
                    },
                    "text": {
                        "type": "string",
                        "description": "Text to type (for type action)"
                    },
                    "instruction": {
                        "type": "string",
                        "description": "Natural language instruction for actions"
                    },
                    "variables": {
                        "type": "object",
                        "description": "Variables to use in instructions",
                        "additionalProperties": {"type": "string"}
                    },
                    "iframes": {
                        "type": "boolean",
                        "description": "Whether to include iframe content",
                        "default": True
                    },
                    "file_path": {
                        "type": "string",
                        "description": "File path for file upload actions"
                    },
                    "wait_time": {
                        "type": "integer",
                        "description": "Time to wait in seconds (for wait action)",
                        "default": 5
                    },
                    "scroll_direction": {
                        "type": "string",
                        "enum": ["up", "down", "left", "right"],
                        "description": "Direction to scroll (for scroll action)",
                        "default": "down"
                    },
                    "scroll_amount": {
                        "type": "integer",
                        "description": "Amount to scroll in pixels",
                        "default": 500
                    }
                },
                "required": ["action"]
            }
        }
    
    async def execute(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Execute browser automation action"""
        try:
            action = args.get("action")
            
            if action == "navigate":
                return await self._navigate(args.get("url"))
            elif action == "click":
                return await self._click(args.get("selector"), args.get("instruction"))
            elif action == "type":
                return await self._type(args.get("selector"), args.get("text"), args.get("instruction"))
            elif action == "extract_content":
                return await self._extract_content(args.get("instruction"), args.get("iframes", True))
            elif action == "screenshot":
                return await self._screenshot(args.get("instruction"))
            elif action == "scroll":
                return await self._scroll(
                    args.get("scroll_direction", "down"), 
                    args.get("scroll_amount", 500)
                )
            elif action == "wait":
                return await self._wait(args.get("wait_time", 5))
            elif action == "get_page_info":
                return await self._get_page_info()
            else:
                return {
                    "success": False,
                    "error": f"Unknown action: {action}",
                    "available_actions": [
                        "navigate", "click", "type", "extract_content", 
                        "screenshot", "scroll", "wait", "get_page_info"
                    ]
                }
                
        except Exception as e:
            logging.error(f"Browser automation tool error: {str(e)}")
            return {
                "success": False,
                "error": f"Browser automation tool error: {str(e)}"
            }
    
    async def _execute_stagehand_api(self, endpoint: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a Stagehand API call through Daytona sandbox"""
        try:
            daytona_client = get_daytona_client()
            
            # Check if Stagehand API server is running
            health_check = await self._check_stagehand_health()
            if not health_check:
                return {
                    "success": False,
                    "error": "Stagehand API server is not running. Please ensure the Stagehand API server is running on port 8004."
                }
            
            # Build curl command to call Stagehand API
            url = f"http://localhost:8004/api/{endpoint}"
            json_data = json.dumps(params)
            
            curl_cmd = f"curl -s -X POST '{url}' -H 'Content-Type: application/json' -d '{json_data}'"
            
            logging.debug(f"Executing Stagehand API call: {curl_cmd}")
            
            result = await daytona_client.execute_command(curl_cmd, timeout_seconds=30)
            
            if result.get("success", False):
                try:
                    response_data = json.loads(result.get("output", "{}"))
                    
                    # Handle screenshot if present
                    if "screenshot_base64" in response_data:
                        screenshot_info = await self._handle_screenshot(response_data["screenshot_base64"])
                        response_data.update(screenshot_info)
                        # Remove raw base64 from response
                        del response_data["screenshot_base64"]
                    
                    return {
                        "success": True,
                        "result": response_data,
                        "provider": "stagehand"
                    }
                except json.JSONDecodeError as e:
                    return {
                        "success": False,
                        "error": f"Failed to parse Stagehand API response: {e}",
                        "raw_response": result.get("output", "")
                    }
            else:
                return {
                    "success": False,
                    "error": f"Stagehand API request failed: {result.get('error', 'Unknown error')}",
                    "exit_code": result.get("exit_code", -1)
                }
                
        except Exception as e:
            logging.error(f"Error executing Stagehand API call: {e}")
            return {
                "success": False,
                "error": f"Error executing Stagehand API call: {str(e)}"
            }
    
    async def _check_stagehand_health(self) -> bool:
        """Check if Stagehand API server is running"""
        try:
            daytona_client = get_daytona_client()
            
            # Simple health check
            curl_cmd = "curl -s -X GET 'http://localhost:8004/api' -H 'Content-Type: application/json'"
            result = await daytona_client.execute_command(curl_cmd, timeout_seconds=10)
            
            if result.get("success", False):
                try:
                    response = json.loads(result.get("output", "{}"))
                    return response.get("status") == "healthy"
                except json.JSONDecodeError:
                    return False
            return False
            
        except Exception:
            return False
    
    async def _navigate(self, url: Optional[str]) -> Dict[str, Any]:
        """Navigate to a URL"""
        try:
            if not url:
                return {
                    "success": False,
                    "error": "URL is required for navigation"
                }
            
            params = {"url": url}
            result = await self._execute_stagehand_api("navigate", params)
            
            if result.get("success", False):
                return {
                    "success": True,
                    "action": "navigate",
                    "url": url,
                    "title": result["result"].get("title", ""),
                    "message": f"Successfully navigated to {url}"
                }
            else:
                return result
                
        except Exception as e:
            return {
                "success": False,
                "error": f"Error navigating to {url}: {str(e)}"
            }
    
    async def _click(self, selector: Optional[str], instruction: Optional[str]) -> Dict[str, Any]:
        """Click on an element"""
        try:
            if not selector and not instruction:
                return {
                    "success": False,
                    "error": "Selector or instruction is required for click action"
                }
            
            action_text = instruction or f"click on {selector}"
            params = {
                "action": action_text,
                "iframes": True
            }
            
            result = await self._execute_stagehand_api("act", params)
            
            if result.get("success", False):
                return {
                    "success": True,
                    "action": "click",
                    "selector": selector,
                    "instruction": instruction,
                    "message": f"Successfully clicked on element"
                }
            else:
                return result
                
        except Exception as e:
            return {
                "success": False,
                "error": f"Error clicking element: {str(e)}"
            }
    
    async def _type(self, selector: Optional[str], text: Optional[str], instruction: Optional[str]) -> Dict[str, Any]:
        """Type text into an element"""
        try:
            if not text and not instruction:
                return {
                    "success": False,
                    "error": "Text or instruction is required for type action"
                }
            
            action_text = instruction or f"type '{text}' into {selector}"
            params = {
                "action": action_text,
                "iframes": True
            }
            
            if text:
                params["variables"] = {"text": text}
            
            result = await self._execute_stagehand_api("act", params)
            
            if result.get("success", False):
                return {
                    "success": True,
                    "action": "type",
                    "selector": selector,
                    "text": text,
                    "instruction": instruction,
                    "message": f"Successfully typed text"
                }
            else:
                return result
                
        except Exception as e:
            return {
                "success": False,
                "error": f"Error typing text: {str(e)}"
            }
    
    async def _extract_content(self, instruction: Optional[str], iframes: bool = True) -> Dict[str, Any]:
        """Extract content from the current page"""
        try:
            if not instruction:
                instruction = "extract all visible text content from the page"
            
            params = {
                "instruction": instruction,
                "iframes": iframes
            }
            
            result = await self._execute_stagehand_api("extract", params)
            
            if result.get("success", False):
                return {
                    "success": True,
                    "action": "extract_content",
                    "instruction": instruction,
                    "extracted_content": result["result"].get("content", ""),
                    "message": "Successfully extracted content from page"
                }
            else:
                return result
                
        except Exception as e:
            return {
                "success": False,
                "error": f"Error extracting content: {str(e)}"
            }
    
    async def _screenshot(self, instruction: Optional[str]) -> Dict[str, Any]:
        """Take a screenshot of the current page"""
        try:
            params = {"name": instruction or "screenshot"}
            
            result = await self._execute_stagehand_api("screenshot", params)
            
            if result.get("success", False):
                return {
                    "success": True,
                    "action": "screenshot",
                    "image_url": result["result"].get("image_url"),
                    "preview_url": result["result"].get("preview_url"),
                    "message": "Successfully took screenshot"
                }
            else:
                return result
                
        except Exception as e:
            return {
                "success": False,
                "error": f"Error taking screenshot: {str(e)}"
            }
    
    async def _scroll(self, direction: str, amount: int) -> Dict[str, Any]:
        """Scroll the page"""
        try:
            action_text = f"scroll {direction} by {amount} pixels"
            params = {
                "action": action_text,
                "iframes": True
            }
            
            result = await self._execute_stagehand_api("act", params)
            
            if result.get("success", False):
                return {
                    "success": True,
                    "action": "scroll",
                    "direction": direction,
                    "amount": amount,
                    "message": f"Successfully scrolled {direction} by {amount} pixels"
                }
            else:
                return result
                
        except Exception as e:
            return {
                "success": False,
                "error": f"Error scrolling: {str(e)}"
            }
    
    async def _wait(self, wait_time: int) -> Dict[str, Any]:
        """Wait for a specified time"""
        try:
            action_text = f"wait {wait_time} seconds"
            params = {
                "action": action_text,
                "iframes": True
            }
            
            result = await self._execute_stagehand_api("act", params)
            
            if result.get("success", False):
                return {
                    "success": True,
                    "action": "wait",
                    "wait_time": wait_time,
                    "message": f"Successfully waited {wait_time} seconds"
                }
            else:
                return result
                
        except Exception as e:
            return {
                "success": False,
                "error": f"Error waiting: {str(e)}"
            }
    
    async def _get_page_info(self) -> Dict[str, Any]:
        """Get current page information"""
        try:
            params = {"instruction": "get current page URL and title"}
            
            result = await self._execute_stagehand_api("extract", params)
            
            if result.get("success", False):
                return {
                    "success": True,
                    "action": "get_page_info",
                    "url": result["result"].get("url", ""),
                    "title": result["result"].get("title", ""),
                    "message": "Successfully retrieved page information"
                }
            else:
                return result
                
        except Exception as e:
            return {
                "success": False,
                "error": f"Error getting page info: {str(e)}"
            }
    
    async def _handle_screenshot(self, screenshot_base64: str) -> Dict[str, Any]:
        """Handle screenshot data and save to workspace"""
        try:
            # Normalize base64 data
            if screenshot_base64.startswith('data:'):
                screenshot_base64 = screenshot_base64.split(',', 1)[1]
            
            screenshot_base64 = screenshot_base64.strip()
            
            # Decode and save screenshot
            try:
                image_data = base64.b64decode(screenshot_base64)
            except Exception as e:
                return {
                    "screenshot_error": f"Failed to decode base64 image: {str(e)}"
                }
            
            # Generate filename
            timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S_%f')
            filename = f"screenshot_{timestamp}_{uuid.uuid4().hex[:6]}.png"
            
            # Save to workspace
            daytona_client = get_daytona_client()
            file_path = f"/workspace/browser_screenshots/{filename}"
            
            # Create directory if it doesn't exist
            await daytona_client.execute_command("mkdir -p /workspace/browser_screenshots")
            
            # Write file
            write_result = await daytona_client.write_file(file_path, image_data)
            
            if write_result.get("success", False):
                return {
                    "image_url": f"/workspace/browser_screenshots/{filename}",
                    "preview_url": f"/workspace/browser_screenshots/{filename}",
                    "screenshot_path": f"browser_screenshots/{filename}"
                }
            else:
                return {
                    "screenshot_error": f"Failed to save screenshot: {write_result.get('error', 'Unknown error')}"
                }
                
        except Exception as e:
            return {
                "screenshot_error": f"Error handling screenshot: {str(e)}"
            }


# Export the tool instance
browser_automation_tool = BrowserAutomationTool()
