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
const Backups = lazy(() => import("@/pages/Backups"))
const Settings = lazy(() => import("@/pages/Settings"))
const Mods = lazy(() => import("@/pages/Mods"))
const Plugins = lazy(() => import("@/pages/Plugins"))
const Alerts = lazy(() => import("@/pages/Alerts"))
const Analytics = lazy(() => import("@/pages/Analytics"))
const PublicStatus = lazy(() => import("@/pages/PublicStatus"))

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
      path: "/:serverName/panel",
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
          path: "console",
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
          path: "files",
          element: (
            <Suspense fallback={<LoadingFallback />}>
              <FileManager />
            </Suspense>
          ),
        },
        {
          path: "backups",
          element: (
            <Suspense fallback={<LoadingFallback />}>
              <Backups />
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
        {
          path: "mods",
          element: (
            <Suspense fallback={<LoadingFallback />}>
              <Mods />
            </Suspense>
          ),
        },
        {
          path: "plugins",
          element: (
            <Suspense fallback={<LoadingFallback />}>
              <Plugins />
            </Suspense>
          ),
        },
        {
          path: "alerts",
          element: (
            <Suspense fallback={<LoadingFallback />}>
              <Alerts />
            </Suspense>
          ),
        },
        {
          path: "analytics",
          element: (
            <Suspense fallback={<LoadingFallback />}>
              <Analytics />
            </Suspense>
          ),
        },
      ],
    },
    {
      path: "/public/:token",
      element: (
        <Suspense fallback={<LoadingFallback />}>
          <PublicStatus />
        </Suspense>
      ),
    },
    {
      path: "*",
      element: <NotFound />,
    },
])
