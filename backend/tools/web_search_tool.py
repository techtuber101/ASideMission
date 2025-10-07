"""
Web Search Tool - Tavily API Integration
Based on Reference implementation with comprehensive search capabilities
"""

import asyncio
import json
import logging
from typing import Dict, Any, Optional, List, Union
from services.tavily_client import get_tavily_client


class WebSearchTool:
    """Tool for performing web searches using Tavily API"""
    
    def __init__(self):
        self.tool_name = "web_search"
        self.description = "Search the web for up-to-date information using Tavily API. Use for research, fact-checking, news, and current data."
    
    def get_schema(self) -> Dict[str, Any]:
        """Get the tool schema for LLM function calling"""
        return {
            "name": self.tool_name,
            "description": self.description,
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query to find relevant web pages. Be specific and include key terms."
                    },
                    "num_results": {
                        "type": "integer",
                        "description": "Number of search results to return (1-50)",
                        "default": 20,
                        "minimum": 1,
                        "maximum": 50
                    },
                    "search_depth": {
                        "type": "string",
                        "enum": ["basic", "advanced"],
                        "description": "Search depth - basic for quick results, advanced for comprehensive",
                        "default": "advanced"
                    },
                    "include_answer": {
                        "type": "boolean",
                        "description": "Whether to include AI-generated answer",
                        "default": True
                    },
                    "include_images": {
                        "type": "boolean",
                        "description": "Whether to include image results",
                        "default": False
                    },
                    "search_domain": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Specific domains to search within"
                    }
                },
                "required": ["query"]
            }
        }
    
    async def execute(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Execute web search"""
        try:
            query = args.get("query")
            if not query or not isinstance(query, str):
                return {
                    "success": False,
                    "error": "A valid search query is required."
                }
            
            # Normalize parameters
            num_results = args.get("num_results", 20)
            if isinstance(num_results, str):
                try:
                    num_results = int(num_results)
                except ValueError:
                    num_results = 20
            num_results = max(1, min(num_results, 50))
            
            search_depth = args.get("search_depth", "advanced")
            include_answer = args.get("include_answer", True)
            include_images = args.get("include_images", False)
            search_domain = args.get("search_domain", [])
            
            # Execute search with Tavily
            logging.info(f"Executing web search for query: '{query}' with {num_results} results")
            
            tavily_client = get_tavily_client()
            search_response = await tavily_client.search(
                query=query,
                max_results=num_results,
                include_images=include_images,
                include_answer=include_answer,
                search_depth=search_depth,
                search_domain=search_domain
            )
            
            # Check if we have results or answer
            results = search_response.get('results', [])
            answer = search_response.get('answer', '')
            
            # Consider search successful if we have either results OR an answer
            if len(results) > 0 or (answer and answer.strip()):
                return {
                    "success": True,
                    "query": query,
                    "results": results,
                    "answer": answer,
                    "num_results": len(results),
                    "search_depth": search_depth,
                    "provider": "tavily"
                }
            else:
                logging.warning(f"No search results or answer found for query: '{query}'")
                return {
                    "success": False,
                    "query": query,
                    "results": [],
                    "answer": "",
                    "error": f"No results found for query: '{query}'",
                    "provider": "tavily"
                }
        
        except Exception as e:
            error_message = str(e)
            logging.error(f"Error performing web search for '{query}': {error_message}")
            return {
                "success": False,
                "error": f"Error performing web search: {error_message[:200]}",
                "query": query,
                "provider": "tavily"
            }


# Export the tool instance
web_search_tool = WebSearchTool()

