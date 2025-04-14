// routes/__root.tsx
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
  createRootRouteWithContext,
  HeadContent,
  Link,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { TRPCOptionsProxy } from "@trpc/tanstack-react-query";
import appCss from "../app.css?url";
import { DefaultCatchBoundary } from "../components/DefaultCatchBoundary";
import { NotFound } from "../components/NotFound";
import { TRPCRouter } from "../../trpc/router";
import * as React from "react";
import { AuthContext, AuthProvider, useAuth } from "../hooks/auth";
import { HandCoinsIcon, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

function InnerApp() {
  const { login, logout, signup } = useAuth();

  return (
    <div className="flex min-h-screen">
      <aside
        className="w-64 bg-gray-100 border-r p-4 flex flex-col justify-between"
        style={{ "--sidebar-width": "16rem" } as React.CSSProperties}
      >
        <div>
          <h2 className="text-lg font-semibold mb-4 flex flex-row gap-x-2 items-center">
            <HandCoinsIcon className="size-6 text-green-800" />
            Medici
          </h2>
          <nav className="space-y-2 text-sm text-gray-700 flex flex-col">
            <Link to="/">Dashboard</Link>
            <Link to="/reports">Reports</Link>
          </nav>
        </div>
        <div className="w-full flex flex-col items-center">
          <Button
            onClick={() => {
              logout();
            }}
          >
            <LogOut className="size-4" /> Log Out
          </Button>
        </div>
      </aside>

      <main className="flex-1 relative">
        <Outlet />
      </main>
    </div>
  );
}

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  trpc: TRPCOptionsProxy<TRPCRouter>;
  auth: AuthContext;
}>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
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
      <AuthProvider>
        <RootDocument>
          <InnerApp />
        </RootDocument>
      </AuthProvider>
    );
  },
});

function RootDocument(props: Readonly<{ children: React.ReactNode }>) {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        <hr />
        {props.children}
        <TanStackRouterDevtools position="bottom-right" />
        <ReactQueryDevtools buttonPosition="bottom-left" />
        <Scripts />
      </body>
    </html>
  );
}
