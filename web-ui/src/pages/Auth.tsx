import React, { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { PasswordInput } from "@/components/PasswordInput"

type AuthMode = "login" | "signup" | "forgot"

function calculatePasswordStrength(password: string): { level: string; score: number; color: string } {
  let score = 0
  if (password.length >= 8) score += 1
  if (password.length >= 12) score += 1
  if (/[A-Z]/.test(password)) score += 1
  if (/[a-z]/.test(password)) score += 1
  if (/[0-9]/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1

  if (score <= 2) return { level: "Weak", score: 25, color: "bg-red-500" }
  if (score <= 3) return { level: "Fair", score: 50, color: "bg-yellow-500" }
  if (score <= 4) return { level: "Good", score: 75, color: "bg-green-500" }
  return { level: "Strong", score: 100, color: "bg-blue-500" }
}

export function AuthPage() {
  const [mode, setMode] = useState<AuthMode>("login")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState("")
  const [contactInfo, setContactInfo] = useState("")

  const { login, register, requestPasswordReset } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/panel"

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const modeParam = params.get("mode") as AuthMode
    if (modeParam === "login" || modeParam === "signup" || modeParam === "forgot") {
      setMode(modeParam)
    }
  }, [location.search])

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      await login(loginData.username, loginData.password, loginData.rememberMe)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      await register(
        signupData.username,
        signupData.password,
        signupData.confirmPassword,
        signupData.rememberMe
      )
      setSuccessMessage("Registration successful! Redirecting...")
      setTimeout(() => {
        navigate(from, { replace: true })
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed")
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const data = await requestPasswordReset(forgotData.username)
      setSuccessMessage(data.message)
      setContactInfo(data.contact_info || "admin@example.com")
      setForgotData({ ...forgotData, submitted: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password reset request failed")
    } finally {
      setLoading(false)
    }
  }

  const [loginData, setLoginData] = useState({
    username: "",
    password: "",
    rememberMe: false,
  })

  const [signupData, setSignupData] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    rememberMe: false,
  })

  const [forgotData, setForgotData] = useState({
    username: "",
    submitted: false,
  })

  const passwordStrength = calculatePasswordStrength(signupData.password)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="max-w-md w-full space-y-8 p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            {mode === "login" ? "Sign in to your account" : mode === "signup" ? "Create an account" : "Reset Password"}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Minecraft Server Management System
          </p>
        </div>

        <div className="flex space-x-4 mb-6">
          <button
            onClick={() => {
              setMode("login")
              setError("")
              setSuccessMessage("")
            }}
            className={`flex-1 py-2 px-4 text-center rounded-md font-medium cursor-pointer transition-colors ${
              mode === "login"
                ? "bg-indigo-600 text-white"
                : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            Sign in
          </button>
          <button
            onClick={() => {
              setMode("signup")
              setError("")
              setSuccessMessage("")
            }}
            className={`flex-1 py-2 px-4 text-center rounded-md font-medium cursor-pointer transition-colors ${
              mode === "signup"
                ? "bg-indigo-600 text-white"
                : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            Sign up
          </button>
        </div>

        {error && (
          <div className="rounded-md bg-red-100 dark:bg-red-900 p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                  {error}
                </h3>
              </div>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="rounded-md bg-green-100 dark:bg-green-900 p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800 dark:text-green-200">
                  {successMessage}
                  {contactInfo && (
                    <span className="block mt-1 text-xs">
                      Contact: {contactInfo}
                    </span>
                  )}
                </h3>
              </div>
            </div>
          </div>
        )}

        {mode === "login" && (
          <form className="mt-8 space-y-6" onSubmit={handleLoginSubmit}>
            <div>
              <label htmlFor="login-username" className="sr-only">
                Username
              </label>
              <input
                id="login-username"
                name="username"
                type="text"
                required
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white dark:bg-gray-700 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Username"
                value={loginData.username}
                onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                disabled={loading}
              />
            </div>

            <PasswordInput
              id="login-password"
              label="Password"
              placeholder="Password"
              value={loginData.password}
              onChange={(value) => setLoginData({ ...loginData, password: value })}
              showForgotPassword
              onForgotPasswordClick={() => setMode("forgot")}
              disabled={loading}
            />

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  type="checkbox"
                  checked={loginData.rememberMe}
                  onChange={(e) => setLoginData({ ...loginData, rememberMe: e.target.checked })}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900 dark:text-gray-300 cursor-pointer">
                  Remember me
                </label>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setMode("signup")}
                className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 cursor-pointer"
              >
                Don't have an account? Sign up
              </button>
            </div>
          </form>
        )}

        {mode === "signup" && (
          <form className="mt-8 space-y-6" onSubmit={handleSignupSubmit}>
            <div>
              <label htmlFor="signup-username" className="sr-only">
                Username
              </label>
              <input
                id="signup-username"
                name="username"
                type="text"
                required
                pattern="[a-zA-Z0-9_]{3,20}"
                className={`appearance-none rounded-md relative block w-full px-3 py-2 border ${
                  signupData.username &&
                  !/^[a-zA-Z0-9_]{3,20}$/.test(signupData.username)
                    ? "border-red-300"
                    : "border-gray-300 dark:border-gray-600"
                } placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white dark:bg-gray-700 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
                placeholder="Username (3-20 characters, alphanumeric + _)"
                value={signupData.username}
                onChange={(e) => setSignupData({ ...signupData, username: e.target.value })}
                disabled={loading}
              />
              {signupData.username && !/^[a-zA-Z0-9_]{3,20}$/.test(signupData.username) && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  Username must be 3-20 characters and contain only letters, numbers, and underscores
                </p>
              )}
            </div>

            <div>
              <PasswordInput
                id="signup-password"
                label="Password"
                placeholder="Password"
                value={signupData.password}
                onChange={(value) => setSignupData({ ...signupData, password: value })}
                disabled={loading}
              />
              {signupData.password && (
                <div className="mt-2">
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${passwordStrength.color}`}
                        style={{ width: `${passwordStrength.score}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {passwordStrength.level}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div>
              <PasswordInput
                id="signup-confirm-password"
                label="Confirm Password"
                placeholder="Confirm Password"
                value={signupData.confirmPassword}
                onChange={(value) => setSignupData({ ...signupData, confirmPassword: value })}
                error={
                  signupData.confirmPassword &&
                  signupData.password !== signupData.confirmPassword
                    ? "Passwords do not match"
                    : ""
                }
                disabled={loading}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="signup-remember-me"
                  type="checkbox"
                  checked={signupData.rememberMe}
                  onChange={(e) => setSignupData({ ...signupData, rememberMe: e.target.checked })}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                />
                <label htmlFor="signup-remember-me" className="ml-2 block text-sm text-gray-900 dark:text-gray-300 cursor-pointer">
                  Remember me
                </label>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading || signupData.password !== signupData.confirmPassword || !/^[a-zA-Z0-9_]{3,20}$/.test(signupData.username)}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? "Creating account..." : "Sign up"}
              </button>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setMode("login")}
                className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 cursor-pointer"
              >
                Already have an account? Sign in
              </button>
            </div>
          </form>
        )}

        {mode === "forgot" && (
          <form className="mt-8 space-y-6" onSubmit={handleForgotPasswordSubmit}>
            {!forgotData.submitted ? (
              <>
                <div>
                  <label htmlFor="forgot-username" className="sr-only">
                    Username
                  </label>
                  <input
                    id="forgot-username"
                    name="username"
                    type="text"
                    required
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white dark:bg-gray-700 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Username"
                    value={forgotData.username}
                    onChange={(e) => setForgotData({ ...forgotData, username: e.target.value })}
                    disabled={loading}
                  />
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {loading ? "Sending..." : "Request Password Reset"}
                  </button>
                </div>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 cursor-pointer"
                  >
                    Back to Sign in
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center space-y-4">
                <svg
                  className="mx-auto h-12 w-12 text-green-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <p className="text-gray-700 dark:text-gray-300">
                  Your password reset request has been received.
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Please contact an administrator to reset your password.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setMode("login")
                    setForgotData({ username: "", submitted: false })
                  }}
                  className="mt-4 text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 cursor-pointer"
                >
                  Back to Sign in
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
