import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createRouter, RouterProvider } from "@tanstack/react-router"
import ReactDOM from "react-dom/client"
import "../globals.css"
import { FetchError } from "./api/client"
import { DefaultCatchBoundary } from "./components/error-boundary"
import { NotFound } from "./components/not-found"
import { routeTree } from "./routeTree.gen"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: FetchError) => {
        if (error?.status === 401) {
          // The server rejected the session (expired, or ended by a password
          // reset). Drop the stored token first: otherwise the login page
          // still thinks we're logged in and bounces straight back here.
          localStorage.removeItem("token")
          window.location.href = "/login"
          return false
        }
        // Not found / not allowed won't change on retry.
        if (error?.status === 403 || error?.status === 404) {
          return false
        }
        return failureCount < 3
      },
    },
  },
})

const router = createRouter({
  context: { queryClient },
  routeTree,
  defaultPreload: "intent",
  defaultErrorComponent: DefaultCatchBoundary,
  defaultNotFoundComponent: () => <NotFound />,
  scrollRestoration: true,
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById("app")!

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
