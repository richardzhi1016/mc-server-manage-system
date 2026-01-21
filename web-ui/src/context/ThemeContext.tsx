import { createContext, useEffect, useState, type ReactNode } from "react"

type Theme = "light" | "dark"

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

function useThemeInner() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light"
    const saved = localStorage.getItem("theme") as Theme | null
    if (saved) return saved
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark"
    return "light"
  })

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove("light", "dark")
    root.classList.add(theme)
    localStorage.setItem("theme", theme)
  }, [theme])

  useEffect(() => {
    if (typeof window === "undefined") return
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem("theme")) {
        setThemeState(e.matches ? "dark" : "light")
      }
    }
    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [])

  const toggleTheme = () => {
    setThemeState((prev) => (prev === "light" ? "dark" : "light"))
  }

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
  }

  return { theme, toggleTheme, setTheme }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const value = useThemeInner()

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
