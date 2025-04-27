// routes/__root.tsx
import { useQuery, type QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
  createRootRouteWithContext,
  HeadContent,
  Link,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import appCss from "../app.css?url";
import { DefaultCatchBoundary } from "../components/DefaultCatchBoundary";
import { NotFound } from "../components/NotFound";
import * as React from "react";
import { useAuth } from "../hooks/auth";
import { HandCoinsIcon, LogOut, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CreatePoolModal } from "@/components/create-pool-modal";
import { $api } from "src/api";

function InnerApp() {
  const { isAuthenticated, id, logout } = useAuth();
  const [isCreatePoolOpen, setIsCreatePoolOpen] = React.useState(false);
  const { data: member } = $api.useQuery(
    "get",
    "/api/members/{member_id}",
    {
      params: { path: { member_id: id || "" } },
    },
    {
      enabled: !!id,
    }
  );

  const email = member?.email;

  return (
    <div className="flex min-h-screen">
      <CreatePoolModal
        isOpen={isCreatePoolOpen}
        setIsOpen={setIsCreatePoolOpen}
      />
      <aside
        className="w-64 bg-gray-100 border-r p-4 flex flex-col justify-start items-start"
        style={{ "--sidebar-width": "16rem" } as React.CSSProperties}
      >
        <h2 className="text-lg font-semibold mb-4 flex flex-row gap-x-2 items-center">
          <HandCoinsIcon className="size-6 text-green-800" />
          Medici
        </h2>
        <div className="text-sm text-gray-700 flex flex-col w-full">
          <Link to="/">
            <Button variant="ghost" className="w-full justify-start py-1">
              Dashboard
            </Button>
          </Link>
          <Link to="/friends">
            <Button variant="ghost" className="w-full justify-start py-1">
              Friends
            </Button>
          </Link>
          {isAuthenticated && (
            <>
              <Separator className="my-2" />
              <Button
                variant="ghost"
                onClick={async () => {
                  setIsCreatePoolOpen(true);
                }}
                className="w-full justify-start py-1"
              >
                <PlusCircle className="size-4" /> Create a pool
              </Button>
            </>
          )}
          {isAuthenticated && (
            <Button
              variant="ghost"
              onClick={() => {
                logout();
              }}
              className="w-full justify-start py-1"
            >
              <LogOut className="size-4" /> Log Out
            </Button>
          )}
          <p className="pl-4 pt-4">{email}</p>
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
      <RootDocument>
        <InnerApp />
      </RootDocument>
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
