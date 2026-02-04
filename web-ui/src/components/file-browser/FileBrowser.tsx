import { useState, useEffect, useRef, useCallback, DragEvent } from 'react';
import {
  Folder,
  ChevronRight,
  Upload,
  Download,
  Trash2,
  Pencil,
  FolderPlus,
  RefreshCw,
  MoreHorizontal,
} from 'lucide-react';
import { clsx } from 'clsx';
import { listFiles, deleteFile, renameFile, createFolder, getDownloadUrl, uploadFile } from '@/api/file';
import type { FileItem } from '@/api/file';
import { FileIcon } from './FileIcon';

interface FileBrowserProps {
  serverName: string;
  currentPath: string;
  onPathChange: (path: string) => void;
  onFileSelect: (file: FileItem) => void;
  selectedFile: FileItem | null;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '-';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(timestamp: number): string {
  if (!timestamp) return '-';
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const loadFiles = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await listFiles(serverName, path);
      setItems(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载文件失败');
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
    if (!renameState) return;
    try {
      await renameFile(serverName, renameState.path, renameState.newName);
      setRenameState(null);
      setContextMenu(null);
      loadFiles(currentPath);
    } catch (err) {
      alert(err instanceof Error ? err.message : '重命名失败');
    }
  };

  const handleDelete = async () => {
    if (!contextMenu) return;
    if (!confirm(`确定删除 "${contextMenu.item.name}"？`)) return;
    try {
      await deleteFile(serverName, contextMenu.item.path);
      setContextMenu(null);
      if (selectedFile?.path === contextMenu.item.path) {
        onFileSelect({ name: '', path: '', is_directory: false, size: 0, modified: 0 });
      }
      loadFiles(currentPath);
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败');
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
      alert(err instanceof Error ? err.message : '创建文件夹失败');
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadProgress(`正在上传 ${files.length} 个文件...`);
    try {
      for (let i = 0; i < files.length; i++) {
        setUploadProgress(`正在上传 (${i + 1}/${files.length}): ${files[i].name}`);
        await uploadFile(serverName, currentPath, files[i]);
      }
      loadFiles(currentPath);
      setUploadProgress(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : '上传失败');
      setUploadProgress(null);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleUpload(e.target.files);
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
      onPathChange(item.path);
    } else {
      onFileSelect(item);
    }
  };

  // Drag and drop handlers
  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === dropZoneRef.current) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleUpload(files);
    }
  };

  const getBreadcrumbs = () => {
    if (!currentPath) return [{ name: '根目录', path: '' }];
    const parts = currentPath.split('/');
    let path = '';
    return [
      { name: '根目录', path: '' },
      ...parts.map((part) => {
        path = path ? `${path}/${part}` : part;
        return { name: part, path };
      }),
    ];
  };

  return (
    <div
      ref={dropZoneRef}
      className={clsx(
        'flex flex-col h-full bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transition-colors',
        isDragging && 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">文件管理</h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => loadFiles(currentPath)}
              className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded cursor-pointer transition-colors"
              title="刷新"
            >
              <RefreshCw className={clsx('w-4 h-4 text-gray-600 dark:text-gray-400', loading && 'animate-spin')} />
            </button>
            <button
              onClick={() => setNewFolderState('新建文件夹')}
              className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded cursor-pointer transition-colors"
              title="新建文件夹"
            >
              <FolderPlus className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded cursor-pointer transition-colors"
              title="上传文件"
            >
              <Upload className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileInputChange}
              className="hidden"
            />
          </div>
        </div>

        {/* Breadcrumbs */}
        <nav className="flex items-center text-sm overflow-x-auto pb-1 scrollbar-thin">
          {getBreadcrumbs().map((crumb, idx) => (
            <div key={crumb.path || 'root'} className="flex items-center whitespace-nowrap">
              {idx > 0 && <ChevronRight className="w-4 h-4 text-gray-400 mx-0.5 flex-shrink-0" />}
              <button
                onClick={() => onPathChange(crumb.path)}
                className={clsx(
                  'px-1 py-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer transition-colors',
                  idx === getBreadcrumbs().length - 1
                    ? 'text-gray-900 dark:text-gray-100 font-medium'
                    : 'text-gray-600 dark:text-gray-400'
                )}
              >
                {crumb.name}
              </button>
            </div>
          ))}
        </nav>
      </div>

      {/* Upload progress */}
      {uploadProgress && (
        <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900/30 border-b border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="truncate">{uploadProgress}</span>
          </div>
        </div>
      )}

      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 flex items-center justify-center bg-blue-500/10 z-10 pointer-events-none">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg px-6 py-4 border-2 border-dashed border-blue-500">
            <Upload className="w-8 h-8 text-blue-500 mx-auto mb-2" />
            <p className="text-blue-600 dark:text-blue-400 font-medium">拖放文件到此处上传</p>
          </div>
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-y-auto p-2">
        {currentPath && (
          <button
            onClick={() => onPathChange(currentPath.split('/').slice(0, -1).join('/'))}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer mb-1 transition-colors"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            <span>返回上级</span>
          </button>
        )}

        {/* New folder input */}
        {newFolderState !== null && (
          <div className="flex items-center gap-2 px-2 py-1.5 mb-1 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
            <FolderPlus className="w-4 h-4 text-yellow-600" />
            <input
              type="text"
              value={newFolderState}
              onChange={(e) => setNewFolderState(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder();
                if (e.key === 'Escape') setNewFolderState(null);
              }}
              onBlur={() => {
                if (newFolderState) handleCreateFolder();
                else setNewFolderState(null);
              }}
              className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              autoFocus
              placeholder="输入文件夹名称"
            />
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-500 text-sm mb-2">{error}</p>
            <button
              onClick={() => loadFiles(currentPath)}
              className="text-sm text-blue-600 hover:text-blue-700 cursor-pointer"
            >
              重试
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Folder className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-sm mb-2">此文件夹为空</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-sm text-blue-600 hover:text-blue-700 cursor-pointer"
            >
              上传文件
            </button>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {items.map((item) => (
              <li key={item.path}>
                {renameState?.path === item.path ? (
                  <div className="flex items-center gap-2 px-2 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                    {item.is_directory ? (
                      <Folder className="w-4 h-4 text-yellow-500" />
                    ) : (
                      <FileIcon filename={item.name} />
                    )}
                    <input
                      type="text"
                      value={renameState.newName}
                      onChange={(e) => setRenameState({ ...renameState, newName: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename();
                        if (e.key === 'Escape') setRenameState(null);
                      }}
                      onBlur={handleRename}
                      className="flex-1 px-2 py-0.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      autoFocus
                    />
                  </div>
                ) : (
                  <div
                    className={clsx(
                      'group flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors',
                      selectedFile?.path === item.path
                        ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                    )}
                    onClick={() => handleFolderClick(item)}
                    onContextMenu={(e) => handleContextMenu(e, item)}
                  >
                    {item.is_directory ? (
                      <Folder className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                    ) : (
                      <FileIcon filename={item.name} />
                    )}
                    <span className="truncate text-sm flex-1 min-w-0">{item.name}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 hidden group-hover:block sm:block">
                      {item.is_directory ? '' : formatFileSize(item.size)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleContextMenu(e, item);
                      }}
                      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity"
                    >
                      <MoreHorizontal className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {!contextMenu.item.is_directory && (
            <button
              onClick={handleDownload}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-gray-700 dark:text-gray-300 transition-colors"
            >
              <Download className="w-4 h-4" />
              下载
            </button>
          )}
          <button
            onClick={() => {
              setRenameState({ path: contextMenu.item.path, newName: contextMenu.item.name });
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-gray-700 dark:text-gray-300 transition-colors"
          >
            <Pencil className="w-4 h-4" />
            重命名
          </button>
          <button
            onClick={handleDelete}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer text-red-600 dark:text-red-400 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            删除
          </button>
          <hr className="my-1 border-gray-200 dark:border-gray-700" />
          <button
            onClick={() => {
              setNewFolderState('新建文件夹');
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-gray-700 dark:text-gray-300 transition-colors"
          >
            <FolderPlus className="w-4 h-4" />
            新建文件夹
          </button>
        </div>
      )}
    </div>
  );
}
