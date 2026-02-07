import { API_BASE_URL } from '@/lib/api';

export interface FileItem {
  name: string;
  path: string;
  is_directory: boolean;
  size: number;
  modified: number;
}


export interface FileListResponse {
  path: string;
  items: FileItem[];
}

export interface FileContentResponse {
  content: string;
  file: FileItem;
}

export interface FileApiError {
  error: string;
}

export async function listFiles(serverName: string, path: string = ''): Promise<FileListResponse> {
  const params = new URLSearchParams();
  if (path) params.set('path', path);

  const response = await fetch(`${API_BASE_URL}/api/servers/${encodeURIComponent(serverName)}/files?${params}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `HTTP ${response.status}: Request failed`);
  }

  return response.json();
}

export async function readFile(serverName: string, path: string): Promise<FileContentResponse> {
  const response = await fetch(`${API_BASE_URL}/api/servers/${encodeURIComponent(serverName)}/files/${encodeURIComponent(path)}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `HTTP ${response.status}: Request failed`);
  }

  return response.json();
}

export async function writeFile(serverName: string, path: string, content: string): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/servers/${encodeURIComponent(serverName)}/files/${encodeURIComponent(path)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `HTTP ${response.status}: Request failed`);
  }

  return response.json();
}

export async function createFolder(serverName: string, path: string): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/servers/${encodeURIComponent(serverName)}/files/${encodeURIComponent(path)}`, {
    method: 'POST',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `HTTP ${response.status}: Request failed`);
  }

  return response.json();
}

export async function deleteFile(serverName: string, path: string): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/servers/${encodeURIComponent(serverName)}/files/${encodeURIComponent(path)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `HTTP ${response.status}: Request failed`);
  }

  return response.json();
}

export async function renameFile(serverName: string, oldPath: string, newName: string): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/servers/${encodeURIComponent(serverName)}/rename`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path: oldPath, new_name: newName }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `HTTP ${response.status}: Request failed`);
  }

  return response.json();
}

export async function uploadFile(serverName: string, path: string, file: File): Promise<{ message: string; filename: string }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('path', path);

  const response = await fetch(`${API_BASE_URL}/api/servers/${encodeURIComponent(serverName)}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `HTTP ${response.status}: Request failed`);
  }

  return response.json();
}

export function getDownloadUrl(serverName: string, path: string): string {
  return `${API_BASE_URL}/api/servers/${encodeURIComponent(serverName)}/download/${encodeURIComponent(path)}`;
}

export function getFileLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    properties: 'ini',
    yml: 'yaml',
    yaml: 'yaml',
    json: 'json',
    txt: 'plaintext',
    md: 'markdown',
    conf: 'ini',
    cfg: 'ini',
    xml: 'xml',
    html: 'html',
    css: 'css',
    js: 'javascript',
    ts: 'typescript',
  };
  return languageMap[ext || ''] || 'plaintext';
}
