const API_BASE_URL = 'http://localhost:5000';

export interface StartServerRequest {
  server_name: string;
}

export interface StartServerResponse {
  message: string;
}

export interface ApiError {
  error: string;
}

export async function startServer(serverName: string): Promise<StartServerResponse> {
  const response = await fetch(`${API_BASE_URL}/api/start-server`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ server_name: serverName }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `HTTP ${response.status}: Request failed`);
  }

  return response.json();
}

export function isApiError(data: unknown): data is ApiError {
  return (
    typeof data === 'object' &&
    data !== null &&
    'error' in data &&
    typeof (data as Record<string, unknown>).error === 'string'
  );
}
