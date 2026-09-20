'use client';

import React, { useState, useRef, DragEvent, ChangeEvent, KeyboardEvent } from 'react';
import { Upload, FileText, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { LocalDeckFile, UploadError, MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from '@/types/deck';

interface DeckUploadZoneProps {
  selectedFile: LocalDeckFile | null;
  onFileSelect: (file: LocalDeckFile | null) => void;
  disabled?: boolean;
}

export function DeckUploadZone({ selectedFile, onFileSelect, disabled = false }: DeckUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<UploadError | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const validateAndProcessFile = (file: File) => {
    setError(null);

    // Validate file extension (case-insensitive) and browser MIME type where available
    const fileNameLower = file.name.toLowerCase();
    const hasPdfExtension = fileNameLower.endsWith('.pdf');
    const mime = file.type ? file.type.toLowerCase() : '';
    const hasPdfMime = !mime || mime === 'application/pdf' || mime === 'application/x-pdf';

    if (!hasPdfExtension || !hasPdfMime) {
      onFileSelect(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setError({
        type: 'INVALID_TYPE',
        message: 'Unsupported file format. Please upload a PDF document (.pdf).',
      });
      return;
    }

    // Validate file size limit (25 MB)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      onFileSelect(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setError({
        type: 'FILE_TOO_LARGE',
        message: `Pitch decks must be ${MAX_FILE_SIZE_MB} MB or smaller.`,
      });
      return;
    }

    const localFile: LocalDeckFile = {
      file,
      name: file.name,
      sizeBytes: file.size,
      sizeFormatted: formatFileSize(file.size),
      uploadedAt: new Date(),
    };

    onFileSelect(localFile);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isDragging) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      validateAndProcessFile(droppedFile);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndProcessFile(e.target.files[0]);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setError(null);
    onFileSelect(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full space-y-4">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf,application/pdf"
        className="hidden"
        id="pitch-deck-file-input"
        aria-label="Upload pitch deck PDF file"
        disabled={disabled}
      />

      {!selectedFile ? (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
          onKeyDown={handleKeyDown}
          aria-label="Drag and drop or click to upload pitch deck PDF"
          className={`
            relative flex flex-col items-center justify-center p-10 md:p-14
            rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-950
            ${
              isDragging
                ? 'border-blue-500 bg-blue-500/10 scale-[0.99]'
                : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900/90'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <div className="w-14 h-14 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center mb-4 text-blue-400 group-hover:scale-105 transition-transform">
            <Upload className="w-6 h-6" />
          </div>

          <h3 className="text-base font-semibold text-slate-200 mb-1 text-center">
            Upload your pitch deck
          </h3>

          <p className="text-sm text-slate-400 text-center max-w-sm mb-4">
            Drag and drop your PDF pitch deck here, or{' '}
            <span className="text-blue-400 font-medium hover:underline">browse files</span>
          </p>

          <div className="inline-flex items-center gap-1.5 text-xs text-slate-400 bg-slate-950/60 px-3 py-1.5 rounded-full border border-slate-800/80">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span>PDF files only (up to {MAX_FILE_SIZE_MB}MB)</span>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 transition-all">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0">
                <FileText className="w-6 h-6" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className="text-sm font-semibold text-slate-200 truncate">
                    {selectedFile.name}
                  </h4>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
                    Ready
                  </span>
                </div>

                <p className="text-xs text-slate-400">
                  {selectedFile.sizeFormatted} • PDF Document
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Replace current PDF file"
                className="text-xs font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-950 hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Replace
              </button>

              <button
                type="button"
                onClick={handleRemove}
                title="Remove file"
                aria-label="Remove selected file"
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="flex items-center gap-2.5 p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium"
        >
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error.message}</span>
        </div>
      )}
    </div>
  );
}
