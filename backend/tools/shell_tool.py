"""
Shell Tool - Execute commands in Daytona sandbox with tmux session management
Based on Reference implementation with session-based state management
"""

import asyncio
import json
import time
from typing import Dict, Any, List, Optional
from services.daytona_client import get_daytona_client


class ShellTool:
    """Tool for executing shell commands in Daytona sandbox with tmux sessions"""
    
    def __init__(self):
        self.tool_name = "shell"
        self.description = "Execute shell commands in the Daytona sandbox. Supports tmux sessions for persistent command execution."
        self.active_sessions = {}  # Track active tmux sessions
    
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
                        "enum": ["execute_command", "check_command_output", "terminate_command", "list_commands"],
                        "description": "The action to perform"
                    },
                    "command": {
                        "type": "string",
                        "description": "The shell command to execute (required for execute_command)"
                    },
                    "session_name": {
                        "type": "string",
                        "description": "Tmux session name for grouping related commands (optional)"
                    },
                    "blocking": {
                        "type": "boolean",
                        "description": "Whether to wait for command completion (default: true)"
                    },
                    "timeout": {
                        "type": "integer",
                        "description": "Command timeout in seconds (default: 30)"
                    }
                },
                "required": ["action"]
            }
        }
    
    async def execute(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the shell tool"""
        try:
            action = args.get("action")
            
            if action == "execute_command":
                return await self._execute_command(
                    args.get("command"),
                    args.get("session_name"),
                    args.get("blocking", True),
                    args.get("timeout", 30)
                )
            elif action == "check_command_output":
                return await self._check_command_output(args.get("session_name"))
            elif action == "terminate_command":
                return await self._terminate_command(args.get("session_name"))
            elif action == "list_commands":
                return await self._list_commands()
            else:
                return {
                    "success": False,
                    "error": f"Unknown action: {action}",
                    "available_actions": ["execute_command", "check_command_output", "terminate_command", "list_commands"]
                }
                
        except Exception as e:
            return {
                "success": False,
                "error": f"Shell tool error: {str(e)}"
            }
    
    async def _execute_command(
        self, 
        command: Optional[str], 
        session_name: Optional[str], 
        blocking: bool = True,
        timeout: int = 30
    ) -> Dict[str, Any]:
        """Execute a shell command in the sandbox"""
        try:
            if not command:
                return {
                    "success": False,
                    "error": "Command is required"
                }
            
            daytona_client = get_daytona_client()
            
            # Generate session name if not provided
            if not session_name:
                session_name = f"session_{int(time.time())}"
            
            # Check if session exists, create if not
            if session_name not in self.active_sessions:
                await self._create_tmux_session(session_name)
            
            # Execute command in tmux session
            if blocking:
                result = await self._execute_blocking_command(session_name, command, timeout)
            else:
                result = await self._execute_non_blocking_command(session_name, command)
            
            return {
                "success": True,
                "result": result,
                "session_name": session_name,
                "command": command
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to execute command: {str(e)}"
            }
    
    async def _create_tmux_session(self, session_name: str) -> None:
        """Create a new tmux session"""
        try:
            daytona_client = get_daytona_client()
            
            # Create tmux session
            create_cmd = f"tmux new-session -d -s {session_name}"
            await daytona_client.execute_command(create_cmd)
            
            # Track the session
            self.active_sessions[session_name] = {
                "created_at": time.time(),
                "commands": [],
                "status": "active"
            }
            
        except Exception as e:
            raise Exception(f"Failed to create tmux session: {str(e)}")
    
    async def _execute_blocking_command(self, session_name: str, command: str, timeout: int) -> Dict[str, Any]:
        """Execute a command and wait for completion"""
        try:
            daytona_client = get_daytona_client()
            
            # Execute command in tmux session
            full_command = f"tmux send-keys -t {session_name} '{command}' Enter"
            await daytona_client.execute_command(full_command)
            
            # Wait for command to complete and get output
            await asyncio.sleep(1)  # Give command time to start
            
            # Get the output
            output_cmd = f"tmux capture-pane -t {session_name} -p"
            output_result = await daytona_client.execute_command(output_cmd)
            
            # Track the command
            if session_name in self.active_sessions:
                self.active_sessions[session_name]["commands"].append({
                    "command": command,
                    "executed_at": time.time(),
                    "status": "completed"
                })
            
            return {
                "output": output_result.get("output", ""),
                "exit_code": output_result.get("exit_code", 0),
                "execution_time": time.time(),
                "session_name": session_name
            }
            
        except Exception as e:
            raise Exception(f"Failed to execute blocking command: {str(e)}")
    
    async def _execute_non_blocking_command(self, session_name: str, command: str) -> Dict[str, Any]:
        """Execute a command without waiting for completion"""
        try:
            daytona_client = get_daytona_client()
            
            # Execute command in tmux session
            full_command = f"tmux send-keys -t {session_name} '{command}' Enter"
            await daytona_client.execute_command(full_command)
            
            # Track the command
            if session_name in self.active_sessions:
                self.active_sessions[session_name]["commands"].append({
                    "command": command,
                    "executed_at": time.time(),
                    "status": "running"
                })
            
            return {
                "status": "started",
                "session_name": session_name,
                "command": command,
                "started_at": time.time()
            }
            
        except Exception as e:
            raise Exception(f"Failed to execute non-blocking command: {str(e)}")
    
    async def _check_command_output(self, session_name: Optional[str]) -> Dict[str, Any]:
        """Check the output of commands in a session"""
        try:
            if not session_name:
                return {
                    "success": False,
                    "error": "Session name is required"
                }
            
            if session_name not in self.active_sessions:
                return {
                    "success": False,
                    "error": f"Session '{session_name}' not found"
                }
            
            daytona_client = get_daytona_client()
            
            # Get current output
            output_cmd = f"tmux capture-pane -t {session_name} -p"
            output_result = await daytona_client.execute_command(output_cmd)
            
            # Get session info
            session_info = self.active_sessions[session_name]
            
            return {
                "success": True,
                "result": {
                    "session_name": session_name,
                    "output": output_result.get("output", ""),
                    "commands": session_info["commands"],
                    "status": session_info["status"],
                    "created_at": session_info["created_at"]
                }
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to check command output: {str(e)}"
            }
    
    async def _terminate_command(self, session_name: Optional[str]) -> Dict[str, Any]:
        """Terminate a tmux session"""
        try:
            if not session_name:
                return {
                    "success": False,
                    "error": "Session name is required"
                }
            
            if session_name not in self.active_sessions:
                return {
                    "success": False,
                    "error": f"Session '{session_name}' not found"
                }
            
            daytona_client = get_daytona_client()
            
            # Kill the tmux session
            kill_cmd = f"tmux kill-session -t {session_name}"
            await daytona_client.execute_command(kill_cmd)
            
            # Remove from tracking
            del self.active_sessions[session_name]
            
            return {
                "success": True,
                "result": {
                    "session_name": session_name,
                    "status": "terminated",
                    "terminated_at": time.time()
                },
                "message": f"Session '{session_name}' terminated successfully"
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to terminate command: {str(e)}"
            }
    
    async def _list_commands(self) -> Dict[str, Any]:
        """List all active sessions and their commands"""
        try:
            daytona_client = get_daytona_client()
            
            # Get all tmux sessions
            list_cmd = "tmux list-sessions -F '#{session_name}'"
            sessions_result = await daytona_client.execute_command(list_cmd)
            
            active_sessions = []
            for session_name in sessions_result.get("output", "").strip().split('\n'):
                if session_name and session_name in self.active_sessions:
                    session_info = self.active_sessions[session_name]
                    active_sessions.append({
                        "session_name": session_name,
                        "status": session_info["status"],
                        "created_at": session_info["created_at"],
                        "command_count": len(session_info["commands"]),
                        "last_command": session_info["commands"][-1] if session_info["commands"] else None
                    })
            
            return {
                "success": True,
                "result": {
                    "active_sessions": active_sessions,
                    "total_sessions": len(active_sessions)
                }
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to list commands: {str(e)}"
            }


# Export the tool instance
shell_tool = ShellTool()

