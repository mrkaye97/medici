import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createRouter, RouterProvider } from "@tanstack/react-router"
import ReactDOM from "react-dom/client"
import "../globals.css"
import { FetchError } from "./api/client"
import { DefaultCatchBoundary } from "./components/error-boundary"
import { NotFound } from "./components/not-found"
import { routeTree } from "./routeTree.gen"

const basePath = import.meta.env.VITE_BASE_PATH || "/"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: FetchError) => {
        if (error?.status === 401 || error?.status === 403) {
          window.location.href = `${basePath}/login`
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
  basepath: basePath,
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
