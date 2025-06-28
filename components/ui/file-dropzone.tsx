'use client';

import React from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { UploadCloud, File as FileIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileDropzoneProps {
  onDrop: (acceptedFiles: File[]) => void;
  acceptedFileTypes: { [key: string]: string[] };
  maxFileSize: number; // in bytes
  label: string;
  className?: string;
  uploadedFile?: { name: string; url: string } | null;
  onClear?: () => void;
}

export function FileDropzone({
  onDrop,
  acceptedFileTypes,
  maxFileSize,
  label,
  className,
  uploadedFile,
  onClear,
}: FileDropzoneProps) {
  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: acceptedFileTypes,
    maxSize: maxFileSize,
    multiple: false,
  });

  if (uploadedFile) {
    return (
        <div className={cn("p-4 border-2 border-dashed rounded-lg bg-green-50 border-green-200 text-green-800", className)}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <FileIcon className="h-6 w-6" />
                    <p className="font-medium">{uploadedFile.name}</p>
                </div>
                <button onClick={onClear} className="text-green-800 hover:text-green-900">
                    <X className="h-5 w-5" />
                </button>
            </div>
        </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        'p-6 border-2 border-dashed rounded-lg cursor-pointer text-center transition-colors',
        isDragActive && 'border-blue-500 bg-blue-50',
        isDragReject && 'border-red-500 bg-red-50',
        className
      )}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center justify-center gap-2 text-gray-500">
        <UploadCloud className="h-8 w-8" />
        <p className="font-medium">{label}</p>
        <p className="text-sm">Drag & drop an MP3 file here, or click to select a file.</p>
        <p className="text-xs">(Max 10MB)</p>
      </div>
    </div>
  );
} 