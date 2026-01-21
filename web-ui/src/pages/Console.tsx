import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { TerminalLogDisplay, CommandInput, LogFilter } from "../components/console";
import { useConsoleSocket } from "../hooks/useConsoleSocket";
import type { LogLevel } from "../types/console";
import { Button } from "../components/ui/Button";
import { Trash2, Circle } from "lucide-react";
import { clsx } from "clsx";

export default function Console() {
  const { serverName } = useParams<{ serverName: string }>();
  const [containerHeight, setContainerHeight] = useState(500);

  const { state, actions } = useConsoleSocket(serverName || null);

  useEffect(() => {
    const updateHeight = () => {
      const header = document.querySelector("header");
      const nav = document.querySelector("nav");
      if (header && nav) {
        const totalHeight = header.getBoundingClientRect().height + nav.getBoundingClientRect().height + 140;
        setContainerHeight(window.innerHeight - totalHeight);
      }
    };
    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  const handleLevelChange = (levels: LogLevel[]) => {
    actions.setFilterLevels(levels);
  };

  const connectionStatusColors = {
    connecting: "text-yellow-400",
    connected: "text-green-400",
    reconnecting: "text-orange-400",
    disconnected: "text-red-400",
  };

  const connectionStatusText = {
    connecting: "Connecting...",
    connected: "Connected",
    reconnecting: "Reconnecting...",
    disconnected: "Disconnected",
  };

  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-gray-100">Console: {serverName}</h1>
          <div className="flex items-center gap-2 px-3 py-1 bg-gray-800 rounded-full">
            <Circle
              className={clsx(
                "w-2 h-2 fill-current animate-pulse",
                state.isConnected ? "text-green-400" : "text-red-400"
              )}
            />
            <span className={clsx("text-xs font-medium", connectionStatusColors[state.connectionStatus])}>
              {connectionStatusText[state.connectionStatus]}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LogFilter
            selectedLevels={state.selectedLevels}
            onLevelChange={handleLevelChange}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={actions.clearLogs}
            className="text-gray-400 hover:text-gray-200"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div style={{ height: containerHeight - 120 }}>
        <TerminalLogDisplay
          logs={state.filteredLogs}
          autoScroll={state.autoScroll}
          onScroll={actions.setAutoScroll}
        />
      </div>

      <CommandInput
        onSendCommand={actions.sendCommand}
        onNavigateHistory={actions.navigateHistory}
        commandHistory={state.commandHistory}
        historyIndex={state.historyIndex}
        disabled={!state.isConnected}
      />
    </div>
  );
}
