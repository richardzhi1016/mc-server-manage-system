import { RouterProvider } from "react-router-dom"
import { appRouter } from "./lib/router"
import { ThemeProvider } from "./context/ThemeContext"
import { NotificationProvider } from "./context/NotificationContext"

function App() {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <RouterProvider router={appRouter} />
      </NotificationProvider>
    </ThemeProvider>
  )
}

export default App
