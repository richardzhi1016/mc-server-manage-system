import { useState, useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { Save, AlertCircle, Check, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { writeFile, readFile, getFileLanguage } from '@/api/file';
import type { FileItem } from '@/api/file';

interface CodeEditorProps {
  serverName: string;
  file: FileItem | null;
  onSaveStatusChange: (status: 'unsaved' | 'saving' | 'saved' | 'error') => void;
  darkMode: boolean;
}

export function CodeEditor({ serverName, file, onSaveStatusChange, darkMode }: CodeEditorProps) {
  const prevFileRef = useRef<FileItem | null>(null);
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [saveStatus, setSaveStatus] = useState<'unsaved' | 'saving' | 'saved' | 'error'>('saved');
  const [error, setError] = useState<string | null>(null);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const fileChanged = prevFileRef.current?.path !== file?.path;
    prevFileRef.current = file;

    if (!file) {
      // Reset state when file is cleared
      setContent('');
      setOriginalContent('');
      setUnsavedChanges(false);
      setSaveStatus('saved');
      onSaveStatusChange('saved');
      return;
    }

    let mounted = true;
    const loadFileData = async () => {
      try {
        const response = await readFile(serverName, file.path);
        if (mounted) {
          setContent(response.content);
          setOriginalContent(response.content);
          setUnsavedChanges(false);
          setSaveStatus('saved');
          onSaveStatusChange('saved');
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load file');
          setContent('');
          setOriginalContent('');
        }
      }
    };

    if (fileChanged || !content) {
      loadFileData();
    }

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, serverName, onSaveStatusChange]);

  const saveFile = useCallback(async (contentToSave?: string) => {
    if (!file) return;
    const contentToUse = contentToSave ?? content;
    setSaveStatus('saving');
    onSaveStatusChange('saving');
    try {
      await writeFile(serverName, file.path, contentToUse);
      setOriginalContent(contentToUse);
      setUnsavedChanges(false);
      setSaveStatus('saved');
      onSaveStatusChange('saved');
      setError(null);
    } catch (err) {
      setSaveStatus('error');
      onSaveStatusChange('error');
      setError(err instanceof Error ? err.message : 'Failed to save file');
    }
  }, [file, serverName, content, onSaveStatusChange]);

  const handleContentChange = (value: string | undefined) => {
    const newContent = value ?? '';
    setContent(newContent);
    setUnsavedChanges(newContent !== originalContent);
    if (newContent !== originalContent) {
      setSaveStatus('unsaved');
      onSaveStatusChange('unsaved');
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      if (newContent !== originalContent) {
        saveFile(newContent);
      }
    }, 2000);
  };

  const handleManualSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveFile();
  }, [saveFile]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleManualSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleManualSave]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  if (!file) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <FileTextPlaceholder />
          <p className="mt-4">Select a file to edit</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-red-500">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{file.name}</span>
          {unsavedChanges && (
            <span className="w-2 h-2 bg-yellow-500 rounded-full" title="Unsaved changes" />
          )}
        </div>
        <div className="flex items-center gap-2">
          {saveStatus === 'unsaved' && (
            <span className="flex items-center gap-1 text-sm text-yellow-600 dark:text-yellow-400">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
              Unsaved
            </span>
          )}
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
              <Check className="w-4 h-4" />
              Saved
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4" />
              Error
            </span>
          )}
          <button
            onClick={handleManualSave}
            disabled={!unsavedChanges && saveStatus !== 'error'}
            className={clsx(
              'flex items-center gap-1 px-3 py-1 text-sm rounded cursor-pointer transition-colors',
              unsavedChanges || saveStatus === 'error'
                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            )}
          >
            <Save className="w-4 h-4" />
            Save
          </button>
        </div>
      </div>
      <div className="flex-1">
        <Editor
          height="100%"
          language={getFileLanguage(file.name)}
          value={content}
          onChange={handleContentChange}
          theme={darkMode ? 'vs-dark' : 'vs'}
          options={{
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
            minimap: { enabled: false },
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            padding: { top: 16, bottom: 16 },
            renderLineHighlight: 'all',
            cursorBlinking: 'smooth',
            smoothScrolling: true,
          }}
          loading={
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          }
        />
      </div>
    </div>
  );
}

function FileTextPlaceholder() {
  return (
    <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
