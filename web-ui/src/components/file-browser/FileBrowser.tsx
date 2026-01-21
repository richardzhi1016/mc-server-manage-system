import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Folder,
  FileText,
  ChevronRight,
  Upload,
  Download,
  Trash2,
  Pencil,
  FolderPlus,
} from 'lucide-react';
import { clsx } from 'clsx';
import { listFiles, deleteFile, renameFile, createFolder, getDownloadUrl, uploadFile } from '@/api/file';
import type { FileItem } from '@/api/file';

interface FileBrowserProps {
  serverName: string;
  currentPath: string;
  onPathChange: (path: string) => void;
  onFileSelect: (file: FileItem) => void;
  selectedFile: FileItem | null;
}

export function FileBrowser({
  serverName,
  currentPath,
  onPathChange,
  onFileSelect,
  selectedFile,
}: FileBrowserProps) {
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: FileItem } | null>(null);
  const [renameState, setRenameState] = useState<{ path: string; newName: string } | null>(null);
  const [newFolderState, setNewFolderState] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const loadFiles = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await listFiles(serverName, path);
      setItems(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setLoading(false);
    }
  }, [serverName]);

  useEffect(() => {
    loadFiles(currentPath);
  }, [currentPath, loadFiles]);

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleContextMenu = (e: React.MouseEvent, item: FileItem) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  };

  const handleRename = async () => {
    if (!contextMenu || !renameState) return;
    try {
      await renameFile(serverName, contextMenu.item.path, renameState.newName);
      setRenameState(null);
      setContextMenu(null);
      loadFiles(currentPath);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Rename failed');
    }
  };

  const handleDelete = async () => {
    if (!contextMenu) return;
    if (!confirm(`Delete "${contextMenu.item.name}"?`)) return;
    try {
      await deleteFile(serverName, contextMenu.item.path);
      setContextMenu(null);
      if (selectedFile?.path === contextMenu.item.path) {
        onFileSelect({ name: '', path: '', is_directory: false, size: 0, modified: 0 });
      }
      loadFiles(currentPath);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderState) return;
    try {
      const folderPath = currentPath ? `${currentPath}/${newFolderState}` : newFolderState;
      await createFolder(serverName, folderPath);
      setNewFolderState(null);
      loadFiles(currentPath);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create folder');
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadFile(serverName, currentPath, file);
      loadFiles(currentPath);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed');
    }
    e.target.value = '';
  };

  const handleDownload = () => {
    if (!contextMenu) return;
    const url = getDownloadUrl(serverName, contextMenu.item.path);
    window.open(url, '_blank');
    setContextMenu(null);
  };

  const handleFolderClick = (item: FileItem) => {
    if (item.is_directory) {
      const newPath = item.path;
      onPathChange(newPath);
    } else {
      onFileSelect(item);
    }
  };

  const getBreadcrumbs = () => {
    if (!currentPath) return [{ name: 'root', path: '' }];
    const parts = currentPath.split('/');
    let path = '';
    return [
      { name: 'root', path: '' },
      ...parts.map((part) => {
        path = path ? `${path}/${part}` : part;
        return { name: part, path };
      }),
    ];
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">Files</h3>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded cursor-pointer"
            title="Upload file"
          >
            <Upload className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleUpload}
            className="hidden"
          />
        </div>
        <nav className="flex items-center space-x-1 text-sm overflow-x-auto pb-1">
          {getBreadcrumbs().map((crumb, idx) => (
            <div key={crumb.path} className="flex items-center whitespace-nowrap">
              {idx > 0 && <ChevronRight className="w-4 h-4 text-gray-400 mx-1" />}
              <button
                onClick={() => onPathChange(crumb.path)}
                className={clsx(
                  'hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer',
                  idx === 0 ? 'text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'
                )}
              >
                {crumb.name}
              </button>
            </div>
          ))}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {currentPath && (
          <button
            onClick={() => onPathChange(currentPath.split('/').slice(0, -1).join('/'))}
            className="w-full flex items-center gap-2 px-2 py-1 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer mb-1"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            ..
          </button>
        )}

        {newFolderState !== null && (
          <div className="flex items-center gap-2 px-2 py-1 mb-1">
            <FolderPlus className="w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={newFolderState}
              onChange={(e) => setNewFolderState(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder();
                if (e.key === 'Escape') setNewFolderState(null);
              }}
              onBlur={() => setNewFolderState(null)}
              className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              autoFocus
            />
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-500 text-sm">{error}</div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">No files</div>
        ) : (
          <ul className="space-y-0.5">
            {items.map((item) => (
              <li key={item.path}>
                {renameState?.path === item.path ? (
                  <div className="flex items-center gap-2 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 rounded">
                    <FileText className="w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      value={renameState.newName}
                      onChange={(e) => setRenameState({ ...renameState, newName: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename();
                        if (e.key === 'Escape') setRenameState(null);
                      }}
                      onBlur={handleRename}
                      className="flex-1 px-2 py-0.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      autoFocus
                    />
                  </div>
                ) : (
                  <div
                    className={clsx(
                      'flex items-center gap-2 px-2 py-1 rounded cursor-pointer',
                      selectedFile?.path === item.path
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                    )}
                    onClick={() => handleFolderClick(item)}
                    onContextMenu={(e) => handleContextMenu(e, item)}
                  >
                    {item.is_directory ? (
                      <Folder className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                    ) : (
                      <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    )}
                    <span className="truncate text-sm flex-1">{item.name}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {!contextMenu.item.is_directory && (
            <button
              onClick={handleDownload}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-gray-700 dark:text-gray-300"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          )}
          <button
            onClick={() => {
              setRenameState({ path: contextMenu.item.path, newName: contextMenu.item.name });
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-gray-700 dark:text-gray-300"
          >
            <Pencil className="w-4 h-4" />
            Rename
          </button>
          <button
            onClick={handleDelete}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-red-600 dark:text-red-400"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
          <hr className="my-1 border-gray-200 dark:border-gray-700" />
          <button
            onClick={() => {
              setNewFolderState('New Folder');
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-gray-700 dark:text-gray-300"
          >
            <FolderPlus className="w-4 h-4" />
            New Folder
          </button>
        </div>
      )}
    </div>
  );
}
