"""
Daytona Client - Simplified interface for Daytona sandbox operations
Based on Reference implementation with simplified API for tool usage
"""

import asyncio
import json
import logging
from typing import Dict, Any, Optional, List
from daytona_sdk import AsyncDaytona, DaytonaConfig, AsyncSandbox, SessionExecuteRequest, SandboxState
import os
from dotenv import load_dotenv

load_dotenv()

class DaytonaClient:
    """Simplified Daytona client for tool operations"""
    
    def __init__(self):
        self.daytona = None
        self.current_sandbox = None
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize Daytona client with configuration"""
        try:
            daytona_config = DaytonaConfig(
                api_key=os.getenv("DAYTONA_API_KEY"),
                api_url=os.getenv("DAYTONA_SERVER_URL", "https://app.daytona.io/api"),
                target=os.getenv("DAYTONA_TARGET", "us"),
            )
            
            if daytona_config.api_key:
                self.daytona = AsyncDaytona(daytona_config)
                logging.info("Daytona client initialized successfully")
            else:
                logging.warning("No Daytona API key found - using mock mode")
                self.daytona = None
                
        except Exception as e:
            logging.error(f"Failed to initialize Daytona client: {e}")
            self.daytona = None
    
    async def _ensure_sandbox(self) -> AsyncSandbox:
        """Ensure we have a working sandbox"""
        if not self.daytona:
            raise Exception("Daytona client not initialized - check API key")
        
        if not self.current_sandbox:
            # For now, we'll use a mock sandbox or create one
            # In a real implementation, you'd get this from your project/session
            raise Exception("No sandbox available - sandbox management not implemented")
        
        return self.current_sandbox
    
    async def execute_command(self, command: str, timeout_seconds: int = 30) -> Dict[str, Any]:
        """Execute a shell command in the sandbox"""
        try:
            if not self.daytona:
                # Mock response for development
                return {
                    "success": True,
                    "output": f"Mock execution of: {command}",
                    "stderr": "",
                    "exit_code": 0
                }
            
            sandbox = await self._ensure_sandbox()
            
            # Execute command in sandbox
            session_id = "default-session"
            
            # Create session if it doesn't exist
            try:
                await sandbox.process.create_session(session_id)
            except:
                pass  # Session might already exist
            
            # Execute command
            req = SessionExecuteRequest(
                command=command,
                var_async=False,
                cwd="/workspace"
            )
            
            response = await sandbox.process.execute_session_command(
                session_id=session_id,
                req=req,
                timeout=timeout_seconds
            )
            
            # Get command logs
            logs = await sandbox.process.get_session_command_logs(
                session_id=session_id,
                command_id=response.cmd_id
            )
            
            return {
                "success": response.exit_code == 0,
                "output": logs,
                "stderr": "",
                "exit_code": response.exit_code
            }
            
        except Exception as e:
            logging.error(f"Error executing command '{command}': {e}")
            return {
                "success": False,
                "output": "",
                "stderr": str(e),
                "exit_code": 1
            }
    
    async def read_file(self, file_path: str) -> Dict[str, Any]:
        """Read file content from sandbox"""
        try:
            if not self.daytona:
                # Mock response for development
                return {
                    "success": True,
                    "content": f"Mock content of file: {file_path}"
                }
            
            sandbox = await self._ensure_sandbox()
            
            # Read file using sandbox filesystem
            content = await sandbox.fs.download_file(file_path)
            
            return {
                "success": True,
                "content": content.decode('utf-8') if isinstance(content, bytes) else content
            }
            
        except Exception as e:
            logging.error(f"Error reading file '{file_path}': {e}")
            return {
                "success": False,
                "content": "",
                "error": str(e)
            }
    
    async def write_file(self, file_path: str, content: str) -> Dict[str, Any]:
        """Write content to file in sandbox"""
        try:
            if not self.daytona:
                # Mock response for development
                return {
                    "success": True,
                    "message": f"Mock write to file: {file_path}"
                }
            
            sandbox = await self._ensure_sandbox()
            
            # Write file using sandbox filesystem
            content_bytes = content.encode('utf-8') if isinstance(content, str) else content
            await sandbox.fs.upload_file(content_bytes, file_path)
            
            return {
                "success": True,
                "message": f"File written successfully: {file_path}"
            }
            
        except Exception as e:
            logging.error(f"Error writing file '{file_path}': {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def delete_file(self, file_path: str) -> Dict[str, Any]:
        """Delete file from sandbox"""
        try:
            if not self.daytona:
                # Mock response for development
                return {
                    "success": True,
                    "message": f"Mock delete of file: {file_path}"
                }
            
            sandbox = await self._ensure_sandbox()
            
            # Delete file using sandbox filesystem
            await sandbox.fs.delete_file(file_path)
            
            return {
                "success": True,
                "message": f"File deleted successfully: {file_path}"
            }
            
        except Exception as e:
            logging.error(f"Error deleting file '{file_path}': {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def list_files(self, directory: str, recursive: bool = False) -> Dict[str, Any]:
        """List files in directory"""
        try:
            if not self.daytona:
                # Mock response for development
                return {
                    "success": True,
                    "files": [
                        {"name": "file1.txt", "is_directory": False, "size": 1024},
                        {"name": "folder1", "is_directory": True, "size": 0}
                    ]
                }
            
            sandbox = await self._ensure_sandbox()
            
            # List files using sandbox filesystem
            files = await sandbox.fs.list_files(directory)
            
            file_list = []
            for file_info in files:
                file_list.append({
                    "name": file_info.name,
                    "is_directory": file_info.is_dir,
                    "size": file_info.size
                })
            
            return {
                "success": True,
                "files": file_list
            }
            
        except Exception as e:
            logging.error(f"Error listing files in '{directory}': {e}")
            return {
                "success": False,
                "files": [],
                "error": str(e)
            }
    
    async def file_exists(self, file_path: str) -> Dict[str, Any]:
        """Check if file exists"""
        try:
            if not self.daytona:
                # Mock response for development
                return {
                    "exists": True
                }
            
            sandbox = await self._ensure_sandbox()
            
            # Check file existence using sandbox filesystem
            try:
                await sandbox.fs.get_file_info(file_path)
                return {"exists": True}
            except:
                return {"exists": False}
            
        except Exception as e:
            logging.error(f"Error checking file existence '{file_path}': {e}")
            return {"exists": False}
    
    async def get_file_info(self, file_path: str) -> Dict[str, Any]:
        """Get file information"""
        try:
            if not self.daytona:
                # Mock response for development
                return {
                    "success": True,
                    "file_info": {
                        "name": file_path.split('/')[-1],
                        "size": 1024,
                        "is_directory": False
                    },
                    "size_bytes": 1024,
                    "is_directory": False
                }
            
            sandbox = await self._ensure_sandbox()
            
            # Get file info using sandbox filesystem
            file_info = await sandbox.fs.get_file_info(file_path)
            
            return {
                "success": True,
                "file_info": {
                    "name": file_info.name,
                    "size": file_info.size,
                    "is_directory": file_info.is_dir
                },
                "size_bytes": file_info.size,
                "is_directory": file_info.is_dir
            }
            
        except Exception as e:
            logging.error(f"Error getting file info '{file_path}': {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def create_directory(self, directory_path: str) -> Dict[str, Any]:
        """Create directory"""
        try:
            if not self.daytona:
                # Mock response for development
                return {
                    "success": True,
                    "message": f"Mock directory created: {directory_path}"
                }
            
            sandbox = await self._ensure_sandbox()
            
            # Create directory using sandbox filesystem
            await sandbox.fs.create_folder(directory_path, "755")
            
            return {
                "success": True,
                "message": f"Directory created successfully: {directory_path}"
            }
            
        except Exception as e:
            logging.error(f"Error creating directory '{directory_path}': {e}")
            return {
                "success": False,
                "error": str(e)
            }


# Global instance
_daytona_client: Optional[DaytonaClient] = None

def get_daytona_client() -> DaytonaClient:
    """Get singleton Daytona client instance"""
    global _daytona_client
    if _daytona_client is None:
        _daytona_client = DaytonaClient()
    return _daytona_client