// routes/__root.tsx
import { type QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
  createRootRouteWithContext,
  HeadContent,
  Link,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { DefaultCatchBoundary } from "@/components/error-boundary";
import { NotFound } from "@/components/not-found";
import * as React from "react";
import { useAuth } from "@/hooks/auth";
import { HandCoinsIcon, LogOut, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CreatePoolModal } from "@/components/create-pool-modal";
import { apiClient } from "@/api/client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

function InnerApp() {
  const { isAuthenticated, memberId, logout, createAuthHeader } = useAuth();

  const [isCreatePoolOpen, setIsCreatePoolOpen] = React.useState(false);
  const { data: member } = apiClient.useQuery(
    "get",
    "/api/members/{member_id}",
    {
      params: { path: { member_id: memberId || "" } },
      headers: createAuthHeader(),
    },
    {
      enabled: !!memberId,
    },
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
          {isAuthenticated ? (
            <>
              <Link to="/">
                <Button variant="ghost" className="w-full justify-start py-1">
                  Dashboard
                </Button>
              </Link>
              <Accordion type="single" collapsible className="pl-4">
                <AccordionItem value="item-1">
                  <AccordionTrigger className="py-2 hover:cursor-pointer">
                    Account Details
                  </AccordionTrigger>
                  <AccordionContent className="flex flex-col gap-y-0">
                    <p className="pl-2 py-1">{email}</p>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        logout();
                      }}
                      className="w-full justify-start py-0 pl-2"
                    >
                      Log Out
                      <LogOut className="size-4" />
                    </Button>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>{" "}
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
          ) : (
            <Link to="/login">
              <Button
                variant="ghost"
                className="w-full justify-start py-0 pl-2"
              >
                Log In
                <LogOut className="size-4" />
              </Button>
            </Link>
          )}
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
