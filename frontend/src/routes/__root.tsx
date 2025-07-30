// routes/__root.tsx
import { DefaultCatchBoundary } from "@/components/error-boundary"
import { NotFound } from "@/components/not-found"
import { AuthProvider } from "@/hooks/use-auth"
import { type QueryClient } from "@tanstack/react-query"
import {
  createRootRouteWithContext,
  Outlet,
  Scripts,
} from "@tanstack/react-router"
import * as React from "react"

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
  }),
  errorComponent: props => {
    return (
      <RootDocument>
        <DefaultCatchBoundary {...props} />
      </RootDocument>
    )
  },
  notFoundComponent: () => <NotFound />,
  component: () => {
    return (
      <RootDocument>
        <main>
          <Outlet />
        </main>
      </RootDocument>
    )
  },
})

function RootDocument(props: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <AuthProvider>
        {props.children}
        {/* <ReactQueryDevtools buttonPosition="bottom-left" /> */}
        <Scripts />
      </AuthProvider>
    </>
  )
}
