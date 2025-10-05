'use client';

import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  Download, 
  FileText, 
  Folder, 
  X, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  Plus,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface FileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  content?: string;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  progress?: number;
}

interface FileUploadProps {
  onUpload: (files: FileItem[]) => void;
  onDownload: (filePath: string) => void;
  onListFiles: () => void;
  isVisible: boolean;
  onClose: () => void;
}

export function FileUpload({ onUpload, onDownload, onListFiles, isVisible, onClose }: FileUploadProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [sandboxFiles, setSandboxFiles] = useState<FileItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isListing, setIsListing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    
    const newFiles: FileItem[] = selectedFiles.map(file => ({
      id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'pending'
    }));

    setFiles(prev => [...prev, ...newFiles]);
    
    // Clear the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (files.length === 0) return;

    setIsUploading(true);
    
    try {
      // Convert files to base64 and upload
      const filesToUpload: FileItem[] = [];
      
      // Process each file
      for (const file of files) {
        if (file.status === 'pending') {
          // Read file content and convert to base64
          const reader = new FileReader();
          reader.onload = (e) => {
            const content = e.target?.result as string;
            const base64Content = content.split(',')[1]; // Remove data:type;base64, prefix
            
            filesToUpload.push({
              ...file,
              content: base64Content,
              status: 'uploading'
            });
          };
          reader.readAsDataURL(file);
        }
      }

      // Wait a bit for file reading to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      setFiles(prev => prev.map(f => 
        f.status === 'pending' ? { ...f, status: 'uploading' } : f
      ));

      // Call upload handler (sends via WebSocket)
      onUpload(filesToUpload);
      
      setFiles(prev => prev.map(f => 
        f.status === 'uploading' ? { ...f, status: 'uploaded' } : f
      ));

      toast.success(`Uploading ${filesToUpload.length} file(s) to sandbox...`);
      
      // Clear uploaded files after a delay
      setTimeout(() => {
        setFiles(prev => prev.filter(f => f.status !== 'uploaded'));
      }, 3000);

    } catch (error) {
      console.error('Upload error:', error);
      setFiles(prev => prev.map(f => 
        f.status === 'uploading' ? { ...f, status: 'error' } : f
      ));
      toast.error('Failed to upload files');
    } finally {
      setIsUploading(false);
    }
  }, [files, onUpload]);

  const handleListFiles = useCallback(async () => {
    setIsListing(true);
    
    try {
      // Call list files handler (sends via WebSocket)
      onListFiles();
    } catch (error) {
      console.error('List files error:', error);
      toast.error('Failed to list files');
    } finally {
      setIsListing(false);
    }
  }, [onListFiles]);

  const handleDownload = useCallback(async (filePath: string) => {
    setIsDownloading(true);
    
    try {
      // Call download handler (sends via WebSocket)
      onDownload(filePath);
      toast.success('Downloading file...');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download file');
    } finally {
      setIsDownloading(false);
    }
  }, [onDownload]);

  const removeFile = useCallback((fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'txt':
      case 'md':
      case 'json':
      case 'csv':
        return <FileText className="h-4 w-4" />;
      case 'zip':
      case 'tar':
      case 'gz':
        return <Folder className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
    >
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              File Transfer
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Upload Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Upload Files to Sandbox</h3>
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Select Files
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={files.length === 0 || isUploading}
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Upload {files.length > 0 && `(${files.length})`}
                </Button>
              </div>
            </div>

            {/* Selected Files */}
            {files.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Selected Files:</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        {getFileIcon(file.name)}
                        <div>
                          <p className="font-medium text-sm">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(file.size)} • {file.type}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {file.status === 'pending' && (
                          <Badge variant="outline">Pending</Badge>
                        )}
                        {file.status === 'uploading' && (
                          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Uploading
                          </Badge>
                        )}
                        {file.status === 'uploaded' && (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Uploaded
                          </Badge>
                        )}
                        {file.status === 'error' && (
                          <Badge className="bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Error
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFile(file.id)}
                          className="h-6 w-6"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Download Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Download Files from Sandbox</h3>
              <Button
                variant="outline"
                onClick={handleListFiles}
                disabled={isListing}
              >
                {isListing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Folder className="h-4 w-4 mr-2" />
                )}
                List Files
              </Button>
            </div>

            {/* Sandbox Files */}
            {sandboxFiles.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Sandbox Files:</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {sandboxFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        {getFileIcon(file.name)}
                        <div>
                          <p className="font-medium text-sm">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(file.name)}
                        disabled={isDownloading}
                      >
                        {isDownloading ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4 mr-2" />
                        )}
                        Download
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sandboxFiles.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Folder className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No files in sandbox</p>
                <p className="text-sm">Click "List Files" to check sandbox contents</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
