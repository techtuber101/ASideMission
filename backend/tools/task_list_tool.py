"""
Task List Tool - Manages task lists with sections and tasks
Based on Reference implementation with full CRUD operations
"""

import json
import uuid
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone


class TaskListTool:
    """Tool for managing task lists with sections and tasks"""
    
    def __init__(self):
        self.tool_name = "task_list"
        self.description = "Manage task lists with sections and tasks. Create, update, delete, and organize tasks."
    
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
                        "enum": ["view_tasks", "create_tasks", "update_tasks", "delete_tasks", "clear_all"],
                        "description": "The action to perform on the task list"
                    },
                    "section": {
                        "type": "string",
                        "description": "The section name for the task (required for create_tasks, update_tasks, delete_tasks)"
                    },
                    "tasks": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "id": {
                                    "type": "string",
                                    "description": "Task ID (required for update_tasks, delete_tasks)"
                                },
                                "title": {
                                    "type": "string",
                                    "description": "Task title"
                                },
                                "description": {
                                    "type": "string",
                                    "description": "Task description"
                                },
                                "status": {
                                    "type": "string",
                                    "enum": ["pending", "in_progress", "completed", "cancelled"],
                                    "description": "Task status"
                                },
                                "priority": {
                                    "type": "string",
                                    "enum": ["low", "medium", "high", "urgent"],
                                    "description": "Task priority"
                                },
                                "due_date": {
                                    "type": "string",
                                    "description": "Due date in ISO format (YYYY-MM-DD)"
                                }
                            },
                            "required": ["title"]
                        },
                        "description": "List of tasks to create, update, or delete"
                    }
                },
                "required": ["action"]
            }
        }
    
    async def execute(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the task list tool"""
        try:
            action = args.get("action")
            
            if action == "view_tasks":
                return await self._view_tasks()
            elif action == "create_tasks":
                return await self._create_tasks(args.get("section"), args.get("tasks", []))
            elif action == "update_tasks":
                return await self._update_tasks(args.get("section"), args.get("tasks", []))
            elif action == "delete_tasks":
                return await self._delete_tasks(args.get("section"), args.get("tasks", []))
            elif action == "clear_all":
                return await self._clear_all()
            else:
                return {
                    "success": False,
                    "error": f"Unknown action: {action}",
                    "available_actions": ["view_tasks", "create_tasks", "update_tasks", "delete_tasks", "clear_all"]
                }
                
        except Exception as e:
            return {
                "success": False,
                "error": f"Task list tool error: {str(e)}"
            }
    
    async def _view_tasks(self) -> Dict[str, Any]:
        """View all tasks organized by sections"""
        try:
            # In a real implementation, this would load from a database
            # For now, return a sample structure
            tasks_data = {
                "sections": {
                    "Planning": {
                        "tasks": [
                            {
                                "id": "task_1",
                                "title": "Define project requirements",
                                "description": "Gather and document all project requirements",
                                "status": "completed",
                                "priority": "high",
                                "due_date": "2024-01-15",
                                "created_at": "2024-01-10T10:00:00Z"
                            },
                            {
                                "id": "task_2",
                                "title": "Create project timeline",
                                "description": "Develop a detailed project timeline",
                                "status": "in_progress",
                                "priority": "medium",
                                "due_date": "2024-01-20",
                                "created_at": "2024-01-10T10:30:00Z"
                            }
                        ]
                    },
                    "Development": {
                        "tasks": [
                            {
                                "id": "task_3",
                                "title": "Setup development environment",
                                "description": "Configure development tools and environment",
                                "status": "pending",
                                "priority": "high",
                                "due_date": "2024-01-18",
                                "created_at": "2024-01-12T09:00:00Z"
                            }
                        ]
                    }
                },
                "summary": {
                    "total_tasks": 3,
                    "completed": 1,
                    "in_progress": 1,
                    "pending": 1,
                    "cancelled": 0
                }
            }
            
            return {
                "success": True,
                "result": tasks_data,
                "message": "Tasks retrieved successfully"
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to view tasks: {str(e)}"
            }
    
    async def _create_tasks(self, section: Optional[str], tasks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Create new tasks in a section"""
        try:
            if not section:
                return {
                    "success": False,
                    "error": "Section name is required for creating tasks"
                }
            
            if not tasks:
                return {
                    "success": False,
                    "error": "At least one task is required"
                }
            
            # Generate IDs for new tasks
            created_tasks = []
            for task in tasks:
                task_id = f"task_{uuid.uuid4().hex[:8]}"
                created_task = {
                    "id": task_id,
                    "title": task["title"],
                    "description": task.get("description", ""),
                    "status": task.get("status", "pending"),
                    "priority": task.get("priority", "medium"),
                    "due_date": task.get("due_date"),
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                created_tasks.append(created_task)
            
            # In a real implementation, this would save to database
            result = {
                "section": section,
                "created_tasks": created_tasks,
                "count": len(created_tasks)
            }
            
            return {
                "success": True,
                "result": result,
                "message": f"Created {len(created_tasks)} task(s) in '{section}' section"
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to create tasks: {str(e)}"
            }
    
    async def _update_tasks(self, section: Optional[str], tasks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Update existing tasks"""
        try:
            if not section:
                return {
                    "success": False,
                    "error": "Section name is required for updating tasks"
                }
            
            if not tasks:
                return {
                    "success": False,
                    "error": "At least one task is required"
                }
            
            updated_tasks = []
            for task in tasks:
                if not task.get("id"):
                    return {
                        "success": False,
                        "error": "Task ID is required for updating tasks"
                    }
                
                updated_task = {
                    "id": task["id"],
                    "title": task.get("title", ""),
                    "description": task.get("description", ""),
                    "status": task.get("status", "pending"),
                    "priority": task.get("priority", "medium"),
                    "due_date": task.get("due_date"),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
                updated_tasks.append(updated_task)
            
            # In a real implementation, this would update the database
            result = {
                "section": section,
                "updated_tasks": updated_tasks,
                "count": len(updated_tasks)
            }
            
            return {
                "success": True,
                "result": result,
                "message": f"Updated {len(updated_tasks)} task(s) in '{section}' section"
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to update tasks: {str(e)}"
            }
    
    async def _delete_tasks(self, section: Optional[str], tasks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Delete tasks"""
        try:
            if not section:
                return {
                    "success": False,
                    "error": "Section name is required for deleting tasks"
                }
            
            if not tasks:
                return {
                    "success": False,
                    "error": "At least one task is required"
                }
            
            deleted_task_ids = []
            for task in tasks:
                if not task.get("id"):
                    return {
                        "success": False,
                        "error": "Task ID is required for deleting tasks"
                    }
                deleted_task_ids.append(task["id"])
            
            # In a real implementation, this would delete from database
            result = {
                "section": section,
                "deleted_task_ids": deleted_task_ids,
                "count": len(deleted_task_ids)
            }
            
            return {
                "success": True,
                "result": result,
                "message": f"Deleted {len(deleted_task_ids)} task(s) from '{section}' section"
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to delete tasks: {str(e)}"
            }
    
    async def _clear_all(self) -> Dict[str, Any]:
        """Clear all tasks from all sections"""
        try:
            # In a real implementation, this would clear the database
            result = {
                "cleared_sections": ["Planning", "Development", "Testing", "Deployment"],
                "total_tasks_cleared": 15
            }
            
            return {
                "success": True,
                "result": result,
                "message": "All tasks cleared successfully"
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to clear all tasks: {str(e)}"
            }


# Export the tool instance
task_list_tool = TaskListTool()

