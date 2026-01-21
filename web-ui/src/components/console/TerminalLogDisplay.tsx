import { useCallback, useRef, useEffect, useMemo } from "react";
import { FixedSizeList as List } from "react-window";
import type { ListChildComponentProps } from "react-window";
import type { LogMessage } from "../../types/console";
import { clsx } from "clsx";

interface TerminalLogDisplayProps {
  logs: LogMessage[];
  autoScroll: boolean;
  onScroll: (autoScroll: boolean) => void;
}

function LogLine({ index, style, data }: ListChildComponentProps<{ logs: LogMessage[] }>) {
  const log = data.logs[index];
  const rowRef = useRef<HTMLDivElement>(null);

  const levelColors = {
    INFO: "text-gray-300",
    WARN: "text-yellow-400",
    ERROR: "text-red-400",
    DEBUG: "text-gray-500",
  };

  return (
    <div style={style} className="px-2 py-0.5 hover:bg-gray-800/30">
      <div ref={rowRef} className="flex items-start gap-2 font-mono text-xs leading-5">
        <span className="text-gray-500 shrink-0 select-none">
          [{log.timestamp.split("T")[1].split(".")[0]}]
        </span>
        <span className={clsx("shrink-0 w-12 font-semibold", levelColors[log.level])}>
          {log.level}
        </span>
        <span className="text-gray-200 break-all whitespace-pre-wrap">{log.message}</span>
      </div>
    </div>
  );
}

export function TerminalLogDisplay({ logs, autoScroll, onScroll }: TerminalLogDisplayProps) {
  const listRef = useRef<List>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(
    ({ scrollOffset, scrollUpdateWasRequested }: { scrollOffset: number; scrollUpdateWasRequested: boolean }) => {
      if (!scrollUpdateWasRequested && listRef.current) {
        const listState = listRef.current.state;
        if (listState) {
          const totalHeight = listState.height || 0;
          const itemSize = 28;
          const totalContentHeight = logs.length * itemSize;
          const maxScroll = totalContentHeight - totalHeight;

          if (maxScroll > 0) {
            const isAtBottom = scrollOffset >= maxScroll - 50;
            onScroll(isAtBottom);
          }
        }
      }
    },
    [logs.length, onScroll]
  );

  useEffect(() => {
    if (autoScroll && logs.length > 0) {
      listRef.current?.scrollToItem(logs.length, "end");
    }
  }, [logs.length, autoScroll]);

  const itemData = useMemo(() => ({ logs }), [logs]);
  const itemCount = logs.length;
  const itemSize = 28;
  const height = 500;
  const width = "100%";

  const scrollToBottom = useCallback(() => {
    onScroll(true);
    listRef.current?.scrollToItem(logs.length, "end");
  }, [logs.length, onScroll]);

  return (
    <div className="relative flex-1 min-h-0">
      <div
        ref={containerRef}
        className="h-full bg-gray-950 rounded-lg border border-gray-800 overflow-hidden"
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
