'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Upload,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { formatFileSize } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface UploadingFile {
  file: File;
  id: string;
  progress: number;
  status: 'pending' | 'uploading' | 'processing' | 'complete' | 'error';
  error?: string;
}

interface DocumentUploaderProps {
  onUploadComplete?: (files: File[]) => void;
  maxFiles?: number;
  maxSize?: number; // in bytes
}

const ACCEPTED_FILE_TYPES = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt'],
  'text/markdown': ['.md'],
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function DocumentUploader({
  onUploadComplete,
  maxFiles = 10,
  maxSize = MAX_FILE_SIZE,
}: DocumentUploaderProps) {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    // Handle rejected files
    if (rejectedFiles.length > 0) {
      rejectedFiles.forEach((rejection) => {
        const error = rejection.errors[0];
        console.error(`File rejected: ${rejection.file.name} - ${error.message}`);
      });
    }

    // Add accepted files to upload queue
    const newFiles: UploadingFile[] = acceptedFiles.map((file) => ({
      file,
      id: crypto.randomUUID(),
      progress: 0,
      status: 'pending' as const,
    }));

    setUploadingFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILE_TYPES,
    maxSize,
    maxFiles,
    multiple: true,
  });

  const removeFile = (id: string) => {
    setUploadingFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const uploadFiles = async () => {
    setIsUploading(true);

    const filesToUpload = uploadingFiles.filter((f) => f.status === 'pending');
    const completedFiles: File[] = [];

    for (const uploadFile of filesToUpload) {
      // Update status to uploading
      setUploadingFiles((prev) =>
        prev.map((f) => (f.id === uploadFile.id ? { ...f, status: 'uploading' as const, progress: 0 } : f))
      );

      try {
        // Create FormData for the API request
        const formData = new FormData();
        formData.append('file', uploadFile.file);
        // partner_id is optional - the API will use user.id if not provided

        // Simulate initial progress (fetch doesn't support upload progress tracking)
        setUploadingFiles((prev) =>
          prev.map((f) => (f.id === uploadFile.id ? { ...f, progress: 30 } : f))
        );

        // Call the upload API
        const response = await fetch('/api/documents/upload', {
          method: 'POST',
          body: formData,
        });

        // Update progress after upload completes
        setUploadingFiles((prev) =>
          prev.map((f) => (f.id === uploadFile.id ? { ...f, progress: 70 } : f))
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error?.message || 'Upload failed');
        }

        // Mark as processing (document is being chunked/embedded on the server)
        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id ? { ...f, status: 'processing' as const, progress: 90 } : f
          )
        );

        // Brief delay to show processing state
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Mark as complete
        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id ? { ...f, status: 'complete' as const, progress: 100 } : f
          )
        );

        completedFiles.push(uploadFile.file);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Upload failed';
        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id
              ? { ...f, status: 'error' as const, error: errorMessage }
              : f
          )
        );
      }
    }

    setIsUploading(false);

    // Notify parent of completion with actually completed files
    if (completedFiles.length > 0 && onUploadComplete) {
      onUploadComplete(completedFiles);
    }
  };

  const getFileTypeLabel = (file: File) => {
    if (file.name.endsWith('.pdf')) return 'PDF';
    if (file.name.endsWith('.docx')) return 'DOCX';
    if (file.name.endsWith('.txt')) return 'TXT';
    if (file.name.endsWith('.md')) return 'MD';
    return 'FILE';
  };

  const getFileTypeColor = (file: File) => {
    if (file.name.endsWith('.pdf')) return 'bg-red-50 text-red-600';
    if (file.name.endsWith('.docx')) return 'bg-blue-50 text-blue-600';
    if (file.name.endsWith('.txt')) return 'bg-gray-50 text-gray-600';
    if (file.name.endsWith('.md')) return 'bg-purple-50 text-purple-600';
    return 'bg-gray-50 text-gray-600';
  };

  const pendingCount = uploadingFiles.filter((f) => f.status === 'pending').length;
  const completedCount = uploadingFiles.filter((f) => f.status === 'complete').length;

  return (
    <div className="space-y-6">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
          isDragActive && !isDragReject && 'border-blue-500 bg-blue-50',
          isDragReject && 'border-red-500 bg-red-50',
          !isDragActive && 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <div
            className={cn(
              'p-4 rounded-full',
              isDragActive && !isDragReject && 'bg-blue-100',
              isDragReject && 'bg-red-100',
              !isDragActive && 'bg-gray-100'
            )}
          >
            <Upload
              className={cn(
                'h-8 w-8',
                isDragActive && !isDragReject && 'text-blue-600',
                isDragReject && 'text-red-600',
                !isDragActive && 'text-gray-400'
              )}
            />
          </div>

          {isDragReject ? (
            <div>
              <p className="text-red-600 font-medium">Some files are not supported</p>
              <p className="text-sm text-red-500">Only PDF, DOCX, TXT, and MD files are allowed</p>
            </div>
          ) : isDragActive ? (
            <p className="text-blue-600 font-medium">Drop your files here</p>
          ) : (
            <div>
              <p className="font-medium text-gray-900">
                Drag & drop files here, or click to browse
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Supports PDF, DOCX, TXT, MD (max {formatFileSize(maxSize)} each)
              </p>
            </div>
          )}
        </div>
      </div>

      {/* File List */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900">
              Files ({completedCount}/{uploadingFiles.length} complete)
            </h4>
            {pendingCount > 0 && (
              <Button onClick={uploadFiles} disabled={isUploading} size="sm">
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload {pendingCount} file{pendingCount > 1 ? 's' : ''}
                  </>
                )}
              </Button>
            )}
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {uploadingFiles.map((uploadFile) => (
              <div
                key={uploadFile.id}
                className="flex items-center gap-3 p-3 rounded-lg border bg-white"
              >
                {/* File Icon */}
                <div className={cn('p-2 rounded-lg', getFileTypeColor(uploadFile.file))}>
                  <FileText className="h-4 w-4" />
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 truncate">
                      {uploadFile.file.name}
                    </p>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {getFileTypeLabel(uploadFile.file)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">
                      {formatFileSize(uploadFile.file.size)}
                    </span>

                    {uploadFile.status === 'uploading' && (
                      <div className="flex-1 max-w-[200px]">
                        <Progress value={uploadFile.progress} className="h-1" />
                      </div>
                    )}

                    {uploadFile.status === 'processing' && (
                      <span className="text-xs text-blue-600 flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Processing...
                      </span>
                    )}

                    {uploadFile.status === 'complete' && (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Complete
                      </span>
                    )}

                    {uploadFile.status === 'error' && (
                      <span className="text-xs text-red-600 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {uploadFile.error || 'Error'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Remove Button */}
                {(uploadFile.status === 'pending' || uploadFile.status === 'error') && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-400 hover:text-gray-600"
                    onClick={() => removeFile(uploadFile.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Supported Formats */}
      <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-400"></span> PDF
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-400"></span> DOCX
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-gray-400"></span> TXT
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-purple-400"></span> MD
        </span>
      </div>
    </div>
  );
}
