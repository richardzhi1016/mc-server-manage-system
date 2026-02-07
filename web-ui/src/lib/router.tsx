import { createBrowserRouter } from "react-router-dom"
import { lazy, Suspense } from "react"
import { Layout } from "@/components/layout/Layout"
import NotFound from "@/pages/NotFound"
import { LoadingFallback } from "@/components/LoadingFallback"

const Dashboard = lazy(() => import("@/pages/Dashboard"))
const ServerLobby = lazy(() => import("@/pages/ServerLobby"))
const ServerCreate = lazy(() => import("@/pages/ServerCreate"))
const Console = lazy(() => import("@/pages/Console"))
const Players = lazy(() => import("@/pages/Players"))
const FileManager = lazy(() => import("@/pages/FileManager"))
const Settings = lazy(() => import("@/pages/Settings"))

export const appRouter = createBrowserRouter([
    {
      path: "/",
      element: (
        <Suspense fallback={<LoadingFallback />}>
          <ServerLobby />
        </Suspense>
      ),
    },
    {
      path: "/servers",
      element: (
        <Suspense fallback={<LoadingFallback />}>
          <ServerLobby />
        </Suspense>
      ),
    },
    {
      path: "/create",
      element: (
        <Suspense fallback={<LoadingFallback />}>
          <ServerCreate />
        </Suspense>
      ),
    },
    {
      path: "/panel",
      element: (
        <Suspense fallback={<LoadingFallback />}>
          <Layout />
        </Suspense>
      ),
      children: [
        {
          index: true,
          element: (
            <Suspense fallback={<LoadingFallback />}>
              <Dashboard />
            </Suspense>
          ),
        },
        {
          path: "console/:serverName",
          element: (
            <Suspense fallback={<LoadingFallback />}>
              <Console />
            </Suspense>
          ),
        },
        {
          path: "players",
          element: (
            <Suspense fallback={<LoadingFallback />}>
              <Players />
            </Suspense>
          ),
        },
        {
          path: "files/:serverName",
          element: (
            <Suspense fallback={<LoadingFallback />}>
              <FileManager />
            </Suspense>
          ),
        },
        {
          path: "settings",
          element: (
            <Suspense fallback={<LoadingFallback />}>
              <Settings />
            </Suspense>
          ),
        },
      ],
    },
    {
      path: "*",
      element: <NotFound />,
    },
])
