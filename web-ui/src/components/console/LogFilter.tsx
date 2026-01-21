import type { LogLevel } from "../../types/console";
import { Button } from "../ui/Button";
import { clsx } from "clsx";

interface LogFilterProps {
  selectedLevels: LogLevel[];
  onLevelChange: (levels: LogLevel[]) => void;
}

const LEVELS: { value: LogLevel; label: string; color: string }[] = [
  { value: "INFO", label: "INFO", color: "text-gray-300" },
  { value: "WARN", label: "WARN", color: "text-yellow-400" },
  { value: "ERROR", label: "ERROR", color: "text-red-400" },
  { value: "DEBUG", label: "DEBUG", color: "text-gray-500" },
];

export function LogFilter({ selectedLevels, onLevelChange }: LogFilterProps) {
  const handleLevelToggle = (level: LogLevel) => {
    if (level === "ALL") {
      onLevelChange(["ALL"]);
      return;
    }

    let newLevels: LogLevel[] = selectedLevels.filter((l) => l !== "ALL");
    if (newLevels.includes(level)) {
      newLevels = newLevels.filter((l) => l !== level);
    } else {
      newLevels = [...newLevels, level];
    }

    if (newLevels.length === 0) {
      newLevels = ["ALL"] as LogLevel[];
    }
    onLevelChange(newLevels);
  };

  const isSelected = (level: LogLevel) => {
    if (level === "ALL") {
      return selectedLevels.includes("ALL") || selectedLevels.length === 0;
    }
    return selectedLevels.includes(level);
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-gray-900/50 rounded-lg">
      <span className="text-sm text-gray-400 mr-2">Filter:</span>
      {LEVELS.map((level) => (
        <Button
          key={level.value}
          variant={isSelected(level.value) ? "default" : "ghost"}
          size="sm"
          onClick={() => handleLevelToggle(level.value)}
          className={clsx(
            "px-2 py-1 text-xs font-mono transition-colors",
            isSelected(level.value) && level.color,
            !isSelected(level.value) && "text-gray-500 hover:text-gray-300"
          )}
        >
          {level.label}
        </Button>
      ))}
    </div>
  );
}
