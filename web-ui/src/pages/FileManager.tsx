import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { FileBrowser } from '@/components/file-browser/FileBrowser';
import { CodeEditor } from '@/components/file-editor/CodeEditor';
import type { FileItem } from '@/api/file';

export default function FileManager() {
  const { serverName } = useParams<{ serverName: string }>();
  const [currentPath, setCurrentPath] = useState('');
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [, setSaveStatus] = useState<'unsaved' | 'saving' | 'saved' | 'error'>('saved');

  if (!serverName) {
    return (
      <div className="flex items-center justify-center h-full text-red-500">
        Server not found
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="w-64 flex-shrink-0 border-r border-gray-200 dark:border-gray-700">
        <FileBrowser
          serverName={serverName}
          currentPath={currentPath}
          onPathChange={setCurrentPath}
          onFileSelect={setSelectedFile}
          selectedFile={selectedFile}
        />
      </div>
      <div className="flex-1 min-w-0">
        <CodeEditor
          serverName={serverName}
          file={selectedFile}
          onSaveStatusChange={setSaveStatus}
          darkMode={true}
        />
      </div>
    </div>
  );
}
