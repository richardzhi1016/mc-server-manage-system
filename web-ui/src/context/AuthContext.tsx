import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

export interface User {
  id: string
  username: string
  role: "admin" | "user"
  created_at?: string
}

interface AuthContextType {
  isAuthenticated: boolean
  user: User | null
  token: string | null
  loading: boolean
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>
  logout: () => void
  restoreSession: () => Promise<void>
  register: (username: string, password: string, confirm_password: string, rememberMe?: boolean) => Promise<void>
  requestPasswordReset: (username: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const TOKEN_KEY = "mc_auth_token"
const USER_KEY = "mc_auth_user"

const getStorage = (rememberMe: boolean = false) => {
  return rememberMe ? localStorage : sessionStorage
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)

  const restoreSession = async () => {
    if (initialized) return

    const localToken = localStorage.getItem(TOKEN_KEY)
    const localUser = localStorage.getItem(USER_KEY)
    const sessionToken = sessionStorage.getItem(TOKEN_KEY)
    const sessionUser = sessionStorage.getItem(USER_KEY)

    if (localToken && localUser) {
      try {
        const userData = JSON.parse(localUser)
        setUser(userData)
        setToken(localToken)
        setIsAuthenticated(true)
        setLoading(false)
        setInitialized(true)
        return
      } catch {
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
      }
    }

    if (sessionToken && sessionUser) {
      try {
        const userData = JSON.parse(sessionUser)
        setUser(userData)
        setToken(sessionToken)
        setIsAuthenticated(true)
      } catch {
        sessionStorage.removeItem(TOKEN_KEY)
        sessionStorage.removeItem(USER_KEY)
      }
    }

    setLoading(false)
    setInitialized(true)
  }

  useEffect(() => {
    restoreSession()
  }, [])

  const login = async (username: string, password: string, rememberMe: boolean = false) => {
    let response
    try {
      response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      })
    } catch (e) {
      console.error("Network error during login:", e)
      throw new Error("Network error. Please check if the server is running.")
    }

    if (!response.ok) {
      try {
        const error = await response.json()
        console.error("Login failed:", error)
        throw new Error(error.error || "Login failed")
      } catch (e) {
        if (e instanceof Error) throw e
        throw new Error("Login failed")
      }
    }

    const data = await response.json()
    const { token: newToken, user: userData } = data
    console.log("Login successful:", data)

    const storageToUse = getStorage(rememberMe)
    storageToUse.setItem(TOKEN_KEY, newToken)
    storageToUse.setItem(USER_KEY, JSON.stringify(userData))

    setToken(newToken)
    setUser(userData)
    setIsAuthenticated(true)
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
    setIsAuthenticated(false)
  }

  const register = async (
    username: string,
    password: string,
    confirm_password: string,
    rememberMe: boolean = false
  ) => {
    let response
    try {
      response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password, confirm_password }),
      })
    } catch (e) {
      console.error("Network error during registration:", e)
      throw new Error("Network error. Please check if the server is running.")
    }

    if (!response.ok) {
      try {
        const error = await response.json()
        console.error("Registration error:", error)
        throw new Error(error.error || "Registration failed")
      } catch (e) {
        if (e instanceof Error) throw e
        throw new Error("Registration failed")
      }
    }

    const data = await response.json()
    console.log("Registration successful:", data)

    await login(username, password, rememberMe)
  }

  const requestPasswordReset = async (username: string) => {
    const response = await fetch("/api/auth/request-password-reset", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Password reset request failed")
    }

    const data = await response.json()
    return data
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        token,
        loading,
        login,
        logout,
        restoreSession,
        register,
        requestPasswordReset,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
