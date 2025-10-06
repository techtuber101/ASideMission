"""
Web Scraping Tool - Firecrawl API Integration
Based on Reference implementation with comprehensive scraping capabilities
"""

import asyncio
import json
import logging
import datetime
from typing import Dict, Any, Optional, List
from urllib.parse import urlparse
from services.firecrawl_client import get_firecrawl_client


class WebScrapeTool:
    """Tool for scraping web pages using Firecrawl API"""
    
    def __init__(self):
        self.tool_name = "web_scrape"
        self.description = "Scrape and extract content from web pages using Firecrawl API. Use for detailed content extraction from specific URLs."
    
    def get_schema(self) -> Dict[str, Any]:
        """Get the tool schema for LLM function calling"""
        return {
            "name": self.tool_name,
            "description": self.description,
            "parameters": {
                "type": "object",
                "properties": {
                    "urls": {
                        "type": "string",
                        "description": "URLs to scrape, separated by commas. Multiple URLs can be scraped efficiently in one call."
                    },
                    "include_html": {
                        "type": "boolean",
                        "description": "Whether to include full HTML content alongside markdown",
                        "default": False
                    },
                    "only_main_content": {
                        "type": "boolean",
                        "description": "Whether to extract only main content (skip navigation, ads, etc.)",
                        "default": True
                    },
                    "max_length": {
                        "type": "integer",
                        "description": "Maximum content length in characters",
                        "default": 4000
                    }
                },
                "required": ["urls"]
            }
        }
    
    async def execute(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Execute web scraping"""
        try:
            urls = args.get("urls")
            if not urls:
                return {
                    "success": False,
                    "error": "Valid URLs are required."
                }
            
            # Parse URLs
            url_list = [url.strip() for url in urls.split(',') if url.strip()]
            if not url_list:
                return {
                    "success": False,
                    "error": "No valid URLs provided."
                }
            
            include_html = args.get("include_html", False)
            only_main_content = args.get("only_main_content", True)
            max_length = args.get("max_length", 4000)
            
            logging.info(f"Scraping {len(url_list)} URLs: {url_list}")
            
            # Process URLs concurrently
            tasks = [self._scrape_single_url(url, include_html, only_main_content, max_length) for url in url_list]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Process results
            processed_results = []
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    logging.error(f"Error processing URL {url_list[i]}: {str(result)}")
                    processed_results.append({
                        "url": url_list[i],
                        "success": False,
                        "error": str(result)
                    })
                else:
                    processed_results.append(result)
            
            # Summarize results
            successful = sum(1 for r in processed_results if r.get("success", False))
            failed = len(processed_results) - successful
            
            if successful == len(processed_results):
                message = f"Successfully scraped all {len(processed_results)} URLs."
            elif successful > 0:
                message = f"Scraped {successful} URLs successfully and {failed} failed."
            else:
                error_details = "; ".join([f"{r.get('url')}: {r.get('error', 'Unknown error')}" for r in processed_results])
                return {
                    "success": False,
                    "error": f"Failed to scrape all {len(processed_results)} URLs. Errors: {error_details}",
                    "results": processed_results
                }
            
            return {
                "success": True,
                "message": message,
                "results": processed_results,
                "successful_count": successful,
                "failed_count": failed,
                "total_count": len(processed_results),
                "provider": "firecrawl"
            }
        
        except Exception as e:
            error_message = str(e)
            logging.error(f"Error in web scraping: {error_message}")
            return {
                "success": False,
                "error": f"Error processing scrape request: {error_message[:200]}",
                "provider": "firecrawl"
            }
    
    async def _scrape_single_url(self, url: str, include_html: bool, only_main_content: bool, max_length: int) -> Dict[str, Any]:
        """Scrape a single URL and return the result"""
        logging.info(f"Scraping single URL: {url}")
        
        try:
            firecrawl_client = get_firecrawl_client()
            
            # Determine formats to request
            formats = ["markdown"]
            if include_html:
                formats.append("html")
            
            # Scrape the URL
            result = await firecrawl_client.scrape_url(
                url=url,
                formats=formats,
                onlyMainContent=only_main_content,
                maxLength=max_length
            )
            
            if result.get("success", False):
                # Extract content
                title = result.get("title", "")
                markdown_content = result.get("markdown", "")
                html_content = result.get("html", "") if include_html else ""
                
                logging.info(f"Extracted content from {url}: title='{title}', content length={len(markdown_content)}")
                
                formatted_result = {
                    "url": url,
                    "success": True,
                    "title": title,
                    "content": markdown_content,
                    "content_length": len(markdown_content)
                }
                
                # Add HTML content if requested
                if include_html and html_content:
                    formatted_result["html"] = html_content
                
                # Add metadata if available
                if "metadata" in result:
                    formatted_result["metadata"] = result["metadata"]
                
                return formatted_result
            else:
                return {
                    "url": url,
                    "success": False,
                    "error": result.get("error", "Unknown scraping error")
                }
        
        except Exception as e:
            error_message = str(e)
            logging.error(f"Error scraping URL '{url}': {error_message}")
            return {
                "url": url,
                "success": False,
                "error": error_message
            }


# Export the tool instance
web_scrape_tool = WebScrapeTool()
