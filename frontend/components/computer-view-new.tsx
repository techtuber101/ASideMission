'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Terminal,
  ListTodo,
  FileText,
  Globe,
  Code,
  Monitor,
  Activity,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ToolCallViewModel {
  id: string;
  name: string;
  args: Record<string, any>;
  status: 'running' | 'completed' | 'error';
  result?: any;
  startTime: number;
  endTime?: number;
  cached?: boolean;
}

interface TaskListData {
  sections: Record<string, {
    tasks: Array<{
      id: string;
      title: string;
      description: string;
      status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
      priority: 'low' | 'medium' | 'high' | 'urgent';
      due_date?: string;
      created_at: string;
    }>;
  }>;
  summary: {
    total_tasks: number;
    completed: number;
    in_progress: number;
    pending: number;
    cancelled: number;
  };
}

interface TerminalSession {
  session_name: string;
  status: string;
  created_at: number;
  command_count: number;
  last_command?: {
    command: string;
    executed_at: number;
    status: string;
  };
}

interface ComputerViewProps {
  toolCalls: ToolCallViewModel[];
  isVisible: boolean;
  onToggle: () => void;
}

export function ComputerView({ toolCalls, isVisible, onToggle }: ComputerViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeView, setActiveView] = useState<'timeline' | 'tasks' | 'terminal'>('timeline');
  const [taskListData, setTaskListData] = useState<TaskListData | null>(null);
  const [terminalSessions, setTerminalSessions] = useState<TerminalSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Update task list data when task_list tool calls complete
  useEffect(() => {
    const taskListCalls = toolCalls.filter(call => 
      call.name === 'task_list' && 
      call.status === 'completed' && 
      call.result?.success
    );
    
    if (taskListCalls.length > 0) {
      const latestCall = taskListCalls[taskListCalls.length - 1];
      if (latestCall.result?.result?.sections) {
        setTaskListData(latestCall.result.result);
      }
    }
  }, [toolCalls]);

  // Update terminal sessions when shell tool calls complete
  useEffect(() => {
    const shellCalls = toolCalls.filter(call => 
      call.name === 'shell' && 
      call.status === 'completed' && 
      call.result?.success
    );
    
    if (shellCalls.length > 0) {
      const listCalls = shellCalls.filter(call => 
        call.args?.action === 'list_commands'
      );
      
      if (listCalls.length > 0) {
        const latestCall = listCalls[listCalls.length - 1];
        if (latestCall.result?.result?.active_sessions) {
          setTerminalSessions(latestCall.result.result.active_sessions);
        }
      }
    }
  }, [toolCalls]);

  const getToolIcon = (toolName: string) => {
    switch (toolName) {
      case 'task_list':
        return <ListTodo className="h-4 w-4" />;
      case 'shell':
        return <Terminal className="h-4 w-4" />;
      case 'web_search':
        return <Globe className="h-4 w-4" />;
      case 'web_scrape':
        return <FileText className="h-4 w-4" />;
      case 'file':
        return <FileText className="h-4 w-4" />;
      case 'code':
        return <Code className="h-4 w-4" />;
      case 'browser':
        return <Globe className="h-4 w-4" />;
      case 'computer':
        return <Monitor className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const renderTimelineView = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Tool Execution Timeline</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {currentIndex + 1} of {toolCalls.length}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentIndex(Math.min(toolCalls.length - 1, currentIndex + 1))}
            disabled={currentIndex === toolCalls.length - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {toolCalls.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              {getToolIcon(toolCalls[currentIndex].name)}
              {toolCalls[currentIndex].name.replace('_', ' ').toUpperCase()}
              {getStatusIcon(toolCalls[currentIndex].status)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <h4 className="text-sm font-medium mb-2">Arguments:</h4>
              <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                {JSON.stringify(toolCalls[currentIndex].args, null, 2)}
              </pre>
            </div>

            {toolCalls[currentIndex].status === 'completed' && toolCalls[currentIndex].result && (
              <div>
                <h4 className="text-sm font-medium mb-2">Result:</h4>
                <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-40">
                  {JSON.stringify(toolCalls[currentIndex].result, null, 2)}
                </pre>
              </div>
            )}

            {toolCalls[currentIndex].status === 'error' && (
              <div>
                <h4 className="text-sm font-medium mb-2 text-red-600">Error:</h4>
                <pre className="text-xs bg-red-50 dark:bg-red-950/20 p-2 rounded text-red-800 dark:text-red-400">
                  {toolCalls[currentIndex].result?.error || 'Unknown error'}
                </pre>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Started: {new Date(toolCalls[currentIndex].startTime).toLocaleTimeString()}
              </span>
              {toolCalls[currentIndex].endTime && (
                <span>
                  Duration: {Math.round(toolCalls[currentIndex].endTime - toolCalls[currentIndex].startTime)}ms
                </span>
              )}
              {toolCalls[currentIndex].cached && (
                <Badge variant="secondary" className="text-xs">Cached</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {toolCalls.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No tool calls yet</p>
          <p className="text-sm">Tool executions will appear here</p>
        </div>
      )}
    </div>
  );

  const renderTaskListView = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Task List</h3>
        {taskListData && (
          <div className="flex gap-2">
            <Badge variant="outline">{taskListData.summary.total_tasks} total</Badge>
            <Badge className={getStatusColor('completed')}>{taskListData.summary.completed} done</Badge>
            <Badge className={getStatusColor('in_progress')}>{taskListData.summary.in_progress} active</Badge>
          </div>
        )}
      </div>

      {taskListData ? (
        <div className="space-y-4">
          {Object.entries(taskListData.sections).map(([sectionName, section]) => (
            <Card key={sectionName}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{sectionName}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {section.tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-start gap-3 p-3 rounded-lg border"
                    >
                      <div className="flex-shrink-0 mt-1">
                        {getStatusIcon(task.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-sm">{task.title}</h4>
                          <Badge className={getPriorityColor(task.priority)} variant="secondary">
                            {task.priority}
                          </Badge>
                          <Badge className={getStatusColor(task.status)} variant="secondary">
                            {task.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        {task.description && (
                          <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Created: {new Date(task.created_at).toLocaleDateString()}</span>
                          {task.due_date && (
                            <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <ListTodo className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No task list data</p>
          <p className="text-sm">Task list operations will appear here</p>
        </div>
      )}
    </div>
  );

  const renderTerminalView = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Terminal Sessions</h3>
        {terminalSessions.length > 0 && (
          <Badge variant="outline">{terminalSessions.length} active</Badge>
        )}
      </div>

      {terminalSessions.length > 0 ? (
        <div className="space-y-3">
          {terminalSessions.map((session) => (
            <Card key={session.session_name}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Terminal className="h-4 w-4" />
                  {session.session_name}
                  <Badge className={getStatusColor(session.status)} variant="secondary">
                    {session.status}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Commands executed: {session.command_count}</span>
                    <span>Created: {new Date(session.created_at * 1000).toLocaleTimeString()}</span>
                  </div>
                  {session.last_command && (
                    <div className="mt-3 p-2 bg-muted rounded text-sm">
                      <div className="font-medium mb-1">Last command:</div>
                      <code className="text-xs">{session.last_command.command}</code>
                      <div className="text-xs text-muted-foreground mt-1">
                        Status: {session.last_command.status} • 
                        Executed: {new Date(session.last_command.executed_at * 1000).toLocaleTimeString()}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <Terminal className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No terminal sessions</p>
          <p className="text-sm">Shell commands will appear here</p>
        </div>
      )}
    </div>
  );

  if (!isVisible) {
    return (
      <div className="w-12 h-full bg-muted/50 border-l flex items-center justify-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ width: 0 }}
      animate={{ width: 400 }}
      exit={{ width: 0 }}
      className="h-full bg-background border-l flex flex-col"
    >
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Computer View</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant={activeView === 'timeline' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveView('timeline')}
            className="flex-1"
          >
            <Activity className="h-4 w-4 mr-2" />
            Timeline
          </Button>
          <Button
            variant={activeView === 'tasks' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveView('tasks')}
            className="flex-1"
          >
            <ListTodo className="h-4 w-4 mr-2" />
            Tasks
          </Button>
          <Button
            variant={activeView === 'terminal' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveView('terminal')}
            className="flex-1"
          >
            <Terminal className="h-4 w-4 mr-2" />
            Terminal
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <AnimatePresence mode="wait">
          {activeView === 'timeline' && (
            <motion.div
              key="timeline"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {renderTimelineView()}
            </motion.div>
          )}
          {activeView === 'tasks' && (
            <motion.div
              key="tasks"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {renderTaskListView()}
            </motion.div>
          )}
          {activeView === 'terminal' && (
            <motion.div
              key="terminal"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {renderTerminalView()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
