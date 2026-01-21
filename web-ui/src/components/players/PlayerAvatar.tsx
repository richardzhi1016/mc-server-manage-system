import { useState } from "react"
import { cn } from "@/lib/utils"

interface PlayerAvatarProps {
  uuid: string
  username: string
  size?: "sm" | "md" | "lg"
  className?: string
}

export function PlayerAvatar({ uuid, username, size = "md", className }: PlayerAvatarProps) {
  const [imageError, setImageError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-12 h-12 text-sm",
    lg: "w-16 h-16 text-base",
  }

  const avatarUrl = `https://cravatar.com/avatar/${uuid}`

  const fallbackLetter = username.charAt(0).toUpperCase()

  if (imageError || !uuid) {
    return (
      <div
        className={cn(
          "rounded-full bg-gray-400 flex items-center justify-center font-semibold text-white",
          sizeClasses[size],
          className
        )}
      >
        {fallbackLetter}
      </div>
    )
  }

  return (
    <div className={cn("relative rounded-full overflow-hidden bg-gray-200", sizeClasses[size], className)}>
      {!imageLoaded && (
        <div
          className={cn(
            "absolute inset-0 rounded-full bg-gray-400 flex items-center justify-center font-semibold text-white animate-pulse",
            sizeClasses[size]
          )}
        >
          {fallbackLetter}
        </div>
      )}
      <img
        src={avatarUrl}
        alt={`${username}'s avatar`}
        className={cn(
          "w-full h-full object-cover",
          imageLoaded ? "opacity-100" : "opacity-0",
          "transition-opacity duration-200"
        )}
        onLoad={() => setImageLoaded(true)}
        onError={() => setImageError(true)}
      />
    </div>
  )
}
