import { RouterProvider } from "react-router-dom"
import { createAppRouter } from "./lib/router"
import { ThemeProvider } from "./context/ThemeContext"
import { NotificationProvider } from "./context/NotificationContext"

function App() {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <RouterProvider router={createAppRouter()} />
      </NotificationProvider>
    </ThemeProvider>
  )
}

export default App
