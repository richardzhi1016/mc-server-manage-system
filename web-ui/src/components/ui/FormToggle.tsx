import { forwardRef, type ButtonHTMLAttributes } from "react"
import { cn } from "@/lib/utils"

interface FormToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  label?: string
  checked: boolean
  onChange?: (checked: boolean) => void
}

export const FormToggle = forwardRef<HTMLButtonElement, FormToggleProps>(
  ({ label, checked, onChange, className = "", disabled, ...props }, ref) => {
    return (
      <div className="flex items-center justify-between">
        {label && (
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </span>
        )}
        <button
          ref={ref}
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={disabled}
          onClick={() => onChange?.(!checked)}
          className={cn(
            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
            checked ? "bg-indigo-600" : "bg-gray-200 dark:bg-gray-700",
            disabled && "opacity-50 cursor-not-allowed",
            className
          )}
          {...props}
        >
          <span
            className={cn(
              "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
              checked ? "translate-x-6" : "translate-x-1"
            )}
          />
        </button>
      </div>
    )
  }
)

FormToggle.displayName = "FormToggle"
