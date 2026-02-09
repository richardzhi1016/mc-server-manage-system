import { useCallback, useRef, useEffect, useMemo } from "react";
import { FixedSizeList as List } from "react-window";
import type { ListChildComponentProps } from "react-window";
import type { LogMessage } from "../../types/console";
import { clsx } from "clsx";

interface TerminalLogDisplayProps {
  logs: LogMessage[];
  autoScroll: boolean;
  onScroll: (autoScroll: boolean) => void;
  height?: number;
}

const levelColors: Record<string, string> = {
  INFO: "text-green-400",
  WARN: "text-yellow-400",
  ERROR: "text-red-400",
  DEBUG: "text-blue-400",
};

function LogLine({ index, style, data }: ListChildComponentProps<{ logs: LogMessage[] }>) {
  const log = data.logs[index];

  return (
    <div style={style} className="px-2 py-0.5 hover:bg-gray-800/30 overflow-hidden">
      <div className="flex items-center gap-2 font-mono text-xs leading-5 min-w-0">
        <span className="text-green-400 shrink-0 select-none">
          [{log.timestamp.split("T")[1].split(".")[0]}]
        </span>
        <span className={clsx("shrink-0 w-12 font-semibold", levelColors[log.level] || "text-gray-300")}>
          {log.level}
        </span>
        <span
          className="text-green-400 truncate min-w-0 cursor-pointer hover:text-green-300 transition-colors"
          title={log.message}
          onClick={() => navigator.clipboard.writeText(log.message)}
        >
          {log.message}
        </span>
      </div>
    </div>
  );
}

export function TerminalLogDisplay({ logs, autoScroll, onScroll, height = 500 }: TerminalLogDisplayProps) {
  const listRef = useRef<List>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const logsLengthRef = useRef(logs.length);
  logsLengthRef.current = logs.length;

  const handleScroll = useCallback(
    ({ scrollOffset, scrollUpdateWasRequested }: { scrollOffset: number; scrollUpdateWasRequested: boolean }) => {
      if (scrollUpdateWasRequested) return;

      const itemSize = 28;
      const totalContentHeight = logsLengthRef.current * itemSize;
      const maxScroll = totalContentHeight - height;

      if (maxScroll <= 0) return;

      const isAtBottom = scrollOffset >= maxScroll - 50;
      if (isAtBottom !== autoScroll) {
        onScroll(isAtBottom);
      }
    },
    [height, onScroll, autoScroll]
  );

  useEffect(() => {
    if (autoScroll && logs.length > 0) {
      const maxScroll = logs.length * 29 - height;
      if (maxScroll > 0) {
        listRef.current?.scrollTo(maxScroll);
      }
    }
  }, [logs.length, autoScroll, height]);

  const itemData = useMemo(() => ({ logs }), [logs]);
  const itemCount = logs.length;
  const itemSize = 28;
  const width = "100%";

  const scrollToBottom = useCallback(() => {
    onScroll(true);
    const maxScroll = logs.length * 29 - height;
    if (maxScroll > 0) {
      listRef.current?.scrollTo(maxScroll);
    }
  }, [logs.length, height, onScroll]);

  return (
    <div className="relative flex-1 min-h-0">
      <div
        ref={containerRef}
        className="h-full bg-gray-900 dark:bg-gray-950 rounded-lg border border-gray-300 dark:border-gray-800 overflow-hidden"
      >
        <List
          ref={listRef}
          height={height}
          width={width}
          itemCount={itemCount}
          itemSize={itemSize}
          itemData={itemData}
          onScroll={handleScroll}
          overscanCount={20}
          style={{ scrollbarWidth: "thin", scrollbarColor: "#374151 #111827" }}
        >
          {LogLine}
        </List>
      </div>
      {!autoScroll && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 bg-green-600 hover:bg-green-500 text-white text-xs font-medium py-2 px-4 rounded-full shadow-lg transition-colors cursor-pointer"
        >
          New logs below
        </button>
      )}
    </div>
  );
}
