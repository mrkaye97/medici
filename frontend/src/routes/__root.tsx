// routes/__root.tsx
import { type QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
  createRootRouteWithContext,
  Link,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { DefaultCatchBoundary } from "@/components/error-boundary";
import { NotFound } from "@/components/not-found";
import * as React from "react";
import { HandCoinsIcon } from "lucide-react";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
  }),
  errorComponent: (props) => {
    return (
      <RootDocument>
        <DefaultCatchBoundary {...props} />
      </RootDocument>
    );
  },
  notFoundComponent: () => <NotFound />,
  component: () => {
    return (
      <RootDocument>
        <main className="flex-1 relative p-6">
          <div className="mb-4">
            <Link to="/" className="flex flex-row items-center gap-2">
              <HandCoinsIcon className="size-6 text-emerald-800" />
              <h1 className="text-2xl font-bold tracking-tight">Medici</h1>
            </Link>
          </div>
          <Outlet />
        </main>
      </RootDocument>
    );
  },
});

function RootDocument(props: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <>
        <hr />
        {props.children}
        <ReactQueryDevtools buttonPosition="bottom-left" />
        <Scripts />
      </>
    </>
  );
}
