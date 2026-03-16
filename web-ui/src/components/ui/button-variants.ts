import { cva } from "class-variance-authority"

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mrinth-green disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-mrinth-green text-mrinth-bg font-semibold shadow hover:bg-mrinth-green-h",
        destructive:
          "bg-red-500 text-white shadow-sm hover:bg-red-600",
        outline:
          "border border-gray-300 dark:border-mrinth-border bg-white dark:bg-transparent shadow-sm hover:bg-gray-50 dark:hover:bg-mrinth-high dark:text-mrinth-text",
        secondary:
          "bg-gray-100 dark:bg-mrinth-high text-gray-900 dark:text-mrinth-text shadow-sm hover:bg-gray-200 dark:hover:bg-mrinth-border",
        ghost:
          "hover:bg-gray-100 dark:hover:bg-mrinth-high hover:text-gray-900 dark:hover:text-mrinth-text dark:text-mrinth-muted",
        link:
          "text-mrinth-green underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-lg px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
