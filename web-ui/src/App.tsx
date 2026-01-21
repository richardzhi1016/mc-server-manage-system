import { RouterProvider } from "react-router-dom"
import { createAppRouter } from "./lib/router"
import { ThemeProvider } from "./context/ThemeContext"
import { NotificationProvider } from "./context/NotificationContext"
import { AuthProvider } from "./context/AuthContext"

function App() {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <AuthProvider>
          <RouterProvider router={createAppRouter()} />
        </AuthProvider>
      </NotificationProvider>
    </ThemeProvider>
  )
}

export default App
