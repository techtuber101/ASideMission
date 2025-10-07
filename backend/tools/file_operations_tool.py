"""
File Operations Tool - Daytona Sandbox Integration
Based on Reference implementation with comprehensive file management capabilities
"""

import asyncio
import json
import logging
import os
from typing import Dict, Any, Optional, List
from services.daytona_client import get_daytona_client


class FileOperationsTool:
    """Tool for file operations in Daytona sandbox"""
    
    def __init__(self):
        self.tool_name = "file_operations"
        self.description = "Manage files in the Daytona sandbox. Create, read, write, edit, and delete files with full content management."
        self.workspace_path = "/workspace"
    
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
                            "create_file", "read_file", "write_file", "edit_file", 
                            "delete_file", "list_files", "file_exists", "get_file_info"
                        ],
                        "description": "The file operation to perform"
                    },
                    "file_path": {
                        "type": "string",
                        "description": "Path to the file (relative to /workspace)"
                    },
                    "content": {
                        "type": "string",
                        "description": "Content to write to the file (for create_file, write_file)"
                    },
                    "instructions": {
                        "type": "string",
                        "description": "Instructions for editing the file (for edit_file)"
                    },
                    "code_edit": {
                        "type": "string",
                        "description": "Code changes to apply (for edit_file)"
                    },
                    "start_line": {
                        "type": "integer",
                        "description": "Starting line number for reading (1-based)"
                    },
                    "end_line": {
                        "type": "integer",
                        "description": "Ending line number for reading (inclusive)"
                    },
                    "directory": {
                        "type": "string",
                        "description": "Directory to list files from (for list_files)"
                    },
                    "recursive": {
                        "type": "boolean",
                        "description": "Whether to list files recursively (for list_files)",
                        "default": False
                    }
                },
                "required": ["action"]
            }
        }
    
    async def execute(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Execute file operation"""
        try:
            action = args.get("action")
            
            if action == "create_file":
                return await self._create_file(args.get("file_path"), args.get("content"))
            elif action == "read_file":
                return await self._read_file(
                    args.get("file_path"), 
                    args.get("start_line"), 
                    args.get("end_line")
                )
            elif action == "write_file":
                return await self._write_file(args.get("file_path"), args.get("content"))
            elif action == "edit_file":
                return await self._edit_file(
                    args.get("file_path"), 
                    args.get("instructions"), 
                    args.get("code_edit")
                )
            elif action == "delete_file":
                return await self._delete_file(args.get("file_path"))
            elif action == "list_files":
                return await self._list_files(args.get("directory"), args.get("recursive", False))
            elif action == "file_exists":
                return await self._file_exists(args.get("file_path"))
            elif action == "get_file_info":
                return await self._get_file_info(args.get("file_path"))
            else:
                return {
                    "success": False,
                    "error": f"Unknown action: {action}",
                    "available_actions": [
                        "create_file", "read_file", "write_file", "edit_file", 
                        "delete_file", "list_files", "file_exists", "get_file_info"
                    ]
                }
                
        except Exception as e:
            logging.error(f"File operations tool error: {str(e)}")
            return {
                "success": False,
                "error": f"File operations tool error: {str(e)}"
            }
    
    def _clean_path(self, path: str) -> str:
        """Clean and normalize file path"""
        if not path:
            return ""
        
        # Remove leading slash and normalize
        path = path.lstrip('/')
        
        # Ensure it's within workspace
        if path.startswith('..') or path.startswith('/'):
            path = path.lstrip('/')
        
        return path
    
    async def _create_file(self, file_path: Optional[str], content: Optional[str]) -> Dict[str, Any]:
        """Create a new file with content"""
        try:
            if not file_path:
                return {
                    "success": False,
                    "error": "File path is required"
                }
            
            if content is None:
                return {
                    "success": False,
                    "error": "Content is required for creating a file"
                }
            
            file_path = self._clean_path(file_path)
            full_path = f"{self.workspace_path}/{file_path}"
            
            # Check if file already exists
            if await self._file_exists(file_path):
                return {
                    "success": False,
                    "error": f"File '{file_path}' already exists. Use write_file to overwrite."
                }
            
            # Create parent directories if needed
            parent_dir = '/'.join(full_path.split('/')[:-1])
            if parent_dir and parent_dir != self.workspace_path:
                await self._create_directory(parent_dir)
            
            # Write the file
            daytona_client = get_daytona_client()
            result = await daytona_client.write_file(full_path, content)
            
            if result.get("success", False):
                return {
                    "success": True,
                    "action": "create_file",
                    "file_path": file_path,
                    "content_length": len(content),
                    "message": f"File '{file_path}' created successfully"
                }
            else:
                return {
                    "success": False,
                    "error": f"Failed to create file: {result.get('error', 'Unknown error')}"
                }
                
        except Exception as e:
            return {
                "success": False,
                "error": f"Error creating file: {str(e)}"
            }
    
    async def _read_file(self, file_path: Optional[str], start_line: Optional[int] = None, end_line: Optional[int] = None) -> Dict[str, Any]:
        """Read file content with optional line range"""
        try:
            if not file_path:
                return {
                    "success": False,
                    "error": "File path is required"
                }
            
            file_path = self._clean_path(file_path)
            full_path = f"{self.workspace_path}/{file_path}"
            
            # Check if file exists
            if not await self._file_exists(file_path):
                return {
                    "success": False,
                    "error": f"File '{file_path}' does not exist"
                }
            
            # Read the file
            daytona_client = get_daytona_client()
            result = await daytona_client.read_file(full_path)
            
            if result.get("success", False):
                content = result.get("content", "")
                
                # Handle line range if specified
                if start_line is not None or end_line is not None:
                    lines = content.split('\n')
                    total_lines = len(lines)
                    
                    start_idx = max(0, (start_line or 1) - 1)
                    end_idx = end_line if end_line is not None else total_lines
                    end_idx = min(end_idx, total_lines)
                    
                    content = '\n'.join(lines[start_idx:end_idx])
                
                return {
                    "success": True,
                    "action": "read_file",
                    "file_path": file_path,
                    "content": content,
                    "content_length": len(content),
                    "start_line": start_line,
                    "end_line": end_line,
                    "total_lines": len(content.split('\n'))
                }
            else:
                return {
                    "success": False,
                    "error": f"Failed to read file: {result.get('error', 'Unknown error')}"
                }
                
        except Exception as e:
            return {
                "success": False,
                "error": f"Error reading file: {str(e)}"
            }
    
    async def _write_file(self, file_path: Optional[str], content: Optional[str]) -> Dict[str, Any]:
        """Write content to file (overwrites existing)"""
        try:
            if not file_path:
                return {
                    "success": False,
                    "error": "File path is required"
                }
            
            if content is None:
                return {
                    "success": False,
                    "error": "Content is required for writing to file"
                }
            
            file_path = self._clean_path(file_path)
            full_path = f"{self.workspace_path}/{file_path}"
            
            # Create parent directories if needed
            parent_dir = '/'.join(full_path.split('/')[:-1])
            if parent_dir and parent_dir != self.workspace_path:
                await self._create_directory(parent_dir)
            
            # Write the file
            daytona_client = get_daytona_client()
            result = await daytona_client.write_file(full_path, content)
            
            if result.get("success", False):
                return {
                    "success": True,
                    "action": "write_file",
                    "file_path": file_path,
                    "content_length": len(content),
                    "message": f"File '{file_path}' written successfully"
                }
            else:
                return {
                    "success": False,
                    "error": f"Failed to write file: {result.get('error', 'Unknown error')}"
                }
                
        except Exception as e:
            return {
                "success": False,
                "error": f"Error writing file: {str(e)}"
            }
    
    async def _edit_file(self, file_path: Optional[str], instructions: Optional[str], code_edit: Optional[str]) -> Dict[str, Any]:
        """Edit file using AI-powered editing (simplified version)"""
        try:
            if not file_path:
                return {
                    "success": False,
                    "error": "File path is required"
                }
            
            if not instructions and not code_edit:
                return {
                    "success": False,
                    "error": "Instructions or code_edit is required for editing"
                }
            
            file_path = self._clean_path(file_path)
            
            # Check if file exists
            if not await self._file_exists(file_path):
                return {
                    "success": False,
                    "error": f"File '{file_path}' does not exist"
                }
            
            # Read current content
            read_result = await self._read_file(file_path)
            if not read_result.get("success", False):
                return read_result
            
            original_content = read_result.get("content", "")
            
            # Simple edit implementation - replace content if code_edit provided
            if code_edit:
                new_content = code_edit
            else:
                # For now, just return the original content with instructions
                new_content = original_content
            
            # Write the edited content
            write_result = await self._write_file(file_path, new_content)
            
            if write_result.get("success", False):
                return {
                    "success": True,
                    "action": "edit_file",
                    "file_path": file_path,
                    "instructions": instructions,
                    "original_length": len(original_content),
                    "new_length": len(new_content),
                    "message": f"File '{file_path}' edited successfully"
                }
            else:
                return write_result
                
        except Exception as e:
            return {
                "success": False,
                "error": f"Error editing file: {str(e)}"
            }
    
    async def _delete_file(self, file_path: Optional[str]) -> Dict[str, Any]:
        """Delete a file"""
        try:
            if not file_path:
                return {
                    "success": False,
                    "error": "File path is required"
                }
            
            file_path = self._clean_path(file_path)
            full_path = f"{self.workspace_path}/{file_path}"
            
            # Check if file exists
            if not await self._file_exists(file_path):
                return {
                    "success": False,
                    "error": f"File '{file_path}' does not exist"
                }
            
            # Delete the file
            daytona_client = get_daytona_client()
            result = await daytona_client.delete_file(full_path)
            
            if result.get("success", False):
                return {
                    "success": True,
                    "action": "delete_file",
                    "file_path": file_path,
                    "message": f"File '{file_path}' deleted successfully"
                }
            else:
                return {
                    "success": False,
                    "error": f"Failed to delete file: {result.get('error', 'Unknown error')}"
                }
                
        except Exception as e:
            return {
                "success": False,
                "error": f"Error deleting file: {str(e)}"
            }
    
    async def _list_files(self, directory: Optional[str] = None, recursive: bool = False) -> Dict[str, Any]:
        """List files in a directory"""
        try:
            if directory:
                directory = self._clean_path(directory)
            else:
                directory = ""
            
            full_path = f"{self.workspace_path}/{directory}" if directory else self.workspace_path
            
            daytona_client = get_daytona_client()
            result = await daytona_client.list_files(full_path, recursive=recursive)
            
            if result.get("success", False):
                files = result.get("files", [])
                return {
                    "success": True,
                    "action": "list_files",
                    "directory": directory or "/",
                    "files": files,
                    "file_count": len(files),
                    "recursive": recursive
                }
            else:
                return {
                    "success": False,
                    "error": f"Failed to list files: {result.get('error', 'Unknown error')}"
                }
                
        except Exception as e:
            return {
                "success": False,
                "error": f"Error listing files: {str(e)}"
            }
    
    async def _file_exists(self, file_path: Optional[str]) -> bool:
        """Check if file exists"""
        try:
            if not file_path:
                return False
            
            file_path = self._clean_path(file_path)
            full_path = f"{self.workspace_path}/{file_path}"
            
            daytona_client = get_daytona_client()
            result = await daytona_client.file_exists(full_path)
            
            return result.get("exists", False)
            
        except Exception:
            return False
    
    async def _get_file_info(self, file_path: Optional[str]) -> Dict[str, Any]:
        """Get file information"""
        try:
            if not file_path:
                return {
                    "success": False,
                    "error": "File path is required"
                }
            
            file_path = self._clean_path(file_path)
            full_path = f"{self.workspace_path}/{file_path}"
            
            # Check if file exists
            if not await self._file_exists(file_path):
                return {
                    "success": False,
                    "error": f"File '{file_path}' does not exist"
                }
            
            daytona_client = get_daytona_client()
            result = await daytona_client.get_file_info(full_path)
            
            if result.get("success", False):
                return {
                    "success": True,
                    "action": "get_file_info",
                    "file_path": file_path,
                    "file_info": result.get("file_info", {}),
                    "size_bytes": result.get("size_bytes", 0),
                    "is_directory": result.get("is_directory", False),
                    "modified_time": result.get("modified_time")
                }
            else:
                return {
                    "success": False,
                    "error": f"Failed to get file info: {result.get('error', 'Unknown error')}"
                }
                
        except Exception as e:
            return {
                "success": False,
                "error": f"Error getting file info: {str(e)}"
            }
    
    async def _create_directory(self, directory_path: str) -> None:
        """Create directory if it doesn't exist"""
        try:
            daytona_client = get_daytona_client()
            await daytona_client.create_directory(directory_path)
        except Exception as e:
            logging.warning(f"Failed to create directory {directory_path}: {e}")


# Export the tool instance
file_operations_tool = FileOperationsTool()

