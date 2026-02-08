import { useState, useCallback, useRef, useEffect } from "react";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { Send, ArrowUp, ArrowDown } from "lucide-react";

interface CommandInputProps {
  onSendCommand: (command: string) => void;
  onNavigateHistory: (direction: "up" | "down") => void;
  commandHistory: string[];
  historyIndex: number;
  disabled?: boolean;
}

export function CommandInput({
  onSendCommand,
  onNavigateHistory,
  commandHistory,
  historyIndex,
  disabled = false,
}: CommandInputProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (historyIndex >= 0 && historyIndex < commandHistory.length) {
      requestAnimationFrame(() => {
        setInput(commandHistory[historyIndex]);
      });
    } else if (historyIndex === -1) {
      requestAnimationFrame(() => {
        setInput("");
      });
    }
  }, [historyIndex, commandHistory]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (input.trim() && !disabled) {
        onSendCommand(input);
        setInput("");
      }
    },
    [input, disabled, onSendCommand]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        onNavigateHistory("up");
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        onNavigateHistory("down");
      }
    },
    [onNavigateHistory]
  );

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-900/50 rounded-lg">
      <span className="text-green-600 dark:text-green-400 font-mono text-sm">{">"}</span>
      <Input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Enter command..."
        disabled={disabled}
        className="flex-1 font-mono text-sm bg-white dark:bg-gray-800/50 border-gray-300 dark:border-gray-700 focus:border-green-500 focus:ring-green-500 text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
      />
      <Button
        type="submit"
        disabled={disabled || !input.trim()}
        variant="ghost"
        size="icon"
        className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:bg-green-500/10 dark:hover:bg-green-400/10 disabled:opacity-50"
      >
        <Send className="w-4 h-4" />
      </Button>
      <div className="flex items-center gap-1 ml-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled || historyIndex >= commandHistory.length - 1}
          onClick={() => onNavigateHistory("up")}
          className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 h-6 w-6"
        >
          <ArrowUp className="w-3 h-3" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled || historyIndex < 0}
          onClick={() => onNavigateHistory("down")}
          className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 h-6 w-6"
        >
          <ArrowDown className="w-3 h-3" />
        </Button>
      </div>
    </form>
  );
}
