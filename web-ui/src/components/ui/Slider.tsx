import { forwardRef, type InputHTMLAttributes } from "react"
import { cn } from "@/lib/utils"

interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string
  min?: number
  max?: number
  step?: number
  unit?: string
  showValue?: boolean
}

export const Slider = forwardRef<HTMLInputElement, SliderProps>(
  ({ label, min = 0, max = 100, step = 1, unit = "", showValue = true, className = "", value, ...props }, ref) => {
    const displayValue = value !== undefined ? `${value}${unit}` : ""

    return (
      <div className="space-y-2">
        {(label || showValue) && (
          <div className="flex items-center justify-between">
            {label && (
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {label}
              </label>
            )}
            {showValue && value !== undefined && (
              <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                {displayValue}
              </span>
            )}
          </div>
        )}
        <div className="relative">
          <input
            ref={ref}
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            className={cn(
              "w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer",
              "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
              className
            )}
            {...props}
          />
        </div>
      </div>
    )
  }
)

Slider.displayName = "Slider"
