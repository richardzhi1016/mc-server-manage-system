import React, { useState } from "react"

interface PasswordInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  error?: string
  showForgotPassword?: boolean
  onForgotPasswordClick?: () => void
  id?: string
  label?: string
  disabled?: boolean
}

export function PasswordInput({
  value,
  onChange,
  placeholder = "Password",
  error,
  showForgotPassword = false,
  onForgotPasswordClick,
  id,
  label,
  disabled = false,
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="relative">
      {label && (
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
      )}
      <div className="relative rounded-md shadow-sm">
        <input
          id={id}
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`block w-full px-3 py-2 border pr-10 ${
            error
              ? "border-red-300 dark:border-red-600 text-red-900 dark:text-red-200 placeholder-red-300 dark:placeholder-red-500 focus:outline-none focus:ring-red-500 focus:border-red-500"
              : "border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          } rounded-md dark:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed`}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer"
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? (
            <svg
              className="h-5 w-5 text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29M7.535 7.535l3.29 3.29"
              />
            </svg>
          ) : (
            <svg
              className="h-5 w-5 text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7"
              />
            </svg>
          )}
        </button>
      </div>
      {showForgotPassword && onForgotPasswordClick && (
        <div className="mt-1">
          <button
            type="button"
            onClick={onForgotPasswordClick}
            className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 cursor-pointer"
          >
            Forgot password?
          </button>
        </div>
      )}
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
