import { useState, useEffect } from 'react';
import { startServer } from '../api/server';
import { getServers } from '../api/client';
import { useNavigate } from 'react-router-dom';

interface ServerInfo {
  name: string;
  status?: string;
  path?: string;
  jar_file?: string;
}

type NotificationType = 'success' | 'error' | null;

interface Notification {
  type: NotificationType;
  message: string;
}

function ServerLaunch() {
  const [servers, setServers] = useState<ServerInfo[]>([]);
  const [selectedServer, setSelectedServer] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<Notification>({ type: null, message: '' });
  const [isLoadingServers, setIsLoadingServers] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadServers = async () => {
      try {
        const response = await getServers();
        setServers(response.servers);
      } catch (error) {
        console.error('Failed to load servers:', error);
        setServers([]);
      } finally {
        setIsLoadingServers(false);
      }
    };

    loadServers();
  }, []);

  const showNotification = (type: NotificationType, message: string) => {
    setNotification({ type, message });
    if (type === 'success') {
      setTimeout(() => {
        setNotification({ type: null, message: '' });
      }, 5000);
    }
  };

  const dismissNotification = () => {
    setNotification({ type: null, message: '' });
  };

  const handleLaunch = async () => {
    if (!selectedServer) return;

    setIsLoading(true);
    setNotification({ type: null, message: '' });

    try {
      await startServer(selectedServer);
      showNotification('success', 'Server started successfully');
      navigate(`/console/${selectedServer}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start server';
      showNotification('error', message);
    } finally {
      setIsLoading(false);
    }
  };

  const isLaunchDisabled = !selectedServer || isLoading;

  return (
    <div className="flex justify-center items-center w-full min-h-[400px]">
      <div className="bg-white rounded-xl py-10 px-8 max-w-112 w-full shadow-lg border border-gray-200 transition-shadow duration-250 hover:shadow-xl" role="main" aria-labelledby="launch-title">
        <h2 id="launch-title" className="text-2xl font-bold text-gray-900 mb-2 text-center">启动 Minecraft 服务器</h2>
        <p className="text-gray-600 text-base text-center mb-8 font-normal">选择要启动的服务器实例</p>

        <form onSubmit={(e) => { e.preventDefault(); handleLaunch(); }} role="form">
          <div className="mb-6">
            <label htmlFor="server-select" className="block text-sm font-semibold text-gray-700 mb-2">服务器</label>
            <select
              id="server-select"
              value={selectedServer}
              onChange={(e) => setSelectedServer(e.target.value)}
              disabled={isLoading}
              className="w-full py-3 px-4 text-base font-inherit border-2 border-gray-300 rounded-md bg-white text-gray-900 cursor-pointer transition-all duration-150 appearance-none bg-no-repeat bg-right-3 bg-center bg-5 pr-10 hover:not(:disabled):border-indigo-500 focus:outline-none focus:border-indigo-500 focus:shadow-lg focus:shadow-indigo-100 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-70"
              style={{backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke-width='1.5' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='m19.5 8.25-7.5 7.5-7.5-7.5'/%3E%3C/svg%3E\")"}}
              required
              aria-describedby="server-help"
            >
              <option value="">请选择服务器...</option>
              {isLoadingServers ? (
                <option value="" disabled>加载中...</option>
              ) : servers.length === 0 ? (
                <option value="" disabled>暂无可用服务器</option>
              ) : (
                servers.map((server) => (
                  <option key={server.name} value={server.name}>
                    {server.name} {server.status ? `(${server.status})` : ''}
                  </option>
                ))
              )}
            </select>
            <div id="server-help" className="absolute w-px h-px p-0 -m-px overflow-hidden clip-rect-0-0-0-0 whitespace-nowrap border-0">
              选择您要启动的 Minecraft 服务器实例
            </div>
          </div>

          {notification.type === null && !selectedServer && (
            <p className="text-sm text-gray-500 -mt-2 mb-6 font-normal" role="status" aria-live="polite">
              请选择要启动的服务器
            </p>
          )}

          <button
            type="submit"
            onClick={handleLaunch}
            disabled={isLaunchDisabled}
            className="w-full py-4 px-6 text-base font-semibold text-white bg-gradient-to-br from-indigo-500 to-indigo-700 border-none rounded-md cursor-pointer transition-all duration-150 shadow-md flex items-center justify-center gap-2 hover:-translate-y-0.5 hover:shadow-lg hover:bg-gradient-to-br hover:from-indigo-600 hover:to-indigo-500 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none disabled:bg-gray-400"
            aria-describedby="launch-help"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-transparent border-t-current rounded-full animate-spin" aria-hidden="true"></div>
                启动中...
              </span>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <polygon points="23 7 16 12 23 17 23 7"></polygon>
                  <rect width="15" height="14" x="1" y="5" rx="2" ry="2"></rect>
                </svg>
                启动服务器
              </>
            )}
          </button>

          <div id="launch-help" className="absolute w-px h-px p-0 -m-px overflow-hidden clip-rect-0-0-0-0 whitespace-nowrap border-0">
            点击启动选定的 Minecraft 服务器实例
          </div>
        </form>

        {notification.type && (
          <div className={`mt-6 py-4 px-5 rounded-md flex items-center justify-between gap-3 animate-slideIn border border-transparent ${
            notification.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-500' : 'bg-red-50 text-red-800 border-red-500'
          }`} role="alert" aria-live="assertive">
            <span className="flex-1 text-sm font-medium flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                {notification.type === 'success' ? (
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                ) : (
                  <path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                )}
              </svg>
              {notification.message}
            </span>
            <button
              onClick={dismissNotification}
              className="bg-transparent border-none text-lg cursor-pointer p-1 leading-none opacity-60 transition-opacity duration-150 rounded-sm text-inherit hover:opacity-100 hover:bg-black hover:bg-opacity-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
              aria-label="关闭通知"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ServerLaunch;
