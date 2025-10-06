"""
Tavily Client - Web search API integration
Based on Reference implementation with simplified interface
"""

import asyncio
import logging
from typing import Dict, Any, Optional, List
from tavily import AsyncTavilyClient
import os
from dotenv import load_dotenv

load_dotenv()

class TavilyClient:
    """Simplified Tavily client for web search operations"""
    
    def __init__(self):
        self.api_key = os.getenv("TAVILY_API_KEY")
        self.client = None
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize Tavily client with API key"""
        try:
            if self.api_key:
                self.client = AsyncTavilyClient(api_key=self.api_key)
                logging.info("Tavily client initialized successfully")
            else:
                logging.warning("No Tavily API key found - using mock mode")
                self.client = None
                
        except Exception as e:
            logging.error(f"Failed to initialize Tavily client: {e}")
            self.client = None
    
    async def search(
        self,
        query: str,
        search_depth: str = "advanced",
        max_results: int = 20,
        include_answer: bool = True,
        include_images: bool = False,
        search_domain: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Perform web search using Tavily API"""
        try:
            if not self.client:
                # Mock response for development
                return {
                    "success": True,
                    "query": query,
                    "results": [
                        {
                            "title": f"Mock result for: {query}",
                            "url": "https://example.com",
                            "content": f"This is a mock search result for the query: {query}",
                            "score": 0.95,
                            "published_date": "2024-01-01"
                        }
                    ],
                    "answer": f"Mock AI-generated answer for: {query}",
                    "num_results": 1
                }
            
            # Execute search with Tavily
            search_response = await self.client.search(
                query=query,
                max_results=max_results,
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
    
    async def extract_content(self, urls: List[str]) -> Dict[str, Any]:
        """Extract content from URLs (placeholder for future implementation)"""
        try:
            if not self.client:
                # Mock response for development
                return {
                    "success": True,
                    "extractions": [
                        {
                            "url": url,
                            "content": f"Mock extracted content from {url}",
                            "title": f"Mock title for {url}"
                        }
                        for url in urls
                    ]
                }
            
            # This would be implemented if Tavily supports content extraction
            # For now, return a placeholder
            return {
                "success": False,
                "error": "Content extraction not implemented in Tavily client",
                "urls": urls
            }
            
        except Exception as e:
            logging.error(f"Error extracting content from URLs: {e}")
            return {
                "success": False,
                "error": f"Error extracting content: {str(e)}",
                "urls": urls
            }


# Global instance
_tavily_client: Optional[TavilyClient] = None

def get_tavily_client() -> TavilyClient:
    """Get singleton Tavily client instance"""
    global _tavily_client
    if _tavily_client is None:
        _tavily_client = TavilyClient()
    return _tavily_client