"""
Firecrawl Client - Web scraping API integration
Based on Reference implementation with simplified interface
"""

import asyncio
import logging
import httpx
from typing import Dict, Any, Optional, List
import os
from dotenv import load_dotenv

load_dotenv()

class FirecrawlClient:
    """Simplified Firecrawl client for web scraping operations"""
    
    def __init__(self):
        self.api_key = os.getenv("FIRECRAWL_API_KEY")
        self.api_url = os.getenv("FIRECRAWL_URL", "https://api.firecrawl.dev")
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize Firecrawl client with API key"""
        try:
            if self.api_key:
                logging.info("Firecrawl client initialized successfully")
            else:
                logging.warning("No Firecrawl API key found - using mock mode")
                
        except Exception as e:
            logging.error(f"Failed to initialize Firecrawl client: {e}")
    
    async def scrape_url(
        self,
        url: str,
        formats: List[str] = ["markdown"],
        onlyMainContent: bool = True,
        maxLength: int = 4000
    ) -> Dict[str, Any]:
        """Scrape a single URL using Firecrawl API"""
        try:
            if not self.api_key:
                # Mock response for development
                return {
                    "success": True,
                    "url": url,
                    "title": f"Mock title for {url}",
                    "content": f"Mock content extracted from {url}",
                    "markdown": f"# Mock Markdown Content\n\nThis is mock content from {url}",
                    "html": f"<html><body><h1>Mock HTML Content</h1><p>This is mock content from {url}</p></body></html>",
                    "metadata": {
                        "title": f"Mock title for {url}",
                        "description": f"Mock description for {url}",
                        "language": "en"
                    }
                }
            
            # Make request to Firecrawl API
            async with httpx.AsyncClient() as client:
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                }
                
                payload = {
                    "url": url,
                    "formats": formats,
                    "onlyMainContent": onlyMainContent,
                    "maxLength": maxLength
                }
                
                # Use retry logic for reliability
                max_retries = 3
                timeout_seconds = 30
                retry_count = 0
                
                while retry_count < max_retries:
                    try:
                        logging.info(f"Sending request to Firecrawl (attempt {retry_count + 1}/{max_retries})")
                        response = await client.post(
                            f"{self.api_url}/v1/scrape",
                            json=payload,
                            headers=headers,
                            timeout=timeout_seconds,
                        )
                        response.raise_for_status()
                        data = response.json()
                        logging.info(f"Successfully received response from Firecrawl for {url}")
                        break
                    except (httpx.ReadTimeout, httpx.ConnectTimeout, httpx.ReadError) as timeout_err:
                        retry_count += 1
                        logging.warning(f"Request timed out (attempt {retry_count}/{max_retries}): {str(timeout_err)}")
                        if retry_count >= max_retries:
                            raise Exception(f"Request timed out after {max_retries} attempts with {timeout_seconds}s timeout")
                        # Exponential backoff
                        logging.info(f"Waiting {2 ** retry_count}s before retry")
                        await asyncio.sleep(2 ** retry_count)
                    except Exception as e:
                        # Don't retry on non-timeout errors
                        logging.error(f"Error during scraping: {str(e)}")
                        raise e
            
            # Format the response
            title = data.get("data", {}).get("metadata", {}).get("title", "")
            markdown_content = data.get("data", {}).get("markdown", "")
            html_content = data.get("data", {}).get("html", "")
            
            logging.info(f"Extracted content from {url}: title='{title}', content length={len(markdown_content)}")
            
            return {
                "success": True,
                "url": url,
                "title": title,
                "content": markdown_content,
                "markdown": markdown_content,
                "html": html_content,
                "metadata": data.get("data", {}).get("metadata", {}),
                "provider": "firecrawl"
            }
        
        except Exception as e:
            error_message = str(e)
            logging.error(f"Error scraping URL '{url}': {error_message}")
            return {
                "success": False,
                "url": url,
                "error": error_message,
                "provider": "firecrawl"
            }
    
    async def scrape_multiple_urls(
        self,
        urls: List[str],
        formats: List[str] = ["markdown"],
        onlyMainContent: bool = True,
        maxLength: int = 4000
    ) -> Dict[str, Any]:
        """Scrape multiple URLs concurrently"""
        try:
            if not urls:
                return {
                    "success": False,
                    "error": "No URLs provided",
                    "results": []
                }
            
            logging.info(f"Scraping {len(urls)} URLs: {urls}")
            
            # Process URLs concurrently
            tasks = [self.scrape_url(url, formats, onlyMainContent, maxLength) for url in urls]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Process results
            processed_results = []
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    logging.error(f"Error processing URL {urls[i]}: {str(result)}")
                    processed_results.append({
                        "url": urls[i],
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
            logging.error(f"Error in batch scraping: {error_message}")
            return {
                "success": False,
                "error": f"Error processing batch scrape request: {error_message[:200]}",
                "provider": "firecrawl"
            }


# Global instance
_firecrawl_client: Optional[FirecrawlClient] = None

def get_firecrawl_client() -> FirecrawlClient:
    """Get singleton Firecrawl client instance"""
    global _firecrawl_client
    if _firecrawl_client is None:
        _firecrawl_client = FirecrawlClient()
    return _firecrawl_client